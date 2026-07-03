import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';

// 签到类型
export type TabType = 'lunch_break' | 'evening_break' | 'morning_evening_study' | 'weekend_day' | 'total_summary';

// 日期区间类型定义
export interface DateRange {
  id: string;    // 唯一标识符
  start: string; // YYYY-MM-DD 格式
  end: string;   // YYYY-MM-DD 格式
  dateCounts?: { [date: string]: 1 | 2 };  // 每个日期的签到次数（仅用于早晚自习和周末白天）
}

// 签到统计数据接口
export interface CheckInSummary {
  class_name: string;
  teacher_name: string;
  total_count: number;
  effective_count: number;
  score: number;
  dates: string[];
}

// 总量化统计数据接口
export interface TotalSummary {
  class_name: string;
  teacher_name: string;
  lunch_break_count: number;
  lunch_break_score: number;
  evening_break_count: number;
  evening_break_score: number;
  morning_evening_study_count: number;
  morning_evening_study_score: number;
  weekend_day_count: number;
  weekend_day_score: number;
  total_count: number;
  total_score: number;
}

// 签到数据结构
export interface CheckInDataState {
  lunch_break: CheckInSummary[];
  evening_break: CheckInSummary[];
  morning_evening_study: CheckInSummary[];
  weekend_day: CheckInSummary[];
}

// 基础次数设置接口
export interface BaseCountSettings {
  lunch_break: {
    single_class: number;
    multi_class: number;
  };
  evening_break: {
    single_class: number;
    multi_class: number;
  };
}

// 选中的签到类型接口
export interface SelectedCheckInTypes {
  lunch_break: boolean;
  evening_break: boolean;
  morning_evening_study: boolean;
  weekend_day: boolean;
}

// 补充签到记录接口
export interface SupplementedRecord {
  id: string;
  teacher_name: string;
  date: string;
  type: 'lunch_break' | 'evening_break' | 'morning_evening_study' | 'weekend_day';
}

// 数据差异接口（对比当前数据和原始数据的差异）
export interface DataDifference {
  teacher_name: string; // 教师姓名
  class_names: string[]; // 班级名称列表（支持多班班主任）
  added_dates: string[]; // 补充的日期列表
  removed_dates: string[]; // 删除的日期列表
}

// 日期限制配置（每个签到类型可以有多个日期区间）
export interface DateRestrictions {
  lunch_break: DateRange[];
  evening_break: DateRange[];
  morning_evening_study: DateRange[];
  weekend_day: DateRange[];
}

// Context接口
interface CheckInDataContextType {
  checkInData: CheckInDataState;
  originalCheckInData: CheckInDataState;
  totalSummaryData: TotalSummary[];
  baseCountSettings: BaseCountSettings;
  selectedCheckInTypes: SelectedCheckInTypes;
  supplementedRecords: SupplementedRecord[];
  uploadedCheckInTypes: ('lunch_break' | 'evening_break' | 'morning_evening_study' | 'weekend_day')[];
  dateRestrictions: DateRestrictions; // 日期限制配置
  updateCheckInData: (type: TabType, data: CheckInSummary[]) => void;
  updateTotalSummaryData: (data: TotalSummary[]) => void;
  updateBaseCountSettings: (settings: BaseCountSettings) => void;
  updateSelectedCheckInTypes: (types: SelectedCheckInTypes) => void;
  addSupplementedRecords: (records: SupplementedRecord[]) => void;
  removeSupplementedRecord: (id: string) => void;
  markCheckInTypeAsUploaded: (type: 'lunch_break' | 'evening_break' | 'morning_evening_study' | 'weekend_day') => void;
  getUploadedRecordCounts: () => {
    lunch_break: number;
    evening_break: number;
    morning_evening_study: number;
    weekend_day: number;
  };
  saveOriginalData: (type: TabType, data: CheckInSummary[]) => void;
  restoreOriginalData: () => void;
  clearCurrentTypeData: (type: 'lunch_break' | 'evening_break' | 'morning_evening_study' | 'weekend_day') => void; // 清空当前类型数据
  getDifferences: (type: 'lunch_break' | 'evening_break' | 'morning_evening_study' | 'weekend_day') => DataDifference[]; // 获取指定类型的数据差异
  restoreToOriginal: (type: 'lunch_break' | 'evening_break' | 'morning_evening_study' | 'weekend_day', teacherName: string) => void; // 将指定教师的所有班级数据恢复到原始状态
  hasDataChanged: (type: 'lunch_break' | 'evening_break' | 'morning_evening_study' | 'weekend_day', teacherName: string) => boolean; // 检查指定教师的数据是否有变化
  updateDateRestrictions: (type: 'lunch_break' | 'evening_break' | 'morning_evening_study' | 'weekend_day', rangesOrUpdater: DateRange[] | ((prev: DateRestrictions) => DateRange[])) => void; // 更新日期限制
  isDateInRestrictions: (type: 'lunch_break' | 'evening_break' | 'morning_evening_study' | 'weekend_day', date: string) => boolean; // 检查日期是否在限制区间内
  getStatisticsPeriod: (type: 'lunch_break' | 'evening_break' | 'morning_evening_study' | 'weekend_day' | 'total_summary') => string; // 获取统计周期字符串
}

