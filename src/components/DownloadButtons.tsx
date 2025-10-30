import React from 'react';
import { Button, Space } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import {
  downloadCSV,
  pivotToCSV,
  deltaToCSV,
  candidateSummaryToCSV,
} from '../features/csv';
import type { PivotRow, DeltaRow } from '../features/types';

interface DownloadButtonsProps {
  pivotData: PivotRow[];
  deltaData: DeltaRow[];
  scale0100: boolean;
}

export const DownloadButtons: React.FC<DownloadButtonsProps> = ({
  pivotData,
  deltaData,
  scale0100,
}) => {
  const handleDownloadPivot = () => {
    const csv = pivotToCSV(pivotData, scale0100);
    downloadCSV(csv, 'pivot_data.csv');
  };

  const handleDownloadDelta = () => {
    const csv = deltaToCSV(deltaData, scale0100);
    downloadCSV(csv, 'delta_ranking.csv');
  };

  const handleDownloadSummary = () => {
    const csv = candidateSummaryToCSV(deltaData, scale0100);
    downloadCSV(csv, 'candidate_summary.csv');
  };

  return (
    <div className='mb-4'>
      <div className='font-medium mb-2'>Export CSV</div>
      <Space direction='vertical' style={{ width: '100%' }}>
        <Button
          icon={<DownloadOutlined />}
          onClick={handleDownloadPivot}
          disabled={pivotData.length === 0}
          size='small'
          block
        >
          Pivot Table
        </Button>
        <Button
          icon={<DownloadOutlined />}
          onClick={handleDownloadDelta}
          disabled={deltaData.length === 0}
          size='small'
          block
        >
          Delta Ranking
        </Button>
        <Button
          icon={<DownloadOutlined />}
          onClick={handleDownloadSummary}
          disabled={deltaData.length === 0}
          size='small'
          block
        >
          Candidate Summary
        </Button>
      </Space>
    </div>
  );
};
