import React, { useRef, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Download, Clock, Moon, Sun, Calendar, BarChart3 } from 'lucide-react';
import { toast } from 'sonner';
import { useCheckInData, type CheckInSummary, type TabType, type TotalSummary } from '@/contexts/CheckInDataContext';

interface CheckInChartProps {
  currentType: TabType;
  onTypeChange: (type: TabType) => void;
}

interface ChartData {
  class_name: string;
  teacher_name: string;
  count: number;
  label: string;
}

// 签到类型配置 - 移到组件外部避免每次渲染都创建新对象
const typeConfig = {
  lunch_break: { 
    label: '午休签到', 
    icon: Sun, 
    color: '#3b82f6', 
    showEffective: true,
    chartTitle: '午休签到统计图表',
    chartDesc: '（仅有效签到）'
  },
  evening_break: { 
    label: '晚休签到', 
    icon: Moon, 
    color: '#10b981', 
    showEffective: true,
    chartTitle: '晚休签到统计图表',
    chartDesc: '（仅有效签到）'
  },
  morning_evening_study: { 
    label: '早晚自习', 
    icon: Clock, 
    color: '#f59e0b', 
    showEffective: false,
    chartTitle: '早晚自习统计图表',
    chartDesc: ''
  },
  weekend_day: { 
    label: '周末白天', 
    icon: Calendar, 
    color: '#ec4899', 
    showEffective: false,
    chartTitle: '周末白天统计图表',
    chartDesc: ''
  },
  total_summary: { 
    label: '总量化统计', 
    icon: BarChart3, 
    color: '#8b5cf6', 
    showEffective: false,
    chartTitle: '总量化统计图表',
    chartDesc: '（只统计已选择的签到类型）'
  },
};