// 创建Context
const CheckInDataContext = createContext<CheckInDataContextType | undefined>(undefined);

// Provider组件
export const CheckInDataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [checkInData, setCheckInData] = useState<CheckInDataState>({
    lunch_break: [],
    evening_break: [],
    morning_evening_study: [],
    weekend_day: []
  });

  const [originalCheckInData, setOriginalCheckInData] = useState<CheckInDataState>({
    lunch_break: [],
    evening_break: [],
    morning_evening_study: [],
    weekend_day: []
  });

  const [totalSummaryData, setTotalSummaryData] = useState<TotalSummary[]>([]);

  const [baseCountSettings, setBaseCountSettings] = useState<BaseCountSettings>({
    lunch_break: {
      single_class: 2,  // 单班班主任午休基础次数
      multi_class: 3    // 多班班主任午休基础次数
    },
    evening_break: {
      single_class: 3,  // 单班班主任晚休基础次数
      multi_class: 4    // 多班班主任晚休基础次数
    }
  });

  const [selectedCheckInTypes, setSelectedCheckInTypes] = useState<SelectedCheckInTypes>({
    lunch_break: true,
    evening_break: true,
    morning_evening_study: true,
    weekend_day: true
  });

  const [supplementedRecords, setSupplementedRecords] = useState<SupplementedRecord[]>([]);

  const [uploadedCheckInTypes, setUploadedCheckInTypes] = useState<('lunch_break' | 'evening_break' | 'morning_evening_study' | 'weekend_day')[]>([]);

  // 日期限制配置，从 localStorage 加载
  const [dateRestrictions, setDateRestrictions] = useState<DateRestrictions>({
    lunch_break: [],
    evening_break: [],
    morning_evening_study: [],
    weekend_day: []
  });

  const updateCheckInData = (type: TabType, data: CheckInSummary[]) => {
    setCheckInData(prev => ({
      ...prev,
      [type]: data
    }));
  };

  const updateTotalSummaryData = (data: TotalSummary[]) => {
    setTotalSummaryData(data);
  };

  const updateBaseCountSettings = (settings: BaseCountSettings) => {
    setBaseCountSettings(settings);
  };

  const updateSelectedCheckInTypes = (types: SelectedCheckInTypes) => {
    setSelectedCheckInTypes(types);
  };

  const addSupplementedRecords = (records: SupplementedRecord[]) => {
    setSupplementedRecords(prev => [...prev, ...records]);
  };

  const removeSupplementedRecord = (id: string) => {
    setSupplementedRecords(prev => prev.filter(record => record.id !== id));
  };

  const markCheckInTypeAsUploaded = (type: 'lunch_break' | 'evening_break' | 'morning_evening_study' | 'weekend_day') => {
    setUploadedCheckInTypes(prev => {
      if (!prev.includes(type)) {
        return [...prev, type];
      }
      return prev;
    });
  };

  const getUploadedRecordCounts = () => {
    return {
      lunch_break: checkInData.lunch_break.length,
      evening_break: checkInData.evening_break.length,
      morning_evening_study: checkInData.morning_evening_study.length,
      weekend_day: checkInData.weekend_day.length
    };
  };

  // 保存原始数据
  const saveOriginalData = (type: TabType, data: CheckInSummary[]) => {
    setOriginalCheckInData(prev => ({
      ...prev,
      [type]: JSON.parse(JSON.stringify(data)) // 深拷贝
    }));
  };

  // 清空当前类型数据
  const clearCurrentTypeData = (type: 'lunch_break' | 'evening_break' | 'morning_evening_study' | 'weekend_day') => {
    // 清空签到数据
    setCheckInData(prev => ({
      ...prev,
      [type]: []
    }));
    
    // 清空原始数据
    setOriginalCheckInData(prev => ({
      ...prev,
      [type]: []
    }));
    
    // 清空该类型的补充记录
    setSupplementedRecords(prev => prev.filter(record => record.type !== type));
    
    // 从已上传类型列表中移除
    setUploadedCheckInTypes(prev => prev.filter(t => t !== type));
  };

  // 获取指定类型的数据差异（对比当前数据和原始数据）
  const getDifferences = (type: 'lunch_break' | 'evening_break' | 'morning_evening_study' | 'weekend_day'): DataDifference[] => {
    const currentData = checkInData[type];
    const originalData = originalCheckInData[type];
    
    // 按教师分组
    const teacherMap = new Map<string, {
      class_names: Set<string>;
      added_dates: Set<string>;
      removed_dates: Set<string>;
    }>();
    
    // 遍历当前数据，找出每个教师的差异
    currentData.forEach(current => {
      const original = originalData.find(
        o => o.teacher_name === current.teacher_name && o.class_name === current.class_name
      );
      
      if (!teacherMap.has(current.teacher_name)) {
        teacherMap.set(current.teacher_name, {
          class_names: new Set(),
          added_dates: new Set(),
          removed_dates: new Set()
        });
      }
      
      const teacherData = teacherMap.get(current.teacher_name)!;
      teacherData.class_names.add(current.class_name);
      
      if (!original) {
        // 原始数据中没有这个教师的这个班级，说明是新增的
        current.dates.forEach(date => teacherData.added_dates.add(date));
      } else {
        // 对比日期差异
        const addedDates = current.dates.filter(date => !original.dates.includes(date));
        const removedDates = original.dates.filter(date => !current.dates.includes(date));
        
        addedDates.forEach(date => teacherData.added_dates.add(date));
        removedDates.forEach(date => teacherData.removed_dates.add(date));
      }
    });
    
    // 检查原始数据中有但当前数据中没有的教师班级（所有日期都被删除）
    originalData.forEach(original => {
      const current = currentData.find(
        c => c.teacher_name === original.teacher_name && c.class_name === original.class_name
      );
      
      if (!current) {
        if (!teacherMap.has(original.teacher_name)) {
          teacherMap.set(original.teacher_name, {
            class_names: new Set(),
            added_dates: new Set(),
            removed_dates: new Set()
          });
        }
        
        const teacherData = teacherMap.get(original.teacher_name)!;
        teacherData.class_names.add(original.class_name);
        original.dates.forEach(date => teacherData.removed_dates.add(date));
      }
    });
    
    // 转换为数组，只返回有差异的教师
    const differences: DataDifference[] = [];
    teacherMap.forEach((data, teacher_name) => {
      if (data.added_dates.size > 0 || data.removed_dates.size > 0) {
        differences.push({
          teacher_name,
          class_names: Array.from(data.class_names),
          added_dates: Array.from(data.added_dates),
          removed_dates: Array.from(data.removed_dates)
        });
      }
    });
    
    return differences;
  };

  // 将指定教师的所有班级数据恢复到原始状态
  const restoreToOriginal = (
    type: 'lunch_break' | 'evening_break' | 'morning_evening_study' | 'weekend_day',
    teacherName: string
  ) => {
    const originalData = originalCheckInData[type];
    // 找到该教师的所有原始记录
    const originalRecords = originalData.filter(o => o.teacher_name === teacherName);
    
    setCheckInData(prev => {
      const currentData = prev[type];
      // 移除该教师的所有当前记录
      let newData = currentData.filter(c => c.teacher_name !== teacherName);
      
      // 添加该教师的所有原始记录
      if (originalRecords.length > 0) {
        newData = [...newData, ...JSON.parse(JSON.stringify(originalRecords))];
      }
      
      return {
        ...prev,
        [type]: newData
      };
    });
    
    // 删除该教师的所有补充记录
    setSupplementedRecords(prev => 
      prev.filter(record => 
        !(record.type === type && record.teacher_name === teacherName)
      )
    );
  };

  // 检查指定教师的数据是否有变化
  const hasDataChanged = (
    type: 'lunch_break' | 'evening_break' | 'morning_evening_study' | 'weekend_day',
    teacherName: string
  ): boolean => {
    const currentData = checkInData[type];
    const originalData = originalCheckInData[type];
    
    // 获取该教师的所有当前记录
    const currentRecords = currentData.filter(c => c.teacher_name === teacherName);
    // 获取该教师的所有原始记录
    const originalRecords = originalData.filter(o => o.teacher_name === teacherName);
    
    // 如果记录数量不同，说明有变化
    if (currentRecords.length !== originalRecords.length) {
      return true;
    }
    
    // 检查每个班级的日期是否有变化
    for (const current of currentRecords) {
      const original = originalRecords.find(
        o => o.class_name === current.class_name
      );
      
      if (!original) {
        // 原始数据中没有这个班级，说明是新增的
        return true;
      }
      
      // 对比日期数组
      const currentDates = [...current.dates].sort();
      const originalDates = [...original.dates].sort();
      
      if (currentDates.length !== originalDates.length) {
        return true;
      }
      
      for (let i = 0; i < currentDates.length; i++) {
        if (currentDates[i] !== originalDates[i]) {
          return true;
        }
      }
    }
    
    return false;
  };

  // 更新日期限制
  const updateDateRestrictions = (
    type: 'lunch_break' | 'evening_break' | 'morning_evening_study' | 'weekend_day',
    rangesOrUpdater: DateRange[] | ((prev: DateRestrictions) => DateRange[])
  ) => {
    if (typeof rangesOrUpdater === 'function') {
      // 函数式更新
      setDateRestrictions(prev => {
        const newRanges = rangesOrUpdater(prev);
        return {
          ...prev,
          [type]: newRanges
        };
      });
    } else {
      // 直接更新
      setDateRestrictions(prev => ({
        ...prev,
        [type]: rangesOrUpdater
      }));
    }
  };

  // 检查日期是否在限制区间内
  const isDateInRestrictions = (
    type: 'lunch_break' | 'evening_break' | 'morning_evening_study' | 'weekend_day',
    date: string
  ): boolean => {
    const ranges = dateRestrictions[type];
    
    // 如果没有设置限制区间，则所有日期都有效
    if (!ranges || ranges.length === 0) {
      return true;
    }

    // 检查日期是否在任一区间内
    return ranges.some(range => {
      return date >= range.start && date <= range.end;
    });
  };

  // 获取统计周期字符串
  const getStatisticsPeriod = (type: 'lunch_break' | 'evening_break' | 'morning_evening_study' | 'weekend_day' | 'total_summary'): string => {
    // 格式化日期为 MM月DD日
    const formatDate = (dateStr: string): string => {
      if (!dateStr) return '无效日期';
      
      const date = new Date(dateStr);
      
      // 检查日期是否有效
      if (isNaN(date.getTime())) {
        console.error('无效的日期字符串:', dateStr);
        return '无效日期';
      }
      
      const month = date.getMonth() + 1;
      const day = date.getDate();
      return `${month}月${day}日`;
    };

    // 判断是否需要显示次数信息
    const needsCountFeature = (t: string): boolean => {
      return t === 'morning_evening_study' || t === 'weekend_day';
    };

    // 获取日期范围内的所有日期
    const getAllDatesInRange = (start: string, end: string): string[] => {
      const dates: string[] = [];
      
      // 验证输入
      if (!start || !end) {
        console.error('getAllDatesInRange: 开始或结束日期为空', { start, end });
        return dates;
      }
      
      const startDate = new Date(start);
      const endDate = new Date(end);
      
      // 验证日期有效性
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        console.error('getAllDatesInRange: 无效的日期', { start, end });
        return dates;
      }
      
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        dates.push(`${year}-${month}-${day}`);
      }
      
      return dates;
    };

    // 精准计算带次数的统计周期（用于早晚自习和周末白天）
    const formatRangesWithCount = (ranges: DateRange[]): string => {
      if (ranges.length === 0) return '暂无数据';

      // 收集所有日期及其次数
      // 注意：只考虑端点的次数，区间内其他日期默认为2次
      const dateCountMap: { [date: string]: number } = {};
      
      ranges.forEach(range => {
        const datesInRange = getAllDatesInRange(range.start, range.end);
        datesInRange.forEach(date => {
          // 如果是端点（开始或结束日期），使用配置的次数
          if (date === range.start || date === range.end) {
            const count = range.dateCounts?.[date] ?? 2;
            dateCountMap[date] = count;
          } else {
            // 如果是区间内的其他日期，默认为2次
            dateCountMap[date] = 2;
          }
        });
      });

      // 按日期排序
      const sortedDates = Object.keys(dateCountMap).sort();
      if (sortedDates.length === 0) return '暂无数据';

      // 合并连续日期，并记录每个区间中的1次日期
      const segments: { start: string; end: string; oneTimeDates: string[] }[] = [];
      let currentStart = sortedDates[0];
      let currentEnd = sortedDates[0];
      let currentOneTimeDates: string[] = [];
      
      // 如果第一个日期是1次，记录下来
      if (dateCountMap[sortedDates[0]] === 1) {
        currentOneTimeDates.push(sortedDates[0]);
      }

      for (let i = 1; i < sortedDates.length; i++) {
        const date = sortedDates[i];
        const count = dateCountMap[date];
        
        // 检查是否是连续日期
        const prevDate = new Date(sortedDates[i - 1]);
        const currDate = new Date(date);
        const diffDays = Math.floor((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
        
        if (diffDays === 1) {
          // 连续日期，扩展当前区间
          currentEnd = date;
          if (count === 1) {
            currentOneTimeDates.push(date);
          }
        } else {
          // 不连续，保存当前区间，开始新区间
          segments.push({ 
            start: currentStart, 
            end: currentEnd, 
            oneTimeDates: [...currentOneTimeDates] 
          });
          currentStart = date;
          currentEnd = date;
          currentOneTimeDates = count === 1 ? [date] : [];
        }
      }
      
      // 添加最后一个区间
      segments.push({ 
        start: currentStart, 
        end: currentEnd, 
        oneTimeDates: [...currentOneTimeDates] 
      });

      // 格式化输出
      return segments.map(seg => {
        const startStr = formatDate(seg.start);
        const endStr = formatDate(seg.end);
        
        if (seg.start === seg.end) {
          // 单个日期
          if (seg.oneTimeDates.length > 0) {
            return `${startStr}（限1次）`;
          } else {
            return startStr;
          }
        } else {
          // 日期范围
          if (seg.oneTimeDates.length === 0) {
            // 区间内没有1次的日期
            return `${startStr}-${endStr}`;
          } else {
            // 区间内有1次的日期，需要标注
            const oneTimeDatesStr = seg.oneTimeDates.map(d => {
              const date = new Date(d);
              return `${date.getDate()}日`;
            }).join('、');
            return `${startStr}-${endStr}（${oneTimeDatesStr}限1次）`;
          }
        }
      }).join('、');
    };

    // 合并重叠的日期区间，返回不重叠的区间数组（用于不需要次数的类型）
    const mergeRanges = (ranges: DateRange[]): DateRange[] => {
      if (ranges.length === 0) return [];
      
      // 按开始日期排序
      const sorted = [...ranges].sort((a, b) => a.start.localeCompare(b.start));
      // 🔧 修复：使用深拷贝而不是引用，避免修改原始数据
      const merged: DateRange[] = [{ ...sorted[0] }];
      
      for (let i = 1; i < sorted.length; i++) {
        const current = sorted[i];
        const last = merged[merged.length - 1];
        
        // 如果当前区间的开始日期 <= 上一个区间的结束日期（或紧邻），则合并
        const lastEndDate = new Date(last.end);
        const currentStartDate = new Date(current.start);
        const nextDay = new Date(lastEndDate);
        nextDay.setDate(nextDay.getDate() + 1);
        
        if (currentStartDate <= nextDay) {
          // 合并区间，取较晚的结束日期
          last.end = last.end > current.end ? last.end : current.end;
        } else {
          // 不重叠，添加新区间
          // 🔧 修复：使用深拷贝而不是引用，避免修改原始数据
          merged.push({ ...current });
        }
      }
      
      return merged;
    };

    // 格式化合并后的日期区间数组（用于不需要次数的类型）
    const formatMergedRanges = (ranges: DateRange[]): string => {
      const merged = mergeRanges(ranges);
      return merged.map(range => {
        const startStr = formatDate(range.start);
        const endStr = formatDate(range.end);
        
        // 如果开始日期和结束日期相同，只显示一个日期
        if (range.start === range.end) {
          return startStr;
        }
        
        // 否则显示日期区间
        return `${startStr}-${endStr}`;
      }).join('，');
    };

    // 获取数据中的最早和最晚日期
    const getDataDateRange = (data: CheckInSummary[]): { min: string; max: string } | null => {
      if (data.length === 0) return null;
      
      const allDates: string[] = [];
      data.forEach(summary => {
        // 将日期字符串转换为标准格式 YYYY-MM-DD
        summary.dates.forEach(dateStr => {
          // 移除次数信息，如 "2025.11.23（2次）" -> "2025.11.23"
          const cleanDateStr = dateStr.split('（')[0].trim();
          // 将 "2025.11.23" 转换为 "2025-11-23"，并确保月份和日期是两位数
          const parts = cleanDateStr.split('.');
          if (parts.length === 3) {
            const year = parts[0];
            const month = parts[1].padStart(2, '0');
            const day = parts[2].padStart(2, '0');
            const standardDateStr = `${year}-${month}-${day}`;
            allDates.push(standardDateStr);
          }
        });
      });
      
      if (allDates.length === 0) return null;
      
      allDates.sort();
      return {
        min: allDates[0],
        max: allDates[allDates.length - 1]
      };
    };

    if (type === 'total_summary') {
      // 总量化统计：对于每个已勾选的类型，优先使用限制区间，否则使用数据范围
      const allRanges: DateRange[] = [];
      
      (['lunch_break', 'evening_break', 'morning_evening_study', 'weekend_day'] as const).forEach(t => {
        // 只处理已勾选的类型
        if (!selectedCheckInTypes[t]) return;
        
        // 如果该类型有限制区间，使用限制区间
        if (dateRestrictions[t] && dateRestrictions[t].length > 0) {
          allRanges.push(...dateRestrictions[t]);
        } else {
          // 如果该类型没有限制区间，从数据中提取日期范围
          const dataRange = getDataDateRange(checkInData[t]);
          if (dataRange) {
            allRanges.push({
              id: `${t}_data_range`,
              start: dataRange.min,
              end: dataRange.max
            });
          }
        }
      });

      if (allRanges.length > 0) {
        return formatMergedRanges(allRanges);
      }
      
      return '暂无数据';
    }

    // 单个签到类型
    const ranges = dateRestrictions[type];
    
    // 如果有设置限制区间
    if (ranges && ranges.length > 0) {
      // 如果是早晚自习或周末白天，使用精准计算（显示次数）
      if (needsCountFeature(type)) {
        return formatRangesWithCount(ranges);
      }
      // 其他类型使用简单合并
      return formatMergedRanges(ranges);
    }

    // 如果没有设置限制区间，显示数据的实际日期范围
    const dataRange = getDataDateRange(checkInData[type]);
    if (dataRange) {
      return `${formatDate(dataRange.min)}-${formatDate(dataRange.max)}`;
    }

    return '暂无数据';
  };

  // 还原到原始数据
  const restoreOriginalData = () => {
    setCheckInData(JSON.parse(JSON.stringify(originalCheckInData)));
    // 清空补充记录
    setSupplementedRecords([]);
  };

  return (
    <CheckInDataContext.Provider
      value={{
        checkInData,
        originalCheckInData,
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
        getUploadedRecordCounts,
        saveOriginalData,
        restoreOriginalData,
        clearCurrentTypeData,
        getDifferences,
        restoreToOriginal,
        hasDataChanged,
        updateDateRestrictions,
        isDateInRestrictions,
        getStatisticsPeriod
      }}
    >
      {children}
    </CheckInDataContext.Provider>
  );
};

// Hook
export const useCheckInData = () => {
  const context = useContext(CheckInDataContext);
  if (context === undefined) {
    throw new Error('useCheckInData must be used within a CheckInDataProvider');
  }
  return context;
};