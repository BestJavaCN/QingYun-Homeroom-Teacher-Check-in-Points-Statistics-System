import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Badge } from '@/components/ui/badge';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { DraggablePanel } from '@/components/ui/draggable-panel';
import { DateBadge } from '@/components/checkin/DateBadge';
import { SupplementCheckInDialog } from '@/components/checkin/SupplementCheckInDialog';
import { BatchUploadDialog, FileWithType } from '@/components/upload/BatchUploadDialog';
import { DateStepper } from '@/components/checkin/DateStepper';
import { toast } from 'sonner';
import { Upload, Download, Plus, FileSpreadsheet, BarChart3, Image, ChevronDown, ChevronUp, Settings, ArrowUpDown, Sun, Moon, Clock, Calendar, X, Trash2, Undo2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { classApi } from '@/db/api';
import { useCheckInData, DateRange, DateRestrictions } from '@/contexts/CheckInDataContext';
import { 
  parseExcelFile, 
  detectCheckInType, 
  validateCheckInData, 
  processCheckInData, 
  generateTotalSummary,
  exportToExcel,
  recalculateCheckInData
} from '@/utils/excel';
import { NumberStepper } from '@/components/ui/number-stepper';
import type { 
  Class, 
  CheckInType, 
  TabType,
  CheckInSummary, 
  TotalSummary, 
  CheckInFormData,
  ExcelImportData 
} from '@/types/types';

// 简单的数字显示组件，避免flex布局导致的html2canvas渲染问题
const NumberDisplay = ({ value, variant = 'default' }: { value: number | string; variant?: 'default' | 'success' | 'danger' }) => {
  const colorClasses = {
    default: 'bg-blue-50 text-blue-700 border border-blue-200',
    success: 'bg-green-100 text-green-700 border border-green-200',
    danger: 'bg-red-100 text-red-600 border border-red-200'
  };
  
  return (
    <span 
      className={`inline-block text-center rounded-md px-2 py-1.5 text-xs font-medium min-w-[40px] ${colorClasses[variant]}`}
    >
      {value}
    </span>
  );
};

// 辅助函数：生成日期区间内所有日期的默认次数（2次）
// 注意：这个函数只用于初始化，实际使用中只记录端点的次数
const generateDefaultDateCounts = (startDate: string, endDate: string): { [date: string]: 1 | 2 } => {
  const counts: { [date: string]: 1 | 2 } = {};
  // 只记录端点的次数，默认都是2次
  counts[startDate] = 2;
  counts[endDate] = 2;
  return counts;
};

// 辅助函数：获取某个日期在区间中的次数限制
// 如果日期是区间端点，返回端点的次数；否则返回默认值2次
const getDateCountInRange = (date: string, range: DateRange): 1 | 2 => {
  if (!range.dateCounts) return 2;
  
  // 如果是开始或结束日期，返回记录的次数
  if (date === range.start || date === range.end) {
    return range.dateCounts[date] || 2;
  }
  
  // 如果是区间内的其他日期，返回默认值2次
  return 2;
};

// 辅助函数：判断签到类型是否需要次数功能
const needsCountFeature = (type: CheckInType): boolean => {
  return type === 'morning_evening_study' || type === 'weekend_day';
};

// 辅助函数：检查某个日期的签到次数是否超过限制
// 返回：true 表示超限（设置为1次但实际签了2次），false 表示正常
const isDateOverLimit = (
  type: CheckInType,
  dateStr: string, // 可能包含次数信息，如 "2025.1.15（2次）"
  formattedDate: string, // 标准格式 "2025-01-15"
  dateRestrictions: DateRestrictions
): boolean => {
  // 只有早晚自习和周末白天需要检查次数限制
  if (!needsCountFeature(type)) {
    return false;
  }

  // 从日期字符串中提取实际签到次数
  const countMatch = dateStr.match(/（(\d+)次）/);
  const actualCount = countMatch ? parseInt(countMatch[1]) : 1;
  
  // 如果实际只签了1次，不可能超限
  if (actualCount === 1) {
    return false;
  }

  const ranges = dateRestrictions[type] || [];
  
  // 遍历所有区间，找到包含该日期的区间
  for (const range of ranges) {
    // 检查日期是否在区间内
    if (formattedDate >= range.start && formattedDate <= range.end) {
      // 使用 getDateCountInRange 获取该日期的次数限制
      const allowedCount = getDateCountInRange(formattedDate, range);
      
      // 如果设置为1次，但实际签了2次，则返回 true（超限）
      if (allowedCount === 1 && actualCount === 2) {
        return true;
      }
    }
  }
  
  return false;
};

// 辅助函数：同步所有区间中相同日期的次数限制
// 当用户修改某个日期的次数时，所有包含该日期的区间都应该更新为相同的次数
// 注意：只同步端点（开始或结束日期）的次数
const syncDateCountsAcrossRanges = (
  ranges: DateRange[],
  targetDate: string,
  newCount: 1 | 2
): DateRange[] => {
  return ranges.map(range => {
    // 检查该日期是否是当前区间的端点
    if (targetDate === range.start || targetDate === range.end) {
      // 如果是端点，更新该日期的次数
      const dateCounts = range.dateCounts || generateDefaultDateCounts(range.start, range.end);
      dateCounts[targetDate] = newCount;
      return { ...range, dateCounts };
    }
    return range;
  });
};

// 辅助函数：为新区间同步已存在的日期次数限制
// 当添加新区间时，检查新区间的端点是否在其他区间的端点中已有次数限制，如果有则同步
// 注意：只同步端点的次数
const syncNewRangeWithExisting = (
  existingRanges: DateRange[],
  newRange: DateRange
): DateRange => {
  // 如果新区间没有 dateCounts，先生成默认的
  const dateCounts = newRange.dateCounts || generateDefaultDateCounts(newRange.start, newRange.end);
  
  // 只检查新区间的端点（开始和结束日期）
  const endpointDates = [newRange.start, newRange.end];
  
  // 遍历新区间的端点，检查是否在已存在的区间的端点中有次数限制
  endpointDates.forEach(date => {
    for (const existingRange of existingRanges) {
      // 只检查已存在区间的端点
      if ((date === existingRange.start || date === existingRange.end) && existingRange.dateCounts) {
        const existingCount = existingRange.dateCounts[date];
        if (existingCount !== undefined) {
          // 如果已存在的区间的端点中该日期有次数限制，同步到新区间
          dateCounts[date] = existingCount;
          break; // 找到第一个匹配的就停止
        }
      }
    }
  });
  
  return { ...newRange, dateCounts };
};

const CHECK_IN_TYPE_LABELS = {
  lunch_break: '午休',
  evening_break: '晚休',
  morning_evening_study: '早晚自习',
  weekend_day: '周末白天'
};

const CHECK_IN_TYPE_ICONS = {
  lunch_break: Sun,
  evening_break: Moon,
  morning_evening_study: Clock,
  weekend_day: Calendar
};

const TAB_LABELS = {
  lunch_break: '午休',
  evening_break: '晚休',
  morning_evening_study: '早晚自习',
  weekend_day: '周末白天',
  total_summary: '总量化统计'
};

export default function CheckInStatistics() {
  const { 
    checkInData, 
    totalSummaryData, 
    baseCountSettings, 
    selectedCheckInTypes,
    supplementedRecords,
    uploadedCheckInTypes,
    dateRestrictions,
    updateCheckInData, 
    updateTotalSummaryData,
    updateBaseCountSettings,
    updateSelectedCheckInTypes,
    addSupplementedRecords,
    removeSupplementedRecord,
    markCheckInTypeAsUploaded,
    saveOriginalData,
    restoreOriginalData,
    getDifferences,
    restoreToOriginal,
    hasDataChanged,
    updateDateRestrictions,
    isDateInRestrictions,
    getStatisticsPeriod
  } = useCheckInData();
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('lunch_break');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isBaseCountOpen, setIsBaseCountOpen] = useState<Record<string, boolean>>({
    lunch_break: false,
    evening_break: false
  });
  const [sortByRank, setSortByRank] = useState(false); // 是否按名次排序
  
  // 补充签到相关状态
  const [supplementRows, setSupplementRows] = useState<CheckInFormData[]>([
    { teacher_name: '', date: '', type: 'lunch_break' }
  ]);
  const [activeInputIndex, setActiveInputIndex] = useState<number>(0); // 当前激活的输入框索引
  
  // 新增：悬停行和补充签到弹框状态
  const [hoveredRowIndex, setHoveredRowIndex] = useState<number | null>(null);
  const [clickedRowIndex, setClickedRowIndex] = useState<number | null>(null);
  const [isButtonExiting, setIsButtonExiting] = useState(false);
  const [supplementDialogOpen, setSupplementDialogOpen] = useState(false);
  const [currentSupplementTeacher, setCurrentSupplementTeacher] = useState<{
    teacherName: string;
    checkInType: CheckInType;
    existingDates: string[];
  } | null>(null);

  // 批量上传对话框状态
  const [batchUploadDialogOpen, setBatchUploadDialogOpen] = useState(false);

  // 处理基础次数变化
  const handleBaseCountChange = (type: 'lunch_break' | 'evening_break', classType: 'single_class' | 'multi_class', value: number) => {
    const newSettings = {
      ...baseCountSettings,
      [type]: {
        ...baseCountSettings[type],
        [classType]: value
      }
    };
    updateBaseCountSettings(newSettings);
  };

  // 本地辅助函数：计算有效签到次数
  const calculateEffectiveCountLocal = (
    totalCount: number,
    type: CheckInType,
    isMultiClass: boolean
  ): number => {
    switch (type) {
      case 'lunch_break':
        const lunchBase = isMultiClass 
          ? baseCountSettings.lunch_break.multi_class 
          : baseCountSettings.lunch_break.single_class;
        return totalCount - lunchBase;
      case 'evening_break':
        const eveningBase = isMultiClass 
          ? baseCountSettings.evening_break.multi_class 
          : baseCountSettings.evening_break.single_class;
        return totalCount - eveningBase;
      case 'morning_evening_study':
        return totalCount;
      case 'weekend_day':
        return totalCount;
      default:
        return totalCount;
    }
  };

  // 获取实时计算的签到数据
  const getDisplayData = (type: CheckInType): CheckInSummary[] => {
    const originalData = checkInData[type];
    
    // 创建一个包含所有班级的完整数据集
    const allClassesData: CheckInSummary[] = classes.map(cls => {
      const teacherClasses = classes.filter(c => c.teacher_name === cls.teacher_name);
      const isMultiClass = teacherClasses.length > 1;
      
      // 查找该班级是否有签到数据
      const existingData = originalData.find(
        item => item.class_name === cls.class_name && item.teacher_name === cls.teacher_name
      );
      
      if (existingData) {
        // 如果有数据，返回现有数据
        return existingData;
      } else {
        // 如果没有数据，创建0次签到记录
        let effectiveCount = 0;
        if (type === 'lunch_break') {
          effectiveCount = 0 - (isMultiClass ? baseCountSettings.lunch_break.multi_class : baseCountSettings.lunch_break.single_class);
        } else if (type === 'evening_break') {
          effectiveCount = 0 - (isMultiClass ? baseCountSettings.evening_break.multi_class : baseCountSettings.evening_break.single_class);
        } else {
          effectiveCount = 0; // 早晚自习和周末白天
        }
        
        return {
          class_name: cls.class_name,
          teacher_name: cls.teacher_name,
          total_count: 0,
          effective_count: effectiveCount,
          score: effectiveCount * 2,
          dates: []
        };
      }
    });
    
    // 只有午休和晚休需要重新计算有效次数
    if (type === 'lunch_break' || type === 'evening_break') {
      return recalculateCheckInData(
        allClassesData,
        classes,
        type,
        baseCountSettings
      );
    }
    
    // 早晚自习和周末白天直接返回
    return allClassesData.sort((a, b) => a.class_name.localeCompare(b.class_name));
  };

  // 更新总量化统计数据
  const updateTotalSummary = () => {
    // 使用实时计算的数据生成总量化统计
    const lunchData = getDisplayData('lunch_break');
    const eveningData = getDisplayData('evening_break');
    const morningEveningData = getDisplayData('morning_evening_study');
    const weekendData = getDisplayData('weekend_day');
    
    const summary = generateTotalSummary(
      lunchData,
      eveningData,
      morningEveningData,
      weekendData,
      selectedCheckInTypes
    );
    updateTotalSummaryData(summary);
  };

  // 监听基础次数变化或班级数据变化，重新计算午休和晚休的有效次数并更新Context
  useEffect(() => {
    let shouldUpdate = false;
    
    // 重新计算午休数据
    if (checkInData.lunch_break.length > 0) {
      const recalculatedLunchData = recalculateCheckInData(
        checkInData.lunch_break,
        classes,
        'lunch_break',
        baseCountSettings
      );
      updateCheckInData('lunch_break', recalculatedLunchData);
      shouldUpdate = true;
    }

    // 重新计算晚休数据
    if (checkInData.evening_break.length > 0) {
      const recalculatedEveningData = recalculateCheckInData(
        checkInData.evening_break,
        classes,
        'evening_break',
        baseCountSettings
      );
      updateCheckInData('evening_break', recalculatedEveningData);
      shouldUpdate = true;
    }
    
    // 注意：这里不需要担心无限循环，因为recalculateCheckInData只修改effective_count和score
    // 不会修改total_count和dates，所以checkInData的实质内容不会无限变化
  }, [baseCountSettings.lunch_break.single_class, baseCountSettings.lunch_break.multi_class, 
      baseCountSettings.evening_break.single_class, baseCountSettings.evening_break.multi_class, 
      classes.length]);

  // 监听签到数据变化和选中类型变化，自动更新总量化统计
  useEffect(() => {
    updateTotalSummary();
  }, [checkInData, classes, baseCountSettings, selectedCheckInTypes]);

  const form = useForm<CheckInFormData>({
    defaultValues: {
      teacher_name: '',
      date: '',
      type: 'lunch_break'
    }
  });

  useEffect(() => {
    loadClasses();
  }, []);

  // 全局点击监听，点击其他地方时关闭按钮
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      // 如果点击的不是表格行，则关闭按钮
      if (!target.closest('tr[data-row-clickable]')) {
        if (clickedRowIndex !== null) {
          // 触发退出动画
          setIsButtonExiting(true);
          setTimeout(() => {
            setClickedRowIndex(null);
            setIsButtonExiting(false);
          }, 200); // 动画时长 200ms
        }
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [clickedRowIndex]);

  const loadClasses = async () => {
    try {
      setLoading(true);
      const data = await classApi.getAllClasses();
      setClasses(data);
    } catch (error) {
      console.error('加载班级列表失败:', error);
      toast.error('加载班级列表失败');
    } finally {
      setLoading(false);
    }
  };


  // 批量上传处理函数
  const handleBatchUpload = async (filesWithType: FileWithType[]) => {
    let successCount = 0;
    let errorCount = 0;
    let totalRecords = 0;
    let totalWarnings = 0;
    const errors: string[] = [];
    let lastSuccessType: CheckInType | null = null;

    for (const item of filesWithType) {
      if (!item.type) continue;

      try {
        // 解析Excel文件
        const rawData = await parseExcelFile(item.file);
        
        if (rawData.length === 0) {
          errors.push(`${item.file.name}: 文件中没有找到有效数据`);
          errorCount++;
          continue;
        }

        // 验证数据
        const { valid, invalid } = validateCheckInData(rawData, classes);
        
        if (valid.length === 0) {
          errors.push(`${item.file.name}: 没有找到有效的签到数据`);
          errorCount++;
          continue;
        }

        // 如果有无效数据，记录错误但继续处理有效数据
        if (invalid.length > 0) {
          const errorMsg = invalid.map(row => 
            `${row.姓名}(${row.班级})`
          ).join(', ');
          errors.push(`${item.file.name}: 以下教师与班级对应关系不匹配：${errorMsg}`);
          errorCount++;
        }

        // 处理签到数据
        const { summaries, warnings } = processCheckInData(valid, item.type, classes, baseCountSettings);
        
        // 更新状态
        updateCheckInData(item.type, summaries);
        
        // 保存原始数据
        saveOriginalData(item.type, summaries);
        
        // 标记该类型已上传
        markCheckInTypeAsUploaded(item.type);

        // 记录成功信息
        successCount++;
        totalRecords += valid.length;
        totalWarnings += warnings.length;
        lastSuccessType = item.type;
        
        // 显示单个文件的处理结果
        if (warnings.length > 0) {
          toast.warning(`${item.file.name}: 成功处理 ${valid.length} 条记录，但发现 ${warnings.length} 条超限记录已自动调整`, {
            duration: 5000
          });
        } else {
          toast.success(`${item.file.name}: 成功处理 ${valid.length} 条记录`);
        }
      } catch (error) {
        console.error(`${item.file.name} 处理失败:`, error);
        errors.push(`${item.file.name}: 文件处理失败，请检查文件格式`);
        errorCount++;
        toast.error(`${item.file.name}: 文件处理失败，请检查文件格式`);
      }
    }

    // 切换到最后一个成功上传的标签页
    if (lastSuccessType) {
      setActiveTab(lastSuccessType);
    }

    // 显示总体处理结果
    if (successCount > 0 && errorCount === 0) {
      if (filesWithType.length === 1) {
        // 单文件上传时不显示总结（已经显示过单个文件的结果）
      } else {
        // 多文件上传时显示总结
        if (totalWarnings > 0) {
          toast.success(`批量上传完成：成功处理 ${successCount} 个文件，共 ${totalRecords} 条记录（${totalWarnings} 条超限记录已自动调整）`, {
            duration: 5000
          });
        } else {
          toast.success(`批量上传完成：成功处理 ${successCount} 个文件，共 ${totalRecords} 条记录`);
        }
      }
    } else if (successCount > 0 && errorCount > 0) {
      toast.warning(`批量上传完成：成功 ${successCount} 个文件（${totalRecords} 条记录），失败 ${errorCount} 个文件`, {
        duration: 5000
      });
      // 显示错误详情
      if (errors.length > 0) {
        console.error('批量上传错误详情：', errors);
      }
    } else {
      toast.error(`所有文件上传失败`);
      // 显示错误详情
      if (errors.length > 0) {
        console.error('批量上传错误详情：', errors);
      }
    }
  };

  const handleAddCheckIn = async (data: CheckInFormData) => {
    try {
      // 检查是否在总量化统计标签页
      if (activeTab === 'total_summary') {
        toast.error('请切换到具体的签到类型标签页后再添加签到记录');
        return;
      }

      // 验证教师是否存在
      const teacherExists = classes.some(cls => cls.teacher_name === data.teacher_name);
      if (!teacherExists) {
        toast.error('该教师不存在，请先在班级管理中添加');
        return;
      }

      // 获取教师对应的班级
      const teacherClasses = classes.filter(cls => cls.teacher_name === data.teacher_name);
      
      // 格式化日期为统一格式
      const formattedDate = formatDateForDisplay(data.date);
      
      // 检查当日签到次数限制
      const existingData = checkInData[data.type];
      const teacherRecord = existingData.find(item => item.teacher_name === data.teacher_name);
      
      if (teacherRecord) {
        // 统计该日期已有的签到次数
        const dateCount = teacherRecord.dates.reduce((count, dateStr) => {
          const cleanDate = dateStr.replace(/（.*?）/, ''); // 移除次数标记
          if (cleanDate === formattedDate) {
            const countMatch = dateStr.match(/（(\d+)次）/);
            return count + (countMatch ? parseInt(countMatch[1]) : 1);
          }
          return count;
        }, 0);
        
        // 检查签到次数上限
        const maxCount = (data.type === 'morning_evening_study' || data.type === 'weekend_day') ? 2 : 1;
        if (dateCount >= maxCount) {
          toast.error(`该教师在${formattedDate}的${CHECK_IN_TYPE_LABELS[data.type]}签到次数已达上限（${maxCount}次）`);
          return;
        }
      }

      // 更新签到数据 - 需要为每个班级都更新
      const updatedData = [...existingData];
      
      // 为教师的每个班级都添加签到记录
      teacherClasses.forEach(teacherClass => {
        const existingIndex = updatedData.findIndex(
          item => item.teacher_name === data.teacher_name && item.class_name === teacherClass.class_name
        );
        
        if (existingIndex >= 0) {
          // 更新现有记录
          const existing = updatedData[existingIndex];
          const newTotalCount = existing.total_count + 1;
          
          // 重新计算有效签到次数
          const isMultiClass = teacherClasses.length > 1;
          const newEffectiveCount = calculateEffectiveCount(newTotalCount, data.type, isMultiClass);
          const newScore = newEffectiveCount * 2;
          
          // 更新日期列表，合并相同日期
          const updatedDates = [...existing.dates];
          const existingDateIndex = updatedDates.findIndex(dateStr => {
            const cleanDate = dateStr.replace(/（.*?）/, '');
            return cleanDate === formattedDate;
          });
          
          if (existingDateIndex >= 0) {
            // 如果日期已存在，更新次数
            const existingDateStr = updatedDates[existingDateIndex];
            const countMatch = existingDateStr.match(/（(\d+)次）/);
            const currentCount = countMatch ? parseInt(countMatch[1]) : 1;
            updatedDates[existingDateIndex] = `${formattedDate}（${currentCount + 1}次）`;
          } else {
            // 如果日期不存在，添加新日期
            updatedDates.push(formattedDate);
            // 按日期排序（从新到旧）- 正确解析日期
            updatedDates.sort((a, b) => {
              const dateA = a.replace(/（.*?）/, '');
              const dateB = b.replace(/（.*?）/, '');
              
              // 解析日期格式 YYYY.M.D
              const parseDate = (dateStr: string) => {
                const parts = dateStr.split('.');
                if (parts.length === 3) {
                  const year = parseInt(parts[0]);
                  const month = parseInt(parts[1]);
                  const day = parseInt(parts[2]);
                  return new Date(year, month - 1, day);
                }
                return new Date(dateStr);
              };
              
              const parsedDateA = parseDate(dateA);
              const parsedDateB = parseDate(dateB);
              
              // 从新到旧排序
              return parsedDateB.getTime() - parsedDateA.getTime();
            });
          }
          
          updatedData[existingIndex] = {
            ...existing,
            total_count: newTotalCount,
            effective_count: newEffectiveCount,
            score: newScore,
            dates: updatedDates
          };
        } else {
          // 添加新记录
          const isMultiClass = teacherClasses.length > 1;
          const effectiveCount = calculateEffectiveCount(1, data.type, isMultiClass);
          const score = effectiveCount * 2;
          
          updatedData.push({
            class_name: teacherClass.class_name,
            teacher_name: data.teacher_name,
            total_count: 1,
            effective_count: effectiveCount,
            score,
            dates: [formattedDate]
          });
        }
      });

      updateCheckInData(data.type, updatedData.sort((a, b) => a.class_name.localeCompare(b.class_name)));

      setIsAddDialogOpen(false);
      form.reset();
      toast.success('签到记录添加成功');
    } catch (error) {
      console.error('添加签到记录失败:', error);
      toast.error('添加签到记录失败');
    }
  };

  // 添加新的补充签到行
  const handleAddSupplementRow = () => {
    const newIndex = supplementRows.length;
    setSupplementRows([...supplementRows, { teacher_name: '', date: '', type: 'lunch_break' }]);
    setActiveInputIndex(newIndex);
    
    // 延迟聚焦到新添加的输入框
    setTimeout(() => {
      const inputs = document.querySelectorAll('input[placeholder="教师姓名"]');
      const newInput = inputs[newIndex] as HTMLInputElement;
      if (newInput) {
        newInput.focus();
      }
    }, 50);
  };

  // 删除补充签到行
  const handleRemoveSupplementRow = (index: number) => {
    if (supplementRows.length > 1) {
      const newRows = supplementRows.filter((_, i) => i !== index);
      setSupplementRows(newRows);
      if (activeInputIndex >= newRows.length) {
        setActiveInputIndex(newRows.length - 1);
      }
    }
  };

  // 更新补充签到行数据
  const handleUpdateSupplementRow = (index: number, field: keyof CheckInFormData, value: string) => {
    const newRows = [...supplementRows];
    newRows[index] = { ...newRows[index], [field]: value };
    setSupplementRows(newRows);
  };

  // 快速填充教师姓名
  const handleQuickFillTeacher = (teacherName: string) => {
    const newRows = [...supplementRows];
    newRows[activeInputIndex] = { ...newRows[activeInputIndex], teacher_name: teacherName };
    setSupplementRows(newRows);
  };

  // 快速填充日期
  const handleQuickFillDate = (date: string) => {
    const newRows = [...supplementRows];
    newRows[activeInputIndex] = { ...newRows[activeInputIndex], date };
    setSupplementRows(newRows);
  };

  // 获取所有签到数据中的日期范围
  const getAllCheckInDates = (): string[] => {
    const allDates = new Set<string>();
    
    // 遍历所有签到类型的数据
    Object.values(checkInData).forEach(dataArray => {
      dataArray.forEach(item => {
        item.dates.forEach(dateStr => {
          // 移除次数标记，只保留日期
          const cleanDate = dateStr.replace(/（.*?）/, '');
          if (cleanDate && cleanDate !== '未签到') {
            // 尝试解析不同格式的日期
            let formattedDate: string;
            
            // 处理 "2025.1.15" 格式
            const parts = cleanDate.split('.');
            if (parts.length === 3) {
              formattedDate = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
              allDates.add(formattedDate);
            } else {
              // 尝试解析其他格式的日期
              try {
                const date = new Date(cleanDate);
                if (!isNaN(date.getTime())) {
                  const year = date.getFullYear();
                  const month = (date.getMonth() + 1).toString().padStart(2, '0');
                  const day = date.getDate().toString().padStart(2, '0');
                  formattedDate = `${year}-${month}-${day}`;
                  allDates.add(formattedDate);
                }
              } catch (error) {
                // 忽略无法解析的日期
              }
            }
          }
        });
      });
    });
    
    // 转换为数组并排序
    return Array.from(allDates).sort();
  };

  // 获取指定签到类型的所有日期
  const getCheckInDatesByType = (type: CheckInType): string[] => {
    const dates = new Set<string>();
    
    checkInData[type].forEach(item => {
      item.dates.forEach(dateStr => {
        // 移除次数标记，只保留日期
        const cleanDate = dateStr.replace(/（.*?）/, '');
        if (cleanDate && cleanDate !== '未签到') {
          // 尝试解析不同格式的日期
          let formattedDate: string;
          
          // 处理 "2025.1.15" 格式
          const parts = cleanDate.split('.');
          if (parts.length === 3) {
            formattedDate = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
            dates.add(formattedDate);
          } else {
            // 尝试解析其他格式的日期
            try {
              const date = new Date(cleanDate);
              if (!isNaN(date.getTime())) {
                const year = date.getFullYear();
                const month = (date.getMonth() + 1).toString().padStart(2, '0');
                const day = date.getDate().toString().padStart(2, '0');
                formattedDate = `${year}-${month}-${day}`;
                dates.add(formattedDate);
              }
            } catch (error) {
              // 忽略无法解析的日期
            }
          }
        }
      });
    });
    
    // 转换为数组并排序
    return Array.from(dates).sort();
  };

  // 获取日期范围（最早和最晚日期）
  // 如果传入 type 参数，则只返回该类型的日期范围；否则返回所有类型的日期范围
  const getDateRange = (type?: CheckInType): { start: Date; end: Date } | null => {
    const allDates = type ? getCheckInDatesByType(type) : getAllCheckInDates();
    if (allDates.length === 0) {
      return null;
    }
    
    const startDate = new Date(allDates[0]);
    const endDate = new Date(allDates[allDates.length - 1]);
    
    return { start: startDate, end: endDate };
  };

  // 删除单个签到日期
  const handleDeleteDate = (teacherName: string, className: string, dateToDelete: string, type: CheckInType) => {
    const teacherClasses = classes.filter(cls => cls.teacher_name === teacherName);
    
    // 多班班主任直接联动删除所有班级，单班班主任只删除当前班级
    const applyToAll = teacherClasses.length > 1;
    executeDeleteDate(teacherName, className, dateToDelete, type, applyToAll);
  };

  // 处理还原操作
  const handleRestoreRow = (teacherName: string, type: CheckInType) => {
    // 检查数据是否有变化
    if (!hasDataChanged(type, teacherName)) {
      toast.info('该行数据未更改，无需还原');
      return;
    }
    
    // 还原该教师的所有班级数据
    restoreToOriginal(type, teacherName);
    toast.success('已还原到原始状态');
  };

  // 执行删除操作
  const executeDeleteDate = (teacherName: string, className: string, dateToDelete: string, type: CheckInType, applyToAll: boolean) => {
    const existingData = checkInData[type];
    const teacherClasses = classes.filter(cls => cls.teacher_name === teacherName);
    
    // 保存操作前的数据快照
    const previousData = JSON.parse(JSON.stringify(existingData));
    
    const updatedData = existingData.map(item => {
      // 如果是多班联动，删除所有班级；否则只删除当前班级
      const shouldUpdate = applyToAll 
        ? item.teacher_name === teacherName 
        : (item.teacher_name === teacherName && item.class_name === className);
      
      if (shouldUpdate) {
        // 移除指定日期
        const cleanDateToDelete = dateToDelete.replace(/（.*?）/, '');
        const updatedDates = [...item.dates];
        
        // 找到要删除的日期
        const dateIndex = updatedDates.findIndex(d => {
          const cleanDate = d.replace(/（.*?）/, '');
          return cleanDate === cleanDateToDelete;
        });
        
        if (dateIndex >= 0) {
          const dateStr = updatedDates[dateIndex];
          const countMatch = dateStr.match(/（(\d+)次）/);
          const currentCount = countMatch ? parseInt(countMatch[1]) : 1;
          
          if (currentCount > 2) {
            // 如果有多次（>2），减少一次，仍然显示次数
            updatedDates[dateIndex] = `${cleanDateToDelete}（${currentCount - 1}次）`;
          } else if (currentCount === 2) {
            // 如果有2次，减少一次后变成1次，不显示"（1次）"
            updatedDates[dateIndex] = cleanDateToDelete;
          } else {
            // 如果只有一次，直接删除
            updatedDates.splice(dateIndex, 1);
          }
        }
        
        // 重新计算统计数据
        const newTotalCount = updatedDates.reduce((sum, d) => {
          const countMatch = d.match(/（(\d+)次）/);
          return sum + (countMatch ? parseInt(countMatch[1]) : 1);
        }, 0);
        
        const isMultiClass = teacherClasses.length > 1;
        const newEffectiveCount = calculateEffectiveCountLocal(newTotalCount, type, isMultiClass);
        const newScore = newEffectiveCount * 2;
        
        return {
          ...item,
          dates: updatedDates,
          total_count: newTotalCount,
          effective_count: newEffectiveCount,
          score: newScore
        };
      }
      return item;
    });
    
    updateCheckInData(type, updatedData);
    
    toast.success(applyToAll ? '已删除所有班级的签到记录' : '已删除当前班级的签到记录');
  };

  // 获取每日签到次数上限
  const getDailyCheckInLimit = (checkInType: CheckInType): number => {
    switch (checkInType) {
      case 'lunch_break':
      case 'evening_break':
      case 'weekend_day':
        return 1;
      case 'morning_evening_study':
        return 2;
      default:
        return 1;
    }
  };

  // 打开补充签到弹框
  const handleOpenSupplementDialog = (teacherName: string, checkInType: CheckInType, existingDates: string[]) => {
    setCurrentSupplementTeacher({
      teacherName,
      checkInType,
      existingDates
    });
    setSupplementDialogOpen(true);
  };

  // 确认补充签到
  const handleConfirmSupplement = (selectedDates: { date: string; count: number }[]) => {
    if (!currentSupplementTeacher) return;
    
    const { teacherName, checkInType } = currentSupplementTeacher;
    const teacherClasses = classes.filter(cls => cls.teacher_name === teacherName);
    const dailyLimit = getDailyCheckInLimit(checkInType);
    const existingData = checkInData[checkInType];
    const teacherData = existingData.filter(item => item.teacher_name === teacherName);
    
    // 多班班主任：验证所有班级并联动补签
    if (teacherClasses.length > 1) {
      // 找出所有班级都能补签的最小次数
      const finalAdjustedDates: { date: string; count: number }[] = [];
      const limitedInfo: string[] = [];
      
      for (const { date, count } of selectedDates) {
        let minCanAdd = count;
        
        // 检查每个班级的可补签次数
        for (const classData of teacherData) {
          const dateCountMap = new Map<string, number>();
          classData.dates.forEach(dateStr => {
            const cleanDate = dateStr.replace(/（.*?）/, '');
            const countMatch = dateStr.match(/（(\d+)次）/);
            const c = countMatch ? parseInt(countMatch[1]) : 1;
            dateCountMap.set(cleanDate, c);
          });
          
          const currentCount = dateCountMap.get(date) || 0;
          const maxCanAdd = dailyLimit - currentCount;
          
          if (maxCanAdd < minCanAdd) {
            minCanAdd = Math.max(0, maxCanAdd);
            if (maxCanAdd <= 0) {
              limitedInfo.push(`${classData.class_name} - ${date}（已达上限${dailyLimit}次）`);
            } else {
              limitedInfo.push(`${classData.class_name} - ${date}（只能补签${maxCanAdd}次，已有${currentCount}次）`);
            }
          }
        }
        
        if (minCanAdd > 0) {
          finalAdjustedDates.push({ date, count: minCanAdd });
        }
      }
      
      if (finalAdjustedDates.length > 0) {
        executeAddDates(teacherName, checkInType, finalAdjustedDates, true);
      }
      
      if (limitedInfo.length > 0) {
        toast.warning(`以下班级和日期因超出上限而未完全补签：\n${limitedInfo.join('\n')}`, {
          duration: 5000
        });
      }
      
      // 关闭补充签到弹框
      setSupplementDialogOpen(false);
      return;
    }
    
    // 单班班主任：验证并补签
    if (teacherData.length > 0) {
      const classData = teacherData[0];
      // 统计每个日期的现有签到次数
      const dateCountMap = new Map<string, number>();
      classData.dates.forEach(dateStr => {
        const cleanDate = dateStr.replace(/（.*?）/, '');
        const countMatch = dateStr.match(/（(\d+)次）/);
        const count = countMatch ? parseInt(countMatch[1]) : 1;
        dateCountMap.set(cleanDate, count);
      });
      
      // 调整补签次数，不超过上限
      const adjustedDates: { date: string; count: number }[] = [];
      const limitedDates: string[] = [];
      
      for (const { date, count } of selectedDates) {
        const currentCount = dateCountMap.get(date) || 0;
        const maxCanAdd = dailyLimit - currentCount;
        
        if (maxCanAdd <= 0) {
          limitedDates.push(`${date}（已达上限${dailyLimit}次）`);
        } else if (count > maxCanAdd) {
          adjustedDates.push({ date, count: maxCanAdd });
          limitedDates.push(`${date}（只能补签${maxCanAdd}次，已有${currentCount}次）`);
        } else {
          adjustedDates.push({ date, count });
        }
      }
      
      if (adjustedDates.length > 0) {
        executeAddDates(teacherName, checkInType, adjustedDates, false);
      }
      
      if (limitedDates.length > 0) {
        toast.warning(`以下日期因超出上限而未完全补签：\n${limitedDates.join('\n')}`);
      }
    } else {
      // 没有现有数据，直接补签
      executeAddDates(teacherName, checkInType, selectedDates, false);
    }
    
    // 关闭补充签到弹框
    setSupplementDialogOpen(false);
  };

  // 执行添加日期操作
  const executeAddDates = (teacherName: string, checkInType: CheckInType, selectedDates: { date: string; count: number }[], applyToAll: boolean) => {
    const existingData = checkInData[checkInType];
    const teacherClasses = classes.filter(cls => cls.teacher_name === teacherName);
    
    // 保存操作前的数据快照
    const previousData = JSON.parse(JSON.stringify(existingData));
    
    // 为每个班级更新数据
    const updatedData = existingData.map(item => {
      // 如果是多班联动，更新所有班级；否则只更新第一个班级（从小+号触发时）
      const shouldUpdate = applyToAll 
        ? item.teacher_name === teacherName 
        : (item.teacher_name === teacherName && item.class_name === teacherClasses[0].class_name);
      
      if (shouldUpdate) {
        const updatedDates = [...item.dates];
        
        // 添加新的签到日期
        selectedDates.forEach(({ date, count }) => {
          for (let i = 0; i < count; i++) {
            // 检查日期是否已存在
            const existingDateIndex = updatedDates.findIndex(d => {
              const cleanDate = d.replace(/（.*?）/, '');
              return cleanDate === date;
            });
            
            if (existingDateIndex >= 0) {
              // 如果日期已存在，增加次数
              const existingDateStr = updatedDates[existingDateIndex];
              const countMatch = existingDateStr.match(/（(\d+)次）/);
              const currentCount = countMatch ? parseInt(countMatch[1]) : 1;
              updatedDates[existingDateIndex] = `${date}（${currentCount + 1}次）`;
            } else {
              // 如果日期不存在，添加新日期
              updatedDates.push(date);
            }
          }
        });
        
        // 按日期排序（从新到旧）
        updatedDates.sort((a, b) => {
          const dateA = a.replace(/（.*?）/, '');
          const dateB = b.replace(/（.*?）/, '');
          
          const parseDate = (dateStr: string) => {
            const parts = dateStr.split('.');
            if (parts.length === 3) {
              const year = parseInt(parts[0]);
              const month = parseInt(parts[1]);
              const day = parseInt(parts[2]);
              return new Date(year, month - 1, day);
            }
            return new Date(dateStr);
          };
          
          const parsedDateA = parseDate(dateA);
          const parsedDateB = parseDate(dateB);
          
          return parsedDateB.getTime() - parsedDateA.getTime();
        });
        
        // 重新计算统计数据
        const newTotalCount = updatedDates.reduce((sum, d) => {
          const countMatch = d.match(/（(\d+)次）/);
          return sum + (countMatch ? parseInt(countMatch[1]) : 1);
        }, 0);
        
        const isMultiClass = teacherClasses.length > 1;
        const newEffectiveCount = calculateEffectiveCountLocal(newTotalCount, checkInType, isMultiClass);
        const newScore = newEffectiveCount * 2;
        
        return {
          ...item,
          dates: updatedDates,
          total_count: newTotalCount,
          effective_count: newEffectiveCount,
          score: newScore
        };
      }
      return item;
    });
    
    updateCheckInData(checkInType, updatedData);
    
    const totalCount = selectedDates.reduce((sum, { count }) => sum + count, 0);
    toast.success(`已为 ${teacherName} 补充 ${totalCount} 次签到${applyToAll ? '（应用到所有班级）' : ''}`);
  };

  // 批量提交补充签到
  const handleBatchSupplementSubmit = async () => {
    try {
      // 过滤掉空行
      const validRows = supplementRows.filter(row => 
        row.teacher_name.trim() && row.date.trim()
      );

      if (validRows.length === 0) {
        toast.error('请至少填写一条完整的签到记录');
        return;
      }

      // 检查每种签到类型是否已上传数据
      const typesToCheck = new Set(validRows.map(row => row.type));
      for (const type of typesToCheck) {
        const hasUploadedData = uploadedCheckInTypes.includes(type);
        if (!hasUploadedData) {
          toast.error(`补充签到前，请先上传${CHECK_IN_TYPE_LABELS[type]}签到数据`);
          return;
        }
      }

      // 验证每一行数据
      for (let i = 0; i < validRows.length; i++) {
        const row = validRows[i];
        
        // 验证教师是否存在
        const teacherExists = classes.some(cls => cls.teacher_name === row.teacher_name);
        if (!teacherExists) {
          toast.error(`教师"${row.teacher_name}"不存在，请先在班级管理中添加`);
          return;
        }

        // 获取教师对应的班级
        const teacherClasses = classes.filter(cls => cls.teacher_name === row.teacher_name);
        const formattedDate = formatDateForDisplay(row.date);
        
        // 检查当日签到次数限制
        const existingData = checkInData[row.type];
        const teacherRecord = existingData.find(item => item.teacher_name === row.teacher_name);
        
        // 计算已存在的签到次数
        let existingDateCount = 0;
        if (teacherRecord) {
          existingDateCount = teacherRecord.dates.reduce((count, dateStr) => {
            const cleanDate = dateStr.replace(/（.*?）/, '');
            if (cleanDate === formattedDate) {
              const countMatch = dateStr.match(/（(\d+)次）/);
              return count + (countMatch ? parseInt(countMatch[1]) : 1);
            }
            return count;
          }, 0);
        }
        
        // 计算当前提交的补充签到中，相同教师、相同日期、相同类型的记录数（包括当前这条）
        const currentSubmitCount = validRows.filter((r, idx) => 
          idx <= i && // 只统计当前及之前的记录
          r.teacher_name === row.teacher_name && 
          formatDateForDisplay(r.date) === formattedDate && 
          r.type === row.type
        ).length;
        
        // 总次数 = 已存在的次数 + 当前提交的次数
        const totalCount = existingDateCount + currentSubmitCount;
        const maxCount = (row.type === 'morning_evening_study' || row.type === 'weekend_day') ? 2 : 1;
        
        if (totalCount > maxCount) {
          toast.error(`教师"${row.teacher_name}"在${formattedDate}的${CHECK_IN_TYPE_LABELS[row.type]}签到次数超出上限（最多${maxCount}次，已有${existingDateCount}次，本次提交${currentSubmitCount}次）`);
          return;
        }
      }


      // 按签到类型分组处理
      const groupedByType: Record<CheckInType, CheckInFormData[]> = {
        lunch_break: [],
        evening_break: [],
        morning_evening_study: [],
        weekend_day: []
      };
      
      validRows.forEach(row => {
        groupedByType[row.type].push(row);
      });

      // 为每种签到类型批量更新数据
      Object.entries(groupedByType).forEach(([type, rows]) => {
        if (rows.length === 0) return;
        
        const checkInType = type as CheckInType;
        const existingData = checkInData[checkInType];
        let updatedData = [...existingData];
        
        // 如果当前类型还没有任何数据，先为所有班主任初始化0次记录
        if (updatedData.length === 0) {
          updatedData = classes.map(cls => ({
            class_name: cls.class_name,
            teacher_name: cls.teacher_name,
            total_count: 0,
            effective_count: 0,
            score: 0,
            dates: []
          }));
        }
        
        // 处理每一行数据
        rows.forEach(row => {
          const teacherClasses = classes.filter(cls => cls.teacher_name === row.teacher_name);
          const formattedDate = formatDateForDisplay(row.date);
          
          // 为教师的每个班级都添加签到记录
          teacherClasses.forEach(teacherClass => {
            const existingIndex = updatedData.findIndex(
              item => item.teacher_name === row.teacher_name && item.class_name === teacherClass.class_name
            );
            
            if (existingIndex >= 0) {
              // 更新现有记录
              const existing = updatedData[existingIndex];
              const newTotalCount = existing.total_count + 1;
              const isMultiClass = teacherClasses.length > 1;
              const newEffectiveCount = calculateEffectiveCount(newTotalCount, checkInType, isMultiClass);
              const newScore = newEffectiveCount * 2;
              
              const updatedDates = [...existing.dates];
              const existingDateIndex = updatedDates.findIndex(dateStr => {
                const cleanDate = dateStr.replace(/（.*?）/, '');
                return cleanDate === formattedDate;
              });
              
              if (existingDateIndex >= 0) {
                const existingDateStr = updatedDates[existingDateIndex];
                const countMatch = existingDateStr.match(/（(\d+)次）/);
                const currentCount = countMatch ? parseInt(countMatch[1]) : 1;
                updatedDates[existingDateIndex] = `${formattedDate}（${currentCount + 1}次）`;
              } else {
                updatedDates.push(formattedDate);
                updatedDates.sort((a, b) => {
                  const dateA = a.replace(/（.*?）/, '');
                  const dateB = b.replace(/（.*?）/, '');
                  const parseDate = (dateStr: string) => {
                    const parts = dateStr.split('.');
                    if (parts.length === 3) {
                      const year = parseInt(parts[0]);
                      const month = parseInt(parts[1]);
                      const day = parseInt(parts[2]);
                      return new Date(year, month - 1, day);
                    }
                    return new Date(dateStr);
                  };
                  const parsedDateA = parseDate(dateA);
                  const parsedDateB = parseDate(dateB);
                  return parsedDateB.getTime() - parsedDateA.getTime();
                });
              }
              
              updatedData[existingIndex] = {
                ...existing,
                total_count: newTotalCount,
                effective_count: newEffectiveCount,
                score: newScore,
                dates: updatedDates
              };
            } else {
              // 添加新记录
              const isMultiClass = teacherClasses.length > 1;
              const effectiveCount = calculateEffectiveCount(1, checkInType, isMultiClass);
              const score = effectiveCount * 2;
              
              updatedData.push({
                class_name: teacherClass.class_name,
                teacher_name: row.teacher_name,
                total_count: 1,
                effective_count: effectiveCount,
                score,
                dates: [formattedDate]
              });
            }
          });
        });
        
        // 更新该类型的签到数据
        updateCheckInData(checkInType, updatedData.sort((a, b) => a.class_name.localeCompare(b.class_name)));
      });
      
      // 重新计算总量化统计
      updateTotalSummary();
      
      // 添加到已补充记录列表（使用Context）
      const newRecords = validRows.map(row => ({
        ...row,
        id: `${row.teacher_name}-${row.date}-${row.type}-${Date.now()}-${Math.random()}`
      }));
      addSupplementedRecords(newRecords);

      // 重置表单
      setSupplementRows([{ teacher_name: '', date: '', type: 'lunch_break' }]);
      setActiveInputIndex(0);
      toast.success(`成功添加 ${validRows.length} 条签到记录`);
    } catch (error) {
      console.error('批量添加签到记录失败:', error);
      toast.error('批量添加签到记录失败');
    }
  };

  // 删除已补充的签到记录
  const handleDeleteSupplementedRecord = async (record: CheckInFormData & { id: string }) => {
    try {
      const teacherClasses = classes.filter(cls => cls.teacher_name === record.teacher_name);
      const formattedDate = formatDateForDisplay(record.date);
      const existingData = checkInData[record.type];
      const updatedData = [...existingData];
      
      // 为教师的每个班级都删除签到记录
      teacherClasses.forEach(teacherClass => {
        const existingIndex = updatedData.findIndex(
          item => item.teacher_name === record.teacher_name && item.class_name === teacherClass.class_name
        );
        
        if (existingIndex >= 0) {
          const existing = updatedData[existingIndex];
          const newTotalCount = Math.max(0, existing.total_count - 1);
          
          // 重新计算有效签到次数
          const isMultiClass = teacherClasses.length > 1;
          const newEffectiveCount = calculateEffectiveCount(newTotalCount, record.type, isMultiClass);
          const newScore = newEffectiveCount * 2;
          
          // 更新日期列表
          const updatedDates = [...existing.dates];
          const existingDateIndex = updatedDates.findIndex(dateStr => {
            const cleanDate = dateStr.replace(/（.*?）/, '');
            return cleanDate === formattedDate;
          });
          
          if (existingDateIndex >= 0) {
            const existingDateStr = updatedDates[existingDateIndex];
            const countMatch = existingDateStr.match(/（(\d+)次）/);
            const currentCount = countMatch ? parseInt(countMatch[1]) : 1;
            
            if (currentCount > 1) {
              // 如果该日期有多次签到，减少次数
              updatedDates[existingDateIndex] = `${formattedDate}（${currentCount - 1}次）`;
            } else {
              // 如果该日期只有一次签到，删除该日期
              updatedDates.splice(existingDateIndex, 1);
            }
          }
          
          if (newTotalCount === 0) {
            // 如果总次数为0，删除该记录
            updatedData.splice(existingIndex, 1);
          } else {
            updatedData[existingIndex] = {
              ...existing,
              total_count: newTotalCount,
              effective_count: newEffectiveCount,
              score: newScore,
              dates: updatedDates
            };
          }
        }
      });
      
      updateCheckInData(record.type, updatedData.sort((a, b) => a.class_name.localeCompare(b.class_name)));
      
      // 重新计算总量化统计
      updateTotalSummary();
      
      // 从已补充记录列表中删除（使用Context）
      removeSupplementedRecord(record.id);
      
      toast.success('签到记录删除成功');
    } catch (error) {
      console.error('删除签到记录失败:', error);
      toast.error('删除签到记录失败');
    }
  };

  // 格式化日期显示函数
  const formatDateForDisplay = (dateStr: string): string => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [year, month, day] = dateStr.split('-').map(Number);
      return `${year}.${month}.${day}`;
    }
    return dateStr;
  };

  // 计算有效签到次数的辅助函数
  const calculateEffectiveCount = (totalCount: number, type: CheckInType, isMultiClass: boolean): number => {
    switch (type) {
      case 'lunch_break':
        return totalCount - (isMultiClass ? baseCountSettings.lunch_break.multi_class : baseCountSettings.lunch_break.single_class);
      case 'evening_break':
        return totalCount - (isMultiClass ? baseCountSettings.evening_break.multi_class : baseCountSettings.evening_break.single_class);
      case 'morning_evening_study':
        return totalCount; // 早晚自习全部算有效
      case 'weekend_day':
        return totalCount; // 周末白天全部算有效
      default:
        return totalCount;
    }
  };

  const handleExport = (type: CheckInType) => {
    const data = getDisplayData(type); // 使用页面显示的数据
    if (data.length === 0) {
      toast.error('没有数据可导出');
      return;
    }

    const exportData = data.map(item => ({
      班级: item.class_name,
      班主任: item.teacher_name,
      签到次数: item.total_count,
      ...(type !== 'morning_evening_study' && type !== 'weekend_day' && { 额外签到次数: item.effective_count }),
      量化分: item.score,
      签到日期: item.dates.join(' ')
    }));

    exportToExcel(
      exportData, 
      `${CHECK_IN_TYPE_LABELS[type]}签到统计.xlsx`, 
      CHECK_IN_TYPE_LABELS[type]
    );
    toast.success('导出成功');
  };

  const handleExportTotal = () => {
    if (totalSummaryData.length === 0) {
      toast.error('没有数据可导出');
      return;
    }

    const exportData = totalSummaryData.map(item => ({
      班级: item.class_name,
      班主任: item.teacher_name,
      午休量化分: item.lunch_break_score,
      晚休量化分: item.evening_break_score,
      早晚自习量化分: item.morning_evening_study_score,
      周末白天量化分: item.weekend_day_score,
      总量化分: item.total_score
    }));

    exportToExcel(exportData, '签到总量化统计.xlsx', '总量化统计');
    toast.success('导出成功');
  };

  // 使用Canvas API手动绘制表格并导出为图片
  const handleExportImage = async (type: CheckInType | 'total_summary') => {
    try {
      // 获取当前数据（考虑排序状态）
      let data;
      if (type === 'total_summary') {
        // 如果是总量化统计，需要考虑排序状态
        if (sortByRank) {
          // 按名次排序
          data = [...totalSummaryData].sort((a, b) => b.total_score - a.total_score);
        } else {
          // 按班级顺序
          data = totalSummaryData;
        }
      } else {
        data = getDisplayData(type);
      }
      
      if (data.length === 0) {
        toast.error('暂无数据可导出');
        return;
      }

      // 创建Canvas
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        toast.error('浏览器不支持Canvas');
        return;
      }

      // 设置Canvas尺寸和样式参数
      const padding = 40;
      const rowHeight = 60;
      const tableHeaderHeight = 56; // 与网页保持一致
      const cardHeaderHeight = 80; // 减小高度，使布局更紧凑
      const cellPadding = 15;
      const fontSize = 14;
      const titleFontSize = 20;
      const headerFontSize = 14;
      const smallFontSize = 12;
      
      // 根据类型确定列配置
      let columns: { label: string; width: number; key: string; minWidth?: number }[] = [];
      let title = '';
      let subtitle = '';
      
      // 固定的Canvas总宽度（与网页表格宽度一致）
      const fixedTableWidth = 1200;
      
      // 临时设置字体以便测量文本宽度
      ctx.font = `${smallFontSize}px "Consolas", "Monaco", monospace`;
      
      if (type === 'total_summary') {
        title = '总量化统计';
        subtitle = '只有已勾选的签到类型会被统计';
        
        // 计算总量化统计表的列数
        let columnCount = 4; // 班级、班主任、总量化分、名次
        if (selectedCheckInTypes.lunch_break) columnCount++;
        if (selectedCheckInTypes.evening_break) columnCount++;
        if (selectedCheckInTypes.morning_evening_study) columnCount++;
        if (selectedCheckInTypes.weekend_day) columnCount++;
        
        // 平均分配列宽
        const avgWidth = Math.floor(fixedTableWidth / columnCount);
        
        columns = [
          { label: '班级', width: avgWidth, key: 'class_name' },
          { label: '班主任', width: avgWidth, key: 'teacher_name' }
        ];
        
        if (selectedCheckInTypes.lunch_break) {
          columns.push({ label: '午休', width: avgWidth, key: 'lunch_break_score' });
        }
        if (selectedCheckInTypes.evening_break) {
          columns.push({ label: '晚休', width: avgWidth, key: 'evening_break_score' });
        }
        if (selectedCheckInTypes.morning_evening_study) {
          columns.push({ label: '早晚自习', width: avgWidth, key: 'morning_evening_study_score' });
        }
        if (selectedCheckInTypes.weekend_day) {
          columns.push({ label: '周末白天', width: avgWidth, key: 'weekend_day_score' });
        }
        
        columns.push({ label: '总量化分', width: avgWidth, key: 'total_score' });
        columns.push({ label: '名次', width: avgWidth, key: 'rank' });
        
        // 调整最后一列宽度以填满剩余空间
        const totalWidth = columns.reduce((sum, col) => sum + col.width, 0);
        columns[columns.length - 1].width += fixedTableWidth - totalWidth;
      } else {
        title = type === 'morning_evening_study' || type === 'weekend_day' 
          ? `${CHECK_IN_TYPE_LABELS[type]}统计`
          : `${CHECK_IN_TYPE_LABELS[type]}签到统计`;
        if (type === 'lunch_break' || type === 'evening_break') {
          subtitle = `本周期基础签到次数：单班班主任 ${baseCountSettings[type].single_class} 次、多班班主任 ${baseCountSettings[type].multi_class} 次`;
        }
        
        // 计算签到统计表的列数
        let columnCount = 4; // 班级、班主任、签到次数、量化分
        if (type !== 'morning_evening_study' && type !== 'weekend_day') {
          columnCount++; // 额外签到次数
        }
        columnCount++; // 签到日期
        
        // 固定列的最小宽度
        const fixedColWidth = 100;
        const dateColMinWidth = 300;
        
        // 计算固定列总宽度
        const fixedColsCount = columnCount - 1; // 除了签到日期列
        const fixedColsTotalWidth = fixedColWidth * fixedColsCount;
        
        // 签到日期列占用剩余空间
        const dateColWidth = Math.max(dateColMinWidth, fixedTableWidth - fixedColsTotalWidth);
        
        columns = [
          { label: '班级', width: fixedColWidth, key: 'class_name' },
          { label: '班主任', width: fixedColWidth, key: 'teacher_name' },
          { label: '签到次数', width: fixedColWidth, key: 'total_count' }
        ];
        
        if (type !== 'morning_evening_study' && type !== 'weekend_day') {
          columns.push({ label: '额外签到次数', width: fixedColWidth, key: 'effective_count' });
        }
        
        columns.push({ label: '量化分', width: fixedColWidth, key: 'score' });
        columns.push({ label: '签到日期', width: dateColWidth, key: 'dates' });
      }
      
      // 计算Canvas总宽度和高度（使用固定宽度）
      const tableWidth = fixedTableWidth;
      canvas.width = tableWidth + padding * 2;
      canvas.height = cardHeaderHeight + tableHeaderHeight + (data.length * rowHeight) + padding * 2;
      
      // 设置高分辨率
      const scale = 2;
      canvas.width *= scale;
      canvas.height *= scale;
      ctx.scale(scale, scale);
      
      const canvasWidth = canvas.width / scale;
      const canvasHeight = canvas.height / scale;
      
      // 绘制白色背景
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
      
      // 绘制卡片头部背景（渐变）
      const cardHeaderY = padding;
      const cardGradient = ctx.createLinearGradient(padding, cardHeaderY, padding + tableWidth, cardHeaderY);
      cardGradient.addColorStop(0, '#f9fafb');
      cardGradient.addColorStop(1, '#f3f4f6');
      ctx.fillStyle = cardGradient;
      ctx.fillRect(padding, cardHeaderY, tableWidth, cardHeaderHeight);
      
      // 绘制卡片头部底部边框
      ctx.strokeStyle = '#e5e7eb';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padding, cardHeaderY + cardHeaderHeight);
      ctx.lineTo(padding + tableWidth, cardHeaderY + cardHeaderHeight);
      ctx.stroke();
      
      // 绘制图标
      const iconX = padding + 20;
      const iconY = cardHeaderY + (cardHeaderHeight - 24) / 2; // 垂直居中
      const iconSize = 24;
      
      // 根据类型绘制不同的图标
      ctx.fillStyle = '#2563eb';
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 2;
      
      if (type === 'total_summary') {
        // BarChart3图标 - 三个柱状图
        const barWidth = 3;
        const gap = 3;
        const startX = iconX + 3;
        
        // 第一个柱子（最短）
        ctx.fillRect(startX, iconY + 16, barWidth, 8);
        // 第二个柱子（中等）
        ctx.fillRect(startX + barWidth + gap, iconY + 10, barWidth, 14);
        // 第三个柱子（最高）
        ctx.fillRect(startX + (barWidth + gap) * 2, iconY + 4, barWidth, 20);
      } else if (type === 'lunch_break') {
        // Sun图标（太阳）
        const centerX = iconX + iconSize / 2;
        const centerY = iconY + iconSize / 2;
        const radius = 5;
        // 绘制中心圆
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.fill();
        // 绘制光线
        for (let i = 0; i < 8; i++) {
          const angle = (Math.PI * 2 * i) / 8;
          const x1 = centerX + Math.cos(angle) * (radius + 2);
          const y1 = centerY + Math.sin(angle) * (radius + 2);
          const x2 = centerX + Math.cos(angle) * (radius + 6);
          const y2 = centerY + Math.sin(angle) * (radius + 6);
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }
      } else if (type === 'evening_break') {
        // Moon图标（月亮）
        const centerX = iconX + iconSize / 2;
        const centerY = iconY + iconSize / 2;
        const radius = 8;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0.5, Math.PI * 1.5);
        ctx.fill();
      } else if (type === 'morning_evening_study') {
        // Clock图标（时钟）
        const centerX = iconX + iconSize / 2;
        const centerY = iconY + iconSize / 2;
        const radius = 9;
        // 绘制圆形边框
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.stroke();
        // 绘制时针和分针
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(centerX, centerY - 5);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(centerX + 4, centerY);
        ctx.stroke();
      } else if (type === 'weekend_day') {
        // Calendar图标（日历）
        const rectX = iconX + 4;
        const rectY = iconY + 6;
        const rectWidth = 16;
        const rectHeight = 14;
        // 绘制日历主体
        ctx.strokeRect(rectX, rectY, rectWidth, rectHeight);
        // 绘制顶部横线
        ctx.beginPath();
        ctx.moveTo(rectX, rectY + 4);
        ctx.lineTo(rectX + rectWidth, rectY + 4);
        ctx.stroke();
        // 绘制两个小方块（日期）
        ctx.fillRect(rectX + 3, rectY + 7, 3, 3);
        ctx.fillRect(rectX + 10, rectY + 7, 3, 3);
      }
      
      // 绘制标题
      ctx.fillStyle = '#1f2937';
      ctx.font = `bold ${titleFontSize}px "Microsoft YaHei", "PingFang SC", sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      const titleX = iconX + iconSize + 15;
      ctx.fillText(title, titleX, iconY + iconSize / 2);
      
      // 计算标题宽度
      const titleWidth = ctx.measureText(title).width;
      
      // 绘制副标题/说明文字（放在标题右侧）
      if (subtitle) {
        ctx.font = `${smallFontSize}px "Microsoft YaHei", "PingFang SC", sans-serif`;
        ctx.textAlign = 'left';
        const subtitleX = titleX + titleWidth + 20;
        const subtitleY = iconY + iconSize / 2;
        
        // 如果是午休或晚休，需要高亮显示数字
        if (type === 'lunch_break' || type === 'evening_break') {
          // 解析文本，找出数字并高亮显示
          const parts = subtitle.split(/(\d+)/);
          let currentX = subtitleX;
          
          parts.forEach((part) => {
            if (/^\d+$/.test(part)) {
              // 这是数字，绘制高亮背景
              const numWidth = ctx.measureText(part).width;
              const badgeWidth = numWidth + 12;
              const badgeHeight = 18;
              const badgeX = currentX;
              const badgeY = subtitleY - badgeHeight / 2;
              const badgeRadius = 4;
              
              // 绘制琥珀色背景
              ctx.fillStyle = '#fef3c7';
              ctx.beginPath();
              ctx.moveTo(badgeX + badgeRadius, badgeY);
              ctx.lineTo(badgeX + badgeWidth - badgeRadius, badgeY);
              ctx.quadraticCurveTo(badgeX + badgeWidth, badgeY, badgeX + badgeWidth, badgeY + badgeRadius);
              ctx.lineTo(badgeX + badgeWidth, badgeY + badgeHeight - badgeRadius);
              ctx.quadraticCurveTo(badgeX + badgeWidth, badgeY + badgeHeight, badgeX + badgeWidth - badgeRadius, badgeY + badgeHeight);
              ctx.lineTo(badgeX + badgeRadius, badgeY + badgeHeight);
              ctx.quadraticCurveTo(badgeX, badgeY + badgeHeight, badgeX, badgeY + badgeHeight - badgeRadius);
              ctx.lineTo(badgeX, badgeY + badgeRadius);
              ctx.quadraticCurveTo(badgeX, badgeY, badgeX + badgeRadius, badgeY);
              ctx.closePath();
              ctx.fill();
              
              // 绘制数字文字
              ctx.fillStyle = '#92400e';
              ctx.font = `bold ${smallFontSize}px "Microsoft YaHei", "PingFang SC", sans-serif`;
              ctx.fillText(part, badgeX + 6, subtitleY);
              
              currentX += badgeWidth + 2;
            } else {
              // 普通文字
              ctx.fillStyle = '#374151';
              ctx.font = `${smallFontSize}px "Microsoft YaHei", "PingFang SC", sans-serif`;
              ctx.fillText(part, currentX, subtitleY);
              currentX += ctx.measureText(part).width;
            }
          });
        } else {
          // 其他类型，直接绘制
          ctx.fillStyle = '#6b7280';
          ctx.fillText(subtitle, subtitleX, subtitleY);
        }
      }
      
      // 如果是总量化统计，绘制复选框（紧凑排列）
      if (type === 'total_summary') {
        const checkboxY = iconY + iconSize / 2;
        const checkboxSize = 14;
        
        const checkboxes = [
          { label: '午休', checked: selectedCheckInTypes.lunch_break },
          { label: '晚休', checked: selectedCheckInTypes.evening_break },
          { label: '早晚自习', checked: selectedCheckInTypes.morning_evening_study },
          { label: '周末白天', checked: selectedCheckInTypes.weekend_day }
        ];
        
        // 计算说明文字宽度
        ctx.font = `${smallFontSize}px "Microsoft YaHei", "PingFang SC", sans-serif`;
        const subtitleWidth = subtitle ? ctx.measureText(subtitle).width : 0;
        let checkboxX = titleX + titleWidth + 20 + subtitleWidth + 20;
        
        checkboxes.forEach(checkbox => {
          // 绘制复选框背景
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(checkboxX, checkboxY - checkboxSize / 2, checkboxSize, checkboxSize);
          
          // 绘制复选框边框
          ctx.strokeStyle = '#d1d5db';
          ctx.lineWidth = 1;
          ctx.strokeRect(checkboxX, checkboxY - checkboxSize / 2, checkboxSize, checkboxSize);
          
          // 如果选中，绘制勾选标记（对勾）
          if (checkbox.checked) {
            ctx.strokeStyle = '#2563eb';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(checkboxX + 3, checkboxY - checkboxSize / 2 + 7);
            ctx.lineTo(checkboxX + 6, checkboxY - checkboxSize / 2 + 10);
            ctx.lineTo(checkboxX + 11, checkboxY - checkboxSize / 2 + 4);
            ctx.stroke();
          }
          
          // 绘制标签文字
          ctx.fillStyle = '#374151';
          ctx.font = `${smallFontSize}px "Microsoft YaHei", "PingFang SC", sans-serif`;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          const labelX = checkboxX + checkboxSize + 6;
          ctx.fillText(checkbox.label, labelX, checkboxY);
          
          // 计算下一个复选框的位置（动态间距）
          const labelWidth = ctx.measureText(checkbox.label).width;
          checkboxX = labelX + labelWidth + 15; // 15px间距
        });
      }
      
      // 绘制统计周期和记录数（在同一行，与标题在同一水平线上）
      const rightSectionY = iconY + iconSize / 2; // 与标题在同一水平线
      
      // 绘制记录数标签（右侧）
      const recordText = `${data.length} 条记录`;
      ctx.font = `${smallFontSize}px "Microsoft YaHei", "PingFang SC", sans-serif`;
      const recordTextWidth = ctx.measureText(recordText).width;
      const recordBadgeWidth = recordTextWidth + 24; // 左右各12px内边距
      const recordBadgeHeight = 24;
      const recordBadgeX = padding + tableWidth - recordBadgeWidth - 20;
      const recordBadgeY = rightSectionY - recordBadgeHeight / 2; // 垂直居中对齐
      const recordBadgeRadius = 4;
      
      // 绘制记录数背景（浅蓝色）
      ctx.fillStyle = '#dbeafe'; // bg-blue-100
      ctx.beginPath();
      ctx.moveTo(recordBadgeX + recordBadgeRadius, recordBadgeY);
      ctx.lineTo(recordBadgeX + recordBadgeWidth - recordBadgeRadius, recordBadgeY);
      ctx.quadraticCurveTo(recordBadgeX + recordBadgeWidth, recordBadgeY, recordBadgeX + recordBadgeWidth, recordBadgeY + recordBadgeRadius);
      ctx.lineTo(recordBadgeX + recordBadgeWidth, recordBadgeY + recordBadgeHeight - recordBadgeRadius);
      ctx.quadraticCurveTo(recordBadgeX + recordBadgeWidth, recordBadgeY + recordBadgeHeight, recordBadgeX + recordBadgeWidth - recordBadgeRadius, recordBadgeY + recordBadgeHeight);
      ctx.lineTo(recordBadgeX + recordBadgeRadius, recordBadgeY + recordBadgeHeight);
      ctx.quadraticCurveTo(recordBadgeX, recordBadgeY + recordBadgeHeight, recordBadgeX, recordBadgeY + recordBadgeHeight - recordBadgeRadius);
      ctx.lineTo(recordBadgeX, recordBadgeY + recordBadgeRadius);
      ctx.quadraticCurveTo(recordBadgeX, recordBadgeY, recordBadgeX + recordBadgeRadius, recordBadgeY);
      ctx.closePath();
      ctx.fill();
      
      // 绘制记录数文字
      ctx.fillStyle = '#1e40af'; // text-blue-800
      ctx.font = `${smallFontSize}px "Microsoft YaHei", "PingFang SC", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(recordText, recordBadgeX + recordBadgeWidth / 2, recordBadgeY + recordBadgeHeight / 2);
      
      // 绘制统计周期文字（记录数左侧）
      const periodText = `统计周期：${getStatisticsPeriod(type)}`;
      ctx.font = `${smallFontSize}px "Microsoft YaHei", "PingFang SC", sans-serif`;
      ctx.fillStyle = '#4b5563'; // text-gray-600
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      const periodTextX = recordBadgeX - 8; // 距离记录数标签8px
      const periodTextY = rightSectionY; // 与标题在同一水平线
      ctx.fillText(periodText, periodTextX, periodTextY);
      
      // 绘制表头背景（浅灰色）
      const tableHeaderY = padding + cardHeaderHeight;
      ctx.fillStyle = '#f3f4f6'; // 浅灰色背景，与网页保持一致
      ctx.fillRect(padding, tableHeaderY, tableWidth, tableHeaderHeight);
      
      // 绘制表头文字（左对齐）
      ctx.fillStyle = '#374151';
      ctx.font = `bold ${headerFontSize}px "Microsoft YaHei", "PingFang SC", sans-serif`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      
      let currentX = padding;
      columns.forEach(col => {
        ctx.fillText(col.label, currentX + cellPadding, tableHeaderY + tableHeaderHeight / 2);
        currentX += col.width;
      });
      
      // 绘制表头底部边框
      ctx.strokeStyle = '#d1d5db';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padding, tableHeaderY + tableHeaderHeight);
      ctx.lineTo(padding + tableWidth, tableHeaderY + tableHeaderHeight);
      ctx.stroke();
      
      // 计算名次数据（用于总量化统计）- 支持并列名次
      const scoreToRank = new Map<number, number>();
      if (type === 'total_summary') {
        const sortedByScore = [...totalSummaryData].sort((a, b) => b.total_score - a.total_score);
        sortedByScore.forEach((item, index) => {
          // 如果这个分数还没有名次，就分配名次
          if (!scoreToRank.has(item.total_score)) {
            scoreToRank.set(item.total_score, index + 1);
          }
        });
      }
      
      // 绘制数据行
      ctx.font = `${fontSize}px "Microsoft YaHei", "PingFang SC", sans-serif`;
      
      data.forEach((item: any, rowIndex: number) => {
        const rowY = tableHeaderY + tableHeaderHeight + (rowIndex * rowHeight);
        
        // 绘制行背景（斑马纹）
        if (rowIndex % 2 === 1) {
          ctx.fillStyle = '#f9fafb';
          ctx.fillRect(padding, rowY, tableWidth, rowHeight);
        }
        
        // 绘制单元格内容
        currentX = padding;
        columns.forEach((col, colIndex) => {
          const cellX = currentX;
          const cellY = rowY;
          const cellCenterY = cellY + rowHeight / 2;
          
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          
          let value = item[col.key];
          
          // 处理特殊字段
          if (col.key === 'dates' && Array.isArray(value)) {
            // 签到日期保持数组格式，稍后特殊处理
          } else if (col.key === 'rank' && type === 'total_summary') {
            // 从scoreToRank获取名次（支持并列名次）
            const rank = scoreToRank.get(item.total_score) || 0;
            
            // 绘制名次徽章（左对齐）
            const getRankStyle = (rank: number) => {
              if (rank === 1) return { bg: ['#dc2626', '#f59e0b'], text: '#ffffff', label: '青云星光' };
              if (rank >= 2 && rank <= 3) return { bg: ['#fbbf24', '#f97316'], text: '#ffffff', label: '五星级' };
              if (rank >= 4 && rank <= 7) return { bg: ['#3b82f6', '#06b6d4'], text: '#ffffff', label: '四星级' };
              if (rank >= 8 && rank <= 12) return { bg: ['#10b981', '#059669'], text: '#ffffff', label: '三星级' };
              if (rank >= 13 && rank <= 18) return { bg: ['#6366f1', '#8b5cf6'], text: '#ffffff', label: '二星级' };
              if (rank >= 19 && rank <= 24) return { bg: ['#6b7280', '#64748b'], text: '#ffffff', label: '一星级' };
              return { bg: ['#e5e7eb', '#d1d5db'], text: '#6b7280', label: '' };
            };
            
            const rankStyle = getRankStyle(rank);
            const rankBadgeWidth = 100;
            const rankBadgeHeight = 28;
            const rankBadgeX = cellX + cellPadding;
            const rankBadgeY = cellCenterY - rankBadgeHeight / 2;
            const rankBadgeRadius = 6;
            
            // 绘制渐变背景
            const rankGradient = ctx.createLinearGradient(rankBadgeX, rankBadgeY, rankBadgeX + rankBadgeWidth, rankBadgeY);
            rankGradient.addColorStop(0, rankStyle.bg[0]);
            rankGradient.addColorStop(1, rankStyle.bg[1]);
            ctx.fillStyle = rankGradient;
            
            ctx.beginPath();
            ctx.moveTo(rankBadgeX + rankBadgeRadius, rankBadgeY);
            ctx.lineTo(rankBadgeX + rankBadgeWidth - rankBadgeRadius, rankBadgeY);
            ctx.quadraticCurveTo(rankBadgeX + rankBadgeWidth, rankBadgeY, rankBadgeX + rankBadgeWidth, rankBadgeY + rankBadgeRadius);
            ctx.lineTo(rankBadgeX + rankBadgeWidth, rankBadgeY + rankBadgeHeight - rankBadgeRadius);
            ctx.quadraticCurveTo(rankBadgeX + rankBadgeWidth, rankBadgeY + rankBadgeHeight, rankBadgeX + rankBadgeWidth - rankBadgeRadius, rankBadgeY + rankBadgeHeight);
            ctx.lineTo(rankBadgeX + rankBadgeRadius, rankBadgeY + rankBadgeHeight);
            ctx.quadraticCurveTo(rankBadgeX, rankBadgeY + rankBadgeHeight, rankBadgeX, rankBadgeY + rankBadgeHeight - rankBadgeRadius);
            ctx.lineTo(rankBadgeX, rankBadgeY + rankBadgeRadius);
            ctx.quadraticCurveTo(rankBadgeX, rankBadgeY, rankBadgeX + rankBadgeRadius, rankBadgeY);
            ctx.closePath();
            ctx.fill();
            
            // 绘制名次文字（居中在徽章内）
            ctx.fillStyle = rankStyle.text;
            ctx.font = `bold ${fontSize}px "Microsoft YaHei", "PingFang SC", sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText(`第${rank}名`, rankBadgeX + rankBadgeWidth / 2, cellCenterY);
            
            currentX += col.width;
            return;
          }
          
          // 绘制数字背景（模拟Badge效果，左对齐）
          if (typeof value === 'number' && col.key !== 'class_name' && col.key !== 'teacher_name') {
            const badgeWidth = 60;
            const badgeHeight = 28;
            const badgeX = cellX + cellPadding;
            const badgeY = cellCenterY - badgeHeight / 2;
            const badgeRadius = 6;
            
            // 根据值和列类型选择颜色（与网页逻辑一致，但颜色更浅）
            let bgColor = '#eff6ff';  // 默认蓝色（更浅）
            let textColor = '#3b82f6';  // 文字颜色（更浅）
            
            if (col.key === 'effective_count') {
              // 额外签到次数列：> 0 绿色，<= 0 红色
              if (value > 0) {
                bgColor = '#ecfdf5';  // 绿色背景（更浅）
                textColor = '#10b981';  // 绿色文字（更浅）
              } else {
                bgColor = '#fef2f2';  // 红色背景（更浅）
                textColor = '#ef4444';  // 红色文字（更浅）
              }
            } else {
              // 其他数字列：> 0 蓝色，<= 0 红色
              if (value <= 0) {
                bgColor = '#fef2f2';  // 红色背景（更浅）
                textColor = '#ef4444';  // 红色文字（更浅）
              }
            }
            
            // 绘制圆角矩形背景
            ctx.fillStyle = bgColor;
            ctx.beginPath();
            ctx.moveTo(badgeX + badgeRadius, badgeY);
            ctx.lineTo(badgeX + badgeWidth - badgeRadius, badgeY);
            ctx.quadraticCurveTo(badgeX + badgeWidth, badgeY, badgeX + badgeWidth, badgeY + badgeRadius);
            ctx.lineTo(badgeX + badgeWidth, badgeY + badgeHeight - badgeRadius);
            ctx.quadraticCurveTo(badgeX + badgeWidth, badgeY + badgeHeight, badgeX + badgeWidth - badgeRadius, badgeY + badgeHeight);
            ctx.lineTo(badgeX + badgeRadius, badgeY + badgeHeight);
            ctx.quadraticCurveTo(badgeX, badgeY + badgeHeight, badgeX, badgeY + badgeHeight - badgeRadius);
            ctx.lineTo(badgeX, badgeY + badgeRadius);
            ctx.quadraticCurveTo(badgeX, badgeY, badgeX + badgeRadius, badgeY);
            ctx.closePath();
            ctx.fill();
            
            // 绘制边框（更浅的颜色）
            ctx.strokeStyle = textColor + '30';  // 降低透明度
            ctx.lineWidth = 1;
            ctx.stroke();
            
            // 绘制数字（居中在徽章内，使用正常字重）
            ctx.fillStyle = textColor;
            ctx.font = `${fontSize}px "Microsoft YaHei", "PingFang SC", sans-serif`;  // 移除bold
            ctx.textAlign = 'center';
            ctx.fillText(String(value), badgeX + badgeWidth / 2, cellCenterY);
          } else if (col.key === 'dates' && Array.isArray(value)) {
            // 绘制签到日期（每个日期一个小标签，样式与网页完全一致）
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.font = `${smallFontSize}px "Consolas", "Monaco", monospace`;
            
            // 如果没有签到日期，显示"未签到"标签
            if (value.length === 0) {
              const badgeX = cellX + cellPadding;
              const badgeY = cellCenterY - 10;
              const badgeWidth = 60;
              const badgeHeight = 20;
              const badgeRadius = 4;
              
              // 绘制未签到背景（红色）
              ctx.fillStyle = '#fee2e2';
              ctx.beginPath();
              ctx.moveTo(badgeX + badgeRadius, badgeY);
              ctx.lineTo(badgeX + badgeWidth - badgeRadius, badgeY);
              ctx.quadraticCurveTo(badgeX + badgeWidth, badgeY, badgeX + badgeWidth, badgeY + badgeRadius);
              ctx.lineTo(badgeX + badgeWidth, badgeY + badgeHeight - badgeRadius);
              ctx.quadraticCurveTo(badgeX + badgeWidth, badgeY + badgeHeight, badgeX + badgeWidth - badgeRadius, badgeY + badgeHeight);
              ctx.lineTo(badgeX + badgeRadius, badgeY + badgeHeight);
              ctx.quadraticCurveTo(badgeX, badgeY + badgeHeight, badgeX, badgeY + badgeHeight - badgeRadius);
              ctx.lineTo(badgeX, badgeY + badgeRadius);
              ctx.quadraticCurveTo(badgeX, badgeY, badgeX + badgeRadius, badgeY);
              ctx.closePath();
              ctx.fill();
              
              // 绘制边框
              ctx.strokeStyle = '#fca5a5';
              ctx.lineWidth = 1;
              ctx.stroke();
              
              // 绘制"未签到"文字
              ctx.fillStyle = '#dc2626';
              ctx.font = `${smallFontSize}px "Microsoft YaHei", "PingFang SC", sans-serif`;
              ctx.textAlign = 'center';
              ctx.fillText('未签到', badgeX + badgeWidth / 2, badgeY + badgeHeight / 2);
            } else {
              // 有签到日期，正常显示
              const dateSpacing = 4;
              const lineHeight = 24;
              const maxWidth = col.width - cellPadding * 2;
              const badgeHeight = 20;
              const badgeRadius = 4;
              
              // 对日期进行排序（从新到旧）
              const sortedDates = [...value].sort((a, b) => {
                const dateA = a.replace(/（.*?）/, '');
                const dateB = b.replace(/（.*?）/, '');
                
                const parseDate = (dateStr: string) => {
                  const parts = dateStr.split('.');
                  if (parts.length === 3) {
                    const year = parseInt(parts[0]);
                    const month = parseInt(parts[1]);
                    const day = parseInt(parts[2]);
                    return new Date(year, month - 1, day);
                  }
                  return new Date(dateStr);
                };
                
                const parsedDateA = parseDate(dateA);
                const parsedDateB = parseDate(dateB);
                
                return parsedDateB.getTime() - parsedDateA.getTime();
              });
              
              // 先计算需要多少行
              let tempX = cellX + cellPadding;
              let lineCount = 1;
              sortedDates.forEach((date: string) => {
                const dateWidth = ctx.measureText(date).width + 16;
                
                // 如果当前行放不下，换行
                if (tempX + dateWidth > cellX + maxWidth && tempX > cellX + cellPadding) {
                  tempX = cellX + cellPadding;
                  lineCount++;
                }
                
                tempX += dateWidth + dateSpacing;
              });
              
              // 计算起始Y坐标，使整体垂直居中
              const totalHeight = lineCount * lineHeight;
              let dateY = cellCenterY - totalHeight / 2 + lineHeight / 2;
              let dateX = cellX + cellPadding;
              
              sortedDates.forEach((date: string) => {
                const dateWidth = ctx.measureText(date).width + 16;
                
                // 如果当前行放不下，换行
                if (dateX + dateWidth > cellX + maxWidth && dateX > cellX + cellPadding) {
                  dateX = cellX + cellPadding;
                  dateY += lineHeight;
                }
                
                const badgeX = dateX;
                const badgeY = dateY - badgeHeight / 2;
                
                // 绘制日期背景（蓝色，更浅的颜色）
                ctx.fillStyle = '#eff6ff';  // 更浅的蓝色背景
                ctx.beginPath();
                ctx.moveTo(badgeX + badgeRadius, badgeY);
                ctx.lineTo(badgeX + dateWidth - badgeRadius, badgeY);
                ctx.quadraticCurveTo(badgeX + dateWidth, badgeY, badgeX + dateWidth, badgeY + badgeRadius);
                ctx.lineTo(badgeX + dateWidth, badgeY + badgeHeight - badgeRadius);
                ctx.quadraticCurveTo(badgeX + dateWidth, badgeY + badgeHeight, badgeX + dateWidth - badgeRadius, badgeY + badgeHeight);
                ctx.lineTo(badgeX + badgeRadius, badgeY + badgeHeight);
                ctx.quadraticCurveTo(badgeX, badgeY + badgeHeight, badgeX, badgeY + badgeHeight - badgeRadius);
                ctx.lineTo(badgeX, badgeY + badgeRadius);
                ctx.quadraticCurveTo(badgeX, badgeY, badgeX + badgeRadius, badgeY);
                ctx.closePath();
                ctx.fill();
                
                // 绘制边框（更浅的颜色）
                ctx.strokeStyle = '#bfdbfe';  // 更浅的边框
                ctx.lineWidth = 1;
                ctx.stroke();
                
                // 绘制日期文字（使用正常字重）
                ctx.fillStyle = '#3b82f6';  // 更浅的文字颜色
                ctx.font = `${smallFontSize}px "Consolas", "Monaco", monospace`;  // 使用正常字重
                ctx.fillText(date, badgeX + 8, dateY);
                
                dateX += dateWidth + dateSpacing;
              });
            }
          } else {
            // 普通文本（左对齐）
            ctx.fillStyle = colIndex === 0 ? '#1f2937' : '#4b5563';
            ctx.font = `${colIndex === 0 ? 'bold ' : ''}${fontSize}px "Microsoft YaHei", "PingFang SC", sans-serif`;
            ctx.textAlign = 'left';
            ctx.fillText(String(value || ''), cellX + cellPadding, cellCenterY);
          }
          
          currentX += col.width;
        });
        
        // 绘制行底部边框
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padding, rowY + rowHeight);
        ctx.lineTo(padding + tableWidth, rowY + rowHeight);
        ctx.stroke();
      });
      
      // 绘制外边框
      ctx.strokeStyle = '#d1d5db';
      ctx.lineWidth = 2;
      ctx.strokeRect(padding, cardHeaderY, tableWidth, cardHeaderHeight + tableHeaderHeight + (data.length * rowHeight));
      
      // 下载图片
      const link = document.createElement('a');
      link.download = `${TAB_LABELS[type]}_统计表.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
      
      toast.success('图片导出成功');
    } catch (error) {
      console.error('导出图片失败:', error);
      toast.error('导出图片失败，请重试');
    }
  };

  const getCurrentData = () => {
    if (activeTab === 'total_summary') {
      return [];
    }
    return getDisplayData(activeTab as CheckInType);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      <div className="container mx-auto p-6 space-y-6">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabType)} className="space-y-6">
          <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 bg-white rounded-lg p-4 shadow-sm border border-gray-200">
            {/* 左侧：标题和标签 */}
            <div className="flex flex-col lg:flex-row lg:items-center gap-4 flex-1">
              {/* 页面标题 */}
              <div className="flex items-center gap-2">
                <div className="p-2 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg">
                  <BarChart3 className="h-5 w-5 text-white" />
                </div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent whitespace-nowrap">签到量化统计</h1>
              </div>
              
              {/* 标签切换 */}
              <TabsList className="grid w-full lg:w-auto grid-cols-2 lg:grid-cols-5 gap-1 bg-gray-100 p-1 rounded-lg">
                <TabsTrigger 
                  value="lunch_break" 
                  className="data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all duration-200"
                >
                  午休签到
                </TabsTrigger>
                <TabsTrigger 
                  value="evening_break"
                  className="data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all duration-200"
                >
                  晚休签到
                </TabsTrigger>
                <TabsTrigger 
                  value="morning_evening_study"
                  className="data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all duration-200"
                >
                  早晚自习
                </TabsTrigger>
                <TabsTrigger 
                  value="weekend_day"
                  className="data-[state=active]:bg-blue-600 data-[state=active]:text-white transition-all duration-200"
                >
                  周末白天
                </TabsTrigger>
                <TabsTrigger 
                  value="total_summary"
                  className="data-[state=active]:bg-green-600 data-[state=active]:text-white transition-all duration-200"
                >
                  总量化统计
                </TabsTrigger>
              </TabsList>
            </div>
            
            {/* 操作按钮组 - 合并所有操作 */}
            <div className="flex flex-wrap items-center gap-2">
              <Button 
                size="sm" 
                variant="outline" 
                className="border-blue-300 hover:bg-blue-50"
                onClick={() => setBatchUploadDialogOpen(true)}
              >
                <Upload className="mr-2 h-4 w-4" />
                上传Excel
              </Button>
              
              <Button 
                size="sm" 
                variant="outline" 
                className="border-blue-300 hover:bg-blue-50"
                onClick={() => {
                  setIsAddDialogOpen(true);
                  setSupplementRows([{ teacher_name: '', date: '', type: 'lunch_break' }]);
                  setActiveInputIndex(0);
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                批量补签
              </Button>
              
              {/* 可拖拽的补充签到面板 */}
              <DraggablePanel
                isOpen={isAddDialogOpen}
                onClose={() => {
                  setIsAddDialogOpen(false);
                  setSupplementRows([{ teacher_name: '', date: '', type: 'lunch_break' }]);
                  setActiveInputIndex(0);
                }}
                title="批量补签"
                width="900px"
              >
                <div className="space-y-6">

                  {/* 动态输入行 */}
                  <div className="space-y-3">
                    {supplementRows.map((row, index) => (
                      <div key={index} className="flex items-start gap-2">
                        <div className="flex-1 grid gap-2" style={{ gridTemplateColumns: '1fr 1.2fr 1fr' }}>
                          <div>
                            <Input
                              placeholder="教师姓名"
                              value={row.teacher_name}
                              onChange={(e) => handleUpdateSupplementRow(index, 'teacher_name', e.target.value)}
                              onFocus={() => setActiveInputIndex(index)}
                              className="w-full"
                            />
                          </div>
                          <div>
                            <Input
                              type="date"
                              value={row.date}
                              onChange={(e) => handleUpdateSupplementRow(index, 'date', e.target.value)}
                              onFocus={() => setActiveInputIndex(index)}
                              className="w-full min-w-[180px]"
                            />
                          </div>
                          <div>
                            <Select
                              value={row.type}
                              onValueChange={(value) => handleUpdateSupplementRow(index, 'type', value as CheckInType)}
                            >
                              <SelectTrigger onFocus={() => setActiveInputIndex(index)}>
                                <SelectValue placeholder="签到类型" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="lunch_break">午休</SelectItem>
                                <SelectItem value="evening_break">晚休</SelectItem>
                                <SelectItem value="morning_evening_study">早晚自习</SelectItem>
                                <SelectItem value="weekend_day">周末白天</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        {supplementRows.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveSupplementRow(index)}
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))}
                    
                    {/* 添加行按钮 */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleAddSupplementRow}
                      className="w-full border-2 border-dashed border-blue-300 text-blue-600 hover:bg-blue-50 hover:text-blue-700 bg-white"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      添加一行
                    </Button>
                  </div>
                  {/* 教师姓名快速选择 */}
                  <div className="space-y-2">
                    <Label className="text-sm text-gray-600">快速选择教师</Label>
                    <div className="flex flex-wrap gap-2 p-3 bg-gray-50 rounded-md max-h-32 overflow-y-auto">
                      {(() => {
                        // 按班级顺序获取教师姓名（去重）
                        const teacherNames: string[] = [];
                        const seen = new Set<string>();
                        classes.forEach(cls => {
                          if (!seen.has(cls.teacher_name)) {
                            teacherNames.push(cls.teacher_name);
                            seen.add(cls.teacher_name);
                          }
                        });
                        return teacherNames.map((teacherName) => (
                          <Badge
                            key={teacherName}
                            variant="outline"
                            className="cursor-pointer hover:bg-blue-100 hover:border-blue-400 transition-colors"
                            onClick={() => handleQuickFillTeacher(teacherName)}
                          >
                            {teacherName}
                          </Badge>
                        ));
                      })()}
                    </div>
                  </div>
                  {/* 日期快速选择 */}
                  <div className="space-y-2">
                    <Label className="text-sm text-gray-600">快速选择日期</Label>
                    <div className="flex flex-wrap gap-2 p-3 bg-gray-50 rounded-md max-h-32 overflow-y-auto">
                      {(() => {
                        const dates = getAllCheckInDates();
                        if (dates.length === 0) {
                          return <span className="text-sm text-gray-400">暂无签到数据</span>;
                        }
                        return dates.map((date) => (
                          <Badge
                            key={date}
                            variant="outline"
                            className="cursor-pointer hover:bg-green-100 hover:border-green-400 transition-colors"
                            onClick={() => handleQuickFillDate(date)}
                          >
                            {date}
                          </Badge>
                        ));
                      })()}
                    </div>
                  </div>
                  {/* 操作按钮 */}
                  <div className="flex justify-end gap-2 pt-4 border-t">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => {
                        setIsAddDialogOpen(false);
                        setSupplementRows([{ teacher_name: '', date: '', type: 'lunch_break' }]);
                        setActiveInputIndex(0);
                      }}
                    >
                      关闭
                    </Button>
                    <Button 
                      type="button" 
                      onClick={handleBatchSupplementSubmit}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      提交签到
                    </Button>
                  </div>
                </div>
              </DraggablePanel>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="border-blue-300 hover:bg-blue-50">
                    <Download className="mr-2 h-4 w-4" />
                    导出当前
                    <ChevronDown className="ml-2 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem 
                    onClick={() => activeTab === 'total_summary' ? handleExportTotal() : handleExport(activeTab as CheckInType)}
                  >
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    导出Excel
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => handleExportImage(activeTab)}
                  >
                    <Image className="mr-2 h-4 w-4" />
                    导出图片
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

        {/* 修改为强制渲染所有标签页内容，使用visibility控制显示 */}
        {(['lunch_break', 'evening_break', 'morning_evening_study', 'weekend_day'] as CheckInType[]).map((type) => {
          return (
          <div 
            key={type} 
            className="space-y-4"
            style={{ 
              display: activeTab === type ? 'block' : 'none'
            }}
          >
            <Card 
              className="shadow-lg border-0 bg-gradient-to-br from-white to-gray-50" 
              data-export-type={type}
            >
                <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 border-b">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {(() => {
                        const IconComponent = CHECK_IN_TYPE_ICONS[type as keyof typeof CHECK_IN_TYPE_ICONS];
                        return <IconComponent className="h-6 w-6 text-blue-600" />;
                      })()}
                      <CardTitle className="text-xl text-gray-800">
                        {type === 'morning_evening_study' || type === 'weekend_day' 
                          ? `${CHECK_IN_TYPE_LABELS[type]}统计`
                          : `${CHECK_IN_TYPE_LABELS[type]}签到统计`
                        }
                      </CardTitle>
                      
                      {/* 基础次数设置 - 悬停显示 */}
                      {(type === 'lunch_break' || type === 'evening_break') && (
                        <div className="group/settings relative">
                          <div className="text-xs text-gray-700 px-3 cursor-help leading-none">
                            本周期基础签到次数：单班班主任 <span className="inline-block bg-amber-100 text-amber-800 font-semibold px-2 py-0.5 rounded leading-none">{ baseCountSettings[type].single_class}</span> 次、多班班主任 <span className="inline-block bg-amber-100 text-amber-800 font-semibold px-2 py-0.5 rounded leading-none">{baseCountSettings[type].multi_class}</span> 次（额外签到次数 = 签到次数 - 基础次数）
                          </div>
                          
                          {/* 悬停时显示的设置面板 - 优化位置和交互 */}
                          <div className="absolute left-0 top-full mt-0.5 z-50 opacity-0 invisible group-hover/settings:opacity-100 group-hover/settings:visible transition-all duration-200">
                            <div className="bg-white rounded-lg shadow-xl border-2 border-blue-300 p-4 min-w-[400px]">
                              <h5 className="font-semibold text-gray-800 text-sm mb-3 text-center">设置基础签到次数</h5>
                              <div className="flex items-center justify-center space-x-8">
                                <div className="text-center">
                                  <NumberStepper
                                    label="单班班主任"
                                    value={baseCountSettings[type].single_class}
                                    onChange={(value) => handleBaseCountChange(type, 'single_class', value)}
                                    min={0}
                                    max={10}
                                  />
                                </div>
                                <div className="text-center">
                                  <NumberStepper
                                    label="多班班主任"
                                    value={baseCountSettings[type].multi_class}
                                    onChange={(value) => handleBaseCountChange(type, 'multi_class', value)}
                                    min={0}
                                    max={10}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* 统计周期和记录数标签 */}
                    <div className="flex items-center gap-2 ml-4 shrink-0">
                      {/* 统计周期设置 - 悬停显示 */}
                      <div className="group/date-settings relative">
                        <div className="text-sm text-gray-600 cursor-help">
                          统计周期：{getStatisticsPeriod(type)}
                        </div>
                        
                        {/* 悬停时显示的设置面板 */}
                        <div className="absolute right-0 top-full mt-0.5 z-50 opacity-0 invisible group-hover/date-settings:opacity-100 group-hover/date-settings:visible transition-all duration-200">
                          <div className="bg-white rounded-lg shadow-xl border-2 border-blue-300 p-4 min-w-[420px] max-w-[450px]">
                            <h5 className="font-semibold text-gray-800 text-sm mb-3 text-center">设置统计周期</h5>
                            
                            {/* 日期区间列表 */}
                            <div className="space-y-3 mb-3">
                              {(() => {
                                const ranges = dateRestrictions[type] || [];
                                const dates = getCheckInDatesByType(type);
                                
                                // 如果没有数据，显示提示
                                if (dates.length === 0) {
                                  return (
                                    <div className="text-center text-gray-500 text-sm py-2">
                                      暂无数据，请先上传文件
                                    </div>
                                  );
                                }
                                
                                // 如果有数据但没有设置区间，自动显示一个默认区间
                                if (ranges.length === 0) {
                                  const sortedDates = [...dates].sort();
                                  const defaultStart = sortedDates[0];
                                  const defaultEnd = sortedDates[sortedDates.length - 1];
                                  
                                  // 判断是否需要次数功能
                                  const showCount = needsCountFeature(type);
                                  
                                  return (
                                    <div className="flex items-center gap-2">
                                      <DateStepper
                                        value={defaultStart}
                                        count={showCount ? 2 : undefined}
                                        onCountChange={showCount ? (date, count) => {
                                          const dateCounts = generateDefaultDateCounts(defaultStart, defaultEnd);
                                          dateCounts[date] = count;
                                          updateDateRestrictions(type, [{ 
                                            id: `${Date.now()}-${Math.random()}`,
                                            start: defaultStart, 
                                            end: defaultEnd,
                                            dateCounts
                                          }]);
                                        } : undefined}
                                        onChange={(newStart) => {
                                          // 验证：开始日期不能晚于结束日期
                                          if (newStart > defaultEnd) {
                                            toast.error('开始日期不能晚于结束日期');
                                            return;
                                          }
                                          const dateCounts = showCount ? generateDefaultDateCounts(newStart, defaultEnd) : undefined;
                                          updateDateRestrictions(type, [{ 
                                            id: `${Date.now()}-${Math.random()}`,
                                            start: newStart, 
                                            end: defaultEnd,
                                            ...(dateCounts && { dateCounts })
                                          }]);
                                        }}
                                      />
                                      <span className="text-gray-400">-</span>
                                      <DateStepper
                                        value={defaultEnd}
                                        count={showCount ? 2 : undefined}
                                        onCountChange={showCount ? (date, count) => {
                                          const dateCounts = generateDefaultDateCounts(defaultStart, defaultEnd);
                                          dateCounts[date] = count;
                                          updateDateRestrictions(type, [{ 
                                            id: `${Date.now()}-${Math.random()}`,
                                            start: defaultStart, 
                                            end: defaultEnd,
                                            dateCounts
                                          }]);
                                        } : undefined}
                                        onChange={(newEnd) => {
                                          // 验证：结束日期不能早于开始日期
                                          if (newEnd < defaultStart) {
                                            toast.error('结束日期不能早于开始日期');
                                            return;
                                          }
                                          const dateCounts = showCount ? generateDefaultDateCounts(defaultStart, newEnd) : undefined;
                                          updateDateRestrictions(type, [{ 
                                            id: `${Date.now()}-${Math.random()}`,
                                            start: defaultStart, 
                                            end: newEnd,
                                            ...(dateCounts && { dateCounts })
                                          }]);
                                        }}
                                      />
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                          updateDateRestrictions(type, []);
                                        }}
                                        className="h-8 w-8 p-0 bg-white text-gray-700 hover:bg-gray-100 hover:text-red-600 border border-gray-300"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  );
                                }
                                
                                // 显示已设置的区间
                                return ranges.map((range) => {
                                  // 判断是否需要次数功能
                                  const showCount = needsCountFeature(type);
                                  // 获取当前日期的次数
                                  const startCount = showCount && range.dateCounts ? (range.dateCounts[range.start] || 2) : undefined;
                                  const endCount = showCount && range.dateCounts ? (range.dateCounts[range.end] || 2) : undefined;
                                  
                                  return (
                                    <div key={range.id} className="flex items-center gap-2">
                                      <DateStepper
                                        key={`start-${range.id}-${range.start}-${startCount}`}
                                        value={range.start}
                                        count={startCount}
                                        onCountChange={showCount ? (date, count) => {
                                          const currentRanges = dateRestrictions[type] || [];
                                          // 使用同步函数更新所有包含该日期的区间
                                          const newRanges = syncDateCountsAcrossRanges(currentRanges, date, count);
                                          updateDateRestrictions(type, newRanges);
                                        } : undefined}
                                        onChange={(newStart) => {
                                          const currentRanges = dateRestrictions[type] || [];
                                          const currentRange = currentRanges.find(r => r.id === range.id);
                                          
                                          if (!currentRange) return;
                                          
                                          if (newStart > currentRange.end) {
                                            toast.error('开始日期不能晚于结束日期');
                                            return;
                                          }
                                          
                                          const newRanges = currentRanges.map(r => {
                                            if (r.id === range.id) {
                                              // 如果有次数功能，重新生成 dateCounts
                                              if (showCount) {
                                                const dateCounts = generateDefaultDateCounts(newStart, r.end);
                                                // 同步已存在的次数限制
                                                const otherRanges = currentRanges.filter(other => other.id !== r.id);
                                                const tempRange = { ...r, start: newStart, dateCounts };
                                                const syncedRange = syncNewRangeWithExisting(otherRanges, tempRange);
                                                return syncedRange;
                                              }
                                              return { ...r, start: newStart };
                                            }
                                            return r;
                                          });
                                          
                                          updateDateRestrictions(type, newRanges);
                                        }}
                                      />
                                      <span className="text-gray-400">-</span>
                                      <DateStepper
                                        key={`end-${range.id}-${range.end}-${endCount}`}
                                        value={range.end}
                                        count={endCount}
                                        onCountChange={showCount ? (date, count) => {
                                          updateDateRestrictions(type, (prevRestrictions: DateRestrictions) => {
                                            const currentRanges = prevRestrictions[type] || [];
                                            // 使用同步函数更新所有包含该日期的区间
                                            return syncDateCountsAcrossRanges(currentRanges, date, count);
                                          });
                                        } : undefined}
                                        onChange={(newEnd) => {
                                          // 使用函数式更新，从最新的状态中获取 ranges
                                          updateDateRestrictions(type, (prevRestrictions: DateRestrictions) => {
                                            const currentRanges = prevRestrictions[type] || [];
                                            const currentRange = currentRanges.find(r => r.id === range.id);
                                            
                                            if (!currentRange) {
                                              return prevRestrictions[type] || [];
                                            }
                                            
                                            if (newEnd < currentRange.start) {
                                              toast.error('结束日期不能早于开始日期');
                                              return prevRestrictions[type] || [];
                                            }
                                            
                                            const newRanges = currentRanges.map(r => {
                                              if (r.id === range.id) {
                                                // 如果有次数功能，重新生成 dateCounts
                                                if (showCount) {
                                                  const dateCounts = generateDefaultDateCounts(r.start, newEnd);
                                                  // 同步已存在的次数限制
                                                  const otherRanges = currentRanges.filter(other => other.id !== r.id);
                                                  const tempRange = { ...r, end: newEnd, dateCounts };
                                                  const syncedRange = syncNewRangeWithExisting(otherRanges, tempRange);
                                                  return syncedRange;
                                                }
                                                return { ...r, end: newEnd };
                                              }
                                              return r;
                                            });
                                            
                                            return newRanges;
                                          });
                                        }}
                                      />
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                          const currentRanges = dateRestrictions[type] || [];
                                          const newRanges = currentRanges.filter(r => r.id !== range.id);
                                          updateDateRestrictions(type, newRanges);
                                        }}
                                        className="h-8 w-8 p-0 bg-white text-gray-700 hover:bg-gray-100 hover:text-red-600 border border-gray-300"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  );
                                });
                              })()}
                            </div>
                            
                            {/* 添加区间按钮 - 只要有数据就显示 */}
                            {(() => {
                              const dates = getCheckInDatesByType(type);
                              
                              if (dates.length > 0) {
                                return (
                                  <div className="flex justify-center">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        const currentRanges = dateRestrictions[type] || [];
                                        const sortedDates = [...dates].sort();
                                        const defaultStart = sortedDates[0];
                                        const defaultEnd = sortedDates[sortedDates.length - 1];
                                        
                                        // 判断是否需要次数功能
                                        const showCount = needsCountFeature(type);
                                        const dateCounts = showCount ? generateDefaultDateCounts(defaultStart, defaultEnd) : undefined;
                                        
                                        // 如果当前没有区间（显示的是默认区间），先保存默认区间，再添加新区间
                                        if (currentRanges.length === 0) {
                                          const defaultRange = { 
                                            id: `${Date.now()}-${Math.random()}`,
                                            start: defaultStart, 
                                            end: defaultEnd,
                                            ...(dateCounts && { dateCounts })
                                          };
                                          const newRange = { 
                                            id: `${Date.now() + 1}-${Math.random()}`,
                                            start: defaultStart, 
                                            end: defaultEnd,
                                            ...(dateCounts && { dateCounts: { ...dateCounts } })
                                          };
                                          // 同步新区间的次数限制
                                          const syncedNewRange = showCount ? syncNewRangeWithExisting([defaultRange], newRange) : newRange;
                                          const newRanges = [defaultRange, syncedNewRange];
                                          updateDateRestrictions(type, newRanges);
                                        } else {
                                          // 如果已有区间，直接添加新区间
                                          const newRange = { 
                                            id: `${Date.now()}-${Math.random()}`,
                                            start: defaultStart, 
                                            end: defaultEnd,
                                            ...(dateCounts && { dateCounts })
                                          };
                                          // 同步新区间的次数限制
                                          const syncedNewRange = showCount ? syncNewRangeWithExisting(currentRanges, newRange) : newRange;
                                          const newRanges = [...currentRanges, syncedNewRange];
                                          updateDateRestrictions(type, newRanges);
                                        }
                                      }}
                                      className="bg-white text-gray-700 hover:bg-gray-100 border-gray-300"
                                    >
                                      <Plus className="h-4 w-4 mr-1" />
                                      增加限制日期区间
                                    </Button>
                                  </div>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        </div>
                      </div>
                      
                      {/* 记录数标签 */}
                      <Badge 
                        variant="secondary" 
                        className="inline-flex items-center justify-center min-h-[24px] px-3 py-1 bg-blue-100 text-blue-800"
                      >
                        {getDisplayData(type).length} 条记录
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="p-0">
                  <div className="overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-gradient-to-r from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300">
                          <TableHead className="font-semibold text-gray-700 py-4 h-[56px]">班级</TableHead>
                          <TableHead className="font-semibold text-gray-700 py-4 h-[56px]">班主任</TableHead>
                          <TableHead className="font-semibold text-gray-700 py-4 h-[56px]">签到次数</TableHead>
                          {type !== 'morning_evening_study' && type !== 'weekend_day' && (
                            <TableHead className="font-semibold text-gray-700 py-4 h-[56px]">额外签到次数</TableHead>
                          )}
                          <TableHead className="font-semibold text-gray-700 py-4 h-[56px]">量化分</TableHead>
                          <TableHead className="font-semibold text-gray-700 py-4 h-[56px]">签到日期</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {getDisplayData(type).map((item, index) => (
                          <TableRow 
                            key={index} 
                            data-row-clickable="true"
                            className={`relative hover:bg-blue-50 transition-colors cursor-pointer ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                            onMouseEnter={() => setHoveredRowIndex(index)}
                            onMouseLeave={() => setHoveredRowIndex(null)}
                            onClick={(e) => {
                              // 如果点击的是按钮或删除图标，不切换状态
                              const target = e.target as HTMLElement;
                              if (target.closest('button') || target.closest('[role="button"]')) {
                                return;
                              }
                              // 切换点击状态
                              if (clickedRowIndex === index) {
                                // 如果点击的是同一行，触发退出动画
                                setIsButtonExiting(true);
                                setTimeout(() => {
                                  setClickedRowIndex(null);
                                  setIsButtonExiting(false);
                                }, 200); // 动画时长 200ms
                              } else {
                                // 如果点击的是不同行，直接切换
                                setIsButtonExiting(false);
                                setClickedRowIndex(index);
                              }
                            }}
                          >
                            <TableCell className="font-medium text-gray-800 py-4">{item.class_name}</TableCell>
                            <TableCell className="text-gray-700 py-4">{item.teacher_name}</TableCell>
                            <TableCell className="py-4">
                              <NumberDisplay 
                                value={item.total_count}
                                variant={item.total_count > 0 ? "default" : "danger"}
                              />
                            </TableCell>
                            {type !== 'morning_evening_study' && type !== 'weekend_day' && (
                              <TableCell className="py-4">
                                <NumberDisplay 
                                  value={item.effective_count}
                                  variant={item.effective_count > 0 ? "success" : "danger"}
                                />
                              </TableCell>
                            )}
                            <TableCell className="py-4">
                              <NumberDisplay 
                                value={item.score}
                                variant={item.score > 0 ? "default" : "danger"}
                              />
                            </TableCell>
                            <TableCell className="text-gray-600 py-4 max-w-xs">
                              <div className="flex flex-wrap gap-1 items-center">
                                {item.dates.length > 0 ? (
                                  <>
                                    {item.dates
                                      .sort((a, b) => {
                                        // 按日期从新到旧排序 - 正确解析日期
                                        const dateA = a.replace(/（.*?）/, '');
                                        const dateB = b.replace(/（.*?）/, '');
                                        
                                        // 解析日期格式 YYYY.M.D
                                        const parseDate = (dateStr: string) => {
                                          const parts = dateStr.split('.');
                                          if (parts.length === 3) {
                                            const year = parseInt(parts[0]);
                                            const month = parseInt(parts[1]);
                                            const day = parseInt(parts[2]);
                                            return new Date(year, month - 1, day);
                                          }
                                          return new Date(dateStr);
                                        };
                                        
                                        const parsedDateA = parseDate(dateA);
                                        const parsedDateB = parseDate(dateB);
                                        
                                        // 从新到旧排序
                                        return parsedDateB.getTime() - parsedDateA.getTime();
                                      })
                                      .map((date, dateIndex) => {
                                        // 检查日期是否在限制区间内
                                        // 将日期格式从 "2025.1.15" 转换为 "2025-01-15"
                                        const parts = date.replace(/（.*?）/, '').split('.');
                                        const formattedDate = parts.length === 3 
                                          ? `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`
                                          : date;
                                        const isOutOfRange = !isDateInRestrictions(type, formattedDate);
                                        
                                        // 检查是否超过次数限制（设置为1次但实际签了2次）
                                        const isOverLimit = isDateOverLimit(type, date, formattedDate, dateRestrictions);
                                        
                                        return (
                                          <DateBadge
                                            key={dateIndex}
                                            date={date}
                                            isHovered={hoveredRowIndex === index}
                                            isOutOfRange={isOutOfRange}
                                            isOverLimit={isOverLimit}
                                            onDelete={() => handleDeleteDate(item.teacher_name, item.class_name, date, type)}
                                          />
                                        );
                                      })}
                                  </>
                                ) : (
                                  <>
                                    <Badge 
                                      variant="secondary" 
                                      className="inline-block text-center min-h-[20px] px-2 bg-red-100 text-red-600 border-red-200 leading-none"
                                      style={{ paddingTop: '0.3rem', paddingBottom: '0.3rem', lineHeight: '1' }}
                                    >
                                      未签到
                                    </Badge>
                                  </>
                                )}
                              </div>
                            </TableCell>
                            
                            {/* 浮动按钮容器 - 点击时显示在签到日期列居中 */}
                            {clickedRowIndex === index && uploadedCheckInTypes.includes(type) && (
                              <div 
                                className="absolute top-1/2 -translate-y-1/2 flex items-center gap-2 bg-white/20 backdrop-blur-[2px] px-3 py-2 rounded-lg border border-gray-200/50 shadow-sm z-10 transition-all duration-200"
                                style={{
                                  right: 'calc(50% - 50px)', // 相对于签到日期列居中
                                  animation: isButtonExiting ? 'slideOutToRight 0.2s ease-out' : 'slideInFromRight 0.2s ease-out'
                                }}
                              >
                                <button
                                  onClick={() => handleOpenSupplementDialog(item.teacher_name, type, item.dates)}
                                  className="inline-flex items-center justify-center h-6 px-2 rounded bg-green-100 text-green-600 hover:bg-green-200 transition-all border border-green-300 text-xs"
                                  title="补充签到"
                                >
                                  <Plus className="w-3 h-3 mr-0.5" />
                                  补签
                                </button>
                                <button
                                  onClick={() => handleRestoreRow(item.teacher_name, type)}
                                  className="inline-flex items-center justify-center h-6 px-2 rounded bg-blue-100 text-blue-600 hover:bg-blue-200 transition-all border border-blue-300 text-xs"
                                  title="还原到原始状态"
                                >
                                  <Undo2 className="w-3 h-3 mr-0.5" />
                                  还原
                                </button>
                              </div>
                            )}
                          </TableRow>
                        ))}
                        {getDisplayData(type).length === 0 && (
                          <TableRow>
                            <TableCell colSpan={type === 'morning_evening_study' || type === 'weekend_day' ? 5 : 6} className="text-center py-12 text-gray-500">
                              <div className="flex flex-col items-center space-y-3">
                                <BarChart3 className="h-16 w-16 text-gray-300" />
                                <p className="text-lg">暂无{CHECK_IN_TYPE_LABELS[type]}数据</p>
                                <p className="text-sm">请上传Excel文件或手动添加签到记录</p>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          );
        })}

        {/* 总量化统计标签页 */}
        <div 
          className="space-y-6"
          style={{ 
            display: activeTab === 'total_summary' ? 'block' : 'none'
          }}
        >
          <Card className="shadow-lg border-0 bg-gradient-to-br from-white to-gray-50" data-export-type="total_summary">
            <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 border-b">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <BarChart3 className="h-6 w-6 text-blue-600" />
                  <CardTitle className="text-xl text-gray-800">
                    总量化统计
                  </CardTitle>
                  
                  <span className="text-xs text-gray-600 whitespace-nowrap ml-2">只有已勾选的签到类型会被统计</span>
                  
                  {/* 签到类型选择 - 自然镶嵌 */}
                  <div className="flex items-center gap-2 ml-2">
                    <label className="flex items-center gap-1.5 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={selectedCheckInTypes.lunch_break}
                        onChange={(e) => updateSelectedCheckInTypes({
                          ...selectedCheckInTypes,
                          lunch_break: e.target.checked
                        })}
                        className="w-3.5 h-3.5 text-blue-600 bg-white border-gray-300 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer accent-blue-600"
                      />
                      <span className="text-xs text-gray-700 group-hover:text-blue-600 transition-colors">午休</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={selectedCheckInTypes.evening_break}
                        onChange={(e) => updateSelectedCheckInTypes({
                          ...selectedCheckInTypes,
                          evening_break: e.target.checked
                        })}
                        className="w-3.5 h-3.5 text-blue-600 bg-white border-gray-300 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer accent-blue-600"
                      />
                      <span className="text-xs text-gray-700 group-hover:text-blue-600 transition-colors">晚休</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={selectedCheckInTypes.morning_evening_study}
                        onChange={(e) => updateSelectedCheckInTypes({
                          ...selectedCheckInTypes,
                          morning_evening_study: e.target.checked
                        })}
                        className="w-3.5 h-3.5 text-blue-600 bg-white border-gray-300 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer accent-blue-600"
                      />
                      <span className="text-xs text-gray-700 group-hover:text-blue-600 transition-colors">早晚自习</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={selectedCheckInTypes.weekend_day}
                        onChange={(e) => updateSelectedCheckInTypes({
                          ...selectedCheckInTypes,
                          weekend_day: e.target.checked
                        })}
                        className="w-3.5 h-3.5 text-blue-600 bg-white border-gray-300 rounded focus:ring-2 focus:ring-blue-500 cursor-pointer accent-blue-600"
                      />
                      <span className="text-xs text-gray-700 group-hover:text-blue-600 transition-colors">周末白天</span>
                    </label>
                  </div>
                </div>
                
                {/* 统计周期和记录数标签 */}
                <div className="flex items-center gap-2 shrink-0">
                  {/* 统计周期 */}
                  <span className="text-sm text-gray-600">
                    统计周期：{getStatisticsPeriod('total_summary')}
                  </span>
                  
                  {/* 记录数标签 */}
                  <Badge 
                    variant="secondary" 
                    className="inline-flex items-center justify-center min-h-[24px] px-3 py-1 bg-blue-100 text-blue-800"
                  >
                    {totalSummaryData.length} 条记录
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gradient-to-r from-gray-100 to-gray-200 hover:from-gray-200 hover:to-gray-300">
                      <TableHead className="font-semibold text-gray-700 py-4 h-[56px]">班级</TableHead>
                      <TableHead className="font-semibold text-gray-700 py-4 h-[56px]">班主任</TableHead>
                      {selectedCheckInTypes.lunch_break && (
                        <TableHead className="font-semibold text-gray-700 py-4 h-[56px]">午休</TableHead>
                      )}
                      {selectedCheckInTypes.evening_break && (
                        <TableHead className="font-semibold text-gray-700 py-4 h-[56px]">晚休</TableHead>
                      )}
                      {selectedCheckInTypes.morning_evening_study && (
                        <TableHead className="font-semibold text-gray-700 py-4 h-[56px]">早晚自习</TableHead>
                      )}
                      {selectedCheckInTypes.weekend_day && (
                        <TableHead className="font-semibold text-gray-700 py-4 h-[56px]">周末白天</TableHead>
                      )}
                      <TableHead className="font-semibold text-gray-700 py-4 h-[56px]">总量化分</TableHead>
                      <TableHead 
                        className="font-semibold text-gray-700 py-4 h-[56px] cursor-pointer hover:text-blue-600 transition-colors"
                        onClick={() => setSortByRank(!sortByRank)}
                      >
                        <div className="flex items-center gap-1">
                          <span>名次</span>
                          {sortByRank ? (
                            <ArrowUpDown className="h-4 w-4" />
                          ) : (
                            <ArrowUpDown className="h-4 w-4 opacity-50" />
                          )}
                        </div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(() => {
                      // 计算名次：按总量化分降序排序
                      const sortedByScore = [...totalSummaryData].sort((a, b) => b.total_score - a.total_score);
                      
                      // 为每个数据项计算名次
                      const scoreToRank = new Map<number, number>();
                      sortedByScore.forEach((item, index) => {
                        if (!scoreToRank.has(item.total_score)) {
                          scoreToRank.set(item.total_score, index + 1);
                        }
                      });
                      
                      // 获取名次徽章样式
                      const getRankBadgeVariant = (rank: number): "default" | "secondary" | "destructive" | "outline" => {
                        if (!rank) return 'secondary';
                        if (rank === 1) return 'default'; // 青云星光
                        if (rank >= 2 && rank <= 3) return 'destructive'; // 五星级
                        if (rank >= 4 && rank <= 7) return 'destructive'; // 四星级
                        if (rank >= 8 && rank <= 12) return 'default'; // 三星级
                        if (rank >= 13 && rank <= 18) return 'secondary'; // 二星级
                        if (rank >= 19 && rank <= 24) return 'outline'; // 一星级
                        return 'secondary';
                      };

                      // 获取名次徽章的自定义样式
                      const getRankBadgeStyle = (rank: number) => {
                        if (!rank) return '';
                        if (rank === 1) return 'bg-gradient-to-r from-red-600 to-amber-500 text-white border-0 shadow-lg inline-block text-center min-h-[24px] w-20 px-3 font-semibold leading-none'; // 青云星光
                        if (rank >= 2 && rank <= 3) return 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white border-0 shadow-md inline-block text-center min-h-[24px] w-20 px-3 font-semibold leading-none'; // 五星级
                        if (rank >= 4 && rank <= 7) return 'bg-gradient-to-r from-blue-500 to-cyan-500 text-white border-0 shadow-md inline-block text-center min-h-[24px] w-20 px-3 font-semibold leading-none'; // 四星级
                        if (rank >= 8 && rank <= 12) return 'bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0 shadow-md inline-block text-center min-h-[24px] w-20 px-3 font-semibold leading-none'; // 三星级
                        if (rank >= 13 && rank <= 18) return 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white border-0 shadow-md inline-block text-center min-h-[24px] w-20 px-3 font-semibold leading-none'; // 二星级
                        if (rank >= 19 && rank <= 24) return 'bg-gradient-to-r from-gray-500 to-slate-500 text-white border-0 shadow-md inline-block text-center min-h-[24px] w-20 px-3 font-semibold leading-none'; // 一星级
                        return '';
                      };
                      
                      // 根据排序状态决定显示顺序
                      const displayData = sortByRank 
                        ? sortedByScore  // 按名次排序
                        : totalSummaryData;  // 按班级顺序
                      
                      return displayData.map((item, index) => {
                        const rank = scoreToRank.get(item.total_score) || 0;
                        const rankVariant = getRankBadgeVariant(rank);
                        const rankStyle = getRankBadgeStyle(rank);
                        
                        return (
                      <TableRow 
                        key={index}
                        className={`hover:bg-blue-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}
                      >
                        <TableCell className="font-medium text-gray-800 py-4">{item.class_name}</TableCell>
                        <TableCell className="text-gray-700 py-4">{item.teacher_name}</TableCell>
                        {selectedCheckInTypes.lunch_break && (
                          <TableCell className="py-4">
                            <NumberDisplay 
                              value={item.lunch_break_score}
                              variant={item.lunch_break_score > 0 ? "default" : "danger"}
                            />
                          </TableCell>
                        )}
                        {selectedCheckInTypes.evening_break && (
                          <TableCell className="py-4">
                            <NumberDisplay 
                              value={item.evening_break_score}
                              variant={item.evening_break_score > 0 ? "default" : "danger"}
                            />
                          </TableCell>
                        )}
                        {selectedCheckInTypes.morning_evening_study && (
                          <TableCell className="py-4">
                            <NumberDisplay 
                              value={item.morning_evening_study_score}
                              variant={item.morning_evening_study_score > 0 ? "default" : "danger"}
                            />
                          </TableCell>
                        )}
                        {selectedCheckInTypes.weekend_day && (
                          <TableCell className="py-4">
                            <NumberDisplay 
                              value={item.weekend_day_score}
                              variant={item.weekend_day_score > 0 ? "default" : "danger"}
                            />
                          </TableCell>
                        )}
                        <TableCell className="py-4">
                          <NumberDisplay 
                            value={item.total_score}
                            variant={item.total_score > 0 ? "default" : "danger"}
                          />
                        </TableCell>
                        <TableCell className="py-4">
                          <Badge 
                            variant={rankVariant}
                            className={rankStyle}
                            style={{ paddingTop: '0.35rem', paddingBottom: '0.35rem', lineHeight: '1' }}
                          >
                            第{rank}名
                          </Badge>
                        </TableCell>
                      </TableRow>
                        );
                      });
                    })()}
                    {totalSummaryData.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-12 text-gray-500">
                          <div className="flex flex-col items-center space-y-3">
                            <BarChart3 className="h-16 w-16 text-gray-300" />
                            <p className="text-lg">暂无统计数据</p>
                            <p className="text-sm">请先上传各类型的签到数据</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>

      </Tabs>

      {/* 补充签到弹框 */}
      {currentSupplementTeacher && (
        <SupplementCheckInDialog
          open={supplementDialogOpen}
          onOpenChange={setSupplementDialogOpen}
          teacherName={currentSupplementTeacher.teacherName}
          checkInType={currentSupplementTeacher.checkInType}
          existingDates={currentSupplementTeacher.existingDates}
          dateRange={getDateRange(currentSupplementTeacher.checkInType) || { start: new Date(), end: new Date() }}
          onConfirm={handleConfirmSupplement}
        />
      )}

      {/* 批量上传对话框 */}
      <BatchUploadDialog
        open={batchUploadDialogOpen}
        onOpenChange={setBatchUploadDialogOpen}
        onUpload={handleBatchUpload}
      />

      </div>
    </div>
  );
}