import { useState, useEffect, useMemo } from 'react';
import { NumberInput } from '@/components/shared/NumberInput';
import {
  TrendingUp, TrendingDown, Minus, Settings, BarChart3, Link2, Layers, Wrench, AlertTriangle,
  Trophy, Building2,
} from 'lucide-react';
import type { ICalcParams, IPlanResult, PlanVariant } from '@/data/materials';
import { calculatePlans, formatNumber } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { CORP_MODULES, CORP_TECHS, fetchIndustrySkills, type EchoesIndustrySkill, toSkillChineseName } from '@/lib/echoes-api';

interface CalcSectionProps {
  params: ICalcParams;
  onParamChange: <K extends keyof ICalcParams>(key: K, value: number) => void;
  linkedMaterialTotal: number;
}

const PARAM_FIELDS: {
  key: keyof ICalcParams;
  label: string;
  unit?: string;
  step?: string;
  placeholder?: string;
  linked?: boolean;
  readOnly?: boolean;
}[] = [
  { key: 'materialCost150', label: '150%效率市价材料成本', unit: '亿ISK', step: '0.0001', linked: true },
  { key: 'blueprintPrice', label: '蓝图市场采购价', unit: '亿ISK', step: '0.0001' },
  { key: 'fixedManufactureFee', label: '固定制造费', unit: '亿ISK', step: '0.0001' },
  { key: 'manufactureEfficiency', label: '当前制造效率', step: '0.01', placeholder: '受技能/军团影响', readOnly: true },
  { key: 'materialDiscount', label: '材料收购折扣', step: '0.01', placeholder: '默认 0.85' },
  { key: 'buyOrderPrice', label: '收购单标价', unit: '亿ISK', step: '0.0001' },
  { key: 'marketSellPrice', label: '市场挂单标价', unit: '亿ISK', step: '0.0001' },
  { key: 'marketTaxRate', label: '市场交易总税率', step: '0.001', placeholder: '默认 0.121' },
  { key: 'ownBlueprintDiscount', label: '自有蓝图折扣', step: '0.01', placeholder: '默认 0.8' },
];

