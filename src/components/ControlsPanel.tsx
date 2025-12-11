import React, { useState } from 'react';
import { Switch, Checkbox, Divider, Button, List, Input } from 'antd';
import {
  SlidersOutlined,
  CheckSquareOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { FileUploader } from './FileUploader';
import { DownloadButtons } from './DownloadButtons';
import type { DataSource, PivotRow } from '../types';
import Item from 'antd/es/list/Item';

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
  const { t } = useTranslation();
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

  const [searchText, setSearchText] = useState('');

  const filteredSources = sources.filter((source) => {
    const searchLower = searchText.toLowerCase();
    return (
      source.modelName.toLowerCase().includes(searchLower) ||
      source.variance.toLowerCase().includes(searchLower) ||
      source.timestamp.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className='h-full overflow-y-auto p-4 bg-gray-50'>
      <h2 className='text-xl font-bold mb-4'>{t('controls.title')}</h2>

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
                {t('controls.selectModels')}
              </span>
              <div className='space-x-2'>
                <Button
                  type='link'
                  size='small'
                  onClick={handleSelectAll}
                  style={{ padding: 0, height: 'auto' }}
                >
                  {t('controls.all')}
                </Button>
                <span className='text-gray-400'>|</span>
                <Button
                  type='link'
                  size='small'
                  onClick={handleClearAll}
                  style={{ padding: 0, height: 'auto' }}
                >
                  {t('controls.none')}
                </Button>
              </div>
            </div>
            <Input
              placeholder={t('controls.searchPlaceholder')}
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
              className='mb-2'
            />
            <List className='space-y-2 max-h-70 overflow-y-auto'>
              {filteredSources.map((source) => (
                <Item key={source.id} className='flex items-center'>
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
                          ({t('controls.official')})
                        </span>
                      )}
                      <div className='text-xs text-gray-500'>
                        {source.timestamp}
                      </div>
                    </span>
                  </Checkbox>
                </Item>
              ))}
            </List>
          </div>
        </>
      )}

      <Divider />

      {/* Scale Toggle */}
      <div className='mb-4'>
        <div className='flex items-center justify-between mb-2'>
          <span className='font-medium flex items-center'>
            <SlidersOutlined className='mr-2' />
            {t('controls.scale')}
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
