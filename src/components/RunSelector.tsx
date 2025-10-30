import React from 'react';
import { Button } from 'antd';
import { CloudDownloadOutlined } from '@ant-design/icons';
import type { ResultFile } from '../features/discover';

interface RunSelectorProps {
  runs: ResultFile[];
  onLoadAll: () => void;
  loading?: boolean;
}

export const RunSelector: React.FC<RunSelectorProps> = ({
  runs,
  onLoadAll,
  loading = false,
}) => {
  return (
    <div className='mb-4'>
      <Button
        type='primary'
        icon={<CloudDownloadOutlined />}
        onClick={onLoadAll}
        disabled={loading || runs.length === 0}
        block
        loading={loading}
      >
        Load All Official Results ({runs.length})
      </Button>
    </div>
  );
};
