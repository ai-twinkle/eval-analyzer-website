import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import { Card, Space, Button, Radio, Row, Col } from 'antd';
import {
  BarChartOutlined,
  AppstoreOutlined,
  UpOutlined,
  SortAscendingOutlined,
  SortDescendingOutlined,
  DashboardOutlined,
} from '@ant-design/icons';
import type { DataSource } from '../features/types';
import { flattenDatasetResults, groupByCategory } from '../features/transform';
import { formatValue } from '../features/transform';

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
    values: Map<string, number>; // modelName -> accuracy
  }>;
  avgPerModel: Map<string, number>;
  minPerModel: Map<string, number>;
  maxPerModel: Map<string, number>;
  overallAvg: number;
  overallMin: number;
  overallMax: number;
  variance: number;
}

type SortMode = 'variance' | 'avg-desc' | 'avg-asc' | 'name';

export const CategoryDashboard: React.FC<CategoryDashboardProps> = ({
  sources,
  scale0100,
}) => {
  const categoryCardsRef = useRef<HTMLDivElement>(null);
  const detailChartRef = useRef<HTMLDivElement>(null);

  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [highlightedModel, setHighlightedModel] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>('variance');
  const [testSortMode, setTestSortMode] = useState<'accuracy' | 'name'>(
    'accuracy',
  );

  // Process data hierarchically by category
  const categoryStats = useMemo(() => {
    const categories = new Map<string, CategoryStats>();

    sources.forEach((source) => {
      const results = flattenDatasetResults(source.rawData);
      const grouped = groupByCategory(results);

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
          let testEntry = catData.tests.find(
            (t) => t.fullPath === result.category,
          );
          if (!testEntry) {
            testEntry = {
              testName: result.category.split('/').pop() || result.category,
              fullPath: result.category,
              values: new Map(),
            };
            catData.tests.push(testEntry);
          }
          testEntry.values.set(source.modelName, result.accuracy_mean);
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
          if (val !== undefined) accuracies.push(val);
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

    // Sort categories based on sort mode
    const sortedCategories = Array.from(categories.values());
    switch (sortMode) {
      case 'variance':
        return sortedCategories.sort((a, b) => b.variance - a.variance);
      case 'avg-desc':
        return sortedCategories.sort((a, b) => b.overallAvg - a.overallAvg);
      case 'avg-asc':
        return sortedCategories.sort((a, b) => a.overallAvg - b.overallAvg);
      case 'name':
        return sortedCategories.sort((a, b) => a.name.localeCompare(b.name));
      default:
        return sortedCategories;
    }
  }, [sources, sortMode]);

  const colorScale = useMemo(
    () =>
      d3
        .scaleOrdinal(d3.schemeCategory10)
        .domain(sources.map((s) => s.modelName)),
    [sources],
  );

  // Render Category Overview Cards with inline sparklines
  useEffect(() => {
    if (!categoryCardsRef.current || sources.length === 0) return;

    const container = categoryCardsRef.current;
    d3.select(container).selectAll('*').remove();

    const cardWidth = 380;
    const cardHeight = 140;
    const padding = 16;
    const margin = { top: 45, right: 12, bottom: 30, left: 12 };

    const cardsPerRow = Math.floor(
      container.clientWidth / (cardWidth + padding),
    );
    const rows = Math.ceil(categoryStats.length / cardsPerRow);

    const svg = d3
      .select(container)
      .append('svg')
      .attr('width', container.clientWidth)
      .attr('height', rows * (cardHeight + padding) + 40);

    // Title
    svg
      .append('text')
      .attr('x', container.clientWidth / 2)
      .attr('y', 25)
      .attr('text-anchor', 'middle')
      .style('font-size', '16px')
      .style('font-weight', 'bold')
      .text(`Performance Overview - ${categoryStats.length} Categories`);

    // Render each category card
    categoryStats.forEach((cat, idx) => {
      const row = Math.floor(idx / cardsPerRow);
      const col = idx % cardsPerRow;
      const x = col * (cardWidth + padding) + padding / 2;
      const y = row * (cardHeight + padding) + 50;

      const card = svg.append('g').attr('transform', `translate(${x},${y})`);

      // Card background
      const isExpanded = expandedCategory === cat.name;
      card
        .append('rect')
        .attr('width', cardWidth)
        .attr('height', cardHeight)
        .attr('fill', isExpanded ? '#e6f7ff' : '#fafafa')
        .attr('stroke', isExpanded ? '#1890ff' : '#d9d9d9')
        .attr('stroke-width', isExpanded ? 2.5 : 1)
        .attr('rx', 6)
        .style('cursor', 'pointer')
        .on('click', () => {
          setExpandedCategory(expandedCategory === cat.name ? null : cat.name);
        })
        .on('mouseenter', function () {
          d3.select(this).attr('stroke', '#1890ff').attr('stroke-width', 2);
        })
        .on('mouseleave', function () {
          if (!isExpanded) {
            d3.select(this).attr('stroke', '#d9d9d9').attr('stroke-width', 1);
          }
        });

      // Category name
      card
        .append('text')
        .attr('x', 12)
        .attr('y', 20)
        .style('font-size', '14px')
        .style('font-weight', 'bold')
        .style('fill', '#262626')
        .style('pointer-events', 'none')
        .text(cat.name.length > 28 ? cat.name.slice(0, 26) + '...' : cat.name);

      // Test count badge
      card
        .append('rect')
        .attr('x', cardWidth - 60)
        .attr('y', 8)
        .attr('width', 50)
        .attr('height', 20)
        .attr('fill', '#f0f0f0')
        .attr('rx', 10)
        .style('pointer-events', 'none');

      card
        .append('text')
        .attr('x', cardWidth - 35)
        .attr('y', 21)
        .attr('text-anchor', 'middle')
        .style('font-size', '11px')
        .style('font-weight', '600')
        .style('fill', '#595959')
        .style('pointer-events', 'none')
        .text(`${cat.testCount} tests`);

      // Statistics row
      const statsY = 42;
      const statWidth = (cardWidth - 24) / 3;

      [
        { label: 'Avg', value: cat.overallAvg, color: '#1890ff' },
        { label: 'Min', value: cat.overallMin, color: '#ff4d4f' },
        { label: 'Max', value: cat.overallMax, color: '#52c41a' },
      ].forEach((stat, i) => {
        const statX = 12 + i * statWidth;

        card
          .append('text')
          .attr('x', statX)
          .attr('y', statsY)
          .style('font-size', '10px')
          .style('fill', '#8c8c8c')
          .style('pointer-events', 'none')
          .text(stat.label);

        card
          .append('text')
          .attr('x', statX)
          .attr('y', statsY + 16)
          .style('font-size', '16px')
          .style('font-weight', 'bold')
          .style('fill', stat.color)
          .style('pointer-events', 'none')
          .text(formatValue(stat.value, scale0100));
      });

      // Mini bar chart for each model
      const chartY = margin.top + 30;
      const chartWidth = cardWidth - margin.left - margin.right;
      const chartHeight = cardHeight - chartY - margin.bottom;

      const xScale = d3.scaleLinear().domain([0, 1]).range([0, chartWidth]);
      const yScale = d3
        .scaleBand()
        .domain(sources.map((s) => s.modelName))
        .range([chartY, chartY + chartHeight])
        .padding(0.25);

      sources.forEach((source) => {
        const avg = cat.avgPerModel.get(source.modelName) || 0;
        const min = cat.minPerModel.get(source.modelName) || 0;
        const max = cat.maxPerModel.get(source.modelName) || 0;
        const isHighlighted =
          !highlightedModel || highlightedModel === source.modelName;

        const barY = yScale(source.modelName) || 0;
        const barHeight = yScale.bandwidth();

        // Range bar (min to max)
        card
          .append('rect')
          .attr('x', margin.left + xScale(min))
          .attr('y', barY + barHeight * 0.35)
          .attr('width', xScale(max - min))
          .attr('height', barHeight * 0.3)
          .attr('fill', colorScale(source.modelName) as string)
          .attr('opacity', isHighlighted ? 0.15 : 0.05)
          .attr('rx', 2);

        // Average bar
        card
          .append('rect')
          .attr('x', margin.left)
          .attr('y', barY)
          .attr('width', xScale(avg))
          .attr('height', barHeight)
          .attr('fill', colorScale(source.modelName) as string)
          .attr('opacity', isHighlighted ? 0.85 : 0.25)
          .attr('rx', 2)
          .style('cursor', 'pointer')
          .on('mouseenter', () => setHighlightedModel(source.modelName))
          .on('mouseleave', () => setHighlightedModel(null));

        // Value label
        if (xScale(avg) > 30) {
          card
            .append('text')
            .attr('x', margin.left + xScale(avg) - 4)
            .attr('y', barY + barHeight / 2)
            .attr('text-anchor', 'end')
            .attr('dominant-baseline', 'middle')
            .style('font-size', '10px')
            .style('font-weight', 'bold')
            .style('fill', 'white')
            .style('pointer-events', 'none')
            .text(formatValue(avg, scale0100));
        }

        // Model name label
        const modelLabel =
          source.modelName.length > 15
            ? source.modelName.slice(0, 13) + '...'
            : source.modelName;
        card
          .append('text')
          .attr('x', margin.left + chartWidth + 4)
          .attr('y', barY + barHeight / 2)
          .attr('dominant-baseline', 'middle')
          .style('font-size', '9px')
          .style('fill', '#595959')
          .style('pointer-events', 'none')
          .text(modelLabel);
      });

      // Click hint icon
      card
        .append('text')
        .attr('x', cardWidth - 15)
        .attr('y', cardHeight - 10)
        .attr('text-anchor', 'end')
        .style('font-size', '11px')
        .style('fill', '#8c8c8c')
        .style('pointer-events', 'none')
        .text(isExpanded ? '▲' : '▼');
    });
  }, [
    categoryStats,
    sources,
    scale0100,
    expandedCategory,
    highlightedModel,
    colorScale,
  ]);

  // Render Detailed Test Chart when category is expanded
  useEffect(() => {
    if (!detailChartRef.current || !expandedCategory) return;

    const container = detailChartRef.current;
    d3.select(container).selectAll('*').remove();

    const categoryInfo = categoryStats.find((c) => c.name === expandedCategory);
    if (!categoryInfo) return;

    // Sort tests
    const sortedTests = [...categoryInfo.tests].sort((a, b) => {
      if (testSortMode === 'accuracy') {
        const avgA = d3.mean(Array.from(a.values.values())) || 0;
        const avgB = d3.mean(Array.from(b.values.values())) || 0;
        return avgB - avgA; // Descending
      } else {
        return a.testName.localeCompare(b.testName);
      }
    });

    const width = container.clientWidth;
    const margin = { top: 70, right: 160, bottom: 50, left: 280 };
    const testHeight = 38;
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
        `${categoryInfo.testCount} individual tests, sorted by ${testSortMode}`,
      );

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Scales
    const yScale = d3
      .scaleBand()
      .domain(sortedTests.map((t) => t.testName))
      .range([0, innerHeight])
      .padding(0.2);

    const xScale = d3.scaleLinear().domain([0, 1]).range([0, innerWidth]);

    // Y Axis - Test names with ranking
    sortedTests.forEach((test, idx) => {
      const avgAccuracy = d3.mean(Array.from(test.values.values())) || 0;
      const rank = idx + 1;

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

      // Test name
      g.append('text')
        .attr('x', -35)
        .attr('y', (yScale(test.testName) || 0) + yScale.bandwidth() / 2)
        .attr('text-anchor', 'end')
        .attr('dominant-baseline', 'middle')
        .style('font-size', '11px')
        .style('fill', '#262626')
        .text(
          test.testName.length > 38
            ? test.testName.slice(0, 36) + '...'
            : test.testName,
        );

      // Average accuracy indicator
      g.append('text')
        .attr('x', -10)
        .attr('y', (yScale(test.testName) || 0) + yScale.bandwidth() / 2)
        .attr('text-anchor', 'end')
        .attr('dominant-baseline', 'middle')
        .style('font-size', '9px')
        .style('fill', '#8c8c8c')
        .text(`μ${formatValue(avgAccuracy, scale0100)}`);
    });

    // Draw grouped bars for each model
    const modelBarHeight = yScale.bandwidth() / sources.length;

    sortedTests.forEach((test) => {
      sources.forEach((source, sIdx) => {
        const value = test.values.get(source.modelName) || 0;
        const isHighlighted =
          !highlightedModel || highlightedModel === source.modelName;

        g.append('rect')
          .attr('x', 0)
          .attr('y', (yScale(test.testName) || 0) + sIdx * modelBarHeight)
          .attr('width', xScale(value))
          .attr('height', modelBarHeight - 1.5)
          .attr('fill', colorScale(source.modelName) as string)
          .attr('opacity', isHighlighted ? 0.85 : 0.2)
          .attr('rx', 2)
          .style('cursor', 'pointer')
          .on('mouseenter', function () {
            setHighlightedModel(source.modelName);
            d3.select(this)
              .attr('opacity', 1)
              .attr('stroke', '#262626')
              .attr('stroke-width', 1);
          })
          .on('mouseleave', function () {
            setHighlightedModel(null);
            d3.select(this).attr('stroke', 'none');
          });

        // Value labels
        if (xScale(value) > 35) {
          g.append('text')
            .attr('x', xScale(value) - 4)
            .attr(
              'y',
              (yScale(test.testName) || 0) +
                sIdx * modelBarHeight +
                modelBarHeight / 2,
            )
            .attr('text-anchor', 'end')
            .attr('dominant-baseline', 'middle')
            .style('font-size', '9px')
            .style('font-weight', 'bold')
            .style('fill', 'white')
            .style('pointer-events', 'none')
            .text(formatValue(value, scale0100));
        } else if (value > 0 && xScale(value) > 5) {
          g.append('text')
            .attr('x', xScale(value) + 3)
            .attr(
              'y',
              (yScale(test.testName) || 0) +
                sIdx * modelBarHeight +
                modelBarHeight / 2,
            )
            .attr('text-anchor', 'start')
            .attr('dominant-baseline', 'middle')
            .style('font-size', '8px')
            .style('font-weight', 'bold')
            .style('fill', colorScale(source.modelName) as string)
            .style('pointer-events', 'none')
            .text(formatValue(value, scale0100));
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

    // Legend
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
      {/* Controls */}
      <Card size='small'>
        <Space direction='vertical' style={{ width: '100%' }} size='middle'>
          <Row gutter={[16, 16]} align='middle'>
            <Col>
              <Space size='small'>
                <span style={{ fontWeight: 600 }}>Sort Categories:</span>
                <Radio.Group
                  value={sortMode}
                  onChange={(e) => setSortMode(e.target.value)}
                  buttonStyle='solid'
                  size='small'
                >
                  <Radio.Button value='variance'>
                    <BarChartOutlined /> Variance
                  </Radio.Button>
                  <Radio.Button value='avg-desc'>
                    <SortDescendingOutlined /> Best
                  </Radio.Button>
                  <Radio.Button value='avg-asc'>
                    <SortAscendingOutlined /> Worst
                  </Radio.Button>
                  <Radio.Button value='name'>
                    <AppstoreOutlined /> A-Z
                  </Radio.Button>
                </Radio.Group>
              </Space>
            </Col>

            {expandedCategory && (
              <>
                <Col>
                  <Space size='small'>
                    <span style={{ fontWeight: 600 }}>Sort Tests:</span>
                    <Radio.Group
                      value={testSortMode}
                      onChange={(e) => setTestSortMode(e.target.value)}
                      buttonStyle='solid'
                      size='small'
                    >
                      <Radio.Button value='accuracy'>Accuracy</Radio.Button>
                      <Radio.Button value='name'>Name</Radio.Button>
                    </Radio.Group>
                  </Space>
                </Col>
                <Col>
                  <Button
                    size='small'
                    icon={<UpOutlined />}
                    onClick={() => setExpandedCategory(null)}
                  >
                    Collapse
                  </Button>
                </Col>
              </>
            )}
          </Row>
        </Space>
      </Card>

      {/* Category Overview Cards */}
      <Card
        title={
          <span>
            <DashboardOutlined style={{ marginRight: 8 }} />
            Category Overview - Click any card to expand details
          </span>
        }
      >
        <div ref={categoryCardsRef} style={{ width: '100%', minHeight: 400 }} />
      </Card>

      {/* Expanded Detail Chart */}
      {expandedCategory && (
        <Card>
          <div ref={detailChartRef} style={{ width: '100%', minHeight: 450 }} />
        </Card>
      )}
    </div>
  );
};
