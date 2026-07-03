import * as XLSX from 'xlsx';
import type { ExcelImportData, CheckInType, CheckInRecord, CheckInSummary, TotalSummary, Class } from '@/types/types';

// 检测签到类型
export function detectCheckInType(fileName: string): CheckInType | null {
  const name = fileName.toLowerCase();
  if (name.includes('午休')) return 'lunch_break';
  if (name.includes('晚休')) return 'evening_break';
  if (name.includes('早晚自习') || name.includes('自习')) return 'morning_evening_study';
  if (name.includes('周末白天') || name.includes('周末')) return 'weekend_day';
  return null;
}

// 解析 Excel 文件 - 通用版本，支持班级管理和签到数据
export function parseExcelFile(file: File): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        console.log('开始解析Excel文件:', file.name);
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        
        console.log('Excel文件工作表数量:', workbook.SheetNames.length);
        console.log('工作表名称:', workbook.SheetNames);
        
        // 优先查找包含"扫码签到数据"的工作表（用于签到数据）
        let targetSheet = null;
        let isCheckInData = false;
        
        for (const sheetName of workbook.SheetNames) {
          console.log('检查工作表:', sheetName);
          if (sheetName.includes('扫码签到数据')) {
            targetSheet = workbook.Sheets[sheetName];
            isCheckInData = true;
            console.log('找到签到数据工作表:', sheetName);
            break;
          }
        }
        
        // 如果没找到签到数据工作表，使用第一个工作表
        if (!targetSheet) {
          targetSheet = workbook.Sheets[workbook.SheetNames[0]];
          console.log('使用第一个工作表:', workbook.SheetNames[0]);
        }
        
        // 直接转换为JSON，使用第一行作为表头
        const jsonData = XLSX.utils.sheet_to_json(targetSheet, { 
          header: 1,
          defval: '' // 空单元格默认值
        });
        
        console.log('转换后的数据行数:', jsonData.length);
        console.log('前10行数据:', jsonData.slice(0, 10));
        
        if (jsonData.length < 2) {
          console.error('文件中没有足够的数据行');
          throw new Error('文件中没有足够的数据行');
        }
        
        // 检查是否包含日期列，如果包含则按签到数据处理
        let hasDateColumn = false;
        for (let i = 0; i < Math.min(10, jsonData.length); i++) {
          const row = jsonData[i] as string[];
          if (row.some(cell => cell && cell.toString().includes('日期'))) {
            hasDateColumn = true;
            break;
          }
        }
        
        // 如果是签到数据或包含日期列，需要特殊处理
        if (isCheckInData || hasDateColumn) {
          console.log('处理签到数据...');
          const result = parseCheckInData(jsonData);
          console.log('签到数据处理结果:', result.length, '条记录');
          return resolve(result);
        }
        
        // 普通Excel处理（如班级信息）
        console.log('处理普通Excel数据...');
        const headers = jsonData[0] as string[];
        const dataRows = jsonData.slice(1) as any[][];
        
        const result: any[] = [];
        
        for (const row of dataRows) {
          if (!row || row.length === 0 || row.every(cell => !cell)) continue;
          
          const rowData: any = {};
          headers.forEach((header, index) => {
            if (header && row[index] !== undefined && row[index] !== '') {
              rowData[header.toString().trim()] = row[index];
            }
          });
          
          // 只有当行数据不为空时才添加
          if (Object.keys(rowData).length > 0) {
            result.push(rowData);
          }
        }
        
        console.log('普通Excel处理结果:', result.length, '条记录');
        resolve(result);
      } catch (error) {
        console.error('Excel解析错误:', error);
        reject(new Error(`文件解析失败: ${error.message}`));
      }
    };
    reader.onerror = () => reject(new Error('文件读取失败'));
    reader.readAsArrayBuffer(file);
  });
}

