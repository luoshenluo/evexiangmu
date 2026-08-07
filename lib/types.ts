// 核心类型定义

export type Season = 'spring' | 'summer' | 'autumn' | 'winter'

export type RankLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7

export const RankNames: Record<RankLevel, string> = {
  1: '黑铁',
  2: '青铜',
  3: '白银',
  4: '黄金',
  5: '铂金',
  6: '钻石',
  7: '传说',
}

export const RankColors: Record<RankLevel, string> = {
  1: '#374151',
  2: '#cd7f32',
  3: '#c0c0c0',
  4: '#ffd700',
  5: '#e5e4e2',
  6: '#b9f2ff',
  7: '#ff6b6b',
}

export interface FlowerType {
  id: string
  name: string
  emoji: string
  season: Season[]
  maxRank: RankLevel
  growthTime: number // 毫秒
  baseBuyPrice: number
  baseSellPrice: number
  description: string
}

export interface SeedType {
  id: string
  flowerTypeId: string
  name: string
  emoji: string
  price: number
  description: string
}

export interface PlantedFlower {
  id: string
  flowerTypeId: string
  rank: RankLevel
  plantedAt: number
  waterCount: number
  fertilizeCount: number
  pestCount: number
  hasPest: boolean
  pestAt: number | null // 虫灾发生时间
  growthProgress: number // 0-100
  isReady: boolean
  lastWaterAt: number | null // 最后浇水时间
  lastFertilizeAt: number | null // 最后施肥时间
}

export interface Plot {
  id: number
  unlocked: boolean
  unlockPrice: number
  flower: PlantedFlower | null
}

export type ItemType = 'flower' | 'seed' | 'tool'

export interface InventoryItem {
  id: string
  type: ItemType
  referenceId: string // flowerTypeId, seedId, or toolId
  name: string
  emoji: string
  rank?: RankLevel
  quantity: number
  maxStack: number
  sellable: boolean
  tradeable: boolean
}

export interface Tool {
  id: string
  name: string
  emoji: string
  price: number
  description: string
  effect: 'water' | 'fertilize' | 'pesticide' | 'speedup'
  power: number
}

export interface User {
  id: string
  username: string
  password: string
  nickname: string
  avatar: string
  coins: number
  createdAt: number
  lastLogin: number
  plots: Plot[]
  inventory: InventoryItem[]
  inventorySize: number
  isAdmin: boolean
  mutedUntil: number | null
  familyId: string | null
  friends: string[]
  deleted?: boolean
  // 偷花系统
  stealCountToday: number
  stealResetAt: number
  // 花园保护（防止被偷）
  gardenProtectedUntil: number
}

export interface MarketListing {
  id: string
  sellerId: string
  sellerName: string
  isOfficial: boolean
  itemType: 'flower' | 'seed'
  referenceId: string
  name: string
  emoji: string
  rank?: RankLevel
  price: number
  quantity: number
  createdAt: number
}

export interface BuyOrder {
  id: string
  buyerId: string
  buyerName: string
  isOfficial: boolean
  itemType: 'flower' | 'seed'
  referenceId: string
  name: string
  emoji: string
  rank?: RankLevel
  price: number
  quantity: number
  createdAt: number
}

export type ChatChannel = 'world' | 'family' | 'friend'

export interface ChatMessage {
  id: string
  channel: ChatChannel
  userId: string
  userName: string
  content: string
  timestamp: number
  isSystem: boolean
}

export interface Task {
  id: string
  type: 'daily' | 'weekly' | 'monthly'
  title: string
  description: string
  target: number
  progress: number
  completed: boolean
  claimed: boolean
  rewards: {
    coins?: number
    items?: { referenceId: string; quantity: number; type: ItemType }[]
  }
}

export interface Family {
  id: string
  name: string
  avatar: string
  announcement: string
  ownerId: string
  members: { userId: string; role: 'owner' | 'admin' | 'member'; contribution: number }[]
  level: number
  exp: number
  maxMembers: number
  createdAt: number
}

export interface Announcement {
  id: string
  title: string
  content: string
  createdAt: number
  priority: 'normal' | 'important' | 'urgent'
}

export interface CDK {
  code: string
  rewards: {
    coins?: number
    items?: { referenceId: string; quantity: number; type: ItemType }[]
  }
  maxUses: number
  usedCount: number
  expiresAt: number | null
  createdAt: number
}

export interface Notification {
  id: string
  userId: string
  type: 'system' | 'trade' | 'friend' | 'family' | 'harvest' | 'plant' | 'purchase' | 'cdk_redeem' | 'task'
  title: string
  content: string
  read: boolean
  createdAt: number
}

export interface GameState {
  currentSeason: Season
  seasonStartAt: number
  seasonDuration: number // 毫秒
}

// ==================== 虫灾系统 ====================

export type PestSeverity = 'minor' | 'major' | 'catastrophic'

export interface PestDisasterEvent {
  id: string
  userId: string
  severity: PestSeverity
  affectedPlots: number[]
  occurredAt: number
}

// ==================== 偷花系统 ====================

export interface StealLog {
  id: string
  thiefId: string
  thiefName: string
  victimId: string
  victimName: string
  plotId: number
  flowerTypeId: string
  flowerName: string
  flowerEmoji: string
  rank: RankLevel
  stolenAt: number
}

export interface StealResult {
  success: boolean
  message: string
  flower?: {
    flowerTypeId: string
    name: string
    emoji: string
    rank: RankLevel
  }
}
