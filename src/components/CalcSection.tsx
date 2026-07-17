import { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Settings,
  BarChart3,
  Link2,
  Layers,
  Wrench,
  AlertTriangle,
} from 'lucide-react';
import type { ICalcParams, IPlanResult, PlanVariant } from '@/data/materials';
import { calculatePlans, formatNumber } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface CalcSectionProps {
  params: ICalcParams;
  onParamChange: <K extends keyof ICalcParams>(key: K, value: number) => void;
  /** 三页材料总价之和（自动联动） */
  linkedMaterialTotal: number;
}

const PARAM_FIELDS: {
  key: keyof ICalcParams;
  label: string;
  unit?: string;
  step?: string;
  placeholder?: string;
  linked?: boolean;
}[] = [
  { key: 'materialCost150', label: '150%效率市价材料成本', unit: '亿ISK', step: '0.0001', linked: true },
  { key: 'blueprintPrice', label: '蓝图市场采购价', unit: '亿ISK', step: '0.0001' },
  { key: 'fixedManufactureFee', label: '固定制造费', unit: '亿ISK', step: '0.0001' },
  { key: 'manufactureEfficiency', label: '当前制造效率', step: '0.01', placeholder: '默认 0.85' },
  { key: 'materialDiscount', label: '材料收购折扣', step: '0.01', placeholder: '默认 0.85' },
  { key: 'buyOrderPrice', label: '收购单标价', unit: '亿ISK', step: '0.0001' },
  { key: 'marketSellPrice', label: '市场挂单标价', unit: '亿ISK', step: '0.0001' },
  { key: 'marketTaxRate', label: '市场交易总税率', step: '0.001', placeholder: '默认 0.121' },
  { key: 'ownBlueprintDiscount', label: '自有蓝图折扣', step: '0.01', placeholder: '默认 0.8' },
];

/**
 * 数字输入框（字符串状态 + 失焦转数值）
 * 解决输入 0 开头小数时 0 被吞掉的问题
 */
function NumberInput({
  value,
  onChange,
  step = '0.01',
  placeholder = '',
  className = '',
}: {
  value: number;
  onChange: (num: number) => void;
  step?: string;
  placeholder?: string;
  className?: string;
}) {
  const [localValue, setLocalValue] = useState<string>(value === 0 ? '' : String(value));
  const [isEditing, setIsEditing] = useState(false);

  // 外部 value 变化且不在编辑中时同步
  useEffect(() => {
    if (!isEditing) {
      setLocalValue(value === 0 ? '' : String(value));
    }
  }, [value, isEditing]);

  const displayValue = isEditing ? localValue : value === 0 ? '' : String(value);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
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

function ProfitBadge({ value }: { value: number }) {
  const isPositive = value > 0;
  const isNegative = value < 0;
  const color = isPositive ? 'text-[#22C55E]' : isNegative ? 'text-[#EF4444]' : 'text-[#888888]';
  const bgColor = isPositive
    ? 'bg-[#22C55E]/15 border-[#22C55E]/30'
    : isNegative
      ? 'bg-[#EF4444]/15 border-[#EF4444]/30'
      : 'bg-[#888888]/15 border-[#888888]/30';
  const Icon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus;

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold tabular-nums',
        bgColor,
        color,
      )}
    >
      <Icon className="h-3 w-3" />
      {isPositive ? '+' : ''}
      {formatNumber(value)}
    </div>
  );
}

