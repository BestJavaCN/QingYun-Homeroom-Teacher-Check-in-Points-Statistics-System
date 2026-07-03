import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';

interface DateBadgeProps {
  date: string;
  onDelete: () => void;
  isHovered: boolean;
  isOutOfRange?: boolean; // 是否不在限制区间内
  isOverLimit?: boolean; // 是否超过次数限制
}

export function DateBadge({ date, onDelete, isHovered, isOutOfRange = false, isOverLimit = false }: DateBadgeProps) {
  const [isDateHovered, setIsDateHovered] = useState(false);

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete();
  };

  // 确定样式：超限用橙色，超出区间用红色，正常用蓝色
  const getBadgeStyle = () => {
    if (isOverLimit) {
      return 'bg-orange-50 text-orange-700 border-orange-200';
    }
    if (isOutOfRange) {
      return 'bg-red-50 text-red-700 border-red-200';
    }
    return 'bg-blue-50 text-blue-700 border-blue-200';
  };

  return (
    <div 
      className="relative inline-block group"
      onMouseEnter={() => setIsDateHovered(true)}
      onMouseLeave={() => setIsDateHovered(false)}
    >
      <Badge 
        variant="secondary" 
        className={`
          inline-block text-center min-h-[20px] px-2 text-xs font-mono 
          ${getBadgeStyle()}
          leading-none
          transition-all duration-200
          ${isHovered && isDateHovered ? 'animate-shake' : ''}
        `}
        style={{ paddingTop: '0.3rem', paddingBottom: '0.3rem', lineHeight: '1' }}
      >
        {date}
      </Badge>
      {isHovered && isDateHovered && (
        <button
          onClick={handleDelete}
          className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-sm z-10"
          title="删除此签到记录"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}
