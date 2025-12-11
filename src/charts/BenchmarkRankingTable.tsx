import React, { useMemo, useState } from 'react';
import { Table, Card, Select, Space, Typography } from 'antd';
import { TableOutlined, SortAscendingOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { ColumnsType } from 'antd/es/table';
import type { DataSource } from '../types';
import { flattenDatasetResults, formatValue } from '../features/transform';

const { Title, Text } = Typography;
const { Option } = Select;

interface RankingTableProps {
  sources: DataSource[];
  scale0100: boolean;
}

interface BenchmarkData {
  benchmarkName: string;
  models: ModelRankingRow[];
  allTests: string[];
}

interface ModelRankingRow {
  key: string;
  modelName: string;
  displayName: string;
  isOfficial: boolean;
  timestamp: string;
  average: number;
  [testName: string]: string | number | boolean;
}

function extractBenchmarkName(category: string): string {
  const parts = category.split('/');
  return parts[0] || category;
}

function extractTestName(category: string): string {
  const parts = category.split('/');
  return parts.length > 1 ? parts.slice(1).join('/') : category;
}

export const BenchmarkRankingTable: React.FC<RankingTableProps> = ({
  sources,
  scale0100,
}) => {
  const { t } = useTranslation();
  const [sortBy, setSortBy] = useState<string>('average');

  const benchmarkData = useMemo((): BenchmarkData[] => {
    const benchmarkMap = new Map<
      string,
      {
        testNames: Set<string>;
        modelData: Map<
          string,
          { source: DataSource; scores: Map<string, number> }
        >;
      }
    >();

    sources.forEach((source) => {
      const results = flattenDatasetResults(source.rawData);

      results.forEach((result) => {
        const benchmarkName = extractBenchmarkName(result.category);
        const testName = extractTestName(result.category);

        if (!benchmarkMap.has(benchmarkName)) {
          benchmarkMap.set(benchmarkName, {
            testNames: new Set(),
            modelData: new Map(),
          });
        }
        const benchmarkEntry = benchmarkMap.get(benchmarkName)!;

        benchmarkEntry.testNames.add(testName);

        const modelKey = source.id;
        if (!benchmarkEntry.modelData.has(modelKey)) {
          benchmarkEntry.modelData.set(modelKey, {
            source,
            scores: new Map(),
          });
        }
        const modelEntry = benchmarkEntry.modelData.get(modelKey)!;

        modelEntry.scores.set(testName, result.accuracy_mean);
      });
    });

    const benchmarks: BenchmarkData[] = [];
    benchmarkMap.forEach((benchmarkEntry, benchmarkName) => {
      const allTests = Array.from(benchmarkEntry.testNames).sort();
      const models: ModelRankingRow[] = [];

      benchmarkEntry.modelData.forEach((modelEntry) => {
        const { source, scores } = modelEntry;
        const displayName = `${source.modelName}${source.variance !== 'default' ? ` (${source.variance})` : ''}`;

        const row: ModelRankingRow = {
          key: `${benchmarkName}-${source.id}`,
          modelName: source.modelName,
          displayName,
          isOfficial: source.isOfficial,
          timestamp: source.timestamp,
          average: 0,
        };

        let totalScore = 0;
        let count = 0;
        allTests.forEach((testName) => {
          const score = scores.get(testName);
          if (score !== undefined) {
            row[testName] = score;
            totalScore += score;
            count++;
          }
        });

        row.average = count > 0 ? totalScore / count : 0;

        models.push(row);
      });

      benchmarks.push({
        benchmarkName,
        models,
        allTests,
      });
    });

    benchmarks.sort((a, b) => a.benchmarkName.localeCompare(b.benchmarkName));

    return benchmarks;
  }, [sources]);

  const generateColumns = (
    allTests: string[],
  ): ColumnsType<ModelRankingRow> => {
    const baseColumns: ColumnsType<ModelRankingRow> = [
      {
        title: t('chart.model'),
        dataIndex: 'displayName',
        key: 'displayName',
        fixed: 'left',
        width: 250,
        sorter: (a, b) => a.displayName.localeCompare(b.displayName),
        render: (text: string, record: ModelRankingRow) => (
          <div>
            <Text strong style={{ fontSize: '13px' }}>
              {text}
            </Text>
            {record.isOfficial && (
              <Text
                type='secondary'
                style={{ fontSize: '11px', display: 'block' }}
              >
                ({t('controls.official')})
              </Text>
            )}
            <Text
              type='secondary'
              style={{ fontSize: '11px', display: 'block' }}
            >
              {record.timestamp}
            </Text>
          </div>
        ),
      },
      {
        title: t('chart.average'),
        dataIndex: 'average',
        key: 'average',
        width: 120,
        align: 'center',
        fixed: 'left',
        sorter: (a, b) => a.average - b.average,
        defaultSortOrder: 'descend',
        render: (value: number) => {
          const displayValue = scale0100 ? value * 100 : value;
          const formatted = displayValue.toFixed(scale0100 ? 2 : 4);

          let color: string;
          if (value >= 0.9) color = '#52c41a';
          else if (value >= 0.8) color = '#1890ff';
          else if (value >= 0.7) color = '#fa8c16';
          else if (value >= 0.6) color = '#faad14';
          else color = '#f5222d';

          return (
            <Text strong style={{ color, fontSize: '14px' }}>
              {formatted}
              {scale0100 ? '%' : ''}
            </Text>
          );
        },
      },
    ];

    const testColumns: ColumnsType<ModelRankingRow> = allTests.map(
      (testName) => ({
        title: testName,
        dataIndex: testName,
        key: testName,
        width: 150,
        align: 'center',
        sorter: (a, b) => {
          const aVal = typeof a[testName] === 'number' ? a[testName] : 0;
          const bVal = typeof b[testName] === 'number' ? b[testName] : 0;
          return (aVal as number) - (bVal as number);
        },
        render: (value: number | string | boolean | undefined) => {
          if (typeof value === 'number') {
            const displayValue = scale0100 ? value * 100 : value;
            const formatted = displayValue.toFixed(scale0100 ? 2 : 4);

            let color: string;
            if (value >= 0.9) color = '#52c41a';
            else if (value >= 0.8) color = '#1890ff';
            else if (value >= 0.7) color = '#fa8c16';
            else if (value >= 0.6) color = '#faad14';
            else color = '#f5222d';

            return (
              <Text style={{ color, fontWeight: 500, fontSize: '13px' }}>
                {formatted}
                {scale0100 ? '%' : ''}
              </Text>
            );
          }
          return <Text type='secondary'>-</Text>;
        },
      }),
    );

    return [...baseColumns, ...testColumns];
  };

  if (sources.length === 0) {
    return (
      <Card>
        <div className='text-center text-gray-500 py-8'>
          <TableOutlined style={{ fontSize: 48, marginBottom: 16 }} />
          <div>{t('chart.noData')}</div>
        </div>
      </Card>
    );
  }

  return (
    <div className='space-y-6'>
      <div className='flex items-center justify-between'>
        <Space>
          <TableOutlined style={{ fontSize: 12 }} />
          <Title level={5} style={{ margin: 0 }}>
            {t('chart.rankingTables')}
          </Title>
        </Space>
        <Space>
          <SortAscendingOutlined />
          <Text>{t('chart.sortBy')}</Text>
          <Select
            value={sortBy}
            onChange={setSortBy}
            style={{ width: 225 }}
            size={'middle'}
          >
            <Option value='modelName'>{t('chart.modelNameAZ')}</Option>
            <Option value='average'>{t('chart.averageScore')}</Option>
          </Select>
        </Space>
      </div>

      <Card size='small' className='bg-blue-50 border-blue-200 !mb-5'>
        <Text>
          <strong>{t('chart.noteLabel')}</strong> {t('chart.noteText')}
          {scale0100
            ? ` ${t('chart.scoresPercentage')}`
            : ` ${t('chart.scoresDecimal')}`}
        </Text>
      </Card>

      {benchmarkData.map((benchmark) => {
        const sortedModels = [...benchmark.models];
        if (sortBy === 'modelName') {
          sortedModels.sort((a, b) =>
            a.displayName.localeCompare(b.displayName),
          );
        } else if (sortBy === 'average') {
          sortedModels.sort((a, b) => b.average - a.average);
        }

        const avgScore =
          sortedModels.length > 0
            ? sortedModels.reduce((sum, model) => sum + model.average, 0) /
              sortedModels.length
            : 0;

        return (
          <Card
            key={benchmark.benchmarkName}
            title={
              <Space>
                <Text strong style={{ fontSize: 16 }}>
                  {benchmark.benchmarkName}
                </Text>
                <Text type='secondary' style={{ fontSize: 14 }}>
                  ({sortedModels.length} {t('chart.models')},{' '}
                  {benchmark.allTests.length} {t('chart.tests')},{' '}
                  {t('chart.avg')}: {formatValue(avgScore, scale0100)}
                  {scale0100 ? '%' : ''})
                </Text>
              </Space>
            }
            className='shadow-sm !mb-6'
          >
            <Table
              columns={generateColumns(benchmark.allTests)}
              dataSource={sortedModels}
              pagination={{
                defaultPageSize: 20,
                showSizeChanger: true,
                pageSizeOptions: ['10', '20', '30', '50', '100'],
                showTotal: (total) => t('chart.totalModels', { total }),
              }}
              scroll={{ x: 'max-content' }}
              size='small'
              bordered
            />
          </Card>
        );
      })}
    </div>
  );
};