function VariantRow({ variant }: { variant: PlanVariant }) {
  return (
    <div className="rounded-lg bg-[#1E1E1E]/80 border border-[#3A3A3A] p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-[#A78BFA]">{variant.variantName}</span>
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-[#888888]">材料成本</span>
          <span className="font-medium text-[#A0A0A0] tabular-nums">
            {formatNumber(variant.materialCost)}
          </span>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-[#888888]">总制造成本</span>
          <span className="font-semibold text-white tabular-nums">
            {formatNumber(variant.totalCost)}
          </span>
        </div>
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-2">
        <div className="flex flex-col items-start gap-1">
          <span className="text-[10px] text-[#666666]">收购利润</span>
          <ProfitBadge value={variant.buyOrderProfit} />
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className="text-[10px] text-[#666666]">挂单利润</span>
          <ProfitBadge value={variant.marketSellProfit} />
        </div>
      </div>
    </div>
  );
}

function PlanCard({ plan, highlighted }: { plan: IPlanResult; highlighted?: boolean }) {
  return (
    <div
      className={cn(
        'rounded-xl border bg-[#2C2C2C] p-4 shadow-[0_2px_8px_rgba(0_0_0_0.2)] transition-all',
        highlighted
          ? 'border-[#7C3AED] shadow-[0_0_12px_rgba(124_58_237_0.2)]'
          : 'border-[#3A3A3A] hover:border-[#7C3AED]/40',
      )}
    >
      <div className="mb-3">
        <h3 className="text-sm font-bold text-white">{plan.planName}</h3>
        <p className="mt-0.5 text-[11px] text-[#A0A0A0] leading-snug">{plan.planDesc}</p>
      </div>

      <div className="space-y-2">
        {plan.variants.map((v) => (
          <VariantRow key={v.variantName} variant={v} />
        ))}
      </div>
    </div>
  );
}

export default function CalcSection({ params, onParamChange, linkedMaterialTotal }: CalcSectionProps) {
  const plans = useMemo(() => calculatePlans(params), [params]);

  // 材料成本计算
  const baseMaterial = params.materialCost150 / 1.5;
  const actualMaterialCost = baseMaterial * params.manufactureEfficiency * params.materialDiscount;

  const handleParamChange = (key: keyof ICalcParams, num: number) => {
    onParamChange(key, num);
  };

  return (
    <div className="h-full overflow-y-auto pb-24">
      {/* 联动提示条 */}
      <div className="mx-4 mt-4 flex items-center gap-2 rounded-lg border border-[#7C3AED]/30 bg-[#7C3AED]/10 px-3 py-2">
        <Link2 className="h-4 w-4 shrink-0 text-[#A78BFA]" />
        <div className="text-xs text-[#A0A0A0]">
          材料录入页总价已自动同步至「150%效率市价材料成本」
          <span className="ml-1 font-semibold text-[#A78BFA] tabular-nums">
            {formatNumber(linkedMaterialTotal)} 亿ISK
          </span>
        </div>
      </div>

      {/* 参数设置卡片 */}
      <div className="px-4 pt-4">
        <div className="rounded-xl border border-[#3A3A3A] bg-[#2C2C2C] shadow-[0_2px_8px_rgba(0_0_0_0.2)]">
          <div className="flex items-center gap-2 border-b border-[#3A3A3A] px-4 py-3">
            <Settings className="h-4 w-4 text-[#7C3AED]" />
            <h2 className="text-sm font-semibold text-white">参数设置</h2>
          </div>
          <div className="p-4 space-y-3">
            {PARAM_FIELDS.map((field) => (
              <div key={field.key} className="flex items-center gap-3">
                <label className="flex-1 text-xs text-[#A0A0A0] truncate flex items-center gap-1">
                  {field.linked && <Link2 className="h-3 w-3 text-[#A78BFA] shrink-0" />}
                  {field.label}
                </label>
                <div className="flex items-center gap-1.5">
                  <NumberInput
                    value={params[field.key]}
                    onChange={(num) => handleParamChange(field.key, num)}
                    step={field.step || '0.01'}
                    placeholder={field.placeholder}
                    className={cn(
                      'w-28 rounded-md border px-3 py-1.5 text-right text-sm text-white placeholder-[#666666] outline-none transition-all focus:ring-2 hover:border-[#666666] tabular-nums',
                      field.linked
                        ? 'border-[#7C3AED]/50 bg-[#7C3AED]/10 focus:border-[#7C3AED] focus:ring-[#7C3AED]/30'
                        : 'border-[#444444] bg-[#1E1E1E] focus:border-[#7C3AED] focus:ring-[#7C3AED]/30',
                    )}
                  />
                  {field.unit && (
                    <span className="text-xs text-[#888888] w-10 text-right">{field.unit}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 材料成本展示区 */}
      <div className="px-4 pt-4">
        <div className="rounded-xl border border-[#3A3A3A] bg-[#2C2C2C] shadow-[0_2px_8px_rgba(0_0_0_0.2)]">
          <div className="flex items-center gap-2 border-b border-[#3A3A3A] px-4 py-3">
            <Layers className="h-4 w-4 text-[#7C3AED]" />
            <h2 className="text-sm font-semibold text-white">材料成本</h2>
            <span className="text-[11px] text-[#888888]">（不含蓝图与制造费）</span>
          </div>
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-[#1E1E1E]/60 border border-[#3A3A3A] px-4 py-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-[#F59E0B]" />
                <span className="text-sm text-[#A0A0A0]">白板基准材料总价</span>
              </div>
              <span className="text-base font-bold text-white tabular-nums">
                {formatNumber(baseMaterial)}
                <span className="ml-1 text-xs font-normal text-[#888888]">亿ISK</span>
              </span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-[#7C3AED]/10 border border-[#7C3AED]/30 px-4 py-3">
              <div className="flex items-center gap-2">
                <Wrench className="h-4 w-4 text-[#A78BFA]" />
                <span className="text-sm text-[#A0A0A0]">当前材料实际成本</span>
              </div>
              <span className="text-base font-bold text-[#A78BFA] tabular-nums">
                {formatNumber(actualMaterialCost)}
                <span className="ml-1 text-xs font-normal text-[#888888]">亿ISK</span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 计算结果 */}
      <div className="px-4 pt-5">
        <div className="mb-3 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-[#7C3AED]" />
          <h2 className="text-sm font-semibold text-white">计算结果 · 三方案对比</h2>
        </div>
        <div className="grid grid-cols-1 gap-3">
          {plans.map((plan, idx) => (
            <PlanCard key={plan.planName} plan={plan} highlighted={idx === 2} />
          ))}
        </div>
      </div>

      {/* 计算公式说明 */}
      <div className="px-4 pt-5 pb-4">
        <div className="rounded-xl border border-[#3A3A3A] bg-[#2C2C2C]/50 p-4">
          <h3 className="text-xs font-semibold text-[#A0A0A0] mb-2">计算逻辑说明</h3>
          <ul className="space-y-1 text-[11px] text-[#888888] leading-relaxed">
            <li>• 白板基准材料 = 150%效率材料 ÷ 1.5</li>
            <li>• 实际材料成本 = 白板 × 制造效率 × 材料折扣</li>
            <li>• 总制造成本 = 材料成本 + 蓝图成本 + 固定制造费</li>
            <li>• 方案1/2：扣市场 {formatNumber(params.marketTaxRate * 100, 1)}% 交易税</li>
            <li>• 方案3：无交易税（仅参考）</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
