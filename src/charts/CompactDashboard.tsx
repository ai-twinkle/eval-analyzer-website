import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import type { DataSource } from '../features/types';
import { flattenDatasetResults, groupByCategory } from '../features/transform';
import { formatValue } from '../features/transform';

interface CompactDashboardProps {
  sources: DataSource[];
  scale0100: boolean;
  onCategoryClick?: (category: string) => void;
  selectedCategory?: string | null;
  highlightedModel?: string | null;
  onModelHighlight?: (model: string | null) => void;
}

interface CategoryData {
  category: string;
  mean: number;
  count: number;
}

interface RadarDataPoint {
  axis: string;
  value: number;
}

// Proper D3 Radar Chart Implementation using lineRadial
function drawRadarChart(
  svg: d3.Selection<SVGSVGElement, unknown, null, undefined>,
  categoryData: CategoryData[],
  sources: DataSource[],
  width: number,
  height: number,
  scale0100: boolean,
  highlightedModel: string | null,
  selectedCategory: string | null,
  onCategoryClick: (category: string) => void,
  onModelClick: (model: string) => void,
) {
  const margin = { top: 100, right: 220, bottom: 80, left: 220 };
  const radius =
    Math.min(
      width - margin.left - margin.right,
      height - margin.top - margin.bottom,
    ) / 2;
  const centerX = width / 2;
  const centerY = height / 2 + 20;

  // Use all categories - no limit
  const topCategories = categoryData;
  const allAxis = topCategories.map((d) => d.category);
  const total = allAxis.length;
  const angleSlice = (Math.PI * 2) / total;

  // Color scale
  const colorScale = d3.scaleOrdinal(d3.schemeCategory10);

  // Radius scale
  const rScale = d3.scaleLinear().domain([0, 1]).range([0, radius]);

  // Main group
  const g = svg
    .append('g')
    .attr('transform', `translate(${centerX}, ${centerY})`);

  // Draw circular grid
  const levels = 5;
  for (let level = 1; level <= levels; level++) {
    const levelRadius = (radius / levels) * level;

    g.append('circle')
      .attr('r', levelRadius)
      .attr('fill', 'none')
      .attr('stroke', '#CDCDCD')
      .attr('stroke-width', level === levels ? 2 : 1)
      .attr('opacity', 0.5);

    // Add value labels
    if (level < levels) {
      g.append('text')
        .attr('x', 5)
        .attr('y', -levelRadius)
        .attr('dy', '0.4em')
        .style('font-size', '10px')
        .attr('fill', '#737373')
        .text(formatValue(level / levels, scale0100));
    }
  }

  // Draw axes
  const axis = g
    .selectAll('.axis')
    .data(allAxis)
    .enter()
    .append('g')
    .attr('class', 'axis');

  axis
    .append('line')
    .attr('x1', 0)
    .attr('y1', 0)
    .attr('x2', (_d, i) => rScale(1) * Math.cos(angleSlice * i))
    .attr('y2', (_d, i) => rScale(1) * Math.sin(angleSlice * i))
    .attr('stroke', (d) => (selectedCategory === d ? '#1890ff' : '#CDCDCD'))
    .attr('stroke-width', (d) => (selectedCategory === d ? 2 : 1));

  // Draw axis labels (clickable)
  axis
    .append('text')
    .attr('class', 'axis-label')
    .attr('text-anchor', 'middle')
    .attr('dy', '0.35em')
    .attr('x', (_d, i) => {
      const angle = angleSlice * i;
      return rScale(1) * 1.15 * Math.cos(angle);
    })
    .attr('y', (_d, i) => {
      const angle = angleSlice * i;
      return rScale(1) * 1.15 * Math.sin(angle);
    })
    .text((d) => {
      const categoryInfo = topCategories.find((c) => c.category === d);
      const shortName = d.length > 18 ? d.substring(0, 15) + '...' : d;
      return categoryInfo ? `${shortName} (${categoryInfo.count})` : shortName;
    })
    .style('font-size', '11px')
    .style('font-weight', (d) => (selectedCategory === d ? 'bold' : 'normal'))
    .style('fill', (d) => (selectedCategory === d ? '#1890ff' : '#333'))
    .style('cursor', 'pointer')
    .each(function (d, i) {
      // Add background box for better readability
      const textNode = this as SVGTextElement;
      const bbox = textNode.getBBox();
      const angle = angleSlice * i;
      const x = rScale(1) * 1.15 * Math.cos(angle);
      const y = rScale(1) * 1.15 * Math.sin(angle);

      const parentNode = textNode.parentNode as SVGGElement;
      d3.select(parentNode)
        .insert('rect', 'text')
        .attr('x', x - bbox.width / 2 - 4)
        .attr('y', y - bbox.height / 2 - 2)
        .attr('width', bbox.width + 8)
        .attr('height', bbox.height + 4)
        .attr('fill', selectedCategory === d ? '#e6f7ff' : 'white')
        .attr('stroke', selectedCategory === d ? '#1890ff' : '#d9d9d9')
        .attr('stroke-width', 1)
        .attr('rx', 3)
        .style('cursor', 'pointer')
        .on('click', () => onCategoryClick(d));
    })
    .on('click', (_event, d) => onCategoryClick(d))
    .append('title')
    .text((d) => {
      const categoryInfo = topCategories.find((c) => c.category === d);
      return `${d}\n${categoryInfo?.count || 0} tests\nClick to focus`;
    });

  // Prepare data for each source
  const radarData = sources.map((source) => {
    const results = flattenDatasetResults(source.rawData);
    const grouped = groupByCategory(results);

    return {
      source: source.modelName,
      isOfficial: source.isOfficial,
      values: allAxis.map((axis) => {
        const categoryResults = grouped[axis] || [];
        const meanAccuracy =
          categoryResults.length > 0
            ? d3.mean(categoryResults, (d) => d.accuracy_mean) || 0
            : 0;
        return {
          axis,
          value: meanAccuracy,
        };
      }),
    };
  });

  // Function to generate polygon coordinates using lineRadial
  // Properly configure the angle to match axis positions exactly
  const radarLine = d3
    .lineRadial<RadarDataPoint>()
    .radius((d) => rScale(d.value))
    .angle((_d, i) => i * angleSlice)
    .curve(d3.curveLinearClosed); // Use curveLinearClosed for proper polygon closure

  // Draw radar blobs
  radarData.forEach((data, idx) => {
    const color = colorScale(idx.toString());
    const isHighlighted = !highlightedModel || highlightedModel === data.source;
    const opacity = isHighlighted ? 1 : 0.2;

    // Radar area (filled polygon) - curveLinearClosed handles closing automatically
    const radarPath = g.append('path')
      .datum(data.values)
      .attr('class', `radar-area radar-area-${idx}`)
      .attr('d', radarLine)
      .style('fill', color)
      .style('fill-opacity', 0.2 * opacity)
      .style('stroke', color)
      .style('stroke-width', isHighlighted ? 2.5 : 1.5)
      .style('opacity', opacity)
      .style('cursor', 'pointer')
      .on('mouseenter', function () {
        // Temporarily highlight this model on hover
        d3.select(this)
          .style('fill-opacity', 0.4)
          .style('stroke-width', 3.5);
      })
      .on('mouseleave', function () {
        // Restore original style
        d3.select(this)
          .style('fill-opacity', 0.2 * opacity)
          .style('stroke-width', isHighlighted ? 2.5 : 1.5);
      })
      .on('click', function () {
        // Toggle model highlight on click
        onModelClick(data.source);
      });
    
    radarPath.append('title')
      .text(`${data.source}${data.isOfficial ? ' (Official)' : ''}\nClick to toggle highlight`);

    // Radar circles (data points)
    g.selectAll(`.radar-circle-${idx}`)
      .data(data.values)
      .enter()
      .append('circle')
      .attr('class', `radar-circle radar-circle-${idx}`)
      .attr('r', isHighlighted ? 4.5 : 3)
      .attr(
        'cx',
        (d, i) => rScale(d.value) * Math.cos(angleSlice * i),
      )
      .attr(
        'cy',
        (d, i) => rScale(d.value) * Math.sin(angleSlice * i),
      )
      .style('fill', color)
      .style('stroke', 'white')
      .style('stroke-width', 2)
      .style('opacity', opacity)
      .style('cursor', 'pointer')
      .on('mouseenter', function (event, d) {
        // Enlarge circle
        d3.select(this).attr('r', 7).style('stroke-width', 3);
        
        // Highlight the entire radar path temporarily
        g.select(`.radar-area-${idx}`)
          .style('fill-opacity', 0.4)
          .style('stroke-width', 3.5);

        // Show tooltip
        const [mouseX, mouseY] = d3.pointer(event, svg.node());
        const tooltip = svg
          .append('g')
          .attr('class', 'tooltip-radar')
          .attr('transform', `translate(${mouseX + 10}, ${mouseY - 10})`);

        const text = `${data.source}\n${d.axis}: ${formatValue(d.value, scale0100)}`;
        const lines = text.split('\n');

        tooltip
          .selectAll('text')
          .data(lines)
          .enter()
          .append('text')
          .attr('y', (_d, i) => i * 16)
          .attr('dy', '0.35em')
          .style('font-size', '12px')
          .style('font-weight', (_d, i) => (i === 0 ? 'bold' : 'normal'))
          .text((d) => d);

        const bbox = (tooltip.node() as SVGGElement).getBBox();
        tooltip
          .insert('rect', 'text')
          .attr('x', bbox.x - 4)
          .attr('y', bbox.y - 4)
          .attr('width', bbox.width + 8)
          .attr('height', bbox.height + 8)
          .attr('fill', 'white')
          .attr('stroke', color)
          .attr('stroke-width', 2)
          .attr('rx', 4);
      })
      .on('mouseleave', function () {
        // Reset circle size
        d3.select(this)
          .attr('r', isHighlighted ? 4.5 : 3)
          .style('stroke-width', 2);
        
        // Reset radar path
        g.select(`.radar-area-${idx}`)
          .style('fill-opacity', 0.2 * opacity)
          .style('stroke-width', isHighlighted ? 2.5 : 1.5);
        
        svg.selectAll('.tooltip-radar').remove();
      })
      .on('click', function() {
        // Toggle model highlight on click
        onModelClick(data.source);
      })
      .append('title')
      .text(
        (d) => `${data.source}\n${d.axis}: ${formatValue(d.value, scale0100)}\nClick to toggle model highlight`,
      );
  });

  // Add title
  svg
    .append('text')
    .attr('x', width / 2)
    .attr('y', 25)
    .attr('text-anchor', 'middle')
    .style('font-size', '18px')
    .style('font-weight', 'bold')
    .text('Performance Radar - Category Overview');

  svg
    .append('text')
    .attr('x', width / 2)
    .attr('y', 48)
    .attr('text-anchor', 'middle')
    .style('font-size', '12px')
    .style('fill', '#666')
    .text('Hover over lines/dots to see details • Click category labels or model legend to highlight');

  // Legend (clickable)
  const legendG = svg
    .append('g')
    .attr('transform', `translate(${width - 200}, 100)`);

  legendG
    .append('text')
    .attr('x', 0)
    .attr('y', -10)
    .style('font-size', '13px')
    .style('font-weight', 'bold')
    .text('Models');

  legendG
    .append('text')
    .attr('x', 0)
    .attr('y', 5)
    .style('font-size', '10px')
    .style('fill', '#666')
    .text('(click to highlight)');

  sources.forEach((source, i) => {
    const yPos = 25 + i * 30;
    const color = colorScale(i.toString());
    const isHighlighted =
      !highlightedModel || highlightedModel === source.modelName;
    const isSelected = highlightedModel === source.modelName;

    const legendItem = legendG
      .append('g')
      .attr('transform', `translate(0, ${yPos})`)
      .attr('class', 'legend-item')
      .style('cursor', 'pointer')
      .style('opacity', isHighlighted ? 1 : 0.4)
      .on('click', () => onModelClick(source.modelName))
      .on('mouseenter', function () {
        d3.select(this).style('opacity', 1);
      })
      .on('mouseleave', function () {
        d3.select(this).style('opacity', isHighlighted ? 1 : 0.4);
      });

    // Line sample
    legendItem
      .append('line')
      .attr('x1', 0)
      .attr('x2', 30)
      .attr('y1', 0)
      .attr('y2', 0)
      .attr('stroke', color)
      .attr('stroke-width', isSelected ? 3 : 2);

    // Circle sample
    legendItem
      .append('circle')
      .attr('cx', 15)
      .attr('cy', 0)
      .attr('r', isSelected ? 5 : 4)
      .attr('fill', color)
      .attr('stroke', 'white')
      .attr('stroke-width', 2);

    // Model name
    const modelLabel =
      source.modelName.length > 22
        ? source.modelName.substring(0, 19) + '...'
        : source.modelName;

    legendItem
      .append('text')
      .attr('x', 38)
      .attr('y', 0)
      .attr('dy', '0.35em')
      .style('font-size', '11px')
      .style('font-weight', isSelected ? 'bold' : 'normal')
      .style('fill', isSelected ? '#1890ff' : '#333')
      .text(modelLabel + (source.isOfficial ? ' ⭐' : ''));

    legendItem
      .append('title')
      .text(source.modelName + (source.isOfficial ? ' (Official)' : ''));
  });
}

