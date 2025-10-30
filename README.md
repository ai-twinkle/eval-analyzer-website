# Eval Analyzer Website

Serverless Official Benchmark Visualizer built with React, TypeScript, Ant Design, and D3.

## Features

- **Config-Driven**: Load official benchmark sources from a client-side configuration file
- **HuggingFace Integration**: Automatically discover and fetch timestamped result files from HuggingFace datasets
- **Multi-File Upload**: Upload and compare multiple JSON/JSONL result files side-by-side
- **Dynamic Schema Inference**: Schema is derived from data at runtime using Zod
- **Interactive Visualizations**: Five D3-powered charts including grouped bars, heatmaps, slopegraphs, delta rankings, and beeswarm plots
- **Delta Analysis**: Compare baseline vs candidates with threshold filtering and multiple sort modes
- **CSV Export**: Export pivot tables, delta rankings, and candidate summaries
- **Fully Static**: Deployable to GitHub Pages, Netlify, or Vercel without a backend

## Quick Start

### Development

```bash
npm install
npm run dev
```

### Build for Production

```bash
npm run build
npm run preview
```

## Configuration

Edit `public/config/benchmarks.config.json` to configure official benchmark sources:

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

## HuggingFace Integration

The app discovers result files from HuggingFace using two strategies:

1. **Manifest File (Recommended)**: Place an `index.json` file in your results folder listing available files:

   ```json
   ["results_20250408_1216.json", "results_20250407_0930.json"]
   ```

2. **HuggingFace API Fallback**: If no manifest exists, the app attempts to use the HF API to list files (requires CORS to be enabled)

### Result File Naming Convention

Files must follow the pattern: `results_YYYYMMDD_HHMM.json`

- Example: `results_20250408_1216.json` → displayed as "2025-04-08 12:16"
- The latest file (by timestamp) is automatically selected by default

## Data Format

Expected JSON structure:

```json
{
  "timestamp": "2025-10-01T12:34:56Z",
  "config": {
    "model": {
      "name": "gpt-xyz-128k"
    }
  },
  "dataset_results": {
    "datasets/benchmark_name": {
      "average_accuracy": 0.742,
      "results": [
        {
          "file": "category.task.jsonl",
          "accuracy_mean": 0.81,
          "accuracy_std": 0.02
        }
      ]
    }
  }
}
```

JSONL format is also supported (one JSON object per line).

## Tech Stack

- **React 18** + **TypeScript** (strict mode)
- **Vite** for fast development and building
- **Ant Design v5** for UI components
- **Ant Design Icons** (no emojis in UI)
- **D3 v7+** for all visualizations
- **Tailwind CSS v4** for styling
- **Zod** for runtime schema validation

## Project Structure

```
/public
  /config/benchmarks.config.json    # Configuration
  /examples/results_example.json    # Example data
/src
  /components                        # UI components
  /charts                           # D3 visualizations
  /features                         # Core logic (parse, transform, schema, etc.)
  /pages                            # Page components
  App.tsx                           # Root component
  main.tsx                          # Entry point
```

## License

MIT
