import React, { useRef } from 'react';
import { Button, App } from 'antd';
import { FileAddOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

interface FileUploaderProps {
  onFilesSelected: (files: File[]) => void;
}

export const FileUploader: React.FC<FileUploaderProps> = ({
  onFilesSelected,
}) => {
  const { message } = App.useApp();
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClick = () => {
    inputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const fileList = Array.from(files);
    const validFiles = fileList.filter((f) => {
      const isValid = f.name.endsWith('.json') || f.name.endsWith('.jsonl');
      if (!isValid) {
        void message.error(t('messages.invalidFileType', { filename: f.name }));
      }
      return isValid;
    });

    if (validFiles.length > 0) {
      onFilesSelected(validFiles);
      void message.success(
        t('messages.filesSelected', { count: validFiles.length }),
      );
    }

    // Reset input
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  return (
    <div className='mb-4'>
      <Button icon={<FileAddOutlined />} onClick={handleClick} block>
        {t('controls.uploadFiles')}
      </Button>
      <input
        ref={inputRef}
        type='file'
        accept='.json,.jsonl'
        multiple
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
    </div>
  );
};
