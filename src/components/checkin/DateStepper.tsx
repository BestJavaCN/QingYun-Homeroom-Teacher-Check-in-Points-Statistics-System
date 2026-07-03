import { ChevronUp, ChevronDown } from 'lucide-react';

interface DateStepperProps {
  value: string; // YYYY-MM-DD 格式
  onChange: (value: string) => void;
  count?: 1 | 2; // 当前日期的签到次数（可选）
  onCountChange?: (date: string, count: 1 | 2) => void; // 次数变化回调
}

export function DateStepper({ value, onChange, count, onCountChange }: DateStepperProps) {
  // 增加一天或次数
  const incrementDate = () => {
    // 如果有次数功能且当前是1次，先增加到2次
    if (count !== undefined && onCountChange && count === 1) {
      onCountChange(value, 2);
      return;
    }
    
    // 否则增加一天
    const date = new Date(value);
    date.setDate(date.getDate() + 1);
    const newValue = date.toISOString().split('T')[0];
    onChange(newValue);
  };

  // 减少一天或次数
  const decrementDate = () => {
    // 如果有次数功能且当前是2次，先减少到1次
    if (count !== undefined && onCountChange && count === 2) {
      onCountChange(value, 1);
      return;
    }
    
    // 否则减少一天
    const date = new Date(value);
    date.setDate(date.getDate() - 1);
    const newValue = date.toISOString().split('T')[0];
    onChange(newValue);
  };

  // 格式化日期显示（YYYY-MM-DD + 次数）
  const formatDate = (dateStr: string) => {
    if (count !== undefined) {
      return `${dateStr}（${count}次）`;
    }
    return dateStr;
  };

  return (
    <div className="relative flex items-center border border-gray-300 rounded bg-white">
      {/* 日期文本显示 */}
      <div className={`${count !== undefined ? 'w-[155px]' : 'w-[130px]'} h-8 px-2 flex items-center text-sm text-gray-700 whitespace-nowrap overflow-hidden`}>
        {formatDate(value)}
      </div>
      
      {/* 上下堆叠的箭头按钮 */}
      <div className="flex flex-col border-l border-gray-300 bg-white rounded-r">
        <button
          type="button"
          onClick={incrementDate}
          className="w-6 h-4 flex items-center justify-center hover:bg-gray-100 transition-colors border-b border-gray-300 rounded-tr"
          title={count !== undefined && count === 1 ? "增加次数" : "增加一天"}
        >
          <ChevronUp className="h-3 w-3 text-gray-600" />
        </button>
        <button
          type="button"
          onClick={decrementDate}
          className="w-6 h-4 flex items-center justify-center hover:bg-gray-100 transition-colors rounded-br"
          title={count !== undefined && count === 2 ? "减少次数" : "减少一天"}
        >
          <ChevronDown className="h-3 w-3 text-gray-600" />
        </button>
      </div>
    </div>
  );
}
