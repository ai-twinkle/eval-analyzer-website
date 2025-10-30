declare module '@ant-design/charts' {
  import type React from 'react';

  export interface BaseChartConfig {
    data: unknown[];
    height?: number;
    width?: number;
    autoFit?: boolean;
    padding?: number | number[] | 'auto';
    appendPadding?: number | number[];
    renderer?: 'canvas' | 'svg';
    pixelRatio?: number;
    limitInPlot?: boolean;
    locale?: string;
    defaultInteractions?: string[];
    [key: string]: unknown;
  }

  export interface ColumnConfig extends BaseChartConfig {
    xField: string;
    yField: string;
    seriesField?: string;
    isGroup?: boolean;
    isStack?: boolean;
    isPercent?: boolean;
    isRange?: boolean;
    minColumnWidth?: number;
    maxColumnWidth?: number;
    columnStyle?: unknown;
    columnWidthRatio?: number;
    marginRatio?: number;
  }

  export interface BarConfig extends BaseChartConfig {
    xField: string;
    yField: string;
    seriesField?: string;
    isGroup?: boolean;
    isStack?: boolean;
    isPercent?: boolean;
    isRange?: boolean;
  }

  export interface LineConfig extends BaseChartConfig {
    xField: string;
    yField: string;
    seriesField?: string;
    smooth?: boolean;
    stepType?: 'vh' | 'hvh' | 'hv';
  }

  export interface HeatmapConfig extends BaseChartConfig {
    xField: string;
    yField: string;
    colorField: string;
    sizeField?: string;
    shape?: string;
    sizeRatio?: number;
  }

  export interface RadarConfig extends BaseChartConfig {
    xField: string;
    yField: string;
    seriesField?: string;
    smooth?: boolean;
  }

  export interface BoxConfig extends BaseChartConfig {
    xField: string;
    yField: string;
    groupField?: string;
  }

  export interface ViolinConfig extends BaseChartConfig {
    xField: string;
    yField: string;
    seriesField?: string;
  }

  export const Column: React.FC<ColumnConfig>;
  export const Bar: React.FC<BarConfig>;
  export const Line: React.FC<LineConfig>;
  export const Heatmap: React.FC<HeatmapConfig>;
  export const Radar: React.FC<RadarConfig>;
  export const Box: React.FC<BoxConfig>;
  export const Violin: React.FC<ViolinConfig>;
}
