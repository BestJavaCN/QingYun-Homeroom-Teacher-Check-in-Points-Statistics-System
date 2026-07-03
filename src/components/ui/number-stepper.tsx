import React from 'react';
import { Button } from '@/components/ui/button';
import { Minus, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NumberStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  className?: string;
  label?: string;
}

export function NumberStepper({ 
  value, 
  onChange, 
  min = 0, 
  max = 99, 
  className,
  label 
}: NumberStepperProps) {
  const handleDecrement = () => {
    if (value > min) {
      onChange(value - 1);
    }
  };

  const handleIncrement = () => {
    if (value < max) {
      onChange(value + 1);
    }
  };

  return (
    <div className={cn("flex flex-col items-center space-y-1", className)}>
      {label && (
        <span className="text-sm font-medium text-gray-700">{label}</span>
      )}
      <div className="flex items-center space-x-1 border rounded-md bg-white">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDecrement}
          disabled={value <= min}
          className="h-8 w-8 p-0 hover:bg-gray-100 disabled:opacity-50"
        >
          <Minus className="h-3 w-3" />
        </Button>
        <div className="flex items-center justify-center w-12 h-8 text-sm font-medium bg-gray-50 border-x">
          {value}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleIncrement}
          disabled={value >= max}
          className="h-8 w-8 p-0 hover:bg-gray-100 disabled:opacity-50"
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}