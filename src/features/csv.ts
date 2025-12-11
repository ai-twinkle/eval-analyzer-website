import type { PivotRow } from '../types';
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
