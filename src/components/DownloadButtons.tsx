import React from 'react';
import { Button, Space } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { downloadCSV, pivotToCSV } from '../features/csv';
import type { PivotRow } from '../types';

interface DownloadButtonsProps {
  pivotData: PivotRow[];
  scale0100: boolean;
}

export const DownloadButtons: React.FC<DownloadButtonsProps> = ({
  pivotData,
  scale0100,
}) => {
  const { t } = useTranslation();
  const handleDownloadPivot = () => {
    const csv = pivotToCSV(pivotData, scale0100);
    downloadCSV(csv, 'pivot_data.csv');
  };

  return (
    <div>
      <Space direction='vertical' style={{ width: '100%' }}>
        <Button
          icon={<DownloadOutlined />}
          onClick={handleDownloadPivot}
          disabled={pivotData.length === 0}
          size='small'
          block
        >
          {t('controls.pivotTable')}
        </Button>
      </Space>
    </div>
  );
};
