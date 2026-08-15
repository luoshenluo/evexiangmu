// 花束系统配置：等级价格区间 + 每日随机收购价
import type { RankLevel } from './types'

// 各等级花束的官方每日随机收购价区间（每日 00:01 刷新）
// 最高传说上限 1000
export const BOUQUET_PRICE_RANGES: Record<RankLevel, [number, number]> = {
  1: [10, 30],     // 黑铁
  2: [20, 60],     // 青铜
  3: [40, 100],    // 白银
  4: [80, 200],    // 黄金
  5: [150, 400],   // 铂金
  6: [300, 700],   // 钻石
  7: [600, 1000],  // 传说（封顶 1000）
}

// 按当天日期生成确定性随机数（0~1），保证当天价格固定、次日变化
function daySeed(): number {
  const now = new Date()
  // 用 北京时间 日序（yyyy*366 + mm*31 + dd）
  const dayCode = now.getFullYear() * 366 + (now.getMonth() + 1) * 31 + now.getDate()
  // 简单 hash 后归一化
  const s = Math.sin(dayCode * 999.7) * 10000
  return s - Math.floor(s)
}

// 获取某等级花束当日的官方收购价
export function getDailyBouquetPrice(rank: RankLevel, override?: number): number {
  if (override && override > 0) return override
  const [min, max] = BOUQUET_PRICE_RANGES[rank] || BOUQUET_PRICE_RANGES[1]
  const t = daySeed()
  return Math.round(min + (max - min) * t)
}

// 获取今日所有等级的花束收购价（用于展示/管理）
export function getTodayBouquetPrices(overrides?: Partial<Record<RankLevel, number>>): Record<RankLevel, number> {
  const result = {} as Record<RankLevel, number>
  const ranks: RankLevel[] = [1, 2, 3, 4, 5, 6, 7]
  for (const r of ranks) {
    result[r] = getDailyBouquetPrice(r, overrides?.[r])
  }
  return result
}

// 花束等级中文名
export const RANK_CN: Record<RankLevel, string> = {
  1: '黑铁',
  2: '青铜',
  3: '白银',
  4: '黄金',
  5: '铂金',
  6: '钻石',
  7: '传说',
}
