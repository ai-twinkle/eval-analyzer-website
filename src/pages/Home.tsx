import React, { useEffect, useState, useMemo } from 'react';
import { App, Button, Flex, Radio, Space } from 'antd';
import {
  BarChartOutlined,
  TableOutlined,
  GithubOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { ControlsPanel } from '../components/ControlsPanel';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { CategoryDashboard } from '../charts/CategoryDashboard';
import { BenchmarkRankingTable } from '../charts/BenchmarkRankingTable';
import {
  type BenchmarkConfig,
  BenchmarkConfigSchema,
  type DataSource,
} from '../types';
import { discoverResultFiles, fetchResultFile } from '../features/discover';
import { deriveSchema, mergeSchemas, validateData } from '../features/schema';
import { parseJSONFile } from '../features/parse';
import { buildPivotTable } from '../features/transform';
import type { ZodType } from 'zod';

type ViewMode = 'dashboard' | 'table';

export const Home: React.FC = () => {
  const { message } = App.useApp();
  const { t } = useTranslation();
  const [config, setConfig] = useState<BenchmarkConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [sources, setSources] = useState<DataSource[]>([]);
  const [dataSchema, setDataSchema] = useState<ZodType | null>(null);

  // UI state
  const [scale0100, setScale0100] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('dashboard');

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
          void message.error(t('messages.invalidConfig'));
        }
      })
      .catch(() => {
        void message.error(t('messages.failedLoadConfig'));
      });
  }, [message]);

  // Autoload latest results from all benchmarks when config is loaded
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
        const existingIds = new Set(prev.map((s) => s.id));
        const newSources = validSources.filter((s) => !existingIds.has(s.id));
        return [...prev, ...newSources];
      });

      setLoading(false);

      const successCount = validSources.length;

      // Only show notification if there were errors
      if (errorCount > 0) {
        message.error(
          t('messages.loadedPartial', {
            success: successCount,
            total: config.official.length,
            failed: errorCount,
          }),
        );
      } else {
        message.success(t('messages.loadedResults', { count: successCount }));
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
              t('messages.schemaMismatch', {
                filename: file.name,
                error: validation.error,
              }),
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
        message.success(t('messages.loadedFile', { filename: file.name }));
      } catch (err) {
        message.error(
          t('messages.failedParse', {
            filename: file.name,
            error: String(err),
          }),
        );
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
      <div className='flex-1 overflow-y-auto p-6 pt-0'>
        {/* Header with title and view toggle - Sticky and half opacity*/}
        <div className='sticky top-0 z-10 bg-white pt-6 pb-4 mb-2 border-b border-gray-200'>
          <Flex justify='space-between' align='center'>
            <h1 className='text-2xl font-bold !mb-0'>{t('app.title')}</h1>
            <Space size={'small'}>
              <LanguageSwitcher />
              {/* View Mode Toggle */}
              <Radio.Group
                value={viewMode}
                onChange={(e) => setViewMode(e.target.value)}
                buttonStyle='solid'
                size={'middle'}
              >
                <Radio.Button value='dashboard'>
                  <BarChartOutlined /> {t('view.dashboard')}
                </Radio.Button>
                <Radio.Button value='table'>
                  <TableOutlined /> {t('view.table')}
                </Radio.Button>
              </Radio.Group>
              <Button
                variant={'text'}
                shape='circle'
                href='https://github.com/ai-twinkle/eval-analyzer-website'
                target='_blank'
                rel='noopener noreferrer'
                title='View on GitHub'
                icon={<GithubOutlined className={'!text-xl'} />}
                className={'!border-none'}
              />
            </Space>
          </Flex>
        </div>

        {loading ? (
          <div className='text-center text-gray-500 mt-20'>
            <p className='text-lg'>{t('app.loading')}</p>
            <p className='mt-2 text-sm'>{t('app.loadingNote')}</p>
          </div>
        ) : sources.length === 0 ? (
          <div className='text-center text-gray-500 mt-20'>
            <p className='text-lg'>{t('app.noData')}</p>
            <p className='mt-2'>{t('app.noDataHint')}</p>
          </div>
        ) : selectedSourceIds.length === 0 ? (
          <div className='text-center text-gray-500 mt-20'>
            <p className='text-lg'>{t('app.noSelection')}</p>
            <p className='mt-2'>{t('app.noSelectionHint')}</p>
          </div>
        ) : viewMode === 'dashboard' ? (
          <CategoryDashboard sources={selectedSources} scale0100={scale0100} />
        ) : (
          <BenchmarkRankingTable
            sources={selectedSources}
            scale0100={scale0100}
          />
        )}
      </div>
    </div>
  );
};
