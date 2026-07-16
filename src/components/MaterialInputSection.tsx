import { useState, useMemo } from 'react';
import { toast } from 'sonner';
import { Eraser, Calculator as CalcIcon } from 'lucide-react';
import type { IMaterialItem } from '@/data/materials';
import { formatNumber, sumMaterials } from '@/lib/utils';

interface MaterialInputSectionProps {
  title: string;
  subtitle?: string;
  materials: IMaterialItem[];
  onChange: (materials: IMaterialItem[]) => void;
}

/**
 * 数字输入框（字符串状态 + 失焦转数值）
 * 解决输入 0 开头小数时 0 被吞掉的问题：
 * - 输入过程中用字符串保存原始输入（允许 "0." 等中间态）
 * - 失焦时才 parse 成数字同步给父组件
 */
function NumberInput({
  value,
  onChange,
  step = '1',
  placeholder = '0',
  className = '',
}: {
  value: number;
  onChange: (num: number) => void;
  step?: string;
  placeholder?: string;
  className?: string;
}) {
  // 本地字符串状态：输入过程中保留原始字符串（含 "0." 中间态）
  const [localValue, setLocalValue] = useState<string>(value === 0 ? '' : String(value));
  // 追踪是否正在编辑，编辑期间以 localValue 为准
  const [isEditing, setIsEditing] = useState(false);

  // 外部 value 变化且不在编辑中时，同步到本地
  useMemo(() => {
    if (!isEditing) {
      setLocalValue(value === 0 ? '' : String(value));
    }
  }, [value]);

  const displayValue = isEditing ? localValue : value === 0 ? '' : String(value);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    // 只允许数字和小数点
    if (raw !== '' && !/^\d*\.?\d*$/.test(raw)) {
      return;
    }
    setLocalValue(raw);
    setIsEditing(true);
  };

  const handleBlur = () => {
    setIsEditing(false);
    const trimmed = localValue.trim();
    if (trimmed === '' || trimmed === '.') {
      setLocalValue('');
      onChange(0);
      return;
    }
    const num = parseFloat(trimmed);
    if (isNaN(num) || num < 0) {
      setLocalValue('');
      onChange(0);
      return;
    }
    setLocalValue(String(num));
    onChange(num);
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      step={step}
      value={displayValue}
      onChange={handleChange}
      onBlur={handleBlur}
      onFocus={() => setIsEditing(true)}
      placeholder={placeholder}
      className={className}
    />
  );
}

export default function MaterialInputSection({
  title,
  subtitle,
  materials,
  onChange,
}: MaterialInputSectionProps) {
  const [showSummary, setShowSummary] = useState(false);

  const handlePriceChange = (index: number, num: number) => {
    const newMaterials = [...materials];
    newMaterials[index] = { ...newMaterials[index], price: num };
    onChange(newMaterials);
  };

  const handleQuantityChange = (index: number, num: number) => {
    const newMaterials = [...materials];
    newMaterials[index] = { ...newMaterials[index], quantity: num };
    onChange(newMaterials);
  };

  const handleClearPrices = () => {
    onChange(materials.map((m) => ({ ...m, price: 0 })));
    toast.success('已清空所有单价');
  };

  const handleClearQuantities = () => {
    onChange(materials.map((m) => ({ ...m, quantity: 0 })));
    toast.success('已清空所有数量');
  };

  const handleSummary = () => {
    setShowSummary(true);
    const total = sumMaterials(materials);
    toast.info(`${title}合计：${formatNumber(total)} 亿 ISK`);
  };

  const total = sumMaterials(materials);

  return (
    <div className="flex flex-col h-full">
      {/* 页面标题 */}
      <div className="px-4 pt-4 pb-3">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-[#A0A0A0]">{subtitle}</p>}
        {showSummary && (
          <div className="mt-3 rounded-lg bg-[#7C3AED]/15 border border-[#7C3AED]/30 px-4 py-2.5">
            <div className="text-xs text-[#A0A0A0]">当前合计</div>
            <div className="text-lg font-bold text-[#A78BFA] tabular-nums">
              {formatNumber(total)} <span className="text-sm font-normal">亿 ISK</span>
            </div>
          </div>
        )}
      </div>

      {/* 表头 */}
      <div className="px-4 pb-2">
        <div className="grid grid-cols-[1fr_90px_90px] gap-2 text-[11px] font-medium text-[#888888]">
          <div>材料名称</div>
          <div className="text-right">单价(ISK)</div>
          <div className="text-right">数量(个)</div>
        </div>
      </div>

      {/* 材料列表 */}
      <div className="flex-1 overflow-y-auto px-4 pb-40">
        <div className="space-y-2">
          {materials.map((item, index) => {
            const itemTotal = ((item.price || 0) * (item.quantity || 0)) / 100000000;
            return (
              <div
                key={item.name}
                className="rounded-lg bg-[#2C2C2C] border border-[#3A3A3A] px-3 py-2.5 transition-all hover:border-[#555555]"
              >
                <div className="grid grid-cols-[1fr_90px_90px] gap-2 items-center">
                  <div className="text-sm font-medium text-white truncate">{item.name}</div>
                  <NumberInput
                    value={item.price}
                    onChange={(num) => handlePriceChange(index, num)}
                    step="1"
                    placeholder="0"
                    className="w-full rounded-md border border-[#444444] bg-[#1E1E1E] px-2 py-1.5 text-right text-sm text-white placeholder-[#666666] outline-none transition-all focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/30 hover:border-[#666666]"
                  />
                  <NumberInput
                    value={item.quantity}
                    onChange={(num) => handleQuantityChange(index, num)}
                    step="1"
                    placeholder="0"
                    className="w-full rounded-md border border-[#444444] bg-[#1E1E1E] px-2 py-1.5 text-right text-sm text-white placeholder-[#666666] outline-none transition-all focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/30 hover:border-[#666666]"
                  />
                </div>
                <div className="mt-1.5 flex items-center justify-between text-[11px]">
                  <span className="text-[#888888]">单价：ISK/个 · 数量：个</span>
                  <span className="font-semibold text-[#A78BFA] tabular-nums">
                    {formatNumber(itemTotal)} 亿ISK
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 底部操作按钮 */}
      <div className="fixed bottom-16 left-0 right-0 border-t border-[#3A3A3A] bg-[#1E1E1E]/95 backdrop-blur-md px-4 py-3">
        <div className="mx-auto flex max-w-md gap-2">
          <button
            onClick={handleClearPrices}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#444444] bg-[#2C2C2C] px-2 py-2.5 text-xs font-medium text-white transition-all hover:border-[#666666] hover:bg-[#363636] active:scale-[0.98]"
          >
            <Eraser className="h-3.5 w-3.5" />
            清空单价
          </button>
          <button
            onClick={handleClearQuantities}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#444444] bg-[#2C2C2C] px-2 py-2.5 text-xs font-medium text-white transition-all hover:border-[#666666] hover:bg-[#363636] active:scale-[0.98]"
          >
            <Eraser className="h-3.5 w-3.5" />
            清空数量
          </button>
          <button
            onClick={handleSummary}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-[#7C3AED] px-2 py-2.5 text-xs font-medium text-white shadow-[0_2px_8px_rgba(124_58_237_0.3)] transition-all hover:bg-[#6D28D9] active:scale-[0.98]"
          >
            <CalcIcon className="h-3.5 w-3.5" />
            汇总总价
          </button>
        </div>
      </div>
    </div>
  );
}
