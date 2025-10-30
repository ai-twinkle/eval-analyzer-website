import type {
  CategoryResult,
  DataSource,
  DeltaRow,
  DeltaSortMode,
  PivotRow,
  SortMode,
} from './types';

// Re-export DeltaRow as DeltaResult for charts
export type { DeltaRow as DeltaResult } from './types';

/**
 * Get unique identifier for a source (model + variance)
 */
export function getSourceIdentifier(source: DataSource): string {
  return source.variance !== 'default'
    ? `${source.modelName}-${source.variance}`
    : source.modelName;
}

/**
 * Normalize dataset key by stripping leading "datasets/"
 */
function normalizeDatasetKey(key: string): string {
  return key.replace(/^datasets\//, '');
}

/**
 * Extract category from filename (stem without extension and path)
 */
function extractCategory(filename: string): string {
  // Extract just the filename without path
  const name = filename.split('/').pop() || filename;
  // Remove test suffix and extension
  return name
    .replace(/_test\.(jsonl?|csv)$/, '')
    .replace(/\.(jsonl?|csv)$/, '');
}

/**
 * Categorize test by subject area
 */
function categorizeTest(filename: string): string {
  const name = filename.toLowerCase();

  if (
    name.includes('math') ||
    name.includes('algebra') ||
    name.includes('calculus') ||
    name.includes('geometry') ||
    name.includes('statistics') ||
    name.includes('trigonometry')
  ) {
    return 'Mathematics';
  } else if (
    name.includes('physics') ||
    name.includes('chemistry') ||
    name.includes('biology') ||
    name.includes('astronomy')
  ) {
    return 'Science';
  } else if (
    name.includes('computer') ||
    name.includes('machine_learning') ||
    name.includes('security')
  ) {
    return 'Computer Science';
  } else if (
    name.includes('law') ||
    name.includes('legal') ||
    name.includes('jurisprudence')
  ) {
    return 'Law';
  } else if (
    name.includes('history') ||
    name.includes('geography') ||
    name.includes('philosophy')
  ) {
    return 'Humanities';
  } else if (
    name.includes('business') ||
    name.includes('economics') ||
    name.includes('marketing') ||
    name.includes('accounting') ||
    name.includes('management')
  ) {
    return 'Business & Economics';
  } else if (
    name.includes('medicine') ||
    name.includes('nutrition') ||
    name.includes('anatomy') ||
    name.includes('clinical') ||
    name.includes('virology')
  ) {
    return 'Medicine & Health';
  } else if (name.includes('psychology') || name.includes('sociology')) {
    return 'Social Sciences';
  }

  return 'Other';
}

/**
 * Flatten dataset results into category results
 */
export function flattenDatasetResults(rawData: unknown): CategoryResult[] {
  const results: CategoryResult[] = [];

  if (typeof rawData !== 'object' || rawData === null) {
    return results;
  }

  const data = rawData as Record<string, unknown>;
  const datasetResults = data.dataset_results as
    | Record<string, unknown>
    | undefined;

  if (!datasetResults) {
    return results;
  }

  for (const [datasetKey, datasetValue] of Object.entries(datasetResults)) {
    const normalizedDataset = normalizeDatasetKey(datasetKey);

    if (typeof datasetValue !== 'object' || datasetValue === null) {
      continue;
    }

    const datasetObj = datasetValue as Record<string, unknown>;
    const resultsList = datasetObj.results as
      | Array<Record<string, unknown>>
      | undefined;

    if (!Array.isArray(resultsList)) {
      continue;
    }

    for (const result of resultsList) {
      const file = result.file as string;
      const accuracy_mean = result.accuracy_mean as number;
      const accuracy_std = result.accuracy_std as number | undefined;

      if (typeof file === 'string' && typeof accuracy_mean === 'number') {
        const category = extractCategory(file);
        results.push({
          category: `${normalizedDataset}/${category}`,
          file,
          accuracy_mean,
          accuracy_std,
        });
      }
    }
  }

  return results;
}

/**
 * Group results by subject category
 */
export function groupByCategory(
  results: CategoryResult[],
): Record<string, CategoryResult[]> {
  const grouped: Record<string, CategoryResult[]> = {};

  for (const result of results) {
    const category = categorizeTest(result.category);
    if (!grouped[category]) {
      grouped[category] = [];
    }
    grouped[category].push(result);
  }

  return grouped;
}

/**
 * Calculate category-level statistics
 */
export function calculateCategoryStats(sources: DataSource[]): Array<{
  category: string;
  source: string;
  avgAccuracy: number;
  minAccuracy: number;
  maxAccuracy: number;
  count: number;
}> {
  const stats: Array<{
    category: string;
    source: string;
    avgAccuracy: number;
    minAccuracy: number;
    maxAccuracy: number;
    count: number;
  }> = [];

  for (const source of sources) {
    const results = flattenDatasetResults(source.rawData);
    const grouped = groupByCategory(results);
    const varianceLabel =
      source.variance !== 'default' ? ` (${source.variance})` : '';
    const sourceLabel = `${source.modelName}${varianceLabel} @ ${source.timestamp}${source.isOfficial ? ' (Official)' : ''}`;

    for (const [category, categoryResults] of Object.entries(grouped)) {
      const accuracies = categoryResults.map((r) => r.accuracy_mean);
      stats.push({
        category,
        source: sourceLabel,
        avgAccuracy: accuracies.reduce((a, b) => a + b, 0) / accuracies.length,
        minAccuracy: Math.min(...accuracies),
        maxAccuracy: Math.max(...accuracies),
        count: accuracies.length,
      });
    }
  }

  return stats;
}

/**
 * Get top N and bottom N tests
 */
export function getTopBottomTests(
  results: CategoryResult[],
  topN: number = 10,
  bottomN: number = 10,
): { top: CategoryResult[]; bottom: CategoryResult[] } {
  const sorted = [...results].sort((a, b) => b.accuracy_mean - a.accuracy_mean);

  return {
    top: sorted.slice(0, topN),
    bottom: sorted.slice(-bottomN).reverse(),
  };
}

/**
 * Build pivot table: category × source
 */
export function buildPivotTable(sources: DataSource[]): PivotRow[] {
  const categoryMap = new Map<string, PivotRow>();

  for (const source of sources) {
    const results = flattenDatasetResults(source.rawData);
    const varianceLabel =
      source.variance !== 'default' ? ` (${source.variance})` : '';
    const sourceLabel = `${source.modelName}${varianceLabel} @ ${source.timestamp}${source.isOfficial ? ' (Official)' : ''}`;

    for (const result of results) {
      let row = categoryMap.get(result.category);
      if (!row) {
        row = { category: result.category };
        categoryMap.set(result.category, row);
      }
      row[sourceLabel] = result.accuracy_mean;
    }
  }

  return Array.from(categoryMap.values());
}

/**
 * Calculate mean for a category across all sources
 */
function calculateCategoryMean(row: PivotRow): number {
  const values = Object.entries(row)
    .filter(([key]) => key !== 'category')
    .map(([, value]) => value as number)
    .filter((v) => typeof v === 'number' && !isNaN(v));

  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Sort pivot table
 */
export function sortPivotTable(
  pivotData: PivotRow[],
  sortMode: SortMode,
): PivotRow[] {
  const sorted = [...pivotData];

  switch (sortMode) {
    case 'mean-desc':
      sorted.sort(
        (a, b) => calculateCategoryMean(b) - calculateCategoryMean(a),
      );
      break;
    case 'mean-asc':
      sorted.sort(
        (a, b) => calculateCategoryMean(a) - calculateCategoryMean(b),
      );
      break;
    case 'alphabetical':
      sorted.sort((a, b) => a.category.localeCompare(b.category));
      break;
  }

  return sorted;
}

/**
 * Calculate deltas between baseline and candidates
 */
export function calculateDeltas(
  baselineSource: DataSource,
  candidateSources: DataSource[],
): DeltaRow[] {
  const baselineResults = flattenDatasetResults(baselineSource.rawData);
  const baselineMap = new Map(
    baselineResults.map((r) => [r.category, r.accuracy_mean]),
  );

  const deltas: DeltaRow[] = [];

  for (const candidate of candidateSources) {
    const candidateResults = flattenDatasetResults(candidate.rawData);
    const candidateLabel = `${candidate.modelName} @ ${candidate.timestamp}${candidate.isOfficial ? ' (Official)' : ''}`;

    for (const result of candidateResults) {
      const baseline = baselineMap.get(result.category);
      if (baseline !== undefined) {
        const delta = result.accuracy_mean - baseline;
        deltas.push({
          category: result.category,
          baseline,
          candidate: result.accuracy_mean,
          delta,
          absDelta: Math.abs(delta),
          candidateLabel,
        });
      }
    }
  }

  return deltas;
}

/**
 * Filter deltas by threshold
 */
export function filterDeltasByThreshold(
  deltas: DeltaRow[],
  threshold: number,
): DeltaRow[] {
  return deltas.filter((d) => d.absDelta >= threshold);
}

/**
 * Sort delta rows
 */
export function sortDeltas(
  deltas: DeltaRow[],
  sortMode: DeltaSortMode,
): DeltaRow[] {
  const sorted = [...deltas];

  switch (sortMode) {
    case 'abs-desc':
      sorted.sort((a, b) => b.absDelta - a.absDelta);
      break;
    case 'delta-desc':
      sorted.sort((a, b) => b.delta - a.delta);
      break;
    case 'delta-asc':
      sorted.sort((a, b) => a.delta - b.delta);
      break;
    case 'category':
      sorted.sort((a, b) => a.category.localeCompare(b.category));
      break;
  }

  return sorted;
}

/**
 * Scale value for display (0-1 or 0-100)
 */
export function scaleValue(value: number, scale0100: boolean): number {
  return scale0100 ? value * 100 : value;
}

/**
 * Format value for display
 */
export function formatValue(value: number, scale0100: boolean): string {
  const scaled = scaleValue(value, scale0100);
  return scaled.toFixed(scale0100 ? 2 : 4);
}
