import { useMemo } from 'react';
import { Link2, Settings, TrendingUp, TrendingDown, Minus, ArrowRight, Info } from 'lucide-react';
import { cn, formatNumber, calculatePlans, type PlanResult } from '@/lib/utils';
import type { ICalcParams } from '@/data/materials';

interface CalcSectionProps {
  params: ICalcParams;
  onParamChange: <K extends keyof ICalcParams>(key: K, value: number) => void;
  linkedMaterialTotal: number;
}

/**
 * 数字输入框（字符串状态 + 失焦转数值）
 * 解决输入 0 开头小数时 0 被吞掉的问题
 */
function NumberInput({
  value,
  onChange,
  step = '0.01',
  placeholder = '0',
  className = '',
}: {
  value: number;
  onChange: (num: number) => void;
  step?: string;
  placeholder?: string;
  className?: string;
}) {
  const displayValue = value === 0 ? '' : String(value);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw !== '' && !/^\d*\.?\d*$/.test(raw)) return;
    if (raw === '' || raw === '.') {
      onChange(0);
      return;
    }
    const num = parseFloat(raw);
    if (!isNaN(num) && num >= 0) {
      onChange(num);
    }
  };

  return (
    <input
      type="text"
      inputMode="decimal"
      step={step}
      value={displayValue}
      onChange={handleChange}
      placeholder={placeholder}
      className={className}
    />
  );
}

interface ParamField {
  key: keyof ICalcParams;
  label: string;
  unit: string;
  step?: string;
  placeholder?: string;
  linked?: boolean;
}

const PARAM_FIELDS: ParamField[] = [
  { key: 'materialCost150', label: '150%效率市价材料成本', unit: '亿ISK', linked: true },
  { key: 'blueprintPrice', label: '蓝图参考价', unit: '亿ISK' },
  { key: 'fixedManufactureFee', label: '固定制造费', unit: '亿ISK' },
  { key: 'efficiency', label: '效率(0~1)', unit: '', step: '0.01', placeholder: '0.8' },
  { key: 'discount', label: '折扣(0~1)', unit: '', step: '0.01', placeholder: '0.9' },
  { key: 'taxRate', label: '税率(0~1)', unit: '', step: '0.01', placeholder: '0.02' },
  { key: 'buyOrderPrice', label: '买单价', unit: '亿ISK' },
  { key: 'marketSellPrice', label: '市场卖价', unit: '亿ISK' },
  { key: 'freightCost', label: '运费', unit: '亿ISK', step: '0.1' },
  { key: 'otherCost', label: '其他费用', unit: '亿ISK', step: '0.1' },
];

/** 利润指示器颜色 */
function ProfitBadge({ profit }: { profit: number }) {
  if (profit > 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-[#22C55E]/15 text-[#22C55E] border border-[#22C55E]/30 w-full justify-center">
        <TrendingUp className="h-3 w-3" />
        +{formatNumber(profit)}%
      </span>
    );
  }
  if (profit < 0) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-[#EF4444]/15 text-[#EF4444] border border-[#EF4444]/30 w-full justify-center">
        <TrendingDown className="h-3 w-3" />
        {formatNumber(profit)}%
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-[#888888]/15 text-[#888888] border border-[#888888]/30 w-full justify-center">
      <Minus className="h-3 w-3" />
      0%
    </span>
  );
}

/** 单行方案卡片 — 显示方案说明、利润、成本明细 */
function VariantRow({
  label,
  subtitle,
  result,
}: {
  label: string;
  subtitle: string;
  result: PlanResult;
}) {
  return (
    <div className="rounded-lg bg-[#1E1E1E] border border-[#3A3A3A] p-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white">{label}</span>
            <span className="text-[10px] text-[#666]">{subtitle}</span>
          </div>
        </div>
      </div>
      <div className="space-y-1">
        <div className="flex justify-between text-[11px]">
          <span className="text-[#888]">利润</span>
          <span className="font-medium text-white tabular-nums">
            {formatNumber(result.profit)} 亿ISK
          </span>
        </div>
        <div className="flex justify-between text-[11px]">
          <span className="text-[#888]">利润率</span>
          <div className="w-28">
            <ProfitBadge profit={result.profitRate} />
          </div>
        </div>
      </div>
      <details className="group">
        <summary className="flex cursor-pointer items-center gap-1 text-[10px] text-[#666] hover:text-[#888] transition-colors">
          <Info className="h-3 w-3" />
          成本明细
          <ArrowRight className="h-3 w-3 ml-auto transition-transform group-open:rotate-90" />
        </summary>
        <div className="mt-1.5 space-y-1 text-[11px]">
          <div className="flex justify-between">
            <span className="text-[#888]">制造成本</span>
            <span className="text-white tabular-nums">{formatNumber(result.manufacturingCost)} 亿ISK</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#888]">买单价</span>
            <span className="text-white tabular-nums">{formatNumber(result.buyOrderPrice)} 亿ISK</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#888]">运费</span>
            <span className="text-white tabular-nums">{formatNumber(result.freightCost)} 亿ISK</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#888]">其他费用</span>
            <span className="text-white tabular-nums">{formatNumber(result.otherCost)} 亿ISK</span>
          </div>
          <div className="flex justify-between border-t border-[#3A3A3A] pt-1">
            <span className="text-[#888]">总成本</span>
            <span className="font-medium text-white tabular-nums">{formatNumber(result.totalCost)} 亿ISK</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#888]">市场卖价</span>
            <span className="text-white tabular-nums">{formatNumber(result.marketSellPrice)} 亿ISK</span>
          </div>
        </div>
      </details>
    </div>
  );
}

/** 总利润卡片 */
function PlanCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[#3A3A3A] bg-[#2C2C2C] shadow-[0_2px_8px_rgba(0_0_0_0.2)]">
      <div className="border-b border-[#3A3A3A] px-4 py-3">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <p className="text-xs text-[#888] mt-0.5">{subtitle}</p>
      </div>
      <div className="p-4 space-y-3">
        {children}
      </div>
    </div>
  );
}

