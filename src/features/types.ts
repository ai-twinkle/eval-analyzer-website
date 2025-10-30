import { z } from 'zod';

// Config types
export const BenchmarkConfigSchema = z.object({
  official: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      provider: z.string(),
      modelName: z.string(),
      variance: z.string(),
      openSource: z.boolean(),
      hfFolderUrl: z.string(),
    }),
  ),
  ui: z.object({
    defaultScale0100: z.boolean(),
    pageSizes: z.array(z.number()),
  }),
  security: z.object({
    allowOrigins: z.array(z.string()),
  }),
});

export type BenchmarkConfig = z.infer<typeof BenchmarkConfigSchema>;

// Dynamic schema types that will be inferred at runtime
export interface DataSource {
  id: string;
  label: string;
  modelName: string;
  variance: string;
  timestamp: string;
  isOfficial: boolean;
  data: unknown;
  rawData: unknown;
}

export interface CategoryResult {
  category: string;
  file: string;
  accuracy_mean: number;
  accuracy_std?: number;
}

export interface PivotRow {
  category: string;
  [sourceLabel: string]: number | string;
}

export interface DeltaRow {
  category: string;
  baseline: number;
  candidate: number;
  delta: number;
  absDelta: number;
  candidateLabel: string;
}

export type SortMode = 'mean-desc' | 'mean-asc' | 'alphabetical';
export type DeltaSortMode =
  | 'abs-desc'
  | 'delta-desc'
  | 'delta-asc'
  | 'category';
