import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { DragDropUpload } from './DragDropUpload';
import { CheckInType } from '@/types/types';
import { Badge } from '@/components/ui/badge';
import { FileSpreadsheet, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface BatchUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpload: (files: FileWithType[]) => Promise<void>;
}

export interface FileWithType {
  file: File;
  type: CheckInType | null;
  status: 'pending' | 'success' | 'error';
  message?: string;
}

const CHECK_IN_TYPE_LABELS: Record<CheckInType, string> = {
  lunch_break: '午休',
  evening_break: '晚休',
  morning_evening_study: '早晚自习',
  weekend_day: '周末白天'
};

const CHECK_IN_TYPE_KEYWORDS: Record<CheckInType, string[]> = {
  lunch_break: ['午休', '午间', 'lunch'],
  evening_break: ['晚休', '晚间', 'evening'],
  morning_evening_study: ['早晚自习', '早晚', '自习', 'study'],
  weekend_day: ['周末', '周末白天', 'weekend']
};

export function BatchUploadDialog({ open, onOpenChange, onUpload }: BatchUploadDialogProps) {
  const [filesWithType, setFilesWithType] = useState<FileWithType[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  // 自动识别文件类型
  const detectCheckInType = (fileName: string): CheckInType | null => {
    const lowerFileName = fileName.toLowerCase();
    
    for (const [type, keywords] of Object.entries(CHECK_IN_TYPE_KEYWORDS)) {
      if (keywords.some(keyword => lowerFileName.includes(keyword.toLowerCase()))) {
        return type as CheckInType;
      }
    }
    
    return null;
  };

  // 处理文件选择
  const handleFilesSelected = (files: File[]) => {
    const newFilesWithType: FileWithType[] = files.map(file => ({
      file,
      type: detectCheckInType(file.name),
      status: 'pending' as const
    }));
    
    setFilesWithType(newFilesWithType);
    
    // 统计识别结果
    const recognized = newFilesWithType.filter(f => f.type !== null).length;
    const unrecognized = newFilesWithType.length - recognized;
    
    if (unrecognized > 0) {
      toast.warning(`已识别 ${recognized} 个文件，${unrecognized} 个文件无法自动识别类型`);
    } else {
      toast.success(`已自动识别所有文件的签到类型`);
    }
  };

  // 手动设置文件类型
  const handleSetFileType = (index: number, type: CheckInType) => {
    const newFilesWithType = [...filesWithType];
    newFilesWithType[index].type = type;
    setFilesWithType(newFilesWithType);
  };

  // 移除文件
  const handleRemoveFile = (index: number) => {
    const newFilesWithType = filesWithType.filter((_, i) => i !== index);
    setFilesWithType(newFilesWithType);
  };

  // 开始上传
  const handleStartUpload = async () => {
    // 检查是否所有文件都已识别类型
    const unrecognizedFiles = filesWithType.filter(f => f.type === null);
    if (unrecognizedFiles.length > 0) {
      toast.error('请为所有文件指定签到类型');
      return;
    }

    setIsUploading(true);
    
    try {
      await onUpload(filesWithType);
      toast.success('批量上传完成');
      onOpenChange(false);
      setFilesWithType([]);
    } catch (error) {
      console.error('批量上传失败:', error);
      toast.error('批量上传失败');
    } finally {
      setIsUploading(false);
    }
  };

  // 关闭对话框
  const handleClose = () => {
    if (!isUploading) {
      onOpenChange(false);
      setFilesWithType([]);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>批量上传签到文件</DialogTitle>
          <DialogDescription>
            支持拖拽上传多个 Excel 文件，系统会自动识别文件类型
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-x-hidden">
          {/* 拖拽上传区域 */}
          {filesWithType.length === 0 && (
            <DragDropUpload
              onFilesSelected={handleFilesSelected}
              accept=".xlsx,.xls"
              multiple={true}
              maxFiles={10}
            />
          )}

          {/* 文件列表 */}
          {filesWithType.length > 0 && (
            <div className="space-y-3 overflow-x-hidden">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-700">
                  已选择 {filesWithType.length} 个文件
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setFilesWithType([])}
                  disabled={isUploading}
                >
                  重新选择
                </Button>
              </div>

              <div className="space-y-2 overflow-x-hidden">{filesWithType.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200 overflow-hidden"
                  >
                    {/* 文件图标 */}
                    <FileSpreadsheet className="w-5 h-5 text-green-600 shrink-0" />
                    
                    {/* 文件信息 */}
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <p className="text-sm font-medium text-gray-700 truncate" title={item.file.name}>
                        {item.file.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {(item.file.size / 1024).toFixed(2)} KB
                      </p>
                    </div>

                    {/* 类型选择 */}
                    <div className="flex items-center gap-2 shrink-0">
                      {item.type ? (
                        <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                          {CHECK_IN_TYPE_LABELS[item.type]}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="bg-yellow-100 text-yellow-700">
                          未识别
                        </Badge>
                      )}
                      
                      {/* 类型选择下拉菜单 */}
                      <select
                        value={item.type || ''}
                        onChange={(e) => handleSetFileType(index, e.target.value as CheckInType)}
                        disabled={isUploading}
                        className="text-xs border border-gray-300 rounded px-2 py-1 bg-white"
                      >
                        <option value="">选择类型</option>
                        {Object.entries(CHECK_IN_TYPE_LABELS).map(([type, label]) => (
                          <option key={type} value={type}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* 状态图标或移除按钮 */}
                    <div className="shrink-0">
                      {item.status === 'success' && (
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                      )}
                      {item.status === 'error' && (
                        <XCircle className="w-5 h-5 text-red-600" />
                      )}
                      {item.status === 'pending' && !isUploading && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveFile(index)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          移除
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* 提示信息 */}
              <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <AlertCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="text-sm text-blue-700">
                  <p className="font-medium">提示：</p>
                  <ul className="list-disc list-inside space-y-1 mt-1">
                    <li>系统会根据文件名自动识别签到类型</li>
                    <li>如果识别错误，请手动选择正确的类型</li>
                    <li>所有文件必须指定类型后才能上传</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            disabled={isUploading}
          >
            取消
          </Button>
          <Button
            type="button"
            onClick={handleStartUpload}
            disabled={filesWithType.length === 0 || isUploading || filesWithType.some(f => f.type === null)}
          >
            {isUploading ? '上传中...' : `开始上传（${filesWithType.length}个文件）`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
