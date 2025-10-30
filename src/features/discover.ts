/**
 * Filename pattern for result files: results_YYYYMMDD_HHMM.json
 */
const RESULTS_PATTERN = /^results_(\d{8})_(\d{4})\.json$/;

export interface ResultFile {
  filename: string;
  timestamp: string;
  displayTimestamp: string;
}

/**
 * Parse timestamp from filename
 */
export function parseTimestampFromFilename(filename: string): string | null {
  const match = filename.match(RESULTS_PATTERN);
  if (!match) return null;

  const [, dateStr, timeStr] = match;
  // Convert YYYYMMDD_HHMM to YYYY-MM-DD HH:MM
  const year = dateStr.slice(0, 4);
  const month = dateStr.slice(4, 6);
  const day = dateStr.slice(6, 8);
  const hour = timeStr.slice(0, 2);
  const minute = timeStr.slice(2, 4);

  return `${year}-${month}-${day} ${hour}:${minute}`;
}

/**
 * Convert tree URL to resolve URL for file downloads
 */
function convertTreeUrlToResolve(treeUrl: string): string {
  return treeUrl.replace('/tree/', '/resolve/');
}

/**
 * Discover result files from HF folder
 */
export async function discoverResultFiles(
  hfFolderUrl: string,
  allowedOrigins: string[],
): Promise<ResultFile[]> {
  // Check if URL is from an allowed origin
  const url = new URL(hfFolderUrl);
  const isAllowed = allowedOrigins.some((origin) =>
    url.href.startsWith(origin),
  );

  if (!isAllowed) {
    throw new Error(`URL ${hfFolderUrl} is not from an allowed origin`);
  }

  // Strategy 1: Try Hugging Face API (primary for /tree/ URLs)
  try {
    return await discoverFromHuggingFaceAPI(hfFolderUrl);
  } catch (apiError) {
    // Strategy 2: Try to fetch index.json
    try {
      // Convert tree URL to resolve URL for index.json
      const resolveUrl = convertTreeUrlToResolve(hfFolderUrl);
      const indexUrl = resolveUrl.endsWith('/')
        ? `${resolveUrl}index.json`
        : `${resolveUrl}/index.json`;
      const response = await fetch(indexUrl);

      if (response.ok) {
        const filenames = (await response.json()) as string[];
        return parseFilenames(filenames);
      }
    } catch {
      // Ignore and throw original API error
    }

    throw new Error(
      `Failed to discover files from ${hfFolderUrl}. ` + `Error: ${apiError}`,
    );
  }
}

/**
 * Parse filenames into ResultFile objects
 */
function parseFilenames(filenames: string[]): ResultFile[] {
  const results: ResultFile[] = [];

  for (const filename of filenames) {
    const displayTimestamp = parseTimestampFromFilename(filename);
    if (displayTimestamp) {
      results.push({
        filename,
        timestamp: filename.replace('results_', '').replace('.json', ''),
        displayTimestamp,
      });
    }
  }

  // Sort by timestamp descending (latest first)
  results.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  return results;
}

/**
 * Try to discover files using Hugging Face API
 */
async function discoverFromHuggingFaceAPI(
  hfFolderUrl: string,
): Promise<ResultFile[]> {
  // Parse HF URL - support both /tree/ and /resolve/ formats
  // https://huggingface.co/datasets/{owner}/{repo}/tree/{branch}/{path}
  // https://huggingface.co/datasets/{owner}/{repo}/resolve/{branch}/{path}
  const treeMatch = hfFolderUrl.match(
    /https:\/\/huggingface\.co\/datasets\/([^/]+)\/([^/]+)\/tree\/([^/]+)\/(.+)/,
  );

  const resolveMatch = hfFolderUrl.match(
    /https:\/\/huggingface\.co\/datasets\/([^/]+)\/([^/]+)\/resolve\/([^/]+)\/(.+)/,
  );

  const match = treeMatch || resolveMatch;

  if (!match) {
    throw new Error('Not a valid Hugging Face dataset URL');
  }

  const [, owner, repo, branch, path] = match;

  // Use HF API to list files
  const apiUrl = `https://huggingface.co/api/datasets/${owner}/${repo}/tree/${branch}/${path}`;

  const response = await fetch(apiUrl);
  if (!response.ok) {
    throw new Error(`HF API returned ${response.status}`);
  }

  const files = (await response.json()) as Array<{
    type: string;
    path: string;
  }>;
  const filenames = files
    .filter((f) => f.type === 'file')
    .map((f) => f.path.split('/').pop())
    .filter((name): name is string => name !== undefined)
    .filter((name) => name.startsWith('result')); // Only get files starting with "result"

  return parseFilenames(filenames);
}

/**
 * Fetch a result file from HF folder
 */
export async function fetchResultFile(
  hfFolderUrl: string,
  filename: string,
  allowedOrigins: string[],
): Promise<unknown> {
  // Convert tree URL to resolve URL for file downloads
  const resolveUrl = convertTreeUrlToResolve(hfFolderUrl);
  const fileUrl = resolveUrl.endsWith('/')
    ? `${resolveUrl}${filename}`
    : `${resolveUrl}/${filename}`;

  // Check if URL is from an allowed origin
  const url = new URL(fileUrl);
  const isAllowed = allowedOrigins.some((origin) =>
    url.href.startsWith(origin),
  );

  if (!isAllowed) {
    throw new Error(`URL ${fileUrl} is not from an allowed origin`);
  }

  const response = await fetch(fileUrl);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch ${fileUrl}: ${response.status} ${response.statusText}`,
    );
  }

  return response.json();
}
