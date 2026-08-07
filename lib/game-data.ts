import type { FlowerType, SeedType, Tool, GameState, Announcement, PestSeverity } from './types'
export { RankNames, RankColors } from './types'

// 花品种配置
export const FLOWER_TYPES: FlowerType[] = [
  {
    id: 'rose',
    name: '玫瑰',
    emoji: '🌹',
    season: ['spring', 'summer'],
    maxRank: 6,
    growthTime: 5 * 60 * 1000, // 5分钟演示
    baseBuyPrice: 50,
    baseSellPrice: 30,
    description: '爱情的象征，春夏盛开，价值较高。',
  },
  {
    id: 'tulip',
    name: '郁金香',
    emoji: '🌷',
    season: ['spring'],
    maxRank: 5,
    growthTime: 4 * 60 * 1000,
    baseBuyPrice: 40,
    baseSellPrice: 25,
    description: '优雅的春之使者，仅春季可种植。',
  },
  {
    id: 'sunflower',
    name: '向日葵',
    emoji: '🌻',
    season: ['summer'],
    maxRank: 5,
    growthTime: 6 * 60 * 1000,
    baseBuyPrice: 35,
    baseSellPrice: 20,
    description: '追逐阳光的夏日之花，生长周期较长。',
  },
  {
    id: 'daisy',
    name: '雏菊',
    emoji: '🌼',
    season: ['spring', 'autumn'],
    maxRank: 4,
    growthTime: 3 * 60 * 1000,
    baseBuyPrice: 20,
    baseSellPrice: 12,
    description: '纯真的小花，春秋两季均可种植。',
  },
  {
    id: 'chrysanthemum',
    name: '菊花',
    emoji: '🏵️',
    season: ['autumn'],
    maxRank: 5,
    growthTime: 5 * 60 * 1000,
    baseBuyPrice: 45,
    baseSellPrice: 28,
    description: '秋日之王，凌霜绽放。',
  },
  {
    id: 'plum',
    name: '梅花',
    emoji: '🌸',
    season: ['winter'],
    maxRank: 7,
    growthTime: 8 * 60 * 1000,
    baseBuyPrice: 100,
    baseSellPrice: 60,
    description: '寒冬独开的传奇之花，有机会达到传说品质。',
  },
  {
    id: 'cherry',
    name: '樱花',
    emoji: '🌸',
    season: ['spring'],
    maxRank: 6,
    growthTime: 5 * 60 * 1000,
    baseBuyPrice: 60,
    baseSellPrice: 38,
    description: '浪漫的春日限定，花期短暂而绚烂。',
  },
  {
    id: 'lotus',
    name: '荷花',
    emoji: '🪷',
    season: ['summer'],
    maxRank: 6,
    growthTime: 7 * 60 * 1000,
    baseBuyPrice: 70,
    baseSellPrice: 45,
    description: '出淤泥而不染，夏季水生名花。',
  },
]

// 种子配置
export const SEED_TYPES: SeedType[] = FLOWER_TYPES.map(flower => ({
  id: `seed_${flower.id}`,
  flowerTypeId: flower.id,
  name: `${flower.name}种子`,
  emoji: '🌱',
  price: Math.floor(flower.baseBuyPrice * 0.3),
  description: `可种植出${flower.name}的种子。`,
}))

// 工具配置
export const TOOLS: Tool[] = [
  {
    id: 'watering_can',
    name: '水壶',
    emoji: '💧',
    price: 10,
    description: '给花浇水，促进生长。',
    effect: 'water',
    power: 5,
  },
  {
    id: 'fertilizer',
    name: '化肥',
    emoji: '🧪',
    price: 25,
    description: '为花施肥，大幅加速生长。',
    effect: 'fertilize',
    power: 15,
  },
  {
    id: 'pesticide',
    name: '除虫剂',
    emoji: '🧴',
    price: 30,
    description: '消灭害虫，保护花朵。',
    effect: 'pesticide',
    power: 1,
  },
  {
    id: 'speedup_card',
    name: '加速卡',
    emoji: '⚡',
    price: 100,
    description: '立即加速花朵成长进度。',
    effect: 'speedup',
    power: 30,
  },
]

// 初始游戏状态
export const INITIAL_GAME_STATE: GameState = {
  currentSeason: 'spring',
  seasonStartAt: Date.now(),
  seasonDuration: 8 * 60 * 60 * 1000, // 8小时一个季节
}

// 初始公告
export const INITIAL_ANNOUNCEMENTS: Announcement[] = [
  {
    id: 'announce_1',
    title: '🎉 欢迎来到花园！',
    content: '欢迎来到花园模拟经营游戏！在这里你可以种花、交易、交友。初始赠送100金币和一些种子，快去你的花园看看吧！',
    createdAt: Date.now(),
    priority: 'urgent',
  },
  {
    id: 'announce_2',
    title: '📖 游戏玩法介绍',
    content: '1. 在花园中种植花朵，浇水施肥加速成长。\n2. 收获的花朵可以卖给系统或挂到市场。\n3. 解锁更多地块和背包格扩大经营。\n4. 和世界频道的玩家交流心得吧！',
    createdAt: Date.now() - 3600000,
    priority: 'important',
  },
]