const CheckInChart: React.FC<CheckInChartProps> = ({ currentType, onTypeChange }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const { checkInData, totalSummaryData } = useCheckInData();

  // 使用useMemo确保数据变化时重新计算
  const chartData = useMemo(() => {
    // 如果是总量化统计,使用totalSummaryData
    if (currentType === 'total_summary') {
      if (!totalSummaryData || totalSummaryData.length === 0) return [];
      
      return totalSummaryData.map((item: TotalSummary) => ({
        class_name: item.class_name,
        teacher_name: item.teacher_name,
        count: item.total_score,
        label: `${item.class_name}-${item.teacher_name}`
      })).sort((a, b) => a.class_name.localeCompare(b.class_name));
    }
    
    // 其他类型使用checkInData - 直接获取对应类型的配置和数据
    const typeKey = currentType as keyof typeof checkInData;
    const data = checkInData[typeKey];
    
    if (!data || data.length === 0) return [];

    // 根据类型决定使用哪个计数字段
    const showEffective = currentType === 'lunch_break' || currentType === 'evening_break';

    return data.map((item: CheckInSummary) => ({
      class_name: item.class_name,
      teacher_name: item.teacher_name,
      count: showEffective ? item.effective_count : item.total_count,
      label: `${item.class_name}-${item.teacher_name}`
    })).sort((a, b) => a.class_name.localeCompare(b.class_name));
  }, [currentType, checkInData, totalSummaryData]);
  
  const config = typeConfig[currentType];
  
  // 检查是否有有效数据（是否所有数据都是0或负值）
  const hasValidData = chartData.length > 0 && chartData.some(item => item.count > 0);

  // 导出图表为图片 - 使用Canvas API手动绘制
  const exportChart = async () => {
    try {
      // 创建canvas
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // 设置canvas尺寸 - 增加高度以容纳图例
      const width = 1400;
      const height = 550; // 从500增加到550，确保图例不被裁剪
      canvas.width = width;
      canvas.height = height;

      // 填充白色背景
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);

      // 绘制标题
      ctx.fillStyle = '#111827';
      ctx.font = 'bold 24px "Microsoft YaHei", "PingFang SC", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      const titleY = 30;
      ctx.fillText(config.chartTitle, width / 2, titleY);

      // 绘制说明文字（在标题下方）
      if (config.chartDesc) {
        ctx.fillStyle = '#6b7280';
        ctx.font = '16px "Microsoft YaHei", "PingFang SC", sans-serif';
        ctx.fillText(config.chartDesc, width / 2, titleY + 32);
      }

      // 图表区域设置 - 减少上下边距，使图表区域更紧凑
      const chartTop = config.chartDesc ? 100 : 80;
      const chartBottom = height - 100; // 增加底部边距以容纳图例
      const chartLeft = 100;
      const chartRight = width - 60;
      const chartWidth = chartRight - chartLeft;
      const chartHeight = chartBottom - chartTop;

      // 计算数据范围
      const maxValue = Math.max(...chartData.map(d => d.count), 0);
      const minValue = Math.min(...chartData.map(d => d.count), 0);
      
      // 计算Y轴刻度，确保0总是作为一个刻度点（不使用放大系数）
      let yMin = minValue;
      let yMax = maxValue;
      
      // 如果有负值，确保0在刻度上
      if (minValue < 0 && maxValue > 0) {
        // 计算合适的刻度范围，使0成为刻度点
        const absMax = Math.max(Math.abs(minValue), Math.abs(maxValue));
        const step = Math.ceil(absMax / 5);
        yMin = -step * Math.ceil(Math.abs(minValue) / step);
        yMax = step * Math.ceil(Math.abs(maxValue) / step);
      } else if (minValue < 0) {
        // 全是负值
        yMax = 0;
        const step = Math.ceil(Math.abs(minValue) / 5);
        yMin = -step * Math.ceil(Math.abs(minValue) / step);
      } else {
        // 全是正值或0
        yMin = 0;
        const step = Math.ceil(maxValue / 5);
        yMax = step * Math.ceil(maxValue / step);
      }
      
      const dataRange = yMax - yMin;
      const yScale = dataRange > 0 ? chartHeight / dataRange : 1;

      // 绘制坐标轴
      ctx.strokeStyle = '#e5e7eb';
      ctx.lineWidth = 1;

      // Y轴网格线和刻度 - 确保0总是显示
      const ySteps = 5;
      const yStep = dataRange / ySteps;
      
      for (let i = 0; i <= ySteps; i++) {
        const value = yMin + yStep * i;
        const y = chartBottom - (value - yMin) * yScale;

        // 网格线
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(chartLeft, y);
        ctx.lineTo(chartRight, y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Y轴刻度标签
        const isZero = Math.abs(value) < 0.01;
        ctx.fillStyle = isZero ? '#ef4444' : '#666666';
        ctx.font = isZero ? 'bold 12px "Microsoft YaHei"' : '12px "Microsoft YaHei"';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        
        let labelText = '';
        if (isZero) {
          labelText = currentType === 'total_summary' ? '0分' : '0次';
        } else {
          labelText = Math.round(value).toString();
        }
        ctx.fillText(labelText, chartLeft - 10, y);
      }

      // 绘制0基线（红色虚线）
      if (yMin < 0 && yMax > 0) {
        const zeroY = chartBottom - (0 - yMin) * yScale;
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(chartLeft, zeroY);
        ctx.lineTo(chartRight, zeroY);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // 绘制柱状图 - 调整柱体宽度以匹配网页显示
      const barSpacing = chartWidth / chartData.length;
      const barWidth = barSpacing * 0.85; // 调整为0.85使柱体更宽，减小柱子间距

      chartData.forEach((item, index) => {
        const x = chartLeft + barSpacing * index + (barSpacing - barWidth) / 2;
        const barCenterX = x + barWidth / 2;
        const zeroY = chartBottom - (0 - yMin) * yScale;
        
        // 绘制竖向辅助虚线（从柱子中心到X轴）
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(barCenterX, chartTop);
        ctx.lineTo(barCenterX, chartBottom);
        ctx.stroke();
        ctx.setLineDash([]);
        
        if (item.count >= 0) {
          // 正值：从0基线向上
          const barHeight = item.count * yScale;
          const y = zeroY - barHeight;
          ctx.fillStyle = config.color;
          ctx.fillRect(x, y, barWidth, barHeight);
        } else {
          // 负值：从0基线向下
          const barHeight = Math.abs(item.count) * yScale;
          ctx.fillStyle = '#ef4444';
          ctx.fillRect(x, zeroY, barWidth, barHeight);
        }

        // 绘制X轴标签（旋转45度）
        ctx.save();
        ctx.translate(barCenterX, chartBottom + 10);
        ctx.rotate(-Math.PI / 4);
        ctx.fillStyle = '#666666';
        ctx.font = '12px "Microsoft YaHei", "PingFang SC", sans-serif';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillText(item.label, 0, 0);
        ctx.restore();
      });

      // 绘制图例
      const legendY = chartBottom + 90;
      const showDualLegend = currentType === 'lunch_break' || currentType === 'evening_break' || currentType === 'total_summary';

      if (showDualLegend) {
        const positiveLabel = currentType === 'total_summary' ? '量化分' : '有效次数';
        const negativeLabel = currentType === 'total_summary' ? '低于0分' : '低于0次';

        // 正值图例
        const legend1X = width / 2 - 80;
        ctx.fillStyle = config.color;
        ctx.fillRect(legend1X, legendY - 8, 16, 16);
        ctx.fillStyle = '#374151';
        ctx.font = '14px "Microsoft YaHei", "PingFang SC", sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(positiveLabel, legend1X + 24, legendY);

        // 负值图例
        const legend2X = width / 2 + 20;
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(legend2X, legendY - 8, 16, 16);
        ctx.fillStyle = '#374151';
        ctx.fillText(negativeLabel, legend2X + 24, legendY);
      } else {
        const labelText = config.showEffective ? '有效次数' : '签到次数';
        const legendX = width / 2 - 40;
        ctx.fillStyle = config.color;
        ctx.fillRect(legendX, legendY - 8, 16, 16);
        ctx.fillStyle = '#374151';
        ctx.font = '14px "Microsoft YaHei", "PingFang SC", sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(labelText, legendX + 24, legendY);
      }

      // 导出图片
      const link = document.createElement('a');
      link.download = `${config.label}_统计图表_${new Date().toLocaleDateString().replace(/\//g, '-')}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();

      toast.success('图表导出成功');
    } catch (error) {
      console.error('导出图表失败:', error);
      toast.error('导出图表失败');
    }
  };

  // 自定义Y轴刻度格式化
  const formatYAxisTick = (value: number) => {
    if (value === 0) {
      return currentType === 'total_summary' ? '0分' : '0次';
    }
    return value.toString();
  };

  // 自定义图例
  const CustomLegend = () => {
    // 只有午休、晚休、总量化统计显示双图例
    const showDualLegend = currentType === 'lunch_break' || currentType === 'evening_break' || currentType === 'total_summary';
    
    if (!showDualLegend) {
      // 其他类型显示单图例
      const labelText = config.showEffective ? '有效次数' : '签到次数';
      
      return (
        <div className="flex justify-center items-center gap-6 mt-4">
          <div className="flex items-center gap-2">
            <div 
              className="w-4 h-4 rounded" 
              style={{ backgroundColor: config.color }}
            />
            <span className="text-sm text-gray-700 align-middle">
              {labelText}
            </span>
          </div>
        </div>
      );
    }
    
    // 午休、晚休、总量化统计显示双图例
    const positiveLabel = currentType === 'total_summary' ? '量化分' : '有效次数';
    const negativeLabel = currentType === 'total_summary' ? '低于0分' : '低于0次';
    
    return (
      <div className="flex justify-center items-center gap-6 mt-4">
        <div className="flex items-center gap-2">
          <div 
            className="w-4 h-4 rounded" 
            style={{ backgroundColor: config.color }}
          />
          <span className="text-sm text-gray-700 align-middle">{positiveLabel}</span>
        </div>
        <div className="flex items-center gap-2">
          <div 
            className="w-4 h-4 rounded" 
            style={{ backgroundColor: '#ef4444' }}
          />
          <span className="text-sm text-gray-700 align-middle">{negativeLabel}</span>
        </div>
      </div>
    );
  };

  // 自定义Tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      
      // 根据当前类型显示不同的文本
      let displayText = '';
      if (currentType === 'total_summary') {
        displayText = `总量化分: ${data.count}分`;
      } else if (config.showEffective) {
        displayText = `有效次数: ${data.count}次`;
      } else {
        displayText = `签到次数: ${data.count}次`;
      }
      
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900">{data.label}</p>
          <p style={{ color: config.color }} className="text-sm mt-1">
            {displayText}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardContent className="pt-6">
        {!hasValidData ? (
          <div className="flex items-center justify-center h-64 text-gray-500">
            暂无{config.label}数据，请先在签到统计页面上传数据
          </div>
        ) : (
          <div ref={chartRef} className="w-full">
            {/* 图表标题和导出按钮 */}
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h3 className="text-xl font-semibold text-gray-900 text-center">
                  {config.chartTitle}
                </h3>
                {/* 说明文字或占位符，确保所有图表高度一致 */}
                <p className="text-sm text-gray-600 text-center mt-1 min-h-[20px]">
                  {config.chartDesc || '\u00A0'}
                </p>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={exportChart}
                className="ml-4 flex-shrink-0"
              >
                <Download className="h-4 w-4 mr-2" />
                导出图片
              </Button>
            </div>
            
            <ResponsiveContainer width="100%" height={400}>
              <BarChart
                key={currentType}
                data={chartData}
                margin={{
                  top: 20,
                  right: 30,
                  left: 20,
                  bottom: 60,
                }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="label" 
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  interval={0}
                  fontSize={12}
                />
                <YAxis 
                  tickFormatter={formatYAxisTick}
                  tick={(props) => {
                    const { x, y, payload } = props;
                    const isZero = payload.value === 0;
                    return (
                      <text 
                        x={x} 
                        y={y} 
                        dy={4} 
                        textAnchor="end" 
                        fill={isZero ? '#ef4444' : '#666'}
                        fontSize={12}
                        fontWeight={isZero ? 'bold' : 'normal'}
                      >
                        {formatYAxisTick(payload.value)}
                      </text>
                    );
                  }}
                />
                {/* 添加0基线参考线 - 不显示标签 */}
                <ReferenceLine 
                  y={0} 
                  stroke="#ef4444" 
                  strokeWidth={2} 
                  strokeDasharray="5 5"
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar 
                  dataKey="count" 
                  name={currentType === 'total_summary' ? '量化分' : (config.showEffective ? '有效次数' : '签到次数')}
                >
                  {chartData.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={entry.count <= 0 ? '#ef4444' : config.color}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            
            {/* 自定义图例 */}
            <CustomLegend />
          </div>
        )}
        
        {/* 签到类型切换按钮 */}
        <div className="flex justify-center gap-2 mt-6 flex-wrap">
          {(Object.keys(typeConfig) as TabType[]).map((type) => {
            const TypeIcon = typeConfig[type].icon;
            return (
              <Button
                key={type}
                variant={currentType === type ? 'default' : 'outline'}
                size="sm"
                onClick={() => onTypeChange(type)}
                className="flex items-center gap-2"
              >
                <TypeIcon className="h-4 w-4" />
                {typeConfig[type].label}
              </Button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
};

export default CheckInChart;