/** 从 localStorage 读取技能配置 */
function loadUserSkills(): Record<string, number> {
  try {
    const raw = localStorage.getItem('eve_echoes_skills_v1');
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

/** 从 localStorage 读取军团配置 */
function loadCorpConfig(): { modules: Record<string, number>; techs: Record<string, number> } {
  try {
    const raw = localStorage.getItem('eve_echoes_corp_v1');
    if (raw) {
      const data = JSON.parse(raw);
      return { modules: data.modules || {}, techs: data.techs || {} };
    }
  } catch { /* ignore */ }
  return { modules: {}, techs: {} };
}

/** 计算军团总材料效率加成（正数=减少的百分比） */
function calcCorpMEBonus(corp: ReturnType<typeof loadCorpConfig>): number {
  let bonus = 0;
  for (const mod of CORP_MODULES) {
    const lv = corp.modules[mod.name] || 0;
    bonus += mod.meBonusPerLevel * lv;
  }
  for (const tech of CORP_TECHS) {
    const lv = corp.techs[tech.name] || 0;
    bonus += tech.meBonusPerLevel * lv;
  }
  return bonus;
}

/** 计算军团总时间效率加成（负数=减少的时间百分比） */
function calcCorpTEBonus(_corp: ReturnType<typeof loadCorpConfig>): number {
  return 0; // 时间加成暂未使用
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
    <div className={cn('inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold tabular-nums', bgColor, color)}>
      <Icon className="h-3 w-3" />
      {isPositive ? '+' : ''}{formatNumber(value)}
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
          <span className="font-medium text-[#A0A0A0] tabular-nums">{formatNumber(variant.materialCost)}</span>
        </div>
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-[#888888]">总制造成本</span>
          <span className="font-semibold text-white tabular-nums">{formatNumber(variant.totalCost)}</span>
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
    <div className={cn('rounded-xl border bg-[#2C2C2C] p-4 shadow-[0_2px_8px_rgba(0_0_0_0.2)] transition-all',
      highlighted ? 'border-[#7C3AED] shadow-[0_0_12px_rgba(124_58_237_0.2)]' : 'border-[#3A3A3A] hover:border-[#7C3AED]/40')}>
      <div className="mb-3">
        <h3 className="text-sm font-bold text-white">{plan.planName}</h3>
        <p className="mt-0.5 text-[11px] text-[#A0A0A0] leading-snug">{plan.planDesc}</p>
      </div>
      <div className="space-y-2">
        {plan.variants.map((v) => <VariantRow key={v.variantName} variant={v} />)}
      </div>
    </div>
  );
}

export default function CalcSection({ params, onParamChange, linkedMaterialTotal }: CalcSectionProps) {
  // 技能和军团数据
  const [apiSkills, setApiSkills] = useState<EchoesIndustrySkill[]>([]);
  const [userSkills, setUserSkills] = useState<Record<string, number>>({});
  const [corpConfig, setCorpConfig] = useState<ReturnType<typeof loadCorpConfig>>({ modules: {}, techs: {} });
  const [skillME, setSkillME] = useState(0);
  const [corpME, setCorpME] = useState(0);
  const [configuredCount, setConfiguredCount] = useState(0);

  // 加载数据
  useEffect(() => {
    fetchIndustrySkills().then(setApiSkills).catch(() => {});
  }, []);

  // 监听 localStorage 变化（其他Tab页修改技能/军团后自动刷新）
  useEffect(() => {
    const handler = () => {
      const skills = loadUserSkills();
      const corp = loadCorpConfig();
      setUserSkills(skills);
      setCorpConfig(corp);
    };
    window.addEventListener('storage', handler);
    // 首次加载
    handler();
    return () => window.removeEventListener('storage', handler);
  }, [apiSkills]);

  // 计算技能ME（取所有已配置技能的最大ME，即最负值）
  useEffect(() => {
    if (apiSkills.length === 0) return;
    let bestME = 0;
    let count = 0;
    Object.entries(userSkills).forEach(([name, level]) => {
      if (level > 0) {
        count++;
        // 用技能英文名查找API数据
        const zhName = toSkillChineseName(name);
        // 查找API中匹配的技能
        const apiSkill = apiSkills.find((s) => s.name === name || s.name === zhName);
        if (apiSkill && level <= apiSkill.efficiencyPerLevel.length) {
          const me = -(apiSkill.efficiencyPerLevel[level - 1] || 0) / 100;
          if (me < bestME) bestME = me; // 取最大减免
        }
      }
    });
    setSkillME(bestME);
    setConfiguredCount(count);
  }, [userSkills, apiSkills]);

  // 计算军团ME
  useEffect(() => {
    setCorpME(calcCorpMEBonus(corpConfig) / 100);
  }, [corpConfig]);

  // 计算综合效率并同步到 manufactureEfficiency
  useEffect(() => {
    // 基础效率0.85 + 技能加成 + 军团加成
    const base = 0.85;
    const total = Math.max(0.1, Math.min(1.0, base + skillME + corpME));
    // 保留3位小数避免精度问题导致无限循环
    const rounded = Math.round(total * 1000) / 1000;
    if (Math.abs(params.manufactureEfficiency - rounded) > 0.0005) {
      onParamChange('manufactureEfficiency', rounded);
    }
  }, [skillME, corpME]);

  const plans = useMemo(() => calculatePlans(params), [params]);
  const baseMaterial = params.materialCost150 / 1.5;
  const actualMaterialCost = baseMaterial * params.manufactureEfficiency * params.materialDiscount;

  const handleParamChange = (key: keyof ICalcParams, num: number) => onParamChange(key, num);

  return (
    <div className="h-full overflow-y-auto pb-24 md:pb-6">
      {/* 技能/军团结成状态指示器 */}
      <div className="mx-4 mt-4 flex items-center gap-2 rounded-lg border border-[#7C3AED]/30 bg-[#7C3AED]/10 px-3 py-2">
        <Link2 className="h-4 w-4 shrink-0 text-[#A78BFA]" />
        <div className="text-xs text-[#A0A0A0]">
          材料录入页总价已自动同步至「150%效率市价材料成本」
          <span className="ml-1 font-semibold text-[#A78BFA] tabular-nums">{formatNumber(linkedMaterialTotal)} 亿ISK</span>
        </div>
      </div>

      {/* 技能和军团结成加成面板 */}
      <div className="px-4 pt-3">
        <div className="rounded-xl border border-[#3A3A3A] bg-[#2C2C2C] overflow-hidden">
          <div className="flex items-center gap-2 border-b border-[#3A3A3A] px-4 py-3">
            <Trophy className="h-4 w-4 text-[#F59E0B]" />
            <Building2 className="h-4 w-4 text-[#06B6D4]" />
            <h2 className="text-sm font-semibold text-white">技能与军团结成</h2>
          </div>
          <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* 技能加成 */}
            <div className="rounded-lg bg-[#1E1E1E] border border-[#3A3A3A] px-3 py-2.5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-[#888888] flex items-center gap-1">
                  <Trophy className="h-3 w-3 text-[#F59E0B]" />
                  技能加成
                </span>
                <span className="text-[10px] text-[#666666]">已配置 {configuredCount} 项</span>
              </div>
              <div className="text-lg font-bold tabular-nums" style={{ color: skillME < 0 ? '#22C55E' : '#888888' }}>
                {skillME < 0 ? '' : ''}{(skillME * 100).toFixed(0)}%
              </div>
              <div className="text-[10px] text-[#666666]">材料效率</div>
            </div>
            {/* 军团加成 */}
            <div className="rounded-lg bg-[#1E1E1E] border border-[#3A3A3A] px-3 py-2.5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-[#888888] flex items-center gap-1">
                  <Building2 className="h-3 w-3 text-[#06B6D4]" />
                  军团加成
                </span>
                {corpME > 0 && <span className="text-[10px] text-[#06B6D4]">已启用</span>}
              </div>
              <div className="text-lg font-bold tabular-nums" style={{ color: corpME > 0 ? '#06B6D4' : '#888888' }}>
                {corpME > 0 ? '-' : ''}{(corpME * 100).toFixed(0)}%
              </div>
              <div className="text-[10px] text-[#666666]">材料效率</div>
            </div>
            {/* 综合效率 */}
            <div className="rounded-lg bg-[#7C3AED]/10 border border-[#7C3AED]/30 px-3 py-2.5">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] text-[#888888]">综合制造效率</span>
              </div>
              <div className="text-lg font-bold text-[#A78BFA] tabular-nums">
                {(params.manufactureEfficiency * 100).toFixed(1)}%
              </div>
              <div className="text-[10px] text-[#666666]">基础85% + 技能{(skillME*100).toFixed(0)}% + 军团{corpME > 0 ? '' : ''}{(corpME*100).toFixed(0)}%</div>
            </div>
          </div>
        </div>
      </div>

      {/* 参数设置 */}
      <div className="px-4 pt-4">
        <div className="rounded-xl border border-[#3A3A3A] bg-[#2C2C2C] shadow-[0_2px_8px_rgba(0_0_0_0.2)]">
          <div className="flex items-center gap-2 border-b border-[#3A3A3A] px-4 py-3">
            <Settings className="h-4 w-4 text-[#7C3AED]" />
            <h2 className="text-sm font-semibold text-white">参数设置</h2>
          </div>
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
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
                      field.readOnly
                        ? 'border-[#7C3AED]/50 bg-[#7C3AED]/10 text-[#A78BFA] cursor-not-allowed'
                        : field.linked
                          ? 'border-[#7C3AED]/50 bg-[#7C3AED]/10 focus:border-[#7C3AED] focus:ring-[#7C3AED]/30'
                          : 'border-[#444444] bg-[#1E1E1E] focus:border-[#7C3AED] focus:ring-[#7C3AED]/30',
                    )}
                  />
                  {field.unit && <span className="text-xs text-[#888888] w-10 text-right">{field.unit}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 材料成本 */}
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
              <span className="text-base font-bold text-white tabular-nums">{formatNumber(baseMaterial)}<span className="ml-1 text-xs font-normal text-[#888888]">亿ISK</span></span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-[#7C3AED]/10 border border-[#7C3AED]/30 px-4 py-3">
              <div className="flex items-center gap-2">
                <Wrench className="h-4 w-4 text-[#A78BFA]" />
                <span className="text-sm text-[#A0A0A0]">当前材料实际成本</span>
              </div>
              <span className="text-base font-bold text-[#A78BFA] tabular-nums">{formatNumber(actualMaterialCost)}<span className="ml-1 text-xs font-normal text-[#888888]">亿ISK</span></span>
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {plans.map((plan, idx) => <PlanCard key={plan.planName} plan={plan} highlighted={idx === 2} />)}
        </div>
      </div>

      <div className="px-4 pt-5 pb-4">
        <div className="rounded-xl border border-[#3A3A3A] bg-[#2C2C2C]/50 p-4">
          <h3 className="text-xs font-semibold text-[#A0A0A0] mb-2">计算逻辑说明</h3>
          <ul className="space-y-1 text-[11px] text-[#888888] leading-relaxed">
            <li>• 白板基准材料 = 150%效率材料 ÷ 1.5</li>
            <li>• 综合效率 = 基础85% + 技能加成 + 军团加成（在「技能」和「军团」页配置）</li>
            <li>• 实际材料成本 = 白板 × 综合效率 × 材料折扣</li>
            <li>• 总制造成本 = 材料成本 + 蓝图成本 + 固定制造费</li>
            <li>• 方案1/2：扣市场 {formatNumber(params.marketTaxRate * 100, 1)}% 交易税</li>
            <li>• 方案3：无交易税（仅参考）</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
