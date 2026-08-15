// 种子阶级与杂交系统工具函数
import { SEED_TIER_ORDER, SEED_TIER_INDEX, type SeedTier, type Season } from './types'

export { SEED_TIER_ORDER, SEED_TIER_INDEX }

// 种子阶级中文名（后台/前端展示）
export const SEED_TIER_CN: Record<SeedTier, string> = {
  black_iron: '黑铁',
  bronze: '青铜',
  silver: '白银',
  gold: '黄金',
  platinum: '铂金',
  diamond: '钻石',
  legend: '传说',
}

// 各阶级可种植出花朵的最大品质等级（rank）
// 种子决定花朵的最高品质上限；花朵实际品质受浇水/施肥/除虫影响
export const TIER_MAX_RANK: Record<SeedTier, number> = {
  black_iron: 1,
  bronze: 2,
  silver: 3,
  gold: 4,
  platinum: 5,
  diamond: 6,
  legend: 7,
}

// 杂交：产出阶级 = 两亲本较低阶级，或 +1 级（各 50%），传说封顶
// 例：黑铁×青铜 → 黑铁或青铜；黑铁×黑铁 → 黑铁或青铜
export function hybridResultTier(tierA: SeedTier, tierB: SeedTier): SeedTier {
  const idxA = SEED_TIER_INDEX[tierA]
  const idxB = SEED_TIER_INDEX[tierB]
  const lowerIdx = Math.min(idxA, idxB)
  // 50% 取较低阶级，50% +1 级（封顶传说 index 6）
  const next = Math.random() < 0.5 ? lowerIdx : Math.min(6, lowerIdx + 1)
  return SEED_TIER_ORDER[next]
}

// 从指定季节的花池中随机选 1 种花（用于杂交产出花型随机）
export function pickFlowerFromSeasons(
  flowers: { id: string; season: Season[]; tier: SeedTier; maxRank: number }[],
  seasons: Season[],
  targetTier: SeedTier,
): { id: string; season: Season[]; tier: SeedTier; maxRank: number } {
  // 候选：属于指定季节 且 阶级不超过目标阶级 的花
  const candidates = flowers.filter(
    (f) => f.season.some((s) => seasons.includes(s)) && SEED_TIER_INDEX[f.tier] <= SEED_TIER_INDEX[targetTier],
  )
  if (candidates.length === 0) {
    // 兜底：任意季节、阶级最低的花
    const fallback = [...flowers].sort((a, b) => SEED_TIER_INDEX[a.tier] - SEED_TIER_INDEX[b.tier])
    return fallback[0]
  }
  return candidates[Math.floor(Math.random() * candidates.length)]
}
