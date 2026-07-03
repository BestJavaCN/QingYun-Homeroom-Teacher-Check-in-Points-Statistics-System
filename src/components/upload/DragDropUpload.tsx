import { useState, useRef, DragEvent, ChangeEvent } from 'react';
import { Upload, FileSpreadsheet, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface DragDropUploadProps {
  onFilesSelected: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  maxFiles?: number;
  className?: string;
}

export function DragDropUpload({
  onFilesSelected,
  accept = '.xlsx,.xls',
  multiple = true,
  maxFiles = 10,
  className
}: DragDropUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 验证文件类型
  const validateFileType = (file: File): boolean => {
    const acceptedExtensions = accept.split(',').map(ext => ext.trim().toLowerCase());
    const fileName = file.name.toLowerCase();
    const fileExtension = '.' + fileName.split('.').pop();
    
    // 检查文件扩展名
    const isValidExtension = acceptedExtensions.some(ext => fileName.endsWith(ext));
    
    // 检查 MIME 类型
    const validMimeTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel', // .xls
      'application/octet-stream' // 有时 Excel 文件会被识别为这个类型
    ];
    const isValidMimeType = validMimeTypes.includes(file.type) || file.type === '';
    
    return isValidExtension && (isValidMimeType || file.type === '');
  };

  // 处理文件选择
  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const fileArray = Array.from(files);
    
    // 验证文件类型
    const invalidFiles: string[] = [];
    const validFiles: File[] = [];
    
    fileArray.forEach(file => {
      if (validateFileType(file)) {
        validFiles.push(file);
      } else {
        invalidFiles.push(file.name);
      }
    });

    // 如果有无效文件，返回错误信息
    if (invalidFiles.length > 0) {
      const errorMsg = `以下文件类型不正确，仅支持 Excel 文件（.xlsx, .xls）：\n${invalidFiles.join('\n')}`;
      alert(errorMsg);
    }

    // 检查文件数量限制
    if (validFiles.length > maxFiles) {
      alert(`一次最多只能上传 ${maxFiles} 个文件`);
      return;
    }

    if (validFiles.length > 0) {
      setSelectedFiles(validFiles);
      onFilesSelected(validFiles);
    }
  };

  // 拖拽进入
  const handleDragEnter = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  // 拖拽悬停
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  // 拖拽离开
  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  // 拖拽放下
  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    handleFiles(files);
  };

  // 文件输入变化
  const handleFileInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
    // 清空输入，允许重复选择相同文件
    e.target.value = '';
  };

  // 点击上传区域
  const handleClick = () => {
    fileInputRef.current?.click();
  };

  // 移除文件
  const handleRemoveFile = (index: number) => {
    const newFiles = selectedFiles.filter((_, i) => i !== index);
    setSelectedFiles(newFiles);
  };

  // 清空所有文件
  const handleClearAll = () => {
    setSelectedFiles([]);
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* 拖拽上传区域 */}
      <div
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={handleClick}
        className={cn(
          'relative border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all',
          isDragging
            ? 'border-blue-500 bg-blue-50'
            : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleFileInputChange}
          className="hidden"
        />
        
        <div className="flex flex-col items-center space-y-3">
          <div className={cn(
            'w-16 h-16 rounded-full flex items-center justify-center transition-colors',
            isDragging ? 'bg-blue-100' : 'bg-gray-100'
          )}>
            <Upload className={cn(
              'w-8 h-8 transition-colors',
              isDragging ? 'text-blue-600' : 'text-gray-600'
            )} />
          </div>
          
          <div className="space-y-1">
            <p className="text-base font-medium text-gray-700">
              {isDragging ? '松开鼠标上传文件' : '拖拽文件到此处或点击上传'}
            </p>
            <p className="text-sm text-gray-500">
              支持 Excel 文件（.xlsx, .xls）{multiple && `，最多 ${maxFiles} 个文件`}
            </p>
          </div>
          
          <Button type="button" variant="outline" size="sm" className="pointer-events-none">
            <Upload className="w-4 h-4 mr-2" />
            选择文件
          </Button>
        </div>
      </div>

      {/* 已选择的文件列表 */}
      {selectedFiles.length > 0 && (
        <div className="space-y-2 overflow-x-hidden">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">
              已选择 {selectedFiles.length} 个文件
            </p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClearAll}
              className="text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              清空全部
            </Button>
          </div>
          
          <div className="space-y-2 max-h-[200px] overflow-y-auto overflow-x-hidden">
            {selectedFiles.map((file, index) => (
              <div
                key={index}
                className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 overflow-hidden"
              >
                <FileSpreadsheet className="w-5 h-5 text-green-600 shrink-0" />
                
                <div className="flex-1 min-w-0 overflow-hidden">
                  <p className="text-sm font-medium text-gray-700 truncate" title={file.name}>
                    {file.name}
                  </p>
                  <p className="text-xs text-gray-500">
                    {(file.size / 1024).toFixed(2)} KB
                  </p>
                </div>
                
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveFile(index);
                  }}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50 shrink-0 ml-2"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
