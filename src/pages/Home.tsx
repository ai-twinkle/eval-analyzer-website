import React, { useEffect, useState, useMemo } from 'react';
import { App } from 'antd';
import { ControlsPanel } from '../components/ControlsPanel';
import { CategoryDashboard } from '../charts/CategoryDashboard';
import type { BenchmarkConfig, DataSource } from '../features/types';
import { BenchmarkConfigSchema } from '../features/types';
import { discoverResultFiles, fetchResultFile } from '../features/discover';
import { deriveSchema, mergeSchemas, validateData } from '../features/schema';
import { parseJSONFile } from '../features/parse';
import { buildPivotTable } from '../features/transform';
import type { ZodType } from 'zod';

export const Home: React.FC = () => {
  const { message } = App.useApp();
  const [config, setConfig] = useState<BenchmarkConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [sources, setSources] = useState<DataSource[]>([]);
  const [dataSchema, setDataSchema] = useState<ZodType | null>(null);

  // UI state
  const [scale0100, setScale0100] = useState(false);

  // Model selection for comparison (simple multi-select)
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);

  // Auto-select new sources
  useEffect(() => {
    const newSourceIds = sources.map((s) => s.id);
    setSelectedSourceIds(newSourceIds);
  }, [sources]);

  // Load config on mount
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}config/benchmarks.config.json`)
      .then((res) => res.json())
      .then((data) => {
        const result = BenchmarkConfigSchema.safeParse(data);
        if (result.success) {
          setConfig(result.data);
          setScale0100(result.data.ui.defaultScale0100);
        } else {
          void message.error('Invalid config file');
        }
      })
      .catch(() => {
        void message.error('Failed to load config');
      });
  }, [message]);

  // Auto-load latest results from all benchmarks when config is loaded
  useEffect(() => {
    if (!config) return;

    const loadAllLatestResults = async () => {
      setLoading(true);
      let errorCount = 0;

      // Load latest result from each benchmark in parallel
      const loadPromises = config.official.map(async (benchmark) => {
        try {
          // Discover available runs
          const files = await discoverResultFiles(
            benchmark.hfFolderUrl,
            config.security.allowOrigins,
          );

          if (files.length === 0) {
            console.warn(`No results found for ${benchmark.label}`);
            return null;
          }

          // Get the latest run (first one)
          const latestRun = files[0];

          // Fetch the result file
          const data = await fetchResultFile(
            benchmark.hfFolderUrl,
            latestRun.filename,
            config.security.allowOrigins,
          );

          // Derive or merge schema
          const newSchema = deriveSchema(data);
          setDataSchema((prevSchema) =>
            prevSchema ? mergeSchemas(prevSchema, newSchema) : newSchema,
          );

          // Validate against schema (silently)
          const validation = validateData(data, newSchema);

          // Extract model name and timestamp from data
          const dataObj = data as {
            config?: { model?: { name?: string } };
            timestamp?: string;
          };
          const modelName = dataObj.config?.model?.name || benchmark.modelName;
          const timestamp = latestRun.displayTimestamp;

          // Create new source
          const newSource: DataSource = {
            id: `official-${benchmark.id}-${latestRun.timestamp}`,
            label: benchmark.label,
            modelName,
            variance: benchmark.variance,
            timestamp,
            isOfficial: true,
            data: validation.data || data,
            rawData: data,
          };

          return newSource;
        } catch (err) {
          errorCount++;
          console.error(`Failed to load ${benchmark.label}:`, err);
          return null;
        }
      });

      const results = await Promise.all(loadPromises);
      
      // Filter out nulls and sort alphabetically by label
      const validSources = results.filter((s): s is DataSource => s !== null);
      validSources.sort((a, b) => a.label.localeCompare(b.label));
      
      // Add all sources at once
      setSources((prev) => {
        const existingIds = new Set(prev.map(s => s.id));
        const newSources = validSources.filter(s => !existingIds.has(s.id));
        return [...prev, ...newSources];
      });

      setLoading(false);

      const successCount = validSources.length;

      // Only show notification if there were errors
      if (errorCount > 0) {
        message.error(
          `Loaded ${successCount} of ${config.official.length} benchmarks (${errorCount} failed)`,
        );
      } else {
        message.success(
          `Loaded latest results from all ${successCount} benchmarks`,
        );
      }
    };

    void loadAllLatestResults();
  }, [config, message]);

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
    return buildPivotTable(selectedSources);
  }, [sources, selectedSourceIds]);

  // Filter selected sources for display
  const selectedSources = useMemo(() => {
    return sources.filter((s) => selectedSourceIds.includes(s.id));
  }, [sources, selectedSourceIds]);

  return (
    <div className='flex h-screen'>
      {/* Sidebar */}
      <div className='w-80 border-r border-gray-200 overflow-y-auto'>
        <ControlsPanel
          onFilesUpload={handleFilesUpload}
          sources={sources}
          selectedSourceIds={selectedSourceIds}
          onSourceSelectionChange={setSelectedSourceIds}
          scale0100={scale0100}
          onScaleToggle={setScale0100}
          pivotData={pivotData}
        />
      </div>

      {/* Main content */}
      <div className='flex-1 overflow-y-auto p-6'>
        <h1 className='text-3xl font-bold mb-6'>Benchmark Visualizer</h1>

        {loading ? (
          <div className='text-center text-gray-500 mt-20'>
            <p className='text-lg'>
              Loading latest results from all benchmarks...
            </p>
            <p className='mt-2 text-sm'>This may take a moment.</p>
          </div>
        ) : sources.length === 0 ? (
          <div className='text-center text-gray-500 mt-20'>
            <p className='text-lg'>No data loaded yet.</p>
            <p className='mt-2'>Upload files to get started.</p>
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
