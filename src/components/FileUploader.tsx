import React, { useRef } from 'react';
import { Button, App } from 'antd';
import { FileAddOutlined } from '@ant-design/icons';

interface FileUploaderProps {
  onFilesSelected: (files: File[]) => void;
}

export const FileUploader: React.FC<FileUploaderProps> = ({
  onFilesSelected,
}) => {
  const { message } = App.useApp();
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
        message.error(
          `Invalid file type: ${f.name}. Only .json and .jsonl files are accepted.`,
        );
      }
      return isValid;
    });

    if (validFiles.length > 0) {
      onFilesSelected(validFiles);
      message.success(`${validFiles.length} file(s) selected`);
    }

    // Reset input
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  return (
    <div className='mb-4'>
      <Button icon={<FileAddOutlined />} onClick={handleClick} block>
        Upload JSON/JSONL Files
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
