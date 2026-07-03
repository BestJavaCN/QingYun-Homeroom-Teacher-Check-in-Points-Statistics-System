import { useState, useRef, useEffect, ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DraggablePanelProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  width?: string;
  height?: string;
}

export function DraggablePanel({ 
  isOpen, 
  onClose, 
  title, 
  children,
  width = '800px',
  height = 'auto'
}: DraggablePanelProps) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  // 初始化位置（居中）
  useEffect(() => {
    if (isOpen && panelRef.current) {
      const rect = panelRef.current.getBoundingClientRect();
      const centerX = (window.innerWidth - rect.width) / 2;
      const centerY = Math.max(50, (window.innerHeight - rect.height) / 2);
      setPosition({ x: centerX, y: centerY });
    }
  }, [isOpen]);

  const handleMouseDown = (e: React.MouseEvent) => {
    // 只在标题栏上才能拖拽
    if ((e.target as HTMLElement).closest('.drag-handle')) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      });
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      const newX = e.clientX - dragStart.x;
      const newY = e.clientY - dragStart.y;
      
      // 限制在视口内
      const maxX = window.innerWidth - (panelRef.current?.offsetWidth || 0);
      const maxY = window.innerHeight - (panelRef.current?.offsetHeight || 0);
      
      setPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY))
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragStart, position]);

  if (!isOpen) return null;

  return (
    <>
      {/* 半透明背景，但不阻止交互 */}
      <div className="fixed inset-0 bg-black/20 z-40 pointer-events-none" />
      
      {/* 可拖拽面板 */}
      <div
        ref={panelRef}
        className="fixed z-50 shadow-2xl"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          width,
          maxHeight: height === 'auto' ? '90vh' : height,
          cursor: isDragging ? 'grabbing' : 'default'
        }}
        onMouseDown={handleMouseDown}
      >
        <Card className="h-full flex flex-col">
          {/* 标题栏 - 可拖拽区域 */}
          <div className="drag-handle flex items-center justify-between p-4 border-b cursor-grab active:cursor-grabbing bg-gray-50">
            <h3 className="text-lg font-semibold">{title}</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          {/* 内容区域 - 可滚动 */}
          <div className="flex-1 overflow-y-auto p-4">
            {children}
          </div>
        </Card>
      </div>
    </>
  );
}
