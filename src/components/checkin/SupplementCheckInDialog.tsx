import { useState, useEffect, useMemo } from 'react';
import { DraggablePanel } from '@/components/ui/draggable-panel';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckInType } from '@/types/types';
import { X, Trash2 } from 'lucide-react';
import { useCheckInData } from '@/contexts/CheckInDataContext';

interface SupplementCheckInDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teacherName: string;
  checkInType: CheckInType;
  existingDates: string[]; // 已有的签到日期
  dateRange: { start: Date; end: Date }; // 日期范围
  onConfirm: (selectedDates: { date: string; count: number }[]) => void;
  showRecords?: boolean; // 是否显示已补充的签到记录
  customTitle?: string; // 自定义标题
}

const CHECK_IN_TYPE_LABELS: Record<CheckInType, string> = {
  lunch_break: '午休',
  evening_break: '晚休',
  morning_evening_study: '早晚自习',
  weekend_day: '周末白天'
};

export function SupplementCheckInDialog({
  open,
  onOpenChange,
  teacherName,
  checkInType,
  existingDates,
  dateRange,
  onConfirm,
  showRecords = false,
  customTitle
}: SupplementCheckInDialogProps) {
  const [selectedDates, setSelectedDates] = useState<Map<string, number>>(new Map());
  const { supplementedRecords, removeSupplementedRecord } = useCheckInData();

  // 计算每日签到次数上限
  const maxDailyCount = (checkInType === 'morning_evening_study' || checkInType === 'weekend_day') ? 2 : 1;

  // 生成日期范围内的所有日期
  const generateDateRange = () => {
    const dates: string[] = [];
    const current = new Date(dateRange.start);
    const end = new Date(dateRange.end);

    while (current <= end) {
      const dateStr = `${current.getFullYear()}.${current.getMonth() + 1}.${current.getDate()}`;
      dates.push(dateStr);
      current.setDate(current.getDate() + 1);
    }

    return dates;
  };

  // 计算每个日期已有的签到次数
  const getExistingCount = (date: string) => {
    let count = 0;
    existingDates.forEach(existingDate => {
      const cleanDate = existingDate.replace(/（.*?）/, '');
      if (cleanDate === date) {
        const countMatch = existingDate.match(/（(\d+)次）/);
        count += countMatch ? parseInt(countMatch[1]) : 1;
      }
    });
    return count;
  };

  // 获取可用的日期（未达到上限的日期）
  const getAvailableDates = () => {
    const allDates = generateDateRange();
    return allDates.filter(date => {
      const existingCount = getExistingCount(date);
      const selectedCount = selectedDates.get(date) || 0;
      return existingCount + selectedCount < maxDailyCount;
    });
  };

  // 处理日期点击
  const handleDateClick = (date: string) => {
    const existingCount = getExistingCount(date);
    const currentCount = selectedDates.get(date) || 0;
    const newCount = currentCount + 1;

    if (existingCount + newCount <= maxDailyCount) {
      const newSelectedDates = new Map(selectedDates);
      newSelectedDates.set(date, newCount);
      setSelectedDates(newSelectedDates);
    }
  };

  // 删除已选中的日期
  const handleRemoveDate = (date: string) => {
    const newSelectedDates = new Map(selectedDates);
    newSelectedDates.delete(date);
    setSelectedDates(newSelectedDates);
  };

  // 确认补充签到
  const handleConfirm = () => {
    const result = Array.from(selectedDates.entries()).map(([date, count]) => ({
      date,
      count
    }));
    onConfirm(result);
    setSelectedDates(new Map());
  };

  // 撤销操作记录
  const handleRemoveRecord = (recordId: string) => {
    removeSupplementedRecord(recordId);
  };

  // 获取当前教师和类型的补充记录
  const currentTypeRecords = supplementedRecords.filter(
    record => record.teacher_name === teacherName && record.type === checkInType
  );

  // 重置状态
  useEffect(() => {
    if (!open) {
      setSelectedDates(new Map());
    }
  }, [open]);

  // 使用useMemo计算可用日期，当existingDates或selectedDates变化时重新计算
  const availableDates = useMemo(() => {
    // 生成日期范围内的所有日期
    const generateDates = () => {
      const dates: string[] = [];
      const current = new Date(dateRange.start);
      const end = new Date(dateRange.end);

      while (current <= end) {
        const dateStr = `${current.getFullYear()}.${current.getMonth() + 1}.${current.getDate()}`;
        dates.push(dateStr);
        current.setDate(current.getDate() + 1);
      }

      return dates;
    };

    // 计算每个日期已有的签到次数
    const getCount = (date: string) => {
      let count = 0;
      existingDates.forEach(existingDate => {
        const cleanDate = existingDate.replace(/（.*?）/, '');
        if (cleanDate === date) {
          const countMatch = existingDate.match(/（(\d+)次）/);
          count += countMatch ? parseInt(countMatch[1]) : 1;
        }
      });
      return count;
    };

    const allDates = generateDates();
    const filteredDates = allDates.filter(date => {
      const existingCount = getCount(date);
      const selectedCount = selectedDates.get(date) || 0;
      return existingCount + selectedCount < maxDailyCount;
    });

    // 按日期降序排列（新日期在前）
    return filteredDates.sort((dateA, dateB) => {
      const parseDate = (dateStr: string) => {
        const parts = dateStr.split('.');
        if (parts.length === 3) {
          return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        }
        return new Date(dateStr);
      };
      return parseDate(dateB).getTime() - parseDate(dateA).getTime();
    });
  }, [existingDates, selectedDates, dateRange, maxDailyCount]);
  const hasSelectedDates = selectedDates.size > 0;

  return (
    <DraggablePanel
      isOpen={open}
      onClose={() => onOpenChange(false)}
      title={customTitle || `为 ${teacherName} 补充签到 - ${CHECK_IN_TYPE_LABELS[checkInType]}`}
      width="900px"
    >
      <div className="space-y-6">
        {/* 说明文字 */}

        {/* 可用日期列表 */}
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3">可补充签到的日期</h3>
          <div className="flex flex-wrap gap-2 p-4 bg-gray-50 rounded-md max-h-[300px] overflow-y-auto">
            {availableDates.length > 0 ? (
              availableDates.map(date => (
                <Badge
                  key={date}
                  variant="outline"
                  className="cursor-pointer hover:bg-blue-100 hover:border-blue-400 transition-colors px-3 py-1 h-fit"
                  onClick={() => handleDateClick(date)}
                >
                  {date}
                </Badge>
              ))
            ) : (
              <div className="w-full text-center text-gray-400 py-8">
                所有日期都已达到签到次数上限
              </div>
            )}
          </div>
        </div>
        {/* 已选中的日期 */}
        {hasSelectedDates && (
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">待补充的签到</h3>
            <div className="flex flex-wrap gap-2 p-4 bg-green-50 rounded-md max-h-[300px] overflow-y-auto">
              {Array.from(selectedDates.entries())
                .sort(([dateA], [dateB]) => {
                  const parseDate = (dateStr: string) => {
                    const parts = dateStr.split('.');
                    if (parts.length === 3) {
                      return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                    }
                    return new Date(dateStr);
                  };
                  return parseDate(dateB).getTime() - parseDate(dateA).getTime();
                })
                .map(([date, count]) => (
                  <div key={date} className="relative inline-block group h-fit">
                    <Badge
                      variant="secondary"
                      className="bg-green-100 text-green-700 border-green-300 px-3 py-1"
                    >
                      {date}{count > 1 ? `（${count}次）` : ''}
                    </Badge>
                    <button
                      onClick={() => handleRemoveDate(date)}
                      className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-sm opacity-0 group-hover:opacity-100"
                      title="移除"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
            </div>
          </div>
        )}
        {/* 已补充的签到记录 - 只在showRecords为true时显示 */}
        {showRecords && currentTypeRecords.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              已补充的签到记录（共 {currentTypeRecords.length} 条）
            </h3>
            <div className="max-h-[200px] overflow-y-auto border rounded-md">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 sticky top-0">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">日期</th>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">类型</th>
                    <th className="px-4 py-2 text-center font-medium text-gray-700">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {currentTypeRecords
                    .sort((a, b) => {
                      const parseDate = (dateStr: string) => {
                        const parts = dateStr.split('.');
                        if (parts.length === 3) {
                          return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
                        }
                        return new Date(dateStr);
                      };
                      return parseDate(b.date).getTime() - parseDate(a.date).getTime();
                    })
                    .map(record => (
                      <tr key={record.id} className="border-t hover:bg-gray-50">
                        <td className="px-4 py-2">{record.date}</td>
                        <td className="px-4 py-2">{CHECK_IN_TYPE_LABELS[record.type]}</td>
                        <td className="px-4 py-2 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveRecord(record.id)}
                            className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-3 h-3 mr-1" />
                            撤销
                          </Button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {/* 底部操作按钮 */}
        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
          <Button 
            onClick={handleConfirm}
            disabled={!hasSelectedDates}
          >
            确定补充（{selectedDates.size}个日期）
          </Button>
        </div>
      </div>
    </DraggablePanel>
  );
}