// 季节名称映射
export const SEASON_NAMES: Record<string, string> = {
  spring: '春季',
  summer: '夏季',
  autumn: '秋季',
  winter: '冬季',
}

// 季节颜色
export const SEASON_COLORS: Record<string, string> = {
  spring: 'from-green-400 to-pink-300',
  summer: 'from-yellow-400 to-orange-400',
  autumn: 'from-orange-500 to-amber-700',
  winter: 'from-blue-300 to-slate-400',
}

// 计算地块解锁价格
export function getPlotUnlockPrice(plotNumber: number): number {
  return plotNumber * 30
}

// 计算背包扩容价格
export function getInventoryExpandPrice(currentSize: number): number {
  const expansions = (currentSize - 5) / 5
  return Math.floor(100 * Math.pow(1.5, expansions))
}

// 计算花的售价（按等级倍率）
export function getFlowerSellPrice(flower: FlowerType, rank: number): number {
  const rankMultipliers = [1, 1.5, 2.2, 3.2, 5, 8, 15]
  return Math.floor(flower.baseSellPrice * rankMultipliers[rank - 1])
}

// 敏感词过滤
// 默认内置敏感词（DB 中无配置时的兜底）
const DEFAULT_SENSITIVE_WORDS = [
  '操', '草', '傻逼', 'sb', 'SB', '去死', '狗日', '他妈', 'tmd', 'TMD',
  '垃圾游戏', '骗钱', '外挂', 'waigua', 'hack',
]

// 过滤敏感词（可传入后台动态词库；不传则只用默认内置词）
export function filterSensitiveWords(text: string, extraWords?: string[]): string {
  let result = text
  const words = extraWords && extraWords.length > 0 ? extraWords : DEFAULT_SENSITIVE_WORDS
  for (const word of words) {
    if (!word) continue
    try {
      // 转义正则特殊字符
      const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const regex = new RegExp(escaped, 'gi')
      result = result.replace(regex, '*'.repeat(word.length))
    } catch {
      // 单个词正则失败不影响其他词
      result = result.split(word).join('*'.repeat(word.length))
    }
  }
  return result
}

export function containsSensitiveWords(text: string, extraWords?: string[]): boolean {
  const words = extraWords && extraWords.length > 0 ? extraWords : DEFAULT_SENSITIVE_WORDS
  const lower = text.toLowerCase()
  for (const word of words) {
    if (word && lower.includes(word.toLowerCase())) {
      return true
    }
  }
  return false
}

// ==================== 虫灾系统配置 ====================

export const PEST_CONFIG = {
  // 每次打理操作后触发单株虫害的概率
  singlePestChance: 0.08,
  // 花园加载时触发虫灾事件的基础概率（每天每用户一次检查）
  disasterBaseChance: 0.15,
  // 虫灾严重程度配置
  severity: {
    minor: { plotsAffected: [1, 2], growthPenalty: 0.3 },        // 轻微：1-2块地，生长速度30%
    major: { plotsAffected: [2, 4], growthPenalty: 0.2 },         // 严重：2-4块地，生长速度20%
    catastrophic: { plotsAffected: [3, 6], growthPenalty: 0.1 },  // 灾难：3-6块地，生长速度10%
  } as Record<PestSeverity, { plotsAffected: [number, number]; growthPenalty: number }>,
  // 虫灾未处理时花死亡的时间（毫秒），6小时
  pestDeathTimeout: 6 * 60 * 60 * 1000,
}

// 随机选择虫灾严重程度
export function rollPestSeverity(): PestSeverity {
  const roll = Math.random()
  if (roll < 0.55) return 'minor'
  if (roll < 0.85) return 'major'
  return 'catastrophic'
}

// ==================== 偷花系统配置 ====================

export const STEAL_CONFIG = {
  // 每日偷花次数上限
  dailyStealLimit: 3,
  // 偷花成功率
  strangerSuccessRate: 0.20,  // 陌生人 20%
  friendSuccessRate: 0.30,    // 好友 30%
  // 好友保护期（添加好友后多少小时内不能偷），毫秒
  friendProtectionPeriod: 12 * 60 * 60 * 1000,
  // 同一地块每天只能被偷一次
  plotStealCooldown: 24 * 60 * 60 * 1000,
  // 只有成熟的花才能被偷
  requireReady: true,
  // 花园保护道具持续时间，毫秒
  gardenProtectionDuration: 24 * 60 * 60 * 1000,
  // 被偷后给受害者的补偿金币比例（基于花的售价）
  victimCompensationRate: 0.3,
}

// 花园保护道具
export const GARDEN_GUARD_TOOL: Tool = {
  id: 'garden_guard',
  name: '花园守卫',
  emoji: '🛡️',
  price: 50,
  description: '激活后24小时内防止花朵被偷。',
  effect: 'speedup', // 复用 effect 字段
  power: 0,
}

