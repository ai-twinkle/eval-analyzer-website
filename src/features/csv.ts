import type { DeltaRow, PivotRow } from './types';
import { formatValue } from './transform';

/**
 * Convert pivot data to CSV
 */
export function pivotToCSV(data: PivotRow[], scale0100: boolean): string {
  if (data.length === 0) return '';

  // Get all column names (source labels)
  const columns = new Set<string>();
  for (const row of data) {
    for (const key of Object.keys(row)) {
      if (key !== 'category') {
        columns.add(key);
      }
    }
  }

  const columnArray = ['category', ...Array.from(columns).sort()];

  // CSV header
  const csv: string[] = [columnArray.map(escapeCSVField).join(',')];

  // CSV rows
  for (const row of data) {
    const values = columnArray.map((col) => {
      if (col === 'category') {
        return escapeCSVField(row.category);
      }
      const value = row[col];
      if (typeof value === 'number') {
        return formatValue(value, scale0100);
      }
      return '';
    });
    csv.push(values.join(','));
  }

  return csv.join('\n');
}

/**
 * Convert delta data to CSV
 */
export function deltaToCSV(data: DeltaRow[], scale0100: boolean): string {
  if (data.length === 0) return '';

  const csv: string[] = [
    [
      'Category',
      'Candidate',
      'Baseline',
      'Candidate Value',
      'Delta',
      'Abs Delta',
    ]
      .map(escapeCSVField)
      .join(','),
  ];

  for (const row of data) {
    csv.push(
      [
        escapeCSVField(row.category),
        escapeCSVField(row.candidateLabel),
        formatValue(row.baseline, scale0100),
        formatValue(row.candidate, scale0100),
        formatValue(row.delta, scale0100),
        formatValue(row.absDelta, scale0100),
      ].join(','),
    );
  }

  return csv.join('\n');
}

/**
 * Per-candidate delta summary
 */
export function candidateSummaryToCSV(
  data: DeltaRow[],
  scale0100: boolean,
): string {
  if (data.length === 0) return '';

  // Group by candidate
  const candidateMap = new Map<string, DeltaRow[]>();
  for (const row of data) {
    const existing = candidateMap.get(row.candidateLabel) || [];
    existing.push(row);
    candidateMap.set(row.candidateLabel, existing);
  }

  const csv: string[] = [
    ['Candidate', 'Mean Delta', 'Mean Abs Delta', 'Count']
      .map(escapeCSVField)
      .join(','),
  ];

  for (const [candidate, rows] of candidateMap) {
    const meanDelta = rows.reduce((sum, r) => sum + r.delta, 0) / rows.length;
    const meanAbsDelta =
      rows.reduce((sum, r) => sum + r.absDelta, 0) / rows.length;

    csv.push(
      [
        escapeCSVField(candidate),
        formatValue(meanDelta, scale0100),
        formatValue(meanAbsDelta, scale0100),
        rows.length.toString(),
      ].join(','),
    );
  }

  return csv.join('\n');
}

/**
 * Escape CSV field
 */
function escapeCSVField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Download CSV file
 */
export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}
