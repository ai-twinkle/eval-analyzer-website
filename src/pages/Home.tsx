import React, { useEffect, useState, useMemo } from 'react';
import { App } from 'antd';
import { ControlsPanel } from '../components/ControlsPanel';
import { CategoryDashboard } from '../charts/CategoryDashboard';
import type { BenchmarkConfig, DataSource, SortMode } from '../features/types';
import { BenchmarkConfigSchema } from '../features/types';
import type { ResultFile } from '../features/discover';
import { discoverResultFiles, fetchResultFile } from '../features/discover';
import { deriveSchema, mergeSchemas, validateData } from '../features/schema';
import { parseJSONFile } from '../features/parse';
import { buildPivotTable, sortPivotTable } from '../features/transform';
import type { ZodSchema } from 'zod';

export const Home: React.FC = () => {
  const { message } = App.useApp();
  const [config, setConfig] = useState<BenchmarkConfig | null>(null);
  const [selectedBenchmarkId, setSelectedBenchmarkId] = useState<string | null>(
    null,
  );
  const [runs, setRuns] = useState<ResultFile[]>([]);
  const [selectedRun, setSelectedRun] = useState<string | null>(null);
  const [runsLoading, setRunsLoading] = useState(false);
  const [sources, setSources] = useState<DataSource[]>([]);
  const [dataSchema, setDataSchema] = useState<ZodSchema | null>(null);

  // UI state
  const [scale0100, setScale0100] = useState(false);
  const [pageSize, setPageSize] = useState(20);
  const [sortMode, setSortMode] = useState<SortMode>('mean-desc');

  // Model selection for comparison (simple multi-select)
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);

  // Auto-select new sources
  useEffect(() => {
    const newSourceIds = sources.map((s) => s.id);
    setSelectedSourceIds(newSourceIds);
  }, [sources]);

  // Load config on mount
  useEffect(() => {
    fetch('/config/benchmarks.config.json')
      .then((res) => res.json())
      .then((data) => {
        const result = BenchmarkConfigSchema.safeParse(data);
        if (result.success) {
          setConfig(result.data);
          setPageSize(result.data.ui.pageSizes[0]);
          setScale0100(result.data.ui.defaultScale0100);
        } else {
          message.error('Invalid config file');
        }
      })
      .catch(() => {
        message.error('Failed to load config');
      });
  }, [message]);

  // Discover runs when benchmark is selected
  useEffect(() => {
    if (!selectedBenchmarkId || !config) return;

    const benchmark = config.official.find((b) => b.id === selectedBenchmarkId);
    if (!benchmark) return;

    setRunsLoading(true);
    setRuns([]);
    setSelectedRun(null);

    discoverResultFiles(benchmark.hfFolderUrl, config.security.allowOrigins)
      .then((files) => {
        setRuns(files);
        if (files.length > 0) {
          // Auto-select latest run
          setSelectedRun(files[0].timestamp);
        }
      })
      .catch((err) => {
        message.error(`Failed to discover runs: ${err.message}`);
      })
      .finally(() => {
        setRunsLoading(false);
      });
  }, [selectedBenchmarkId, config, message]);

  // Load selected run
  useEffect(() => {
    if (!selectedRun || !selectedBenchmarkId || !config) return;

    const benchmark = config.official.find((b) => b.id === selectedBenchmarkId);
    if (!benchmark) return;

    const run = runs.find((r) => r.timestamp === selectedRun);
    if (!run) return;

    fetchResultFile(
      benchmark.hfFolderUrl,
      run.filename,
      config.security.allowOrigins,
    )
      .then((data) => {
        // Derive or merge schema using functional update
        const newSchema = deriveSchema(data);
        setDataSchema((prevSchema) =>
          prevSchema ? mergeSchemas(prevSchema, newSchema) : newSchema,
        );

        // Validate against schema
        const validation = validateData(data, newSchema);
        if (!validation.success) {
          message.warning(`Schema validation warning: ${validation.error}`);
        }

        // Extract model name and timestamp from data
        const dataObj = data as {
          config?: { model?: { name?: string } };
          timestamp?: string;
        };
        const modelName = dataObj.config?.model?.name || benchmark.modelName;
        const timestamp = run.displayTimestamp;

        // Add to sources
        const newSource: DataSource = {
          id: `official-${benchmark.id}-${run.timestamp}`,
          label: benchmark.label,
          modelName,
          variance: benchmark.variance,
          timestamp,
          isOfficial: true,
          data: validation.data || data,
          rawData: data,
        };

        // Replace existing official source or add new
        setSources((prev) => {
          const filtered = prev.filter(
            (s) => !s.id.startsWith(`official-${benchmark.id}`),
          );
          return [...filtered, newSource];
        });

        message.success(`Loaded ${benchmark.label} @ ${timestamp}`);
      })
      .catch((err) => {
        message.error(`Failed to load run: ${err.message}`);
      });
  }, [selectedRun, selectedBenchmarkId, config, runs, message]);

  // Handle file uploads
  const handleFilesUpload = async (files: File[]) => {
    for (const file of files) {
      try {
        const data = await parseJSONFile(file);

        // Validate against existing schema
        if (dataSchema) {
          const validation = validateData(data, dataSchema);
          if (!validation.success) {
            message.warning(
              `${file.name}: Schema mismatch - ${validation.error}`,
            );
            // Still try to merge schemas
            const newSchema = deriveSchema(data);
            setDataSchema(mergeSchemas(dataSchema, newSchema));
          }
        } else {
          // First file - derive schema
          setDataSchema(deriveSchema(data));
        }

        // Extract metadata
        const dataObj = data as {
          config?: { model?: { name?: string } };
          timestamp?: string;
        };
        const modelName =
          dataObj.config?.model?.name ||
          file.name.replace(/\.(json|jsonl)$/, '');
        const timestamp = dataObj.timestamp || new Date().toISOString();

        const newSource: DataSource = {
          id: `upload-${Date.now()}-${Math.random()}`,
          label: file.name,
          modelName,
          variance: 'default',
          timestamp,
          isOfficial: false,
          data,
          rawData: data,
        };

        setSources((prev) => [...prev, newSource]);
        message.success(`Loaded ${file.name}`);
      } catch (err) {
        message.error(`Failed to parse ${file.name}: ${err}`);
      }
    }
  };

  // Compute pivot data for selected sources only
  const pivotData = useMemo(() => {
    if (selectedSourceIds.length === 0) return [];
    const selectedSources = sources.filter((s) =>
      selectedSourceIds.includes(s.id),
    );
    const pivot = buildPivotTable(selectedSources);
    return sortPivotTable(pivot, sortMode);
  }, [sources, selectedSourceIds, sortMode]);

  // Filter selected sources for display
  const selectedSources = useMemo(() => {
    return sources.filter((s) => selectedSourceIds.includes(s.id));
  }, [sources, selectedSourceIds]);

  return (
    <div className='flex h-screen'>
      {/* Sidebar */}
      <div className='w-80 border-r border-gray-200 overflow-y-auto'>
        <ControlsPanel
          config={config}
          selectedBenchmarkId={selectedBenchmarkId}
          onBenchmarkSelect={setSelectedBenchmarkId}
          runs={runs}
          selectedRun={selectedRun}
          onRunSelect={setSelectedRun}
          runsLoading={runsLoading}
          onFilesUpload={handleFilesUpload}
          sources={sources}
          selectedSourceIds={selectedSourceIds}
          onSourceSelectionChange={setSelectedSourceIds}
          scale0100={scale0100}
          onScaleToggle={setScale0100}
          pageSize={pageSize}
          onPageSizeChange={setPageSize}
          sortMode={sortMode}
          onSortModeChange={setSortMode}
          pivotData={pivotData}
          deltaData={[]}
        />
      </div>

      {/* Main content */}
      <div className='flex-1 overflow-y-auto p-6'>
        <h1 className='text-3xl font-bold mb-6'>Benchmark Visualizer</h1>

        {sources.length === 0 ? (
          <div className='text-center text-gray-500 mt-20'>
            <p className='text-lg'>No data loaded yet.</p>
            <p className='mt-2'>
              Select an official benchmark or upload files to get started.
            </p>
          </div>
        ) : selectedSourceIds.length === 0 ? (
          <div className='text-center text-gray-500 mt-20'>
            <p className='text-lg'>No models selected.</p>
            <p className='mt-2'>
              Select one or more models from the sidebar to compare.
            </p>
          </div>
        ) : (
          <CategoryDashboard sources={selectedSources} scale0100={scale0100} />
        )}
      </div>
    </div>
  );
};
