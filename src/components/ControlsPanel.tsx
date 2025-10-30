import React from 'react';
import { Select, Switch, Checkbox, Divider } from 'antd';
import { SlidersOutlined, CheckSquareOutlined } from '@ant-design/icons';
import { OfficialSelector } from './OfficialSelector';
import { RunSelector } from './RunSelector';
import { FileUploader } from './FileUploader';
import { DownloadButtons } from './DownloadButtons';
import type {
  BenchmarkConfig,
  DataSource,
  SortMode,
  PivotRow,
  DeltaRow,
} from '../features/types';
import type { ResultFile } from '../features/discover';

interface ControlsPanelProps {
  config: BenchmarkConfig | null;
  selectedBenchmarkId: string | null;
  onBenchmarkSelect: (id: string) => void;
  runs: ResultFile[];
  selectedRun: string | null;
  onRunSelect: (timestamp: string) => void;
  runsLoading: boolean;
  onFilesUpload: (files: File[]) => void;
  sources: DataSource[];
  selectedSourceIds: string[];
  onSourceSelectionChange: (ids: string[]) => void;
  scale0100: boolean;
  onScaleToggle: (checked: boolean) => void;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  sortMode: SortMode;
  onSortModeChange: (mode: SortMode) => void;
  pivotData: PivotRow[];
  deltaData: DeltaRow[];
}

export const ControlsPanel: React.FC<ControlsPanelProps> = ({
  config,
  selectedBenchmarkId,
  onBenchmarkSelect,
  runs,
  selectedRun,
  onRunSelect,
  runsLoading,
  onFilesUpload,
  sources,
  selectedSourceIds,
  onSourceSelectionChange,
  scale0100,
  onScaleToggle,
  pageSize,
  onPageSizeChange,
  sortMode,
  onSortModeChange,
  pivotData,
  deltaData,
}) => {
  const handleSelectAll = () => {
    onSourceSelectionChange(sources.map((s) => s.id));
  };

  const handleClearAll = () => {
    onSourceSelectionChange([]);
  };

  const handleToggleSource = (id: string, checked: boolean) => {
    if (checked) {
      onSourceSelectionChange([...selectedSourceIds, id]);
    } else {
      onSourceSelectionChange(selectedSourceIds.filter((sid) => sid !== id));
    }
  };

  return (
    <div className='h-full overflow-y-auto p-4 bg-gray-50'>
      <h2 className='text-xl font-bold mb-4'>Controls</h2>

      {/* Official Benchmark Selection */}
      <OfficialSelector
        config={config}
        selectedBenchmarkId={selectedBenchmarkId}
        onSelect={onBenchmarkSelect}
      />

      {/* Run Timestamp Selection */}
      <RunSelector
        runs={runs}
        selectedRun={selectedRun}
        onSelect={onRunSelect}
        loading={runsLoading}
      />

      <Divider />

      {/* File Upload */}
      <FileUploader onFilesSelected={onFilesUpload} />

      <Divider />

      {/* Model Selection for Comparison */}
      {sources.length > 0 && (
        <>
          <div className='mb-4'>
            <div className='font-medium mb-2 flex items-center justify-between'>
              <span className='flex items-center'>
                <CheckSquareOutlined className='mr-2' />
                Select Models to Compare
              </span>
              <div className='space-x-2'>
                <a
                  onClick={handleSelectAll}
                  className='text-xs text-blue-600 cursor-pointer hover:underline'
                >
                  All
                </a>
                <span className='text-gray-400'>|</span>
                <a
                  onClick={handleClearAll}
                  className='text-xs text-blue-600 cursor-pointer hover:underline'
                >
                  None
                </a>
              </div>
            </div>
            <div className='space-y-2 max-h-60 overflow-y-auto border rounded p-2 bg-white'>
              {sources.map((source) => (
                <div key={source.id} className='flex items-center'>
                  <Checkbox
                    checked={selectedSourceIds.includes(source.id)}
                    onChange={(e) =>
                      handleToggleSource(source.id, e.target.checked)
                    }
                  >
                    <span className='text-sm'>
                      {source.modelName}
                      {source.variance !== 'default' && (
                        <span className='ml-1 text-xs text-gray-600'>
                          ({source.variance})
                        </span>
                      )}
                      {source.isOfficial && (
                        <span className='ml-1 text-xs text-blue-600'>
                          (Official)
                        </span>
                      )}
                      <div className='text-xs text-gray-500'>
                        {source.timestamp}
                      </div>
                    </span>
                  </Checkbox>
                </div>
              ))}
            </div>
          </div>

          <Divider />
        </>
      )}

      <Divider />

      {/* Scale Toggle */}
      <div className='mb-4'>
        <div className='flex items-center justify-between mb-2'>
          <span className='font-medium flex items-center'>
            <SlidersOutlined className='mr-2' />
            Scale
          </span>
          <Switch
            checked={scale0100}
            onChange={onScaleToggle}
            checkedChildren='0-100'
            unCheckedChildren='0-1'
          />
        </div>
      </div>

      {/* Page Size */}
      {config && (
        <div className='mb-4'>
          <div className='font-medium mb-2'>Page Size</div>
          <Select
            style={{ width: '100%' }}
            value={pageSize}
            onChange={onPageSizeChange}
            options={config.ui.pageSizes.map((size) => ({
              label: size.toString(),
              value: size,
            }))}
          />
        </div>
      )}

      {/* Sort Mode */}
      <div className='mb-4'>
        <div className='font-medium mb-2'>Sort Mode</div>
        <Select
          style={{ width: '100%' }}
          value={sortMode}
          onChange={onSortModeChange}
          options={[
            { label: 'Mean (High to Low)', value: 'mean-desc' },
            { label: 'Mean (Low to High)', value: 'mean-asc' },
            { label: 'Alphabetical', value: 'alphabetical' },
          ]}
        />
      </div>

      <Divider />

      {/* Download Buttons */}
      <DownloadButtons
        pivotData={pivotData}
        deltaData={deltaData}
        scale0100={scale0100}
      />
    </div>
  );
};
