import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { Card, Space, Button, Radio } from 'antd';
import {
  BarChartOutlined,
  AppstoreOutlined,
  UpOutlined,
  SortAscendingOutlined,
  SortDescendingOutlined,
  RadarChartOutlined,
} from '@ant-design/icons';
import type { DataSource } from '../features/types';
import { flattenDatasetResults, groupByCategory } from '../features/transform';
import { formatValue } from '../features/transform';
import { CompactDashboard } from './CompactDashboard';

interface CategoryDashboardProps {
  sources: DataSource[];
  scale0100: boolean;
}

interface CategoryStats {
  name: string;
  testCount: number;
  tests: Array<{
    testName: string;
    fullPath: string;
    dataset: string; // e.g., "mmlu", "tmmluplus"
    values: Map<string, { avg: number; min: number; max: number }>; // modelName -> accuracy stats
  }>;
  avgPerModel: Map<string, number>;
  minPerModel: Map<string, number>;
  maxPerModel: Map<string, number>;
  overallAvg: number;
  overallMin: number;
  overallMax: number;
  variance: number;
}

export const CategoryDashboard: React.FC<CategoryDashboardProps> = ({
  sources,
  scale0100,
}) => {
  const detailChartRef = useRef<HTMLDivElement>(null);

  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [highlightedModel, setHighlightedModel] = useState<string | null>(null);
  const [testSortMode, setTestSortMode] = useState<
    'accuracy' | 'benchmark' | 'name'
  >('accuracy');

  // Process data hierarchically by category
  const categoryStats = useMemo(() => {
    const categories = new Map<string, CategoryStats>();

    sources.forEach((source) => {
      const results = flattenDatasetResults(source.rawData);
      const grouped = groupByCategory(results);

      // Extract individual runs data from rawData
      const rawData = source.rawData as Record<string, unknown>;
      const datasetResults = (rawData?.dataset_results || {}) as Record<
        string,
        unknown
      >;

      for (const [categoryName, categoryResults] of Object.entries(grouped)) {
        if (!categories.has(categoryName)) {
          categories.set(categoryName, {
            name: categoryName,
            testCount: 0,
            tests: [],
            avgPerModel: new Map(),
            minPerModel: new Map(),
            maxPerModel: new Map(),
            overallAvg: 0,
            overallMin: 1,
            overallMax: 0,
            variance: 0,
          });
        }

        const catData = categories.get(categoryName)!;

        // Process each test result
        categoryResults.forEach((result) => {
          // Use testName as the key to group same tests across different models
          const testName = result.category.split('/').pop() || result.category;
          // Extract dataset name from the full path (e.g., "mmlu/test" -> "mmlu")
          const datasetName = result.category.split('/')[0] || 'unknown';

          let testEntry = catData.tests.find((t) => t.testName === testName);
          if (!testEntry) {
            testEntry = {
              testName: testName,
              fullPath: result.category,
              dataset: datasetName,
              values: new Map(),
            };
            catData.tests.push(testEntry);
          }

          // Extract min/max from individual runs if available
          let min = result.accuracy_mean;
          let max = result.accuracy_mean;

          // Try to find the individual runs data - match by exact file path
          for (const [, datasetValue] of Object.entries(datasetResults)) {
            const dataset = datasetValue as Record<string, unknown>;
            if (dataset?.results && Array.isArray(dataset.results)) {
              const testResult = dataset.results.find(
                (r: Record<string, unknown>) => {
                  const file = r.file as string | undefined;
                  // Match by exact file path to avoid cross-contamination
                  return file === result.file;
                },
              ) as Record<string, unknown> | undefined;

              if (testResult?.individual_runs) {
                const individualRuns = testResult.individual_runs as Record<
                  string,
                  unknown
                >;
                const accuracies = individualRuns.accuracies as
                  | number[]
                  | undefined;
                if (
                  accuracies &&
                  Array.isArray(accuracies) &&
                  accuracies.length > 0
                ) {
                  min = Math.min(...accuracies);
                  max = Math.max(...accuracies);
                  break; // Found the right test, stop searching
                }
              }
            }
          }

          testEntry.values.set(source.modelName, {
            avg: result.accuracy_mean,
            min,
            max,
          });
        });
      }
    });

    // Calculate statistics for each category
    categories.forEach((catData) => {
      catData.testCount = catData.tests.length;

      sources.forEach((source) => {
        const accuracies: number[] = [];
        catData.tests.forEach((test) => {
          const val = test.values.get(source.modelName);
          if (val !== undefined) accuracies.push(val.avg);
        });

        if (accuracies.length > 0) {
          const avg = d3.mean(accuracies)!;
          const min = d3.min(accuracies)!;
          const max = d3.max(accuracies)!;
          catData.avgPerModel.set(source.modelName, avg);
          catData.minPerModel.set(source.modelName, min);
          catData.maxPerModel.set(source.modelName, max);
        }
      });

      // Calculate overall stats across all models
      const allAvgs = Array.from(catData.avgPerModel.values());
      if (allAvgs.length > 0) {
        catData.overallAvg = d3.mean(allAvgs)!;
        catData.overallMin = d3.min(Array.from(catData.minPerModel.values()))!;
        catData.overallMax = d3.max(Array.from(catData.maxPerModel.values()))!;

        // Variance across models (shows how much models differ)
        const mean = catData.overallAvg;
        catData.variance =
          allAvgs.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
          allAvgs.length;
      }
    });

    // Return categories as array (no sorting needed for radar chart)
    return Array.from(categories.values());
  }, [sources]);

  const colorScale = useMemo(
    () =>
      d3
        .scaleOrdinal(d3.schemeCategory10)
        .domain(sources.map((s) => s.modelName)),
    [sources],
  );

  // Render Detailed Test Chart when category is expanded
  useEffect(() => {
    if (!detailChartRef.current || !expandedCategory) return;

    const container = detailChartRef.current;
    d3.select(container).selectAll('*').remove();

    const categoryInfo = categoryStats.find((c) => c.name === expandedCategory);
    if (!categoryInfo) return;

    // Create a color scale for datasets/benchmarks
    const uniqueDatasets = Array.from(
      new Set(categoryInfo.tests.map((t) => t.dataset)),
    );
    const datasetColorScale = d3
      .scaleOrdinal(d3.schemePaired)
      .domain(uniqueDatasets);

    // Sort tests
    const sortedTests = [...categoryInfo.tests].sort((a, b) => {
      if (testSortMode === 'accuracy') {
        const avgA =
          d3.mean(Array.from(a.values.values()).map((v) => v.avg)) || 0;
        const avgB =
          d3.mean(Array.from(b.values.values()).map((v) => v.avg)) || 0;
        return avgB - avgA; // Descending
      } else if (testSortMode === 'benchmark') {
        // Group by benchmark first, then by accuracy within each benchmark
        if (a.dataset !== b.dataset) {
          return a.dataset.localeCompare(b.dataset);
        }
        const avgA =
          d3.mean(Array.from(a.values.values()).map((v) => v.avg)) || 0;
        const avgB =
          d3.mean(Array.from(b.values.values()).map((v) => v.avg)) || 0;
        return avgB - avgA;
      } else {
        return a.testName.localeCompare(b.testName);
      }
    });

    const width = container.clientWidth;
    const margin = { top: 70, right: 160, bottom: 50, left: 300 };
    const testHeight = Math.max(50, 15 * sources.length); // Dynamic height based on number of models
    const height = Math.max(
      450,
      sortedTests.length * testHeight + margin.top + margin.bottom,
    );

    const svg = d3
      .select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height);

    // Title
    svg
      .append('text')
      .attr('x', width / 2)
      .attr('y', 25)
      .attr('text-anchor', 'middle')
      .style('font-size', '18px')
      .style('font-weight', 'bold')
      .text(`${expandedCategory} - Detailed Test Results`);

    svg
      .append('text')
      .attr('x', width / 2)
      .attr('y', 48)
      .attr('text-anchor', 'middle')
      .style('font-size', '12px')
      .style('fill', '#666')
      .text(
        `${categoryInfo.testCount} tests • Benchmarks shown with colored badges • Models side-by-side: Min (light), Avg (medium), Max (dark)`,
      );

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Scales - use testName as key since we group by testName across models
    const yScale = d3
      .scaleBand()
      .domain(sortedTests.map((t) => t.testName))
      .range([0, innerHeight])
      .padding(0.3);

    const xScale = d3.scaleLinear().domain([0, 1]).range([0, innerWidth]);

    // Create a sub-band scale for models within each test
    const modelScale = d3
      .scaleBand()
      .domain(sources.map((s) => s.modelName))
      .range([0, yScale.bandwidth()])
      .padding(0.1);

    // Y Axis - Test names with ranking and color-coded dataset badges
    sortedTests.forEach((test, idx) => {
      const rank = idx + 1;
      const datasetColor = datasetColorScale(test.dataset) as string;

      // Rank badge
      g.append('text')
        .attr('x', -margin.left + 10)
        .attr('y', (yScale(test.testName) || 0) + yScale.bandwidth() / 2)
        .attr('text-anchor', 'start')
        .attr('dominant-baseline', 'middle')
        .style('font-size', '10px')
        .style('font-weight', 'bold')
        .style('fill', rank <= 3 ? '#faad14' : '#bfbfbf')
        .text(`#${rank}`);

      // Color-coded dataset badge background
      const badgeY = (yScale(test.testName) || 0) + yScale.bandwidth() / 2;
      const datasetText =
        test.dataset.length > 10
          ? test.dataset.slice(0, 8) + '..'
          : test.dataset;

      g.append('rect')
        .attr('x', -margin.left + 40)
        .attr('y', badgeY - 8)
        .attr('width', datasetText.length * 6.5 + 8)
        .attr('height', 16)
        .attr('fill', datasetColor)
        .attr('opacity', 0.2)
        .attr('rx', 3)
        .style('cursor', 'help')
        .append('title')
        .text(`Benchmark: ${test.dataset}`);

      // Dataset badge text
      g.append('text')
        .attr('x', -margin.left + 44)
        .attr('y', badgeY)
        .attr('text-anchor', 'start')
        .attr('dominant-baseline', 'middle')
        .style('font-size', '9px')
        .style('font-weight', 'bold')
        .style('fill', datasetColor)
        .style('cursor', 'help')
        .text(datasetText)
        .append('title')
        .text(`Benchmark: ${test.dataset}`);

      // Test name
      g.append('text')
        .attr('x', -15)
        .attr('y', badgeY)
        .attr('text-anchor', 'end')
        .attr('dominant-baseline', 'middle')
        .style('font-size', '11px')
        .style('fill', '#262626')
        .text(
          test.testName.length > 42
            ? test.testName.slice(0, 40) + '...'
            : test.testName,
        )
        .append('title')
        .text(`${test.dataset}/${test.testName}`);
    });

    // Draw bars - models side-by-side, each showing min/avg/max
    const barGroupHeight = modelScale.bandwidth();
    const barHeight = barGroupHeight / 3; // 3 bars: min, avg, max

    sortedTests.forEach((test) => {
      const testY = yScale(test.testName) || 0;

      sources.forEach((source) => {
        const stats = test.values.get(source.modelName);
        if (!stats) return;

        const isHighlighted =
          !highlightedModel || highlightedModel === source.modelName;
        const modelY = testY + (modelScale(source.modelName) || 0);
        const color = colorScale(source.modelName) as string;

        // Color indicator bar (thin vertical bar on the left edge)
        g.append('rect')
          .attr('x', -3)
          .attr('y', modelY)
          .attr('width', 2)
          .attr('height', barGroupHeight * 0.9)
          .attr('fill', color)
          .attr('opacity', isHighlighted ? 0.8 : 0.3)
          .attr('rx', 1);

        // Min bar (top, lightest)
        g.append('rect')
          .attr('x', 0)
          .attr('y', modelY)
          .attr('width', xScale(stats.min))
          .attr('height', barHeight * 0.9)
          .attr('fill', color)
          .attr('opacity', isHighlighted ? 0.35 : 0.12)
          .attr('rx', 1)
          .style('cursor', 'pointer')
          .on('mouseenter', function () {
            setHighlightedModel(source.modelName);
          })
          .on('mouseleave', function () {
            setHighlightedModel(null);
          })
          .append('title')
          .text(
            `${source.modelName}\nMin: ${formatValue(stats.min, scale0100)}`,
          );

        // Avg bar (middle, medium opacity)
        g.append('rect')
          .attr('x', 0)
          .attr('y', modelY + barHeight)
          .attr('width', xScale(stats.avg))
          .attr('height', barHeight * 0.9)
          .attr('fill', color)
          .attr('opacity', isHighlighted ? 0.75 : 0.22)
          .attr('rx', 1)
          .style('cursor', 'pointer')
          .append('title')
          .text(
            `${source.modelName}\nAvg: ${formatValue(stats.avg, scale0100)}`,
          );

        // Max bar (bottom, darkest)
        g.append('rect')
          .attr('x', 0)
          .attr('y', modelY + 2 * barHeight)
          .attr('width', xScale(stats.max))
          .attr('height', barHeight * 0.9)
          .attr('fill', color)
          .attr('opacity', isHighlighted ? 1.0 : 0.32)
          .attr('rx', 1)
          .style('cursor', 'pointer')
          .on('mouseenter', function () {
            setHighlightedModel(source.modelName);
          })
          .on('mouseleave', function () {
            setHighlightedModel(null);
          })
          .append('title')
          .text(
            `${source.modelName}\nMax: ${formatValue(stats.max, scale0100)}`,
          );

        // Label for avg bar (only if space allows)
        if (isHighlighted && xScale(stats.avg) > 50) {
          g.append('text')
            .attr('x', xScale(stats.avg) - 3)
            .attr('y', modelY + barHeight + barHeight / 2)
            .attr('text-anchor', 'end')
            .attr('dominant-baseline', 'middle')
            .style('font-size', '7px')
            .style('font-weight', 'bold')
            .style('fill', 'white')
            .style('pointer-events', 'none')
            .text(formatValue(stats.avg, scale0100));
        }
      });
    });

    // X Axis
    const xAxis = d3
      .axisBottom(xScale)
      .ticks(10)
      .tickFormat((d) => formatValue(d as number, scale0100));

    g.append('g')
      .attr('transform', `translate(0, ${innerHeight})`)
      .call(xAxis)
      .style('font-size', '11px');

    // X Axis Label
    g.append('text')
      .attr('x', innerWidth / 2)
      .attr('y', innerHeight + 40)
      .attr('text-anchor', 'middle')
      .style('font-size', '13px')
      .style('font-weight', 'bold')
      .text('Accuracy Score');

    // Legend for Models
    const legend = svg
      .append('g')
      .attr(
        'transform',
        `translate(${width - margin.right + 12}, ${margin.top})`,
      );

    legend
      .append('text')
      .attr('x', 0)
      .attr('y', 0)
      .style('font-size', '12px')
      .style('font-weight', 'bold')
      .text('Models:');

    sources.forEach((source, i) => {
      const legendRow = legend
        .append('g')
        .attr('transform', `translate(0, ${(i + 1) * 22})`)
        .style('cursor', 'pointer')
        .on('mouseenter', () => setHighlightedModel(source.modelName))
        .on('mouseleave', () => setHighlightedModel(null));

      legendRow
        .append('rect')
        .attr('width', 14)
        .attr('height', 14)
        .attr('fill', colorScale(source.modelName) as string)
        .attr('opacity', 0.85)
        .attr('rx', 2);

      legendRow
        .append('text')
        .attr('x', 18)
        .attr('y', 11)
        .style('font-size', '10px')
        .style(
          'font-weight',
          highlightedModel === source.modelName ? 'bold' : 'normal',
        )
        .text(
          source.modelName.length > 16
            ? source.modelName.slice(0, 14) + '...'
            : source.modelName,
        );
    });

    // Legend for Benchmarks/Datasets
    const datasetLegend = svg
      .append('g')
      .attr(
        'transform',
        `translate(${width - margin.right + 12}, ${margin.top + sources.length * 22 + 40})`,
      );

    datasetLegend
      .append('text')
      .attr('x', 0)
      .attr('y', 0)
      .style('font-size', '12px')
      .style('font-weight', 'bold')
      .text('Benchmarks:');

    uniqueDatasets.forEach((dataset, i) => {
      const datasetRow = datasetLegend
        .append('g')
        .attr('transform', `translate(0, ${(i + 1) * 22})`);

      datasetRow
        .append('rect')
        .attr('width', 14)
        .attr('height', 14)
        .attr('fill', datasetColorScale(dataset) as string)
        .attr('opacity', 0.3)
        .attr('rx', 2);

      datasetRow
        .append('text')
        .attr('x', 18)
        .attr('y', 11)
        .style('font-size', '10px')
        .text(dataset.length > 16 ? dataset.slice(0, 14) + '...' : dataset)
        .append('title')
        .text(dataset);
    });
  }, [
    expandedCategory,
    categoryStats,
    sources,
    scale0100,
    highlightedModel,
    testSortMode,
    colorScale,
  ]);

  return (
    <div className='space-y-4'>
      {/* Radar Chart View - Always Visible */}
      <Card
        title={
          <span>
            <RadarChartOutlined style={{ marginRight: 8 }} />
            Performance Radar - Category Overview
          </span>
        }
      >
        <div className='mb-3 text-sm text-gray-600 bg-blue-50 p-3 rounded border border-blue-200'>
          <strong>💡 Tip:</strong> Click on a category label in the radar chart
          to view detailed test results below
        </div>
        <CompactDashboard
          sources={sources}
          scale0100={scale0100}
          selectedCategory={expandedCategory}
          highlightedModel={highlightedModel}
          onCategoryClick={(category) => {
            setExpandedCategory(
              expandedCategory === category ? null : category,
            );
          }}
          onModelHighlight={(model) => {
            setHighlightedModel(model);
          }}
        />
      </Card>

      {/* Expanded Detail Chart */}
      {expandedCategory && (
        <>
          <Card size='small' title='Test View Controls'>
            <Space direction='horizontal' size='middle'>
              <Space size='small'>
                <span style={{ fontWeight: 600 }}>Sort Tests:</span>
                <Radio.Group
                  value={testSortMode}
                  onChange={(e) => setTestSortMode(e.target.value)}
                  buttonStyle='solid'
                  size='small'
                >
                  <Radio.Button value='accuracy'>
                    <SortDescendingOutlined /> Accuracy
                  </Radio.Button>
                  <Radio.Button value='benchmark'>
                    <AppstoreOutlined /> By Benchmark
                  </Radio.Button>
                  <Radio.Button value='name'>
                    <SortAscendingOutlined /> A-Z
                  </Radio.Button>
                </Radio.Group>
              </Space>
              <Button
                size='small'
                icon={<UpOutlined />}
                onClick={() => setExpandedCategory(null)}
              >
                Collapse
              </Button>
            </Space>
          </Card>
          <Card
            title={
              <span>
                <BarChartOutlined style={{ marginRight: 8 }} />
                Detailed Test Results: {expandedCategory}
              </span>
            }
          >
            <div
              ref={detailChartRef}
              style={{ width: '100%', minHeight: 450 }}
            />
          </Card>
        </>
      )}
    </div>
  );
};
