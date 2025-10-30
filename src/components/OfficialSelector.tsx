import React from 'react';
import { Select } from 'antd';
import { DatabaseOutlined } from '@ant-design/icons';
import type { BenchmarkConfig } from '../features/types';

interface OfficialSelectorProps {
  config: BenchmarkConfig | null;
  selectedBenchmarkId: string | null;
  onSelect: (id: string) => void;
}

export const OfficialSelector: React.FC<OfficialSelectorProps> = ({
  config,
  selectedBenchmarkId,
  onSelect,
}) => {
  if (!config) return null;

  const options = config.official.map((b) => ({
    label: b.label,
    value: b.id,
  }));

  return (
    <div className='mb-4'>
      <div className='flex items-center mb-2'>
        <DatabaseOutlined className='mr-2' />
        <span className='font-medium'>Official Benchmark</span>
      </div>
      <Select
        style={{ width: '100%' }}
        placeholder='Select benchmark'
        value={selectedBenchmarkId}
        onChange={onSelect}
        options={options}
      />
    </div>
  );
};
