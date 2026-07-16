import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import type { ICalcParams, IPlanResult, IMaterialItem } from '@/data/materials';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 计算四方案成本与利润
 * 严格保持原始计算逻辑：
 *
 * 基础公式：
 * - 白板基准材料总价 = 150%效率市价材料成本 ÷ 1.5
 * - 当前材料实际成本 = 白板基准材料总价 × 当前制造效率 × 材料收购折扣
 *
 * 方案1：蓝图市场购买 · 扣市场交易税
 *   总制造成本 = 材料实际成本 + 蓝图市场采购价 + 固定制造费
 *   利润 = 售价 × (1 - 市场交易总税率) - 总制造成本
 *
 * 方案2：自有折扣蓝图 · 扣市场交易税
 *   总制造成本 = 材料实际成本 + 蓝图市场采购价 × 自有蓝图折扣 + 固定制造费
 *   利润 = 售价 × (1 - 市场交易总税率) - 总制造成本
 *
 * 方案3：无任何交易税（仅参考）
 *   - 蓝图市场采购：利润 = 售价 - (材料实际成本 + 蓝图 + 制造费)
 *   - 自有折扣蓝图：利润 = 售价 - (材料实际成本 + 蓝图×折扣 + 制造费)
 *
 * 方案4：私人合同（固定扣5%税率）
 *   - 蓝图市场采购：利润 = 售价 × 0.95 - (材料实际成本 + 蓝图 + 制造费)
 *   - 自有折扣蓝图：利润 = 售价 × 0.95 - (材料实际成本 + 蓝图×折扣 + 制造费)
 */
export function calculatePlans(params: ICalcParams): IPlanResult[] {
  const {
    materialCost150,
    blueprintPrice,
    fixedManufactureFee,
    manufactureEfficiency,
    materialDiscount,
    buyOrderPrice,
    marketSellPrice,
    marketTaxRate,
    ownBlueprintDiscount,
  } = params;

  // 白板基准材料总价
  const baseMaterial = materialCost150 / 1.5;
  // 当前材料实际成本
  const actualMaterialCost = baseMaterial * manufactureEfficiency * materialDiscount;

  // 蓝图市场采购的总成本
  const totalCostMarket = actualMaterialCost + blueprintPrice + fixedManufactureFee;
  // 自有折扣蓝图的总成本
  const totalCostOwn = actualMaterialCost + blueprintPrice * ownBlueprintDiscount + fixedManufactureFee;

  // 扣市场交易税后的收入
  const buyOrderAfterMarketTax = buyOrderPrice * (1 - marketTaxRate);
  const sellAfterMarketTax = marketSellPrice * (1 - marketTaxRate);

  return [
    {
      planName: '方案 1',
      planDesc: '蓝图市场购买 · 扣市场交易税',
      variants: [
        {
          variantName: '蓝图市场采购',
          materialCost: actualMaterialCost,
          totalCost: totalCostMarket,
          buyOrderProfit: buyOrderAfterMarketTax - totalCostMarket,
          marketSellProfit: sellAfterMarketTax - totalCostMarket,
        },
      ],
    },
    {
      planName: '方案 2',
      planDesc: '自有折扣蓝图 · 扣市场交易税',
      variants: [
        {
          variantName: '自有折扣蓝图',
          materialCost: actualMaterialCost,
          totalCost: totalCostOwn,
          buyOrderProfit: buyOrderAfterMarketTax - totalCostOwn,
          marketSellProfit: sellAfterMarketTax - totalCostOwn,
        },
      ],
    },
    {
      planName: '方案 3',
      planDesc: '无任何交易税（仅参考）',
      variants: [
        {
          variantName: '蓝图市场采购',
          materialCost: actualMaterialCost,
          totalCost: totalCostMarket,
          buyOrderProfit: buyOrderPrice - totalCostMarket,
          marketSellProfit: marketSellPrice - totalCostMarket,
        },
        {
          variantName: '自有折扣蓝图',
          materialCost: actualMaterialCost,
          totalCost: totalCostOwn,
          buyOrderProfit: buyOrderPrice - totalCostOwn,
          marketSellProfit: marketSellPrice - totalCostOwn,
        },
      ],
    },
    // 方案四（私人合同·固定扣5%税率）已按用户要求删除，仅保留 3 个方案
  ];
}

/** 格式化数字，默认保留 4 位小数 */
export function formatNumber(value: number, decimals = 4): string {
  if (!isFinite(value)) return '0.0000';
  return value.toFixed(decimals);
}

/** 计算材料列表总价（单价 ISK × 数量 ÷ 1亿 = 亿ISK） */
export function sumMaterials(materials: IMaterialItem[]): number {
  return materials.reduce((sum, m) => {
    const p = Number(m.price) || 0;
    const q = Number(m.quantity) || 0;
    return sum + (p * q) / 100000000;
  }, 0);
}
