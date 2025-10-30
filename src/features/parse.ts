/**
 * Tolerant JSON/JSONL parser
 */
export function parseJSON(content: string): unknown {
  // Try standard JSON first
  try {
    return JSON.parse(content);
  } catch {
    // Try JSONL (line-by-line JSON)
    try {
      const lines = content
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .filter((line) => !line.startsWith('//')) // ignore comments
        .map((line) => line.replace(/,\s*$/, '')); // trim trailing commas

      if (lines.length === 0) {
        throw new Error('No valid JSON lines found');
      }

      // If single line, return single object
      if (lines.length === 1) {
        return JSON.parse(lines[0]);
      }

      // Multiple lines - return array of objects
      return lines.map((line) => JSON.parse(line));
    } catch (error) {
      throw new Error(`Failed to parse as JSON or JSONL: ${error}`);
    }
  }
}

/**
 * Parse a file that might be JSON or JSONL
 */
export async function parseJSONFile(file: File): Promise<unknown> {
  const content = await file.text();
  return parseJSON(content);
}
