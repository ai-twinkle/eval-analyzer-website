import React from 'react';
import { Select } from 'antd';
import { ClockCircleOutlined } from '@ant-design/icons';
import type { ResultFile } from '../features/discover';

interface RunSelectorProps {
  runs: ResultFile[];
  selectedRun: string | null;
  onSelect: (timestamp: string) => void;
  loading?: boolean;
}

export const RunSelector: React.FC<RunSelectorProps> = ({
  runs,
  selectedRun,
  onSelect,
  loading = false,
}) => {
  const options = runs.map((r) => ({
    label: `${r.displayTimestamp}${r.timestamp === runs[0]?.timestamp ? ' (Latest)' : ''}`,
    value: r.timestamp,
  }));

  return (
    <div className='mb-4'>
      <div className='flex items-center mb-2'>
        <ClockCircleOutlined className='mr-2' />
        <span className='font-medium'>Run Timestamp</span>
      </div>
      <Select
        style={{ width: '100%' }}
        placeholder='Select run'
        value={selectedRun}
        onChange={onSelect}
        options={options}
        loading={loading}
        disabled={loading || runs.length === 0}
      />
    </div>
  );
};
