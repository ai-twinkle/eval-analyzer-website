import React from 'react';
import { Switch, Checkbox, Divider } from 'antd';
import { SlidersOutlined, CheckSquareOutlined } from '@ant-design/icons';
import { FileUploader } from './FileUploader';
import { DownloadButtons } from './DownloadButtons';
import type { DataSource, PivotRow } from '../features/types';

interface ControlsPanelProps {
  onFilesUpload: (files: File[]) => void;
  sources: DataSource[];
  selectedSourceIds: string[];
  onSourceSelectionChange: (ids: string[]) => void;
  scale0100: boolean;
  onScaleToggle: (checked: boolean) => void;
  pivotData: PivotRow[];
}

export const ControlsPanel: React.FC<ControlsPanelProps> = ({
  onFilesUpload,
  sources,
  selectedSourceIds,
  onSourceSelectionChange,
  scale0100,
  onScaleToggle,
  pivotData,
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

      <Divider />

      {/* Download Buttons */}
      <DownloadButtons pivotData={pivotData} scale0100={scale0100} />
    </div>
  );
};