export default function CalcSection({ params, onParamChange: handleParamChange, linkedMaterialTotal }: CalcSectionProps) {
  // 计算三种方案的结果
  const { manufacturing, buyOrder, taxOptimized } = useMemo(
    () => calculatePlans(params),
    [params],
  );

  return (
    <div className="h-full overflow-y-auto pb-24">
      {/* 联动提示条 */}
      <div className="mx-4 mt-4 flex items-start sm:items-center gap-2 rounded-lg border border-[#7C3AED]/30 bg-[#7C3AED]/10 px-3 py-2.5 sm:py-2">
        <Link2 className="h-4 w-4 shrink-0 mt-0.5 sm:mt-0 text-[#A78BFA]" />
        <div className="text-[11px] sm:text-xs text-[#A0A0A0] leading-tight">
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
          <div className="p-3 sm:p-4 space-y-2.5 sm:space-y-3">
            {PARAM_FIELDS.map((field) => (
              <div key={field.key} className="flex items-center gap-2 sm:gap-3">
                <label className="flex-1 text-[11px] sm:text-xs text-[#A0A0A0] truncate flex items-center gap-1">
                  {field.linked && <Link2 className="h-3 w-3 text-[#A78BFA] shrink-0" />}
                  {field.label}
                </label>
                <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
                  <NumberInput
                    value={params[field.key]}
                    onChange={(num) => handleParamChange(field.key, num)}
                    step={field.step || '0.01'}
                    placeholder={field.placeholder}
                    className={cn(
                      'w-24 sm:w-28 rounded-md border px-2 sm:px-3 py-2 sm:py-1.5 text-right text-sm text-white placeholder-[#666666] outline-none transition-all focus:ring-2 hover:border-[#666666] tabular-nums',
                      field.linked
                        ? 'border-[#7C3AED]/50 bg-[#7C3AED]/10 focus:border-[#7C3AED] focus:ring-[#7C3AED]/30'
                        : 'border-[#444444] bg-[#1E1E1E] focus:border-[#7C3AED] focus:ring-[#7C3AED]/30',
                    )}
                  />
                  {field.unit && (
                    <span className="text-[10px] sm:text-xs text-[#888888] w-8 sm:w-10 text-right shrink-0">{field.unit}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 计算结果区域 */}
      <div className="px-4 pt-4 space-y-4">
        <PlanCard title="制造成品方案" subtitle="按制造成本 + 运费 + 其他费用计算">
          <VariantRow label="制造成品" subtitle="综合方案" result={manufacturing} />
        </PlanCard>

        <PlanCard title="买单倒卖方案" subtitle="按买单价 + 运费 + 其他费用计算">
          <VariantRow label="买单倒卖" subtitle="市价方案" result={buyOrder} />
        </PlanCard>

        <PlanCard title="税收优化方案" subtitle="按市场卖价分段税优化计算">
          <VariantRow label="税收优化" subtitle="分段方案" result={taxOptimized} />
        </PlanCard>
      </div>

      {/* 计算结果说明 */}
      <div className="px-4 pt-4 pb-6">
        <div className="rounded-lg border border-[#3A3A3A] bg-[#2C2C2C] p-3 text-[11px] text-[#888] space-y-1">
          <p>利润 = 市场卖价 - 总成本</p>
          <p>利润率 = (利润 / 总成本) × 100%</p>
          <p>税收优化方案按市场卖价计算分段税率</p>
        </div>
      </div>
    </div>
  );
}
