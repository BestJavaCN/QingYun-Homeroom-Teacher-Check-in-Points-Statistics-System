// 数据库表类型定义

export type UserRole = 'user' | 'admin';

export interface Profile {
  id: string;
  phone: string;
  username: string;
  password: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface Class {
  id: string;
  class_name: string;
  teacher_name: string;
  created_at: string;
  updated_at: string;
}

// 签到相关类型定义
export type CheckInType = 'lunch_break' | 'evening_break' | 'morning_evening_study' | 'weekend_day';

// 标签页类型定义（包含总量化统计）
export type TabType = CheckInType | 'total_summary';

export interface CheckInRecord {
  date: string;
  teacher_name: string;
  class_name: string;
  type: CheckInType;
}

export interface CheckInSummary {
  class_name: string;
  teacher_name: string;
  total_count: number;
  effective_count: number;
  score: number;
  dates: string[];
}

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

// Excel 导入相关类型
export interface ExcelImportData {
  序号?: number;
  签到日期: string;
  姓名: string;
  自动定位?: string;
  班级: string;
}

// 表单类型
export interface ClassFormData {
  class_name: string;
  teacher_name: string;
}

export interface CheckInFormData {
  teacher_name: string;
  date: string;
  type: CheckInType;
}

export interface UserFormData {
  username?: string;
  password?: string;
  confirm_password?: string;
}

// 日期区间类型定义
export interface DateRange {
  start: string; // YYYY-MM-DD 格式
  end: string;   // YYYY-MM-DD 格式
}

// 签到类型的日期限制配置
export interface CheckInDateRestriction {
  type: CheckInType;
  ranges: DateRange[];
}