// 解析签到数据的特殊处理
function parseCheckInData(jsonData: any[]): ExcelImportData[] {
  // 找到表头行
  let headerRowIndex = -1;
  for (let i = 0; i < jsonData.length; i++) {
    const row = jsonData[i] as string[];
    // 表头行应该同时包含"日期"和"姓名"字段
    const hasDate = row.some(cell => cell && cell.toString().includes('日期'));
    const hasName = row.some(cell => cell && cell.toString().includes('姓名'));
    if (hasDate && hasName) {
      headerRowIndex = i;
      break;
    }
  }
  
  if (headerRowIndex === -1) {
    console.error('未找到包含"日期"的表头行');
    throw new Error('未找到有效的表头行');
  }
  
  const headers = jsonData[headerRowIndex] as string[];
  const dataRows = jsonData.slice(headerRowIndex + 1) as string[][];
  const result: ExcelImportData[] = [];
  
  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    if (!row || row.length === 0) continue;
    
    const rowData: any = {};
    headers.forEach((header, index) => {
      if (header && row[index] !== undefined) {
        rowData[header] = row[index];
      }
    });
    
    // 验证必要字段
    if (rowData['日期'] && rowData['姓名']) {
      // 处理姓名格式，提取纯姓名
      let pureName = rowData['姓名'];
      if (typeof pureName === 'string') {
        // 移除班级前缀，如"703张三"、"701702张三"、"701、702张三"、"701 张三"、"701.张三"
        pureName = pureName.replace(/^[0-9、\s.]+/, '');
      }
      
      // 处理日期格式，确保格式统一
      let formattedDate = rowData['日期'];
      if (typeof formattedDate === 'string') {
        // 尝试解析日期
        // 移除中文星期，如"2026/04/01 星期三" -> "2026/04/01"
        const cleanDate = formattedDate.replace(/\s+星期[一二三四五六日]/, '');
        const date = new Date(cleanDate);
        if (!isNaN(date.getTime())) {
          // 格式化为标准的日期时间格式，如"2026/03/17 21:13:03"
          const year = date.getFullYear();
          const month = (date.getMonth() + 1).toString().padStart(2, '0');
          const day = date.getDate().toString().padStart(2, '0');
          const hours = date.getHours().toString().padStart(2, '0');
          const minutes = date.getMinutes().toString().padStart(2, '0');
          const seconds = date.getSeconds().toString().padStart(2, '0');
          formattedDate = `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
        } else {
          // 如果解析失败，尝试使用更简单的方式解析
          console.error('无法解析日期:', formattedDate);
        }
      }
      
      result.push({
        序号: rowData['序号'],
        签到日期: formattedDate,
        姓名: pureName,
        自动定位: rowData['自动定位'],
        班级: '' // 新模板没有班级列
      });
    }
  }
  
  return result;
}

// 验证签到数据与班级数据的匹配性
export function validateCheckInData(
  checkInData: ExcelImportData[],
  classes: Class[]
): { valid: ExcelImportData[]; invalid: ExcelImportData[] } {
  const valid: ExcelImportData[] = [];
  const invalid: ExcelImportData[] = [];
  
  // 创建教师姓名的集合，用于快速查找
  const teacherNames = new Set<string>();
  classes.forEach(cls => {
    teacherNames.add(cls.teacher_name);
  });
  
  checkInData.forEach(record => {
    if (teacherNames.has(record.姓名)) {
      // 只要教师存在于系统中就视为有效
      valid.push(record);
    } else {
      invalid.push(record);
    }
  });
  return { valid, invalid };
}

// 处理签到数据并生成统计
export function processCheckInData(
  checkInData: ExcelImportData[],
  type: CheckInType,
  classes: Class[],
  baseCountSettings?: {
    lunch_break?: { single_class: number; multi_class: number };
    evening_break?: { single_class: number; multi_class: number };
  }
): { summaries: CheckInSummary[]; warnings: string[] } {
  const teacherClassMap = new Map<string, string[]>();
  classes.forEach(cls => {
    if (!teacherClassMap.has(cls.teacher_name)) {
      teacherClassMap.set(cls.teacher_name, []);
    }
    teacherClassMap.get(cls.teacher_name)!.push(cls.class_name);
  });
  
  // 按教师分组统计签到数据
  const teacherStats = new Map<string, { dates: string[]; classes: Set<string> }>();
  
  // 首先按教师和日期分组，统计每日签到次数
  const teacherDateCount = new Map<string, Map<string, number>>();
  
  checkInData.forEach(record => {
    const teacher = record.姓名;
    // 确保日期格式统一，无论输入格式如何，都格式化为标准格式
    let dateStr = record.签到日期;
    let formattedDate = dateStr;
    
    if (typeof dateStr === 'string') {
      // 尝试解析日期
      // 移除中文星期，如"2026/04/01 星期三" -> "2026/04/01"
      const cleanDate = dateStr.replace(/\s+星期[一二三四五六日]/, '');
      const date = new Date(cleanDate);
      if (!isNaN(date.getTime())) {
        // 格式化为标准的日期格式，如"2026.4.7"
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();
        formattedDate = `${year}.${month}.${day}`;
       }
    }
    
    if (!teacherDateCount.has(teacher)) {
      teacherDateCount.set(teacher, new Map());
    }
    
    const dateMap = teacherDateCount.get(teacher)!;
    dateMap.set(formattedDate, (dateMap.get(formattedDate) || 0) + 1);
    
    if (!teacherStats.has(teacher)) {
      teacherStats.set(teacher, { dates: [], classes: new Set() });
    }
    
    // 从系统班级数据中获取教师对应的班级
    const teacherClasses = teacherClassMap.get(teacher);
    if (teacherClasses) {
      teacherClasses.forEach(cls => {
        teacherStats.get(teacher)!.classes.add(cls);
      });
    }
  });
  
  // 应用每日签到次数上限，并生成最终的dates数组
  const maxDailyCount = (type === 'morning_evening_study' || type === 'weekend_day') ? 2 : 1;
  const warnings: string[] = [];
  
  // 签到类型标签映射
  const typeLabels: Record<CheckInType, string> = {
    lunch_break: '午休',
    evening_break: '晚休',
    morning_evening_study: '早晚自习',
    weekend_day: '周末白天'
  };
  
  teacherDateCount.forEach((dateMap, teacher) => {
    const stats = teacherStats.get(teacher)!;
    
    dateMap.forEach((count, date) => {
      // 如果超过上限，只记录上限次数
      const actualCount = Math.min(count, maxDailyCount);
      
      // 将该日期添加actualCount次到dates数组
      for (let i = 0; i < actualCount; i++) {
        stats.dates.push(date);
      }
      
      // 如果有超限情况，记录警告
      if (count > maxDailyCount) {
        const warning = `教师"${teacher}"在${date}的${typeLabels[type]}签到次数为${count}次，超过上限${maxDailyCount}次，已自动限制为${maxDailyCount}次`;
        warnings.push(warning);
      }
    });
  });
  
  // 生成统计结果 - 确保包含所有班级
  const results: CheckInSummary[] = [];
  
  // 遍历所有班级，确保每个班级都有记录
  classes.forEach(cls => {
    const teacher = cls.teacher_name;
    const className = cls.class_name;
    
    // 获取该教师的签到统计
    const stats = teacherStats.get(teacher);
    
    if (stats && stats.dates.length > 0) {
      // 有签到记录的情况
      const teacherClasses = teacherClassMap.get(teacher) || [];
      
      // 统计每日签到次数
      const dateCount = new Map<string, number>();
      stats.dates.forEach(date => {
        dateCount.set(date, (dateCount.get(date) || 0) + 1);
      });
      
      // 格式化日期显示
      const formattedDates = Array.from(dateCount.entries())
        .sort(([a], [b]) => {
          // 正确解析日期进行排序（从新到旧）
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
          
          const dateA = parseDate(a);
          const dateB = parseDate(b);
          
          // 从新到旧排序
          return dateB.getTime() - dateA.getTime();
        })
        .map(([date, count]) => count > 1 ? `${date}（${count}次）` : date);
      
      const totalCount = stats.dates.length;
      const effectiveCount = calculateEffectiveCount(totalCount, type, teacherClasses.length > 1, baseCountSettings);
      const score = effectiveCount * 2;
      
      results.push({
        class_name: className,
        teacher_name: teacher,
        total_count: totalCount,
        effective_count: effectiveCount,
        score,
        dates: formattedDates
      });
    } else {
      // 没有签到记录的情况 - 显示0次签到
      const teacherClasses = teacherClassMap.get(teacher) || [className];
      const totalCount = 0;
      const effectiveCount = calculateEffectiveCount(totalCount, type, teacherClasses.length > 1, baseCountSettings);
      const score = effectiveCount * 2;
      
      results.push({
        class_name: className,
        teacher_name: teacher,
        total_count: totalCount,
        effective_count: effectiveCount,
        score,
        dates: [] // 没有签到日期
      });
    }
  });
  
  return {
    summaries: results.sort((a, b) => a.class_name.localeCompare(b.class_name)),
    warnings
  };
}

// 计算有效签到次数（允许负数）
export function calculateEffectiveCount(
  totalCount: number, 
  type: CheckInType, 
  isMultiClass: boolean,
  customBaseCounts?: {
    lunch_break?: { single_class: number; multi_class: number };
    evening_break?: { single_class: number; multi_class: number };
  }
): number {
  switch (type) {
    case 'lunch_break':
      const lunchBase = customBaseCounts?.lunch_break 
        ? (isMultiClass ? customBaseCounts.lunch_break.multi_class : customBaseCounts.lunch_break.single_class)
        : (isMultiClass ? 3 : 2);
      return totalCount - lunchBase; // 允许负数
    case 'evening_break':
      const eveningBase = customBaseCounts?.evening_break 
        ? (isMultiClass ? customBaseCounts.evening_break.multi_class : customBaseCounts.evening_break.single_class)
        : (isMultiClass ? 4 : 3);
      return totalCount - eveningBase; // 允许负数
    case 'morning_evening_study':
      return totalCount; // 早晚自习全部算有效
    case 'weekend_day':
      return totalCount; // 周末白天全部算有效
    default:
      return totalCount;
  }
}

// 重新计算签到数据（使用自定义基础次数）
export function recalculateCheckInData(
  originalData: CheckInSummary[],
  classes: Class[],
  type: CheckInType,
  customBaseCounts?: {
    lunch_break?: { single_class: number; multi_class: number };
    evening_break?: { single_class: number; multi_class: number };
  }
): CheckInSummary[] {
  return originalData.map(item => {
    // 获取教师对应的班级数量
    const teacherClasses = classes.filter(cls => cls.teacher_name === item.teacher_name);
    const isMultiClass = teacherClasses.length > 1;
    
    // 只有午休和晚休需要重新计算
    if (type === 'lunch_break' || type === 'evening_break') {
      // 重新计算有效签到次数和量化分
      const newEffectiveCount = calculateEffectiveCount(
        item.total_count,
        type,
        isMultiClass,
        customBaseCounts
      );
      
      return {
        ...item,
        effective_count: newEffectiveCount,
        score: newEffectiveCount * 2
      };
    }
    
    // 早晚自习和周末白天不需要重新计算
    return item;
  });
}

// 格式化日期 - 统一使用 YYYY.M.D 格式
function formatDate(dateStr: string): string {
  try {
    // 处理 Excel 日期格式
    if (typeof dateStr === 'number') {
      const date = XLSX.SSF.parse_date_code(dateStr);
      return `${date.y}.${date.m}.${date.d}`;
    }
    
    // 处理字符串日期
    let date: Date;
    
    // 如果是 YYYY-MM-DD 格式，直接解析
    if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      const [year, month, day] = dateStr.split('-').map(Number);
      return `${year}.${month}.${day}`;
    }
    
    // 其他格式尝试解析
    date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return dateStr; // 如果无法解析，返回原字符串
    }
    
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${year}.${month}.${day}`;
  } catch {
    return dateStr;
  }
}

// 生成总量化统计
export function generateTotalSummary(
  lunchBreakData: CheckInSummary[],
  eveningBreakData: CheckInSummary[],
  morningEveningData: CheckInSummary[],
  weekendDayData: CheckInSummary[],
  selectedTypes?: {
    lunch_break: boolean;
    evening_break: boolean;
    morning_evening_study: boolean;
    weekend_day: boolean;
  }
): TotalSummary[] {
  // 默认全部选中
  const types = selectedTypes || {
    lunch_break: true,
    evening_break: true,
    morning_evening_study: true,
    weekend_day: true
  };

  const classMap = new Map<string, TotalSummary>();
  
  // 初始化所有班级
  const allClasses = new Set<string>();
  [...lunchBreakData, ...eveningBreakData, ...morningEveningData, ...weekendDayData].forEach(item => {
    allClasses.add(item.class_name);
  });
  
  allClasses.forEach(className => {
    const teacherName = lunchBreakData.find(item => item.class_name === className)?.teacher_name ||
                       eveningBreakData.find(item => item.class_name === className)?.teacher_name ||
                       morningEveningData.find(item => item.class_name === className)?.teacher_name ||
                       weekendDayData.find(item => item.class_name === className)?.teacher_name ||
                       '';
    
    classMap.set(className, {
      class_name: className,
      teacher_name: teacherName,
      lunch_break_count: 0,
      lunch_break_score: 0,
      evening_break_count: 0,
      evening_break_score: 0,
      morning_evening_study_count: 0,
      morning_evening_study_score: 0,
      weekend_day_count: 0,
      weekend_day_score: 0,
      total_count: 0,
      total_score: 0
    });
  });
  
  // 填充午休数据（使用量化分）- 仅在选中时填充
  if (types.lunch_break) {
    lunchBreakData.forEach(item => {
      const summary = classMap.get(item.class_name)!;
      summary.lunch_break_count = item.dates.length;
      summary.lunch_break_score = item.score;
    });
  }
  
  // 填充晚休数据（使用量化分）- 仅在选中时填充
  if (types.evening_break) {
    eveningBreakData.forEach(item => {
      const summary = classMap.get(item.class_name)!;
      summary.evening_break_count = item.dates.length;
      summary.evening_break_score = item.score;
    });
  }
  
  // 填充早晚自习数据（使用量化分）- 仅在选中时填充
  if (types.morning_evening_study) {
    morningEveningData.forEach(item => {
      const summary = classMap.get(item.class_name)!;
      summary.morning_evening_study_count = item.dates.length;
      summary.morning_evening_study_score = item.score;
    });
  }
  
  // 填充周末白天数据（使用量化分）- 仅在选中时填充
  if (types.weekend_day) {
    weekendDayData.forEach(item => {
      const summary = classMap.get(item.class_name)!;
      summary.weekend_day_count = item.dates.length;
      summary.weekend_day_score = item.score;
    });
  }
  
  // 计算总量化分和总次数
  classMap.forEach(summary => {
    summary.total_count = summary.lunch_break_count + 
                         summary.evening_break_count + 
                         summary.morning_evening_study_count +
                         summary.weekend_day_count;
    summary.total_score = summary.lunch_break_score + 
                         summary.evening_break_score + 
                         summary.morning_evening_study_score +
                         summary.weekend_day_score;
  });
  
  return Array.from(classMap.values()).sort((a, b) => a.class_name.localeCompare(b.class_name));
}

// 导出为 Excel
export function exportToExcel(data: any[], filename: string, sheetName: string = 'Sheet1') {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, filename);
}

// 导出为图片（通过 HTML 转换）
export function exportToImage(tableElement: HTMLElement, filename: string) {
  // 这里需要使用 html2canvas 或类似库
  // 由于依赖问题，这里提供一个简单的实现思路
  // 导出图片功能需要额外的库支持
}