export const CompactDashboard: React.FC<CompactDashboardProps> = ({
  sources,
  scale0100,
  onCategoryClick,
  selectedCategory: externalSelectedCategory,
  highlightedModel: externalHighlightedModel,
  onModelHighlight,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [internalSelectedCategory, setInternalSelectedCategory] = useState<string | null>(null);
  const [internalHighlightedModel, setInternalHighlightedModel] = useState<string | null>(null);

  // Use external selected category if provided, otherwise use internal state
  const selectedCategory = externalSelectedCategory !== undefined ? externalSelectedCategory : internalSelectedCategory;
  const highlightedModel = externalHighlightedModel !== undefined ? externalHighlightedModel : internalHighlightedModel;

  useEffect(() => {
    if (!containerRef.current || sources.length === 0) return;

    const container = containerRef.current;
    d3.select(container).selectAll('*').remove();

    const width = container.clientWidth;
    const height = 700;

    const svg = d3
      .select(container)
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', `0 0 ${width} ${height}`)
      .attr('preserveAspectRatio', 'xMidYMid meet');

    // Process data
    const allResults: Array<{
      category: string;
      accuracy: number;
      source: string;
    }> = [];

    for (const source of sources) {
      const results = flattenDatasetResults(source.rawData);
      const grouped = groupByCategory(results);

      for (const [category, categoryResults] of Object.entries(grouped)) {
        for (const result of categoryResults) {
          allResults.push({
            category,
            accuracy: result.accuracy_mean,
            source: source.modelName,
          });
        }
      }
    }

    // Calculate category stats
    const categoryStats = d3.group(allResults, (d) => d.category);
    const categories = Array.from(categoryStats.keys()).sort();

    const categoryData: CategoryData[] = categories
      .map((cat) => {
        const tests = categoryStats.get(cat) || [];
        const accuracies = tests.map((t) => t.accuracy);
        return {
          category: cat,
          mean: d3.mean(accuracies) || 0,
          count: tests.length,
        };
      })
      .sort((a, b) => b.mean - a.mean);

    // Draw radar chart
    drawRadarChart(
      svg,
      categoryData,
      sources,
      width,
      height,
      scale0100,
      highlightedModel,
      selectedCategory,
      (category) => {
        // Update internal state if not controlled by parent
        if (externalSelectedCategory === undefined) {
          setInternalSelectedCategory(internalSelectedCategory === category ? null : category);
        }
        // Notify parent if callback provided
        if (onCategoryClick) {
          onCategoryClick(category);
        }
      },
      (model) => {
        // Update internal state if not controlled by parent
        if (externalHighlightedModel === undefined) {
          setInternalHighlightedModel(internalHighlightedModel === model ? null : model);
        }
        // Notify parent if callback provided
        if (onModelHighlight) {
          onModelHighlight(highlightedModel === model ? null : model);
        }
      },
    );
  }, [sources, scale0100, selectedCategory, highlightedModel, onCategoryClick, onModelHighlight, externalSelectedCategory, externalHighlightedModel, internalSelectedCategory, internalHighlightedModel]);

  if (sources.length === 0) {
    return (
      <div className='text-gray-500 text-center py-8'>
        No data available. Please load a benchmark or upload files.
      </div>
    );
  }

  return (
    <div className='w-full'>
      <div
        ref={containerRef}
        className='w-full'
        style={{ minHeight: '700px' }}
      />
    </div>
  );
};
