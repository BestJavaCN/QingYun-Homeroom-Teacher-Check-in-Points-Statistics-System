import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Trash2, Calendar } from 'lucide-react';
import { DateRange } from '@/contexts/CheckInDataContext';
import { toast } from 'sonner';

interface DateRestrictionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  typeName: string;
  currentRanges: DateRange[];
  onSave: (ranges: DateRange[]) => void;
}

export function DateRestrictionsDialog({
  open,
  onOpenChange,
  typeName,
  currentRanges,
  onSave
}: DateRestrictionsDialogProps) {
  const [ranges, setRanges] = useState<DateRange[]>([]);

  // 当对话框打开时，初始化日期区间
  useEffect(() => {
    if (open) {
      if (currentRanges.length > 0) {
        setRanges(JSON.parse(JSON.stringify(currentRanges)));
      } else {
        setRanges([{ id: `${Date.now()}-${Math.random()}`, start: '', end: '' }]);
      }
    }
  }, [open, currentRanges]);

  // 添加新的日期区间
  const handleAddRange = () => {
    setRanges([...ranges, { id: `${Date.now()}-${Math.random()}`, start: '', end: '' }]);
  };

  // 删除日期区间
  const handleRemoveRange = (index: number) => {
    if (ranges.length === 1) {
      toast.error('至少保留一个日期区间');
      return;
    }
    setRanges(ranges.filter((_, i) => i !== index));
  };

  // 更新日期区间
  const handleUpdateRange = (index: number, field: 'start' | 'end', value: string) => {
    const newRanges = [...ranges];
    newRanges[index][field] = value;
    setRanges(newRanges);
  };

  // 验证日期区间
  const validateRanges = (): boolean => {
    for (let i = 0; i < ranges.length; i++) {
      const range = ranges[i];
      
      // 检查是否为空
      if (!range.start || !range.end) {
        toast.error(`第 ${i + 1} 个日期区间不完整`);
        return false;
      }

      // 检查开始日期是否小于等于结束日期
      if (range.start > range.end) {
        toast.error(`第 ${i + 1} 个日期区间的开始日期不能晚于结束日期`);
        return false;
      }
    }

    return true;
  };

  // 保存设置
  const handleSave = () => {
    // 过滤掉空的日期区间
    const validRanges = ranges.filter(r => r.start && r.end);
    
    if (validRanges.length === 0) {
      // 如果所有区间都是空的，表示清空限制
      onSave([]);
      onOpenChange(false);
      toast.success('已清空日期限制');
      return;
    }

    if (!validateRanges()) {
      return;
    }

    onSave(validRanges);
    onOpenChange(false);
    toast.success('日期限制设置成功');
  };

  // 清空所有限制
  const handleClear = () => {
    onSave([]);
    onOpenChange(false);
    toast.success('已清空日期限制');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader>
          <DialogTitle>设置签到日期限制 - {typeName}</DialogTitle>
          <DialogDescription>
            设置签到日期的有效区间，不在区间内的日期将标记为红色
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-x-hidden">
          {ranges.map((range, index) => (
            <div key={index} className="flex items-end gap-3 p-4 bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
              <div className="flex-1 space-y-2 min-w-0">
                <Label className="text-sm font-medium">
                  日期区间 {index + 1}
                </Label>
                <div className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <Label htmlFor={`start-${index}`} className="text-xs text-gray-600">
                      开始日期
                    </Label>
                    <div className="relative mt-1">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                      <Input
                        id={`start-${index}`}
                        type="date"
                        value={range.start}
                        onChange={(e) => handleUpdateRange(index, 'start', e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                  
                  <div className="flex-shrink-0 text-gray-400 mt-6">至</div>
                  
                  <div className="flex-1 min-w-0">
                    <Label htmlFor={`end-${index}`} className="text-xs text-gray-600">
                      结束日期
                    </Label>
                    <div className="relative mt-1">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                      <Input
                        id={`end-${index}`}
                        type="date"
                        value={range.end}
                        onChange={(e) => handleUpdateRange(index, 'end', e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleRemoveRange(index)}
                className="text-red-600 hover:text-red-700 hover:bg-red-50 shrink-0 mb-1"
                disabled={ranges.length === 1}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}

          <Button
            type="button"
            variant="outline"
            onClick={handleAddRange}
            className="w-full"
          >
            <Plus className="w-4 h-4 mr-2" />
            添加日期区间
          </Button>

          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-700">
              <strong>说明：</strong>
            </p>
            <ul className="list-disc list-inside text-sm text-blue-700 mt-2 space-y-1">
              <li>可以设置多个日期区间</li>
              <li>不在任何区间内的签到日期将显示为红色标签</li>
              <li>如果不设置限制，所有日期都将显示为正常颜色</li>
              <li>统计周期将根据设置的日期区间显示</li>
            </ul>
          </div>
        </div>

        <DialogFooter className="flex justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={handleClear}
            className="text-red-600 hover:text-red-700"
          >
            清空限制
          </Button>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              取消
            </Button>
            <Button
              type="button"
              onClick={handleSave}
            >
              保存设置
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
