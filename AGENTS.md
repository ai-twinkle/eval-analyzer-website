# TASK PROMPT — Serverless Official Benchmark Visualizer (React+TS, AntD, D3)

**No backend. Config-driven. Derive schema from data.**

## 1) Product Overview (high view of what we want)

Build a **static site** (deployable to GitHub Pages/Netlify/Vercel static) that:

- Loads a **client-side config** describing the official benchmark source(s):
  `{ provider, modelName, variance, openSource, hfFolderUrl }`.
- From `hfFolderUrl` (a Hugging Face directory), lists and fetches timestamped result files named like `results_YYYYMMDD_HHMM.json`.
  - Default to **latest** by parsing timestamps.
  - Provide a dropdown to select any available timestamped run.

- Allows users to **upload multiple** JSON/JSONL files for side-by-side comparison.
- Uses **D3 + TypeScript** for all visualizations; **Tailwind CSS** for styling and layout with **Ant Design** components and **Ant Icons** (no emojis in product UI).
- **Schema is inferred from the input JSON** at runtime and used to validate subsequent files.

## 2) Inputs we provide

- `public/config/benchmarks.config.json` (static, fetched at runtime).
- `results_example.json` (place in `public/examples/`).
- (Optional) an example Hugging Face folder populated with timestamped results.

## 3) Config (exact shape; extend if needed)

```json
{
  "official": [
    {
      "id": "twinkle_eval_v1",
      "label": "Twinkle Eval v1 — Official",
      "provider": "HuggingFace",
      "modelName": "gpt-xyz-128k",
      "variance": "default",
      "openSource": false,
      "hfFolderUrl": "https://huggingface.co/datasets/<owner>/<repo>/resolve/main/results/"
    }
  ],
  "ui": {
    "defaultScale0100": false,
    "pageSizes": [10, 20, 30, 50, 100]
  },
  "security": {
    "allowOrigins": [
      "https://huggingface.co",
      "https://raw.githubusercontent.com"
    ]
  }
}
```

**Notes (static-only constraints):**

- We cannot list a “folder” over raw HTTPS unless an index endpoint exists. Support **two strategies**:
  1. **Manifest file (preferred)**: If `hfFolderUrl` ends with `/results/`, first try to fetch `index.json` there, which lists available result filenames (e.g., `["results_20250408_1216.json", ...]`).
  2. **Hugging Face API fallback**: If no manifest, call the public listing API for the repo path (must be CORS-allowed) to enumerate files, then filter names by the `results_YYYYMMDD_HHMM.json` pattern.

- Only fetch from **allowlisted origins** in `security.allowOrigins`.

## 4) Data & Schema (derive, don’t guess)

- **Parse the first loaded official or example file** to derive schema:
  - Inspect keys/arrays/number types; mark optional fields when missing across samples.
  - Build a Zod schema (or equivalent) **programmatically** from the observed shape.
  - Generate TS types from the schema (e.g., `z.infer`).

- Validate all subsequently loaded JSON (official or uploads) **against the derived schema**.
  - If a new file introduces a broader shape, merge schemas safely (union/optional) and re-validate.

- **Support JSONL**: if standard JSON parse fails, try line-by-line JSONL (trim trailing commas).

## 5) Frontend (no backend)

- **Stack**: Vite, React 18, TypeScript (strict), Tailwind CSS, Ant Design v5, @ant-design/icons, D3 v7+.
- **Layout**: Tailwind CSS flexbox/grid layout with sidebar (controls) + main content (visualizations).
- **Controls** (Ant Icons only):
  - Official run selector:
    - First select Official Benchmark (`DatabaseOutlined`) from `config.official`.
    - Then select Run Timestamp (`ClockCircleOutlined`) built from available filenames. Default to latest.

  - Upload (multi) `.json`/`.jsonl` (`FileAddOutlined`).
  - Scale toggle 0–1 / 0–100 (`SlidersOutlined`).
  - Page size select (from config).
  - Sort mode select (mean desc / mean asc / A→Z).
  - Δ analysis panel: Baseline (single) & Candidates (multi); Δ sort (`|Δ| desc` / `Δ desc` / `Δ asc` / `Category`); threshold numeric (`SlidersOutlined`); inline help (`InfoCircleOutlined`).

- **Labels**: Each source labeled `<model> @ <timestamp>`; append `(Official)` for official sources.

## 6) Visualizations (D3 + TypeScript)

Implement D3-only responsive SVG (ResizeObserver). Provide these views:

1. **GroupedBars** (`BarChartOutlined`): category × metric, grouped by source.
2. **PivotHeatmap**: category × source_label matrix, color = metric.
3. **DeltaSlopegraph** (`ForkOutlined`): baseline vs candidate per category; color by sign(Δ).
4. **DeltaRanking**: horizontal bars of Δ; sortable; optional facet by candidate; brush selection.
5. **Beeswarm**: per-candidate Δ distribution to reveal density/outliers.

**Tables & Export**

- AntD `Table` for pivot and Δ summaries.
- CSV export buttons (`DownloadOutlined`) for current pivot page, full Δ ranking, and per-candidate summaries.

## 7) Data processing rules (explicit)

- Raw scores remain **0–1**; derive **×100** only for display/CSV when toggle is on.
- Normalize dataset keys (strip leading `datasets/`).
- `category` = filename stem.
- Build wide pivot (category × source); compute Δ = candidate − baseline.
- Threshold filter: keep rows with `|Δ| ≥ threshold`.
- Sorting:
  - Original scores: mean per category desc/asc or alphabetical.
  - Δ views: `|Δ| desc`, `Δ desc`, `Δ asc`, `Category`.

## 8) File discovery in `hfFolderUrl` (client-side)

- **Filename pattern**: `results_YYYYMMDD_HHMM.json`
  - Extract `YYYY-MM-DD HH:MM` for display.
  - “Latest” = max timestamp by filename.

- **Discovery flow**:
  1. Try fetch `${hfFolderUrl}/index.json` → array of filenames.
  2. If absent, try HF API listing for that path (must be CORS-allowed).
  3. Filter by pattern; build dropdown of runs.

- **Fetch** the selected file via HTTPS; validate against schema; add to sources.

> If remote listing is blocked by CORS, instruct users to add a `index.json` manifest in that folder (documented in README).

## 9) Project structure (static)

```
/public
  /config/benchmarks.config.json
  /examples/results_example.json
/src
  /components
    ControlsPanel.tsx
    OfficialSelector.tsx
    RunSelector.tsx
    FileUploader.tsx
    Legend.tsx
    DownloadButtons.tsx
  /charts
    GroupedBars.tsx
    PivotHeatmap.tsx
    DeltaSlopegraph.tsx
    DeltaRanking.tsx
    Beeswarm.tsx
    ChartUtils.ts
  /features
    schema.ts          // derive/merge schema from data (Zod helpers)
    types.ts           // types inferred from schema
    parse.ts           // tolerant JSON/JSONL parsing
    discover.ts        // folder listing strategies + filename timestamp parser
    transform.ts       // flatten, pivot, Δ, sorting
    csv.ts
  /pages
    Home.tsx
  App.tsx
  main.tsx
  index.css
vite.config.ts
package.json
tsconfig.json
README.md
```

## 10) Quality, Accessibility, Security

- TypeScript **strict**; no `any` in app code. ESLint (ts, react, hooks) + Prettier clean.
- Keyboard navigable; color contrast via AntD tokens.
- Only fetch from `security.allowOrigins` in config; ignore user-provided URLs.
- Performance: memoize transforms; virtualize big tables if needed.

## 11) `results_example.json`

```json
{
  "timestamp": "2025-10-01T12:34:56Z",
  "config": { "model": { "name": "gpt-xyz-128k" } },
  "dataset_results": {
    "datasets/twinkle_eval_v1": {
      "average_accuracy": 0.742,
      "results": [
        { "file": "math.arithmetic.jsonl", "accuracy_mean": 0.81 },
        { "file": "logic.symbolic.jsonl", "accuracy_mean": 0.67 },
        { "file": "coding.read-json.jsonl", "accuracy_mean": 0.75 },
        { "file": "safety.judgement.jsonl", "accuracy_mean": 0.74 }
      ]
    },
    "datasets/twinkle_eval_extra": {
      "results": [
        { "file": "reasoning.chain.jsonl", "accuracy_mean": 0.71 },
        { "file": "qa.trivia.jsonl", "accuracy_mean": 0.76 }
      ]
    }
  }
}
```

## 12) Acceptance Criteria

- Site is **purely static** and runs with `vite build` output only.
- On load, site fetches `benchmarks.config.json`, lists official benchmarks, discovers runs from `hfFolderUrl`, defaults to the **latest**, and allows switching runs.
- Users can upload multiple JSON/JSONL files; all sources appear together and are validated against the **derived** schema.
- All five D3 charts render; controls (scale toggle, paging, sorting, Δ threshold) work.
- Δ analysis (baseline/candidates, sorting, threshold) and CSV exports work.
- No emojis appear in the product UI; only **Ant Design Icons**.
