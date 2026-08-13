// ============================================================================
// lib/server-store.ts
// 服务端数据层（面向 API Routes / Server Actions）
// 统一封装 Supabase 访问 + 内存缓存兜底 + 热更新降级（缺失列/表时静默处理）
// ============================================================================
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { User, Plot, Message, ChatMessage, TaskTemplate, ChatChannel, ChatStats, StealLog, Family, MarketListing, ListingType, SensitiveWord, Task, ChatSettings, PrivateMessage, PrivateConversation, RankLevel, TaskProgressState, TaskProgress, InventoryItem, PestSeverity, } from './types'
import { FLOWER_TYPES, FAMILY_LEVEL_EXP, calcFamilyLevel, calcFamilyMaxMembers, getFlowerSellPrice, } from './game-data'
import { genId } from './id'
import { logger } from './logger'

// ============================================================================
// Supabase 客户端
// ============================================================================
const SB_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
let _sb: SupabaseClient | null = null;
function getSupabase(): SupabaseClient {
  if (!_sb) {
    _sb = createClient(SB_URL, SB_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return _sb
}

// 本地内存兜底（热更新早期或 Supabase 未就绪时使用）
let _localUsers: Map<string, User> | null = null
let _localMessages: ChatMessage[] | null = null
let _localListings: any[] | null = null
let _localFamilies: Family[] | null = null
let _taskTemplatesCache: TaskTemplate[] | null = null

// 新列名与旧列名的映射（支持数据库热更新的兼容）
const NEW_USER_COLUMNS = {
  lastActiveAt: 'last_active_at',
  incomingFriendRequests: 'incoming_friend_requests',
  outgoingFriendRequests: 'outgoing_friend_requests',
  friendRequests: 'friend_requests',
  mutedUntil: 'muted_until',
  isAdmin: 'is_admin',
  title: 'title',
  familyId: 'family_id',
  deleted: 'deleted',
  gardenProtectedUntil: 'garden_protected_until',
  stealCountToday: 'steal_count_today',
  stealResetAt: 'steal_reset_at',
  dailyQuestResetAt: 'daily_quest_reset_at',
  lastDailyRewardAt: 'last_daily_reward_at',
  plots: 'plots',
  inventory: 'inventory',
  notifications: 'notifications',
  familyJoinRequests: 'family_join_requests',
} as const

function isMissingColumnError(err: any): boolean {
  if (!err) return false
  const msg = err?.message || ''
  return /column .* does not exist/i.test(msg) || /relation .* does not exist/i.test(msg) || /does not exist/i.test(msg)
}

// 默认地块
function defaultPlots(): Plot[] {
  const plots: Plot[] = []
  for (let i = 1; i <= 30; i++) {
    plots.push({
      id: i,
      unlocked: i <= 4,
      unlockCost: i <= 4 ? 0 : 200 + (i - 5) * 100,
      flower: null,
    })
  }
  return plots
}

function defaultInventory(): InventoryItem[] {
  return [
    { itemId: 'seed_rose', itemType: 'seed', name: '玫瑰种子', emoji: '🌹', quantity: 5 },
    { itemId: 'seed_sunflower', itemType: 'seed', name: '向日葵种子', emoji: '🌻', quantity: 5 },
    { itemId: 'seed_tulip', itemType: 'seed', name: '郁金香种子', emoji: '🌷', quantity: 5 },
    { itemId: 'tool_watercan', itemType: 'tool', name: '水壶', emoji: '💧', quantity: 1 },
    { itemId: 'tool_fertilizer', itemType: 'tool', name: '肥料', emoji: '🧪', quantity: 2 },
    { itemId: 'tool_pesticide', itemType: 'tool', name: '除虫剂', emoji: '🧴', quantity: 2 },
  ]
}

function newUserTemplate(partial: Partial<User> & { id: string; username: string; nickname: string }): User {
  const now = Date.now()
  return {
    id: partial.id,
    username: partial.username,
    nickname: partial.nickname || partial.username,
    avatar: partial.avatar || '🌱',
    password: partial.password || '',
    coins: partial.coins ?? 500,
    diamonds: partial.diamonds ?? 0,
    exp: partial.exp ?? 0,
    level: partial.level ?? 1,
    plots: partial.plots || defaultPlots(),
    inventory: partial.inventory || defaultInventory(),
    friends: partial.friends || [],
    incomingFriendRequests: partial.incomingFriendRequests || [],
    outgoingFriendRequests: partial.outgoingFriendRequests || [],
    notifications: partial.notifications || [],
    isAdmin: partial.isAdmin || false,
    title: partial.title || '',
    lastLogin: partial.lastLogin || now,
    lastActiveAt: partial.lastActiveAt || partial.lastLogin || now,
    createdAt: partial.createdAt || now,
    updatedAt: partial.updatedAt || now,
    familyId: partial.familyId || null,
    gardenProtectedUntil: partial.gardenProtectedUntil || 0,
    stealCountToday: partial.stealCountToday || 0,
    stealResetAt: partial.stealResetAt || 0,
    dailyQuestProgress: partial.dailyQuestProgress || {},
    dailyQuestResetAt: partial.dailyQuestResetAt || 0,
    lastDailyRewardAt: partial.lastDailyRewardAt || 0,
    mutedUntil: partial.mutedUntil || 0,
    deleted: partial.deleted || false,
    achievements: partial.achievements || [],
    familyJoinRequests: partial.familyJoinRequests || [],
    tasks: partial.tasks || {},
    completedTaskIds: partial.completedTaskIds || [],
    stats: partial.stats || {},
  }
}

// ============================================================================
// 数据库初始化 & 种子数据
// ============================================================================
let _seeded = false
let _seedPromise: Promise<void> | null = null
export async function seedDatabase(force = false): Promise<void> {
  if (_seeded && !force) return
  if (_seedPromise && !force) return _seedPromise
  _seedPromise = (async () => {
    const sb = getSupabase()
    // 确保种子用户存在
    const seedUsers: User[] = [
      newUserTemplate({
        id: 'u_admin',
        username: 'admin',
        nickname: '管理员',
        password: 'admin123',
        isAdmin: true,
        coins: 99999,
        avatar: '👑',
        title: '花园守护者',
      }),
      newUserTemplate({
        id: 'u_test1',
        username: 'test1',
        nickname: '测试用户1',
        password: '123456',
        coins: 1000,
        avatar: '🌸',
      }),
      newUserTemplate({
        id: 'u_test2',
        username: 'test2',
        nickname: '测试用户2',
        password: '123456',
        coins: 800,
        avatar: '🌺',
      }),
      newUserTemplate({
        id: 'u_test3',
        username: 'test3',
        nickname: '测试用户3',
        password: '123456',
        coins: 600,
        avatar: '💮',
      }),
    ]
    _localUsers = new Map(seedUsers.map(u => [u.id, u]))
    for (const u of seedUsers) {
      try { await upsertUserRow(u) } catch { /* 静默 */ }
    }
    _localMessages = []
    _localListings = []
    _localFamilies = []
    _seeded = true
  })()
  await _seedPromise
}

async function upsertUserRow(user: User) {
  const sb = getSupabase()
  const row: Record<string, any> = {
    id: user.id,
    username: user.username,
    nickname: user.nickname,
    avatar: user.avatar,
    password: user.password,
    coins: user.coins,
    diamonds: user.diamonds,
    exp: user.exp,
    level: user.level,
    plots: user.plots as any,
    inventory: user.inventory as any,
    friends: user.friends,
    notifications: user.notifications as any,
    is_admin: user.isAdmin,
    title: user.title,
    last_login: user.lastLogin,
    created_at: user.createdAt,
    updated_at: user.updatedAt,
    family_id: user.familyId,
    achievements: user.achievements,
  }
  try { row.incoming_friend_requests = user.incomingFriendRequests as any } catch {}
  try { row.outgoing_friend_requests = user.outgoingFriendRequests as any } catch {}
  try { row.muted_until = user.mutedUntil } catch {}
  try { row.garden_protected_until = user.gardenProtectedUntil } catch {}
  try { row.steal_count_today = user.stealCountToday } catch {}
  try { row.steal_reset_at = user.stealResetAt } catch {}
  try { row.daily_quest_progress = user.dailyQuestProgress as any } catch {}
  try { row.daily_quest_reset_at = user.dailyQuestResetAt } catch {}
  try { row.last_daily_reward_at = user.lastDailyRewardAt } catch {}
  try { row.deleted = user.deleted || false } catch {}
  try { row.family_join_requests = user.familyJoinRequests as any } catch {}
  try { row.tasks = user.tasks as any } catch {}
  try { row.completed_task_ids = user.completedTaskIds } catch {}
  try { row.stats = user.stats as any } catch {}
  try { row.last_active_at = user.lastActiveAt || user.lastLogin || Date.now() } catch {}
  await sb.from('users').upsert(row, { onConflict: 'id', ignoreDuplicates: false })
}

function dbRowToUser(row: any): User {
  return newUserTemplate({
    id: row.id,
    username: row.username,
    nickname: row.nickname,
    avatar: row.avatar,
    password: row.password,
    coins: Number(row.coins ?? 0),
    diamonds: Number(row.diamonds ?? 0),
    exp: Number(row.exp ?? 0),
    level: Number(row.level ?? 1),
    plots: Array.isArray(row.plots) ? row.plots as Plot[] : undefined,
    inventory: Array.isArray(row.inventory) ? row.inventory as InventoryItem[] : undefined,
    friends: Array.isArray(row.friends) ? row.friends : [],
    isAdmin: !!row.is_admin,
    title: row.title || '',
    lastLogin: Number(row.last_login || 0),
    lastActiveAt: Number(row.last_active_at || row.last_login || Date.now()),
    createdAt: Number(row.created_at || 0),
    updatedAt: Number(row.updated_at || 0),
    familyId: row.family_id || null,
    gardenProtectedUntil: Number(row.garden_protected_until || 0),
    stealCountToday: Number(row.steal_count_today || 0),
    stealResetAt: Number(row.steal_reset_at || 0),
    dailyQuestProgress: (row.daily_quest_progress as any) || {},
    dailyQuestResetAt: Number(row.daily_quest_reset_at || 0),
    lastDailyRewardAt: Number(row.last_daily_reward_at || 0),
    mutedUntil: Number(row.muted_until || 0),
    deleted: !!row.deleted,
    achievements: Array.isArray(row.achievements) ? row.achievements : [],
    familyJoinRequests: Array.isArray(row.family_join_requests) ? row.family_join_requests : [],
    incomingFriendRequests: Array.isArray(row.incoming_friend_requests) ? row.incoming_friend_requests : [],
    outgoingFriendRequests: Array.isArray(row.outgoing_friend_requests) ? row.outgoing_friend_requests : [],
    tasks: (row.tasks as any) || {},
    completedTaskIds: Array.isArray(row.completed_task_ids) ? row.completed_task_ids : [],
    notifications: Array.isArray(row.notifications) ? row.notifications : [],
    stats: (row.stats as any) || {},
  })
}

// ============================================================================
// 用户相关
// ============================================================================
export async function getAllUsers(): Promise<User[]> {
  await seedDatabase()
  const sb = getSupabase()
  try {
    const { data, error } = await sb.from('users').select('*')
    if (error || !data) {
      // 降级：本地缓存
      return Array.from(_localUsers?.values() || [])
    }
    const users = data.map(dbRowToUser)
    _localUsers = new Map(users.map(u => [u.id, u]))
    return users
  } catch {
    return Array.from(_localUsers?.values() || [])
  }
}

export async function findUserById(id: string): Promise<User | null> {
  if (!id) return null
  await seedDatabase()
  const sb = getSupabase()
  try {
    const { data, error } = await sb.from('users').select('*').eq('id', id).limit(1).maybeSingle()
    if (error || !data) {
      return _localUsers?.get(id) || null
    }
    const u = dbRowToUser(data)
    _localUsers?.set(id, u)
    return u
  } catch {
    return _localUsers?.get(id) || null
  }
}

export async function findUserByUsername(username: string): Promise<User | null> {
  const all = await getAllUsers()
  const u = all.find(u => u.username.toLowerCase() === username.toLowerCase())
  return u || null
}

export async function createUser(data: Partial<User> & { username: string; password: string; nickname?: string }): Promise<User> {
  await seedDatabase()
  const user = newUserTemplate({
    id: data.id || genId('u'),
    username: data.username,
    nickname: data.nickname || data.username,
    password: data.password,
    avatar: data.avatar,
    isAdmin: data.isAdmin,
  })
  try { await upsertUserRow(user) } catch {}
  _localUsers?.set(user.id, user)
  return user
}

export async function updateUser(userId: string, patch: Partial<User>): Promise<User | null> {
  const current = await findUserById(userId)
  if (!current) return null
  const merged: User = { ...current, ...patch, updatedAt: Date.now() }
  try { await upsertUserRow(merged) } catch {}
  _localUsers?.set(userId, merged)
  return merged
}

// 用户心跳：更新 last_active_at（用于最近5分钟在线用户统计）
export async function touchUserActive(userId: string, ts: number = Date.now()): Promise<void> {
  await seedDatabase()
  const sb = getSupabase()
  try {
    await sb.from('users').update({ last_active_at: ts, updated_at: ts }).eq('id', userId)
    const user = _localUsers?.get(userId)
    if (user) { user.lastActiveAt = ts; user.updatedAt = ts }
  } catch (e: any) {
    // 热更新早期 last_active_at 列尚未存在时静默
    if (!isMissingColumnError(e)) {
      logger.warn('heartbeat', `touchUserActive 失败: ${e?.message}`)
    }
    const user = _localUsers?.get(userId)
    if (user) { user.lastActiveAt = ts; user.updatedAt = ts }
  }
}

// ============================================================================
// 通知
// ============================================================================
export async function createNotification(n: {
  userId: string; type: string; title: string; content: string; link?: string;
}): Promise<void> {
  const user = await findUserById(n.userId)
  if (!user) return
  const notifs = user.notifications || []
  notifs.unshift({
    id: `n_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    type: n.type,
    title: n.title,
    content: n.content,
    link: n.link || '',
    read: false,
    createdAt: Date.now(),
  })
  await updateUser(n.userId, { notifications: notifs.slice(0, 100) })
}

// ============================================================================
// 聊天（公共频道）
// ============================================================================
const MESSAGE_TIME_COL_FALLBACK = {
  preferred: 'timestamp' as const,
  fallback: 'created_at' as const,
}
let _messageTimeCol: string | null = null
async function detectMessagesTimeCol(): Promise<string> {
  if (_messageTimeCol) return _messageTimeCol
  const sb = getSupabase()
  try {
    const { data, error } = await sb.from('messages').select('*').limit(1)
    if (error || !data || data.length === 0) {
      _messageTimeCol = MESSAGE_TIME_COL_FALLBACK.preferred
    } else {
      const row = data[0] as any
      if (typeof row.timestamp === 'number') _messageTimeCol = 'timestamp'
      else _messageTimeCol = 'created_at'
    }
  } catch {
    _messageTimeCol = MESSAGE_TIME_COL_FALLBACK.preferred
  }
  return _messageTimeCol
}

function dbRowToMessage(row: any): ChatMessage {
  const ts = (typeof row.timestamp === 'number' ? row.timestamp : row.created_at) || 0
  return {
    id: row.id,
    channel: (row.channel as ChatChannel) || 'world',
    userId: row.user_id,
    userName: row.user_name || '',
    userAvatar: row.user_avatar || '🌱',
    content: row.content || '',
    timestamp: ts,
    familyId: row.family_id || null,
    familyName: row.family_name || null,
    mentions: Array.isArray(row.mentions) ? row.mentions : [],
    replyToId: row.reply_to_id || null,
    isSystem: !!row.is_system,
  }
}

export async function getRecentMessages(channel: ChatChannel, limit = 100, familyId?: string): Promise<ChatMessage[]> {
  await seedDatabase()
  const sb = getSupabase()
  const col = await detectMessagesTimeCol()
  try {
    let query: any = sb.from('messages').select('*').eq('channel', channel).order(col, { ascending: false }).limit(limit)
    if (channel === 'family' && familyId) query = query.eq('family_id', familyId)
    const { data, error } = await query
    if (error || !data) {
      const arr = (_localMessages || []).filter(m => m.channel === channel)
      if (channel === 'family' && familyId) arr.filter(m => m.familyId === familyId)
      return arr.slice(-limit)
    }
    const msgs = data.map(dbRowToMessage)
    msgs.sort((a, b) => a.timestamp - b.timestamp)
    return msgs
  } catch {
    const arr = (_localMessages || []).filter(m => m.channel === channel)
    return arr.slice(-limit)
  }
}

export async function sendChatMessage(msg: Omit<ChatMessage, 'id'>): Promise<ChatMessage> {
  await seedDatabase()
  const sb = getSupabase()
  const full: ChatMessage = { id: genId('m'), ...msg }
  const row: Record<string, any> = {
    id: full.id,
    channel: full.channel,
    user_id: full.userId,
    user_name: full.userName,
    user_avatar: full.userAvatar,
    content: full.content,
    timestamp: full.timestamp,
    family_id: full.familyId || null,
    family_name: full.familyName || null,
    mentions: full.mentions || [],
    reply_to_id: full.replyToId || null,
    is_system: !!full.isSystem,
    created_at: full.timestamp,
  }
  try {
    const { error } = await sb.from('messages').insert(row)
    if (error) throw error
  } catch (e: any) {
    logger.warn('chat', `sendChatMessage 写入失败（降级本地）: ${e?.message}`)
    _localMessages?.push(full)
  }
  return full
}

// ============================================================================
// 任务 & 成就
// ============================================================================
export async function getAllTaskTemplates(): Promise<TaskTemplate[]> {
  if (_taskTemplatesCache) return _taskTemplatesCache
  const sb = getSupabase()
  try {
    const { data, error } = await sb.from('task_templates').select('*').eq('enabled', true).order('sort_order', { ascending: true }).order('created_at', { ascending: true })
    if (error || !data) return defaultTaskTemplates()
    const ts = data.map(dbRowToTaskTemplate)
    _taskTemplatesCache = ts.length > 0 ? ts : defaultTaskTemplates()
    return _taskTemplatesCache
  } catch {
    return defaultTaskTemplates()
  }
}

function defaultTaskTemplates(): TaskTemplate[] {
  const now = Date.now()
  return [
    { id: 'daily_login', type: 'daily', title: '每日签到', description: '每日登录花园', target: 1, action: 'login', rewards: { coins: 100 }, enabled: true, sortOrder: 1, createdAt: now, updatedAt: now },
    { id: 'daily_water', type: 'daily', title: '浇水 3 次', description: '给自己的花浇水 3 次', target: 3, action: 'water', rewards: { coins: 50 }, enabled: true, sortOrder: 2, createdAt: now, updatedAt: now },
    { id: 'daily_harvest', type: 'daily', title: '收获 1 朵花', description: '收获任意 1 朵花', target: 1, action: 'harvest', rewards: { coins: 80 }, enabled: true, sortOrder: 3, createdAt: now, updatedAt: now },
    { id: 'daily_chat', type: 'daily', title: '发送 3 条消息', description: '在任意聊天频道发送 3 条消息', target: 3, action: 'chat', rewards: { coins: 40 }, enabled: true, sortOrder: 4, createdAt: now, updatedAt: now },
    { id: 'ach_first_friend', type: 'achievement', title: '初遇好友', description: '添加第一个好友', target: 1, action: 'add_friend', rewards: { coins: 200, diamonds: 5 }, enabled: true, sortOrder: 50, createdAt: now, updatedAt: now },
    { id: 'ach_plant_10', type: 'achievement', title: '小有所成', description: '累计种植 10 朵花', target: 10, action: 'plant', rewards: { coins: 500, diamonds: 10 }, enabled: true, sortOrder: 51, createdAt: now, updatedAt: now },
    { id: 'ach_level_5', type: 'achievement', title: '进阶园丁', description: '达到 5 级', target: 5, action: 'reach_level', rewards: { coins: 1000, diamonds: 30 }, enabled: true, sortOrder: 52, createdAt: now, updatedAt: now },
  ]
}

function dbRowToTaskTemplate(row: any): TaskTemplate {
  return { id: row.id, type: row.type, title: row.title, description: row.description, target: row.target, action: row.action, rewards: typeof row.rewards === 'string' ? JSON.parse(row.rewards) : row.rewards, enabled: row.enabled, sortOrder: row.sort_order, createdAt: row.created_at, updatedAt: row.updated_at }
}

export async function deleteTaskTemplate(id: string): Promise<boolean> {
  const sb = getSupabase()
  const { error } = await sb.from('task_templates').delete().eq('id', id)
  if (error) {
    // 降级：从缓存删除
    if (_taskTemplatesCache) {
      _taskTemplatesCache = _taskTemplatesCache.filter(t => t.id !== id)
      return true
    }
    throw new Error(error.message)
  }
  _taskTemplatesCache = null
  return true
}

// ==================== 官方收购价调整 ====================
export async function setOfficialBuyPrice(referenceId: string, rank: number, newPrice: number): Promise<void> {
  const sb = getSupabase()
  const { data: existing } = await sb.from('buy_orders').select('*').eq('is_official', true).eq('reference_id', referenceId).eq('rank', rank).single()
  if (existing) {
    await sb.from('buy_orders').update({ price: newPrice }).eq('id', existing.id)
  } else {
    const flower = FLOWER_TYPES.find(f => f.id === referenceId)
    if (flower) {
      await sb.from('buy_orders').insert({
        id: genId('o'), buyer_id: 'system', buyer_name: '官方', is_official: true,
        item_type: 'flower', reference_id: referenceId, name: flower.name, emoji: flower.emoji,
        rank: rank, price: newPrice, quantity: 9999, created_at: Date.now(),
      })
    }
  }
}

// ==================== 虫灾系统 ====================
export async function checkPestDisaster(userId: string): Promise<{ triggered: boolean; severity?: PestSeverity; affectedPlots?: number[] }> {
  const user = await findUserById(userId)
  if (!user) return { triggered: false }
  const plotsWithFlowers = user.plots.filter(p => p.unlocked && p.flower && !p.flower.hasPest)
  if (plotsWithFlowers.length === 0) return { triggered: false }
  if (Math.random() > PEST_CONFIG.disasterBaseChance) return { triggered: false }
  const severity = rollPestSeverity()
  const [min, max] = PEST_CONFIG.severity[severity].plotsAffected
  const numAffected = Math.min(plotsWithFlowers.length, min + Math.floor(Math.random() * (max - min + 1)))
  const shuffled = [...plotsWithFlowers].sort(() => Math.random() - 0.5)
  const affected = shuffled.slice(0, numAffected)
  const affectedPlotIds = affected.map(p => p.id)
  const now = Date.now()
  const newPlots = user.plots.map(p => {
    if (affectedPlotIds.includes(p.id) && p.flower) {
      return { ...p, flower: { ...p.flower, hasPest: true, pestAt: now, pestCount: p.flower.pestCount + 1 } }
    }
    return p
  })
  await updateUser(userId, { plots: newPlots })
  await createNotification({ userId, type: 'system', title: '🐛 虫灾警报！', content: `你的花园遭遇了${severity === 'minor' ? '轻微' : severity === 'major' ? '严重' : '灾难性'}虫灾！${affectedPlotIds.length}块地的花受到了影响，请尽快使用除虫剂！` })
  logger.warn('pest', '虫灾事件触发', { userId, severity, affectedPlots: affectedPlotIds })
  return { triggered: true, severity, affectedPlots: affectedPlotIds }
}

const PEST_CONFIG = {
  disasterBaseChance: 0.06,
  pestDeathTimeout: 6 * 60 * 60 * 1000,
  severity: {
    minor:  { weight: 6, plotsAffected: [1, 2] as [number, number] },
    major:  { weight: 3, plotsAffected: [2, 4] as [number, number] },
    plague: { weight: 1, plotsAffected: [4, 8] as [number, number] },
  },
}
function rollPestSeverity(): PestSeverity {
  const total = PEST_CONFIG.severity.minor.weight + PEST_CONFIG.severity.major.weight + PEST_CONFIG.severity.plague.weight
  let r = Math.random() * total
  r -= PEST_CONFIG.severity.minor.weight; if (r < 0) return 'minor'
  r -= PEST_CONFIG.severity.major.weight; if (r < 0) return 'major'
  return 'plague'
}

export async function checkPestDeath(userId: string): Promise<{ deadFlowers: number[] }> {
  const user = await findUserById(userId)
  if (!user) return { deadFlowers: [] }
  const now = Date.now()
  const deadPlotIds: number[] = []
  const newPlots = user.plots.map(p => {
    if (p.flower && p.flower.hasPest && p.flower.pestAt) {
      if (now - p.flower.pestAt > PEST_CONFIG.pestDeathTimeout) {
        deadPlotIds.push(p.id)
        logger.warn('pest', '花朵因虫灾死亡', { userId, plotId: p.id, flowerType: p.flower.flowerTypeId, pestAt: p.flower.pestAt, elapsed: now - p.flower.pestAt })
        return { ...p, flower: null }
      }
    }
    return p
  })
  if (deadPlotIds.length > 0) {
    await updateUser(userId, { plots: newPlots })
    await createNotification({ userId, type: 'system', title: '💀 花朵死亡', content: `由于虫灾未及时处理，${deadPlotIds.length}朵花已经枯萎死亡。请下次注意及时除虫！` })
  }
  return { deadFlowers: deadPlotIds }
}

// ==================== 偷花系统 ====================
const STEAL_CONFIG = {
  dailyStealLimit: 5,
  requireReady: true,
  friendSuccessRate: 0.7,
  strangerSuccessRate: 0.4,
  victimCompensationRate: 0.5,
  plotStealCooldown: 4 * 60 * 60 * 1000,
}
export async function attemptSteal(thiefId: string, victimId: string, plotId: number): Promise<{ success: boolean; message: string; flower?: { flowerTypeId: string; name: string; emoji: string; rank: RankLevel } }> {
  const thief = await findUserById(thiefId)
  const victim = await findUserById(victimId)
  if (!thief || !victim) return { success: false, message: '用户不存在' }
  if (thiefId === victimId) return { success: false, message: '不能偷自己的花' }
  logger.info('steal', '偷花尝试', { thiefId, thiefName: thief.nickname, victimId, victimName: victim.nickname, plotId })
  const now = Date.now()
  let stealCountToday = thief.stealCountToday
  if (now > thief.stealResetAt) stealCountToday = 0
  if (stealCountToday >= STEAL_CONFIG.dailyStealLimit) return { success: false, message: `今日偷花次数已达上限（${STEAL_CONFIG.dailyStealLimit}次）` }
  if (victim.gardenProtectedUntil > now) return { success: false, message: '对方花园正在保护中，无法偷取' }
  const plot = victim.plots.find(p => p.id === plotId)
  if (!plot || !plot.unlocked || !plot.flower) return { success: false, message: '该地块没有花朵' }
  if (STEAL_CONFIG.requireReady && !plot.flower.isReady) return { success: false, message: '只有成熟的花才能被偷取' }
  const sb = getSupabase()
  const { data: stealRecord } = await sb.from('plot_steal_records').select('*').eq('victim_id', victimId).eq('plot_id', plotId).gt('reset_at', now).single()
  if (stealRecord) return { success: false, message: '该地块今天已经被偷过了' }
  const isFriend = thief.friends.includes(victimId)
  const successRate = isFriend ? STEAL_CONFIG.friendSuccessRate : STEAL_CONFIG.strangerSuccessRate
  const success = Math.random() < successRate
  if (!success) {
    await updateUser(thiefId, { stealCountToday: stealCountToday + 1, stealResetAt: now + STEAL_CONFIG.plotStealCooldown })
    await createNotification({ userId: victimId, type: 'system', title: '🔍 有人来偷花！', content: `${thief.nickname} 试图偷取你的花，但失败了！` })
    return { success: false, message: '偷花失败！花太牢固了，没能得手' }
  }
  const flowerType = FLOWER_TYPES.find(f => f.id === plot.flower!.flowerTypeId)
  if (!flowerType) return { success: false, message: '花朵类型异常' }
  const stolenFlower = plot.flower
  const flowerName = flowerType.name
  const flowerEmoji = flowerType.emoji
  const victimNewPlots = victim.plots.map(p => p.id === plotId ? { ...p, flower: null } : p)
  const sellPrice = getFlowerSellPrice(flowerType, stolenFlower.rank)
  const compensation = Math.floor(sellPrice * STEAL_CONFIG.victimCompensationRate)
  await updateUser(victimId, { plots: victimNewPlots, coins: victim.coins + compensation })
  await updateUser(thiefId, { stealCountToday: stealCountToday + 1, stealResetAt: now + STEAL_CONFIG.plotStealCooldown })
  const logId = genId('sl')
  await sb.from('steal_logs').insert({ id: logId, thief_id: thiefId, thief_name: thief.nickname, victim_id: victimId, victim_name: victim.nickname, plot_id: plotId, flower_type_id: stolenFlower.flowerTypeId, flower_name: flowerName, flower_emoji: flowerEmoji, rank: stolenFlower.rank, stolen_at: now })
  await sb.from('plot_steal_records').insert({ id: genId('psr'), victim_id: victimId, plot_id: plotId, thief_id: thiefId, stolen_at: now, reset_at: now + STEAL_CONFIG.plotStealCooldown })
  await createNotification({ userId: victimId, type: 'system', title: '💔 花被偷了！', content: `${thief.nickname} 偷走了你的 ${flowerEmoji} ${flowerName}！获得补偿 ${compensation} 金币。` })
  return { success: true, message: `偷花成功！获得 ${flowerEmoji} ${flowerName}（${['黑铁','青铜','白银','黄金','铂金','钻石','传说'][stolenFlower.rank - 1]}）`, flower: { flowerTypeId: stolenFlower.flowerTypeId, name: flowerName, emoji: flowerEmoji, rank: stolenFlower.rank } }
}

export async function getStealLogs(victimId: string, limit = 20): Promise<StealLog[]> {
  const sb = getSupabase()
  const { data, error } = await sb.from('steal_logs').select('*').eq('victim_id', victimId).order('stolen_at', { ascending: false }).limit(limit)
  if (error || !data) return []
  return data.map((d: any) => ({ id: d.id, thiefId: d.thief_id, thiefName: d.thief_name, victimId: d.victim_id, victimName: d.victim_name, plotId: d.plot_id, flowerTypeId: d.flower_type_id, flowerName: d.flower_name, flowerEmoji: d.flower_emoji, rank: d.rank, stolenAt: d.stolen_at }))
}

// ==================== 敏感词库（后台化） ====================
let _sensitiveWordsCache: { words: string[]; expireAt: number } | null = null
const SENSITIVE_CACHE_TTL = 30 * 1000
export async function getSensitiveWords(): Promise<SensitiveWord[]> {
  const sb = getSupabase()
  try {
    const { data, error } = await sb.from('sensitive_words').select('*').order('created_at', { ascending: true })
    if (error || !data) return []
    return data.map((d: any) => ({ id: d.id, word: d.word, createdAt: d.created_at, createdBy: d.created_by }))
  } catch (e: any) { logger.warn('chat', `获取敏感词失败: ${e?.message}`); return [] }
}
export async function getSensitiveWordList(): Promise<string[]> {
  const now = Date.now()
  if (_sensitiveWordsCache && now < _sensitiveWordsCache.expireAt) return _sensitiveWordsCache.words
  const list = await getSensitiveWords()
  const words = list.map(w => w.word)
  _sensitiveWordsCache = { words, expireAt: now + SENSITIVE_CACHE_TTL }
  return words
}
export function clearSensitiveWordsCache(): void { _sensitiveWordsCache = null }
export async function addSensitiveWord(word: string, createdBy: string | null = null): Promise<SensitiveWord | null> {
  const sb = getSupabase()
  const trimmed = word.trim()
  if (!trimmed) return null
  const sw: SensitiveWord = { id: genId('sw'), word: trimmed, createdAt: Date.now(), createdBy }
  const { error } = await sb.from('sensitive_words').insert({ id: sw.id, word: sw.word, created_at: sw.createdAt, created_by: sw.createdBy })
  if (error) { if (error.code === '23505') return null; logger.error('chat', '添加敏感词失败', { error: error.message }); return null }
  clearSensitiveWordsCache()
  return sw
}
export async function removeSensitiveWord(id: string): Promise<boolean> {
  const sb = getSupabase()
  const { error } = await sb.from('sensitive_words').delete().eq('id', id)
  if (error) { logger.error('chat', '删除敏感词失败', { error: error.message }); return false }
  clearSensitiveWordsCache()
  return true
}

// ==================== 聊天设置（频率限制配置） ====================
const DEFAULT_CHAT_SETTINGS: ChatSettings = { maxMessagesPerMinute: 5, maxMessageLength: 200, minMessageIntervalMs: 2000, enabled: true, updatedAt: 0 }
export async function getChatSettings(): Promise<ChatSettings> {
  const sb = getSupabase()
  try {
    const { data, error } = await sb.from('chat_settings').select('*').eq('id', 1).single()
    if (error || !data) return { ...DEFAULT_CHAT_SETTINGS, updatedAt: Date.now() }
    return { maxMessagesPerMinute: data.max_messages_per_minute, maxMessageLength: data.max_message_length, minMessageIntervalMs: data.min_message_interval_ms, enabled: data.enabled, updatedAt: data.updated_at }
  } catch { return { ...DEFAULT_CHAT_SETTINGS, updatedAt: Date.now() } }
}
export async function updateChatSettings(updates: Partial<ChatSettings>): Promise<ChatSettings | null> {
  const sb = getSupabase()
  const current = await getChatSettings()
  const merged: ChatSettings = { ...current, ...updates, updatedAt: Date.now() }
  const row: Record<string, any> = { id: 1, max_messages_per_minute: merged.maxMessagesPerMinute, max_message_length: merged.maxMessageLength, min_message_interval_ms: merged.minMessageIntervalMs, enabled: merged.enabled, updated_at: merged.updatedAt }
  const { error } = await sb.from('chat_settings').upsert(row)
  if (error) { logger.error('chat', '更新聊天设置失败', { error: error.message }); return null }
  return merged
}

// ==================== 服务端消息频率限制 ====================
function getRateLimitStore(): Map<string, number[]> {
  try { const g = globalThis as any; g.__gardenRateLimit = g.__gardenRateLimit || new Map<string, number[]>(); return g.__gardenRateLimit } catch { return new Map<string, number[]>() }
}
function getLastMessageStore(): Map<string, number> {
  try { const g = globalThis as any; g.__gardenLastMsg = g.__gardenLastMsg || new Map<string, number>(); return g.__gardenLastMsg } catch { return new Map<string, number>() }
}
export interface RateLimitResult { allowed: boolean; reason?: string; retryAfterMs?: number }
export async function checkMessageRateLimit(userId: string): Promise<RateLimitResult> {
  const settings = await getChatSettings()
  if (!settings.enabled) return { allowed: true }
  const now = Date.now()
  const lastStore = getLastMessageStore()
  const lastTs = lastStore.get(userId) || 0
  const sinceLast = now - lastTs
  if (sinceLast < settings.minMessageIntervalMs) return { allowed: false, reason: `发言太快，请稍候`, retryAfterMs: settings.minMessageIntervalMs - sinceLast }
  const rateStore = getRateLimitStore()
  const times = (rateStore.get(userId) || []).filter(t => now - t < 60000)
  if (times.length >= settings.maxMessagesPerMinute) {
    const oldest = Math.min(...times)
    return { allowed: false, reason: `每分钟最多 ${settings.maxMessagesPerMinute} 条，请稍候`, retryAfterMs: 60000 - (now - oldest) }
  }
  return { allowed: true }
}
export function recordServerMessageTime(userId: string): void {
  const now = Date.now()
  const lastStore = getLastMessageStore()
  lastStore.set(userId, now)
  const rateStore = getRateLimitStore()
  const times = (rateStore.get(userId) || []).filter(t => now - t < 60000)
  times.push(now)
  rateStore.set(userId, times)
}

// ==================== 聊天管理（后台） ====================
export async function getRecentMessagesAllChannels(limit = 100, channel?: string): Promise<ChatMessage[]> {
  await seedDatabase()
  const sb = getSupabase()
  const col = await detectMessagesTimeCol()
  try {
    let query = sb.from('messages').select('*').order(col, { ascending: false }).limit(limit)
    if (channel) query = query.eq('channel', channel)
    const { data, error } = await query
    if (error || !data) return []
    return data.map(dbRowToMessage)
  } catch { return [] }
}
export async function deleteMessage(id: string): Promise<boolean> {
  const sb = getSupabase()
  const { error } = await sb.from('messages').delete().eq('id', id)
  if (error) { logger.error('chat', '删除消息失败', { id, error: error.message }); return false }
  logger.info('chat', '管理员删除消息', { id })
  return true
}
export async function deleteMessagesByUser(userId: string): Promise<number> {
  const sb = getSupabase()
  const { data, error } = await sb.from('messages').delete().eq('user_id', userId).select('id')
  if (error) { logger.error('chat', '批量删除用户消息失败', { userId, error: error.message }); return 0 }
  const count = data?.length || 0
  logger.info('chat', '管理员批量删除用户消息', { userId, count })
  return count
}
export async function getChatStats(): Promise<ChatStats> {
  await seedDatabase()
  const sb = getSupabase()
  const now = Date.now()
  const todayStart = now - 24 * 60 * 60 * 1000
  const channels: ChatChannel[] = ['world', 'family', 'friend']
  const counts: Record<string, number> = { world: 0, family: 0, friend: 0 }
  let totalCount = 0
  let todayCount = 0
  const userCounter: Record<string, { userId: string; userName: string; count: number }> = {}
  try {
    const { data, error } = await sb.from('messages').select('*')
    if (error) logger.warn('chat', `获取聊天统计查询错误: ${error.message}`)
    else if (data && Array.isArray(data)) processChannelData(data)
  } catch (e: any) { logger.warn('chat', `获取聊天统计失败: ${e?.message}`) }
  function processChannelData(msgs: any[]) {
    for (const m of msgs) {
      const ch = m.channel as ChatChannel
      if (ch && channels.includes(ch)) { counts[ch]++; totalCount++ }
      const ts = (typeof m.timestamp === 'number' ? m.timestamp : m.created_at) || 0
      if (ts > todayStart && !m.is_system) todayCount++
      if (m.user_id && m.user_id !== 'system' && !m.is_system) {
        if (!userCounter[m.user_id]) userCounter[m.user_id] = { userId: m.user_id, userName: m.user_name || '未知', count: 0 }
        userCounter[m.user_id].count++
      }
    }
  }
  const topUsers = Object.values(userCounter).sort((a, b) => b.count - a.count).slice(0, 10)
  return { worldCount: counts.world, familyCount: counts.family, friendCount: counts.friend, totalCount, todayCount, topUsers }
}

// ==================== 花园点赞（社交增强） ====================
export async function getGardenLikeCount(targetId: string): Promise<number> {
  const sb = getSupabase()
  try {
    const { count, error } = await sb.from('garden_likes').select('*', { count: 'exact', head: true }).eq('target_id', targetId)
    if (error || count === null) return 0
    return count
  } catch { return 0 }
}
export async function hasLiked(likerId: string, targetId: string): Promise<boolean> {
  const sb = getSupabase()
  try { const { data } = await sb.from('garden_likes').select('id').eq('liker_id', likerId).eq('target_id', targetId).limit(1); return !!(data && data.length > 0) } catch { return false }
}
export async function toggleGardenLike(likerId: string, targetId: string): Promise<{ liked: boolean; count: number }> {
  const sb = getSupabase()
  const existed = await hasLiked(likerId, targetId)
  if (existed) await sb.from('garden_likes').delete().eq('liker_id', likerId).eq('target_id', targetId)
  else await sb.from('garden_likes').insert({ id: genId('gl'), liker_id: likerId, target_id: targetId, created_at: Date.now() })
  const count = await getGardenLikeCount(targetId)
  return { liked: !existed, count }
}

// ==================== 好友浇水（社交增强） ====================
function getFriendWaterStore(): Map<string, number[]> {
  try { const g = globalThis as any; g.__gardenFriendWater = g.__gardenFriendWater || new Map<string, number[]>(); return g.__gardenFriendWater } catch { return new Map<string, number[]>() }
}
const FRIEND_WATER_DAILY_LIMIT = 5
const FRIEND_WATER_GROWTH_BONUS = 5
const FRIEND_WATER_COIN_REWARD = 2
export async function waterFriendFlower(watererId: string, targetId: string, plotId: number): Promise<{ success: boolean; message: string; reward?: number }> {
  if (watererId === targetId) return { success: false, message: '不能给自己的花浇水（请用花园页浇水）' }
  const now = Date.now()
  const store = getFriendWaterStore()
  const times = (store.get(watererId) || []).filter(t => now - t < 86400000)
  if (times.length >= FRIEND_WATER_DAILY_LIMIT) return { success: false, message: `今日好友浇水次数已用完（${FRIEND_WATER_DAILY_LIMIT}次）` }
  const target = await findUserById(targetId)
  if (!target) return { success: false, message: '目标用户不存在' }
  const plot = target.plots.find(p => p.id === plotId)
  if (!plot || !plot.unlocked || !plot.flower) return { success: false, message: '该地块没有花朵' }
  if (plot.flower.isReady) return { success: false, message: '花已成熟，无需浇水' }
  const newFlower = { ...plot.flower }
  newFlower.growthProgress = Math.min(100, newFlower.growthProgress + FRIEND_WATER_GROWTH_BONUS)
  newFlower.waterCount += 1
  newFlower.lastWaterAt = now
  if (newFlower.growthProgress >= 100) { newFlower.growthProgress = 100; newFlower.isReady = true }
  const newPlots = target.plots.map(p => p.id === plotId ? { ...p, flower: newFlower } : p)
  await updateUser(targetId, { plots: newPlots })
  const waterer = await findUserById(watererId)
  if (waterer) await updateUser(watererId, { coins: waterer.coins + FRIEND_WATER_COIN_REWARD })
  times.push(now)
  store.set(watererId, times)
  const watererName = waterer?.nickname || '好友'
  await createNotification({ userId: targetId, type: 'system', title: '💧 好友帮你浇水啦', content: `${watererName} 帮你的花浇了水，生长 +${FRIEND_WATER_GROWTH_BONUS}%` })
  return { success: true, message: `浇水成功！花朵生长 +${FRIEND_WATER_GROWTH_BONUS}%，你获得 ${FRIEND_WATER_COIN_REWARD} 金币`, reward: FRIEND_WATER_COIN_REWARD }
}
export function getFriendWaterRemainingToday(userId: string): number {
  const store = getFriendWaterStore()
  const now = Date.now()
  const times = (store.get(userId) || []).filter(t => now - t < 86400000)
  return Math.max(0, FRIEND_WATER_DAILY_LIMIT - times.length)
}

// ==================== 好友系统 ====================
export async function searchUsers(currentUserId: string, keyword: string, limit = 20): Promise<User[]> {
  const all = await getAllUsers()
  const kw = keyword.trim().toLowerCase()
  if (!kw) return []
  return all.filter((u) => u.id !== currentUserId && !u.deleted && !u.friends.includes(currentUserId) && (u.nickname.toLowerCase().includes(kw) || u.username.toLowerCase().includes(kw) || u.id.toLowerCase().includes(kw))).slice(0, limit)
}
export async function sendFriendRequest(fromUserId: string, toUserId: string, message?: string): Promise<{ success: boolean; error?: string; request?: any }> {
  if (fromUserId === toUserId) return { success: false, error: '不能加自己为好友' }
  const from = await findUserById(fromUserId)
  const to = await findUserById(toUserId)
  if (!from || !to) return { success: false, error: '用户不存在' }
  if (to.deleted) return { success: false, error: '该用户已注销' }
  if (from.friends.includes(toUserId)) return { success: false, error: '已经是好友了' }
  const outgoing = from.outgoingFriendRequests || []
  if (outgoing.some((r) => r.toUserId === toUserId && r.status === 'pending')) return { success: false, error: '已发送过申请，等待对方处理' }
  const incoming = to.incomingFriendRequests || []
  if (incoming.some((r) => r.fromUserId === fromUserId && r.status === 'pending')) return { success: false, error: '对方已有你的待处理申请' }
  const now = Date.now()
  const request: any = { id: `fr_${now}_${Math.random().toString(36).slice(2, 8)}`, fromUserId, fromUserName: from.nickname, fromUserAvatar: from.avatar, toUserId, toUserName: to.nickname, toUserAvatar: to.avatar, status: 'pending', createdAt: now, message: message || '' }
  await Promise.all([updateUser(fromUserId, { outgoingFriendRequests: [...outgoing, request] }), updateUser(toUserId, { incomingFriendRequests: [...incoming, request] })])
  await createNotification({ userId: toUserId, type: 'friend', title: '👋 好友申请', content: `${from.nickname} 申请加你为好友${message ? `：「${message}」` : ''}` })
  return { success: true, request }
}
export async function handleFriendRequest(currentUserId: string, requestId: string, action: 'accept' | 'reject'): Promise<{ success: boolean; error?: string }> {
  const me = await findUserById(currentUserId)
  if (!me) return { success: false, error: '用户不存在' }
  const incoming = me.incomingFriendRequests || []
  const req = incoming.find((r) => r.id === requestId)
  if (!req) return { success: false, error: '申请不存在' }
  if (req.toUserId !== currentUserId) return { success: false, error: '无权操作此申请' }
  if (req.status !== 'pending') return { success: false, error: '申请已处理过' }
  const fromUser = await findUserById(req.fromUserId)
  if (!fromUser) return { success: false, error: '对方用户不存在' }
  const newStatus = action === 'accept' ? 'accepted' : 'rejected'
  if (action === 'accept') {
    const myFriends = [...me.friends, req.fromUserId]
    const theirFriends = [...fromUser.friends, currentUserId]
    await Promise.all([updateUser(currentUserId, { friends: myFriends, incomingFriendRequests: incoming.map((r) => r.id === requestId ? { ...r, status: newStatus } : r) }), updateUser(req.fromUserId, { friends: theirFriends, outgoingFriendRequests: (fromUser.outgoingFriendRequests || []).map((r) => r.id === requestId ? { ...r, status: newStatus } : r) })])
    await createNotification({ userId: req.fromUserId, type: 'friend', title: '🎉 好友申请通过', content: `你和 ${me.nickname} 已经是好友了！` })
  } else {
    await Promise.all([updateUser(currentUserId, { incomingFriendRequests: incoming.map((r) => r.id === requestId ? { ...r, status: newStatus } : r) }), updateUser(req.fromUserId, { outgoingFriendRequests: (fromUser.outgoingFriendRequests || []).map((r) => r.id === requestId ? { ...r, status: newStatus } : r) })])
  }
  return { success: true }
}
export async function removeFriend(currentUserId: string, friendId: string): Promise<{ success: boolean; error?: string }> {
  const me = await findUserById(currentUserId)
  const friend = await findUserById(friendId)
  if (!me || !friend) return { success: false, error: '用户不存在' }
  if (!me.friends.includes(friendId)) return { success: false, error: '不是好友' }
  await Promise.all([updateUser(currentUserId, { friends: me.friends.filter((f) => f !== friendId) }), updateUser(friendId, { friends: friend.friends.filter((f) => f !== currentUserId) })])
  return { success: true }
}
export async function getFriendProfiles(currentUserId: string): Promise<any[]> {
  const me = await findUserById(currentUserId)
  if (!me) return []
  const all = await getAllUsers()
  return me.friends.map((fid) => { const u = all.find((x) => x.id === fid && !x.deleted); if (!u) return null; return { id: u.id, nickname: u.nickname, avatar: u.avatar, online: Date.now() - u.lastLogin < 5 * 60 * 1000, lastLogin: u.lastLogin, plotsUnlocked: u.plots.filter((p) => p.unlocked).length, coins: u.coins, familyId: u.familyId, familyName: null, title: u.title || '' } }).filter(Boolean)
}

// ==================== 家族系统（真实版） ====================
export { FAMILY_LEVEL_EXP }
export const getFamilyLevel = calcFamilyLevel
export const getFamilyMaxMembers = calcFamilyMaxMembers
export async function getFamilies(keyword?: string, limit = 50): Promise<Family[]> {
  await seedDatabase()
  const sb = getSupabase()
  try {
    let query = sb.from('families').select('*').order('level', { ascending: false }).order('exp', { ascending: false }).limit(limit)
    const { data, error } = await query
    if (error || !data) return []
    const list = data.map(dbRowToFamily)
    if (keyword) { const kw = keyword.trim().toLowerCase(); return list.filter((f) => f.name.toLowerCase().includes(kw)) }
    return list
  } catch { return [] }
}
function dbRowToFamily(row: any): Family {
  const members = Array.isArray(row.members) ? row.members.map((m: any) => ({ userId: m.user_id || m.userId, role: m.role || 'member', contribution: Number(m.contribution || 0), joinedAt: Number(m.joined_at || m.joinedAt || Date.now()) })) : []
  return { id: row.id, name: row.name, avatar: row.avatar || '🏰', announcement: row.announcement || '', ownerId: row.owner_id, members, level: Number(row.level || 1), exp: Number(row.exp || 0), maxMembers: Number(row.max_members || 10), createdAt: Number(row.created_at || 0) }
}
export async function findFamilyById(id: string): Promise<Family | null> {
  const sb = getSupabase()
  const { data, error } = await sb.from('families').select('*').eq('id', id).single()
  if (error || !data) return null
  return dbRowToFamily(data)
}
export async function findFamilyByName(name: string): Promise<Family | null> {
  const sb = getSupabase()
  const { data, error } = await sb.from('families').select('*').eq('name', name.trim()).single()
  if (error || !data) return null
  return dbRowToFamily(data)
}
export async function createFamilyReal(ownerId: string, name: string, announcement: string, avatar = '🏰'): Promise<{ success: boolean; error?: string; family?: Family }> {
  const owner = await findUserById(ownerId)
  if (!owner) return { success: false, error: '用户不存在' }
  if (owner.familyId) return { success: false, error: '你已加入其他家族，请先退出' }
  if (owner.coins < 1000) return { success: false, error: '创建家族需要 1000 金币' }
  const exist = await findFamilyByName(name)
  if (exist) return { success: false, error: '家族名称已存在' }
  const sb = getSupabase()
  const id = `fam_${Date.now()}`
  const now = Date.now()
  const row = { id, name: name.trim(), avatar, announcement: announcement || '', owner_id: ownerId, members: [{ userId: ownerId, role: 'owner', contribution: 0 }], level: 1, exp: 0, max_members: 10, created_at: now }
  const { error } = await sb.from('families').insert(row)
  if (error) return { success: false, error: error.message }
  await updateUser(ownerId, { coins: owner.coins - 1000, familyId: id })
  const family = await findFamilyById(id)
  return { success: true, family: family! }
}
export async function joinFamily(userId: string, familyId: string): Promise<{ success: boolean; error?: string }> {
  const u = await findUserById(userId)
  if (!u) return { success: false, error: '用户不存在' }
  if (u.familyId) return { success: false, error: '你已加入其他家族' }
  const fam = await findFamilyById(familyId)
  if (!fam) return { success: false, error: '家族不存在' }
  if (fam.members.length >= fam.maxMembers) return { success: false, error: '家族人数已满' }
  const sb = getSupabase()
  const newMembers = [...fam.members, { userId, role: 'member' as const, contribution: 0 }]
  await sb.from('families').update({ members: newMembers }).eq('id', familyId)
  await updateUser(userId, { familyId })
  await createNotification({ userId: fam.ownerId, type: 'family', title: '👪 新成员加入', content: `${u.nickname} 加入了你的家族！` })
  return { success: true }
}
export async function leaveFamilyReal(userId: string): Promise<{ success: boolean; error?: string }> {
  const u = await findUserById(userId)
  const sb = getSupabase()
  try {
    const { data: allFamilies } = await sb.from('families').select('id, members')
    if (allFamilies && Array.isArray(allFamilies)) {
      for (const fam of allFamilies as any[]) {
        if (!Array.isArray(fam.members)) continue
        if (fam.members.some((m: any) => m && m.userId === userId)) {
          const newMembers = fam.members.filter((m: any) => m && m.userId !== userId)
          let updates: Record<string, any> = { members: newMembers }
          if (fam.owner_id === userId && newMembers.length > 0) {
            const newOwner = newMembers.find((m: any) => m.role === 'admin') || newMembers[0]
            updates.owner_id = newOwner.userId
            updates.members = newMembers.map((m: any) => m.userId === newOwner.userId ? { ...m, role: 'owner' } : m)
          }
          if (newMembers.length === 0) await sb.from('families').delete().eq('id', fam.id)
          else await sb.from('families').update(updates).eq('id', fam.id)
        }
      }
    }
  } catch (e: any) { logger.warn('family', `leaveFamilyReal 清理 families.members 脏数据失败: ${e?.message}`) }
  if (!u) return { success: false, error: '用户不存在' }
  if (!u.familyId) { await updateUser(userId, { familyId: null }); return { success: true } }
  const fam = await findFamilyById(u.familyId)
  if (!fam) { await updateUser(userId, { familyId: null }); return { success: true } }
  const isOwner = fam.ownerId === userId
  if (isOwner) {
    const other = fam.members.filter((m) => m.userId !== userId)
    if (other.length > 0) {
      const admin = other.find((m) => m.role === 'admin') || other[0]
      const newOwnerId = admin.userId
      const newMembers = fam.members.filter((m) => m.userId !== userId).map((m) => m.userId === newOwnerId ? { ...m, role: 'owner' as const } : m)
      await sb.from('families').update({ members: newMembers, owner_id: newOwnerId }).eq('id', fam.id)
    } else {
      await sb.from('families').delete().eq('id', fam.id)
    }
  } else {
    const newMembers = fam.members.filter((m) => m.userId !== userId)
    await sb.from('families').update({ members: newMembers }).eq('id', fam.id)
  }
  await updateUser(userId, { familyId: null })
  return { success: true }
}
export async function setFamilyMemberRole(operatorId: string, familyId: string, targetUserId: string, role: 'owner' | 'admin' | 'member'): Promise<{ success: boolean; error?: string }> {
  const fam = await findFamilyById(familyId)
  if (!fam) return { success: false, error: '家族不存在' }
  if (fam.ownerId !== operatorId) return { success: false, error: '仅族长可操作' }
  const sb = getSupabase()
  let newMembers = fam.members.map((m) => m.userId === targetUserId ? { ...m, role } : m)
  let ownerId = fam.ownerId
  if (role === 'owner') { newMembers = newMembers.map((m) => m.userId === operatorId ? { ...m, role: 'member' as const } : m); ownerId = targetUserId }
  await sb.from('families').update({ members: newMembers, owner_id: ownerId }).eq('id', familyId)
  return { success: true }
}
export async function kickFamilyMember(operatorId: string, familyId: string, targetUserId: string): Promise<{ success: boolean; error?: string }> {
  const fam = await findFamilyById(familyId)
  if (!fam) return { success: false, error: '家族不存在' }
  const operator = fam.members.find((m) => m.userId === operatorId)
  if (!operator) return { success: false, error: '你不在家族中' }
  if (operator.role === 'member') return { success: false, error: '无权踢出成员' }
  if (fam.ownerId === targetUserId) return { success: false, error: '不能踢出族长' }
  const sb = getSupabase()
  const newMembers = fam.members.filter((m) => m.userId !== targetUserId)
  await sb.from('families').update({ members: newMembers }).eq('id', familyId)
  await updateUser(targetUserId, { familyId: null })
  return { success: true }
}
export async function addFamilyExp(familyId: string, exp: number): Promise<void> {
  const fam = await findFamilyById(familyId)
  if (!fam) return
  const sb = getSupabase()
  const newExp = fam.exp + exp
  const newLevel = getFamilyLevel(newExp)
  const newMax = getFamilyMaxMembers(newLevel)
  await sb.from('families').update({ exp: newExp, level: newLevel, max_members: newMax }).eq('id', familyId)
}
export async function updateFamilyInfo(operatorId: string, familyId: string, data: { name?: string; announcement?: string; avatar?: string }): Promise<{ success: boolean; error?: string }> {
  const fam = await findFamilyById(familyId)
  if (!fam) return { success: false, error: '家族不存在' }
  if (fam.ownerId !== operatorId) return { success: false, error: '仅族长可编辑' }
  const sb = getSupabase()
  const updates: Record<string, any> = {}
  if (data.announcement !== undefined) updates.announcement = data.announcement
  if (data.avatar !== undefined) updates.avatar = data.avatar
  if (data.name !== undefined) { const trimmed = data.name.trim(); if (!trimmed) return { success: false, error: '家族名不能为空' }; const dup = await findFamilyByName(trimmed); if (dup && dup.id !== familyId) return { success: false, error: '家族名称已存在' }; updates.name = trimmed }
  if (Object.keys(updates).length === 0) return { success: true }
  const { error } = await sb.from('families').update(updates).eq('id', familyId)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

// ============== 价格覆盖（后台调控） ==============
export interface PriceOverrides { flowers?: Record<string, { baseSellPrice?: number; seedPrice?: number }>; seeds?: Record<string, { price?: number }>; tools?: Record<string, { price?: number }>; feeRate?: number; minListPrice?: number; maxListPrice?: number; updatedAt?: number; updatedBy?: string }
let _priceOverridesCache: PriceOverrides | null = null
function priceOverridesRow(row: any): PriceOverrides { if (!row) return {}; return { flowers: row.flowers || undefined, seeds: row.seeds || undefined, tools: row.tools || undefined, feeRate: row.fee_rate ?? undefined, minListPrice: row.min_list_price ?? undefined, maxListPrice: row.max_list_price ?? undefined, updatedAt: row.updated_at, updatedBy: row.updated_by } }
export async function getPriceOverrides(): Promise<PriceOverrides> { await seedDatabase(); if (_priceOverridesCache) return _priceOverridesCache; const sb = getSupabase(); const { data, error } = await sb.from('price_overrides').select('*').order('updated_at', { ascending: false }).limit(1); if (error || !data || data.length === 0) { try { _priceOverridesCache = {} } catch {} return _priceOverridesCache || {} } _priceOverridesCache = priceOverridesRow(data[0]); return _priceOverridesCache }
export async function setPriceOverrides(adminId: string, overrides: PriceOverrides): Promise<{ success: boolean; error?: string }> { await seedDatabase(); const sb = getSupabase(); const { error } = await sb.from('price_overrides').insert({ flowers: overrides.flowers || null, seeds: overrides.seeds || null, tools: overrides.tools || null, fee_rate: overrides.feeRate ?? null, min_list_price: overrides.minListPrice ?? null, max_list_price: overrides.maxListPrice ?? null, updated_by: adminId, updated_at: Date.now() }); if (error) return { success: false, error: error.message }; _priceOverridesCache = { ...overrides, updatedAt: Date.now(), updatedBy: adminId }; return { success: true } }
export function applyFlowerPriceOverrides(flower: { id: string; baseSellPrice: number; seedPrice: number }, rank: number, overrides?: PriceOverrides): { sell: number; seed: number } {
  const rankMultipliers = [1, 1.5, 2.2, 3.2, 5, 8, 15]
  const rankMul = rankMultipliers[Math.max(0, Math.min(rankMultipliers.length - 1, rank - 1))] || 1
  const flowerOver = overrides?.flowers?.[flower.id] || {}
  let base = flowerOver.baseSellPrice ?? flower.baseSellPrice
  if (base < 0) base = flower.baseSellPrice
  const sell = Math.floor(base * rankMul)
  const seed = (flowerOver.seedPrice ?? flower.seedPrice)
  return { sell, seed: seed < 0 ? flower.seedPrice : seed }
}

// ============== 管理员/市场 辅助函数 ==============
function dbRowToListing(row: any): MarketListing {
  return {
    id: row.id,
    itemType: row.item_type as ListingType,
    referenceId: row.reference_id,
    name: row.name,
    emoji: row.emoji,
    rank: Number(row.rank || 1),
    price: Number(row.price || 0),
    quantity: Number(row.quantity || 0),
    sellerId: row.seller_id,
    sellerName: row.seller_name || '',
    isOfficial: !!row.is_official,
    createdAt: Number(row.created_at || 0),
    buyerId: row.buyer_id || null,
    soldAt: row.sold_at ? Number(row.sold_at) : null,
    status: row.status || 'active',
  }
}
export async function createListing(l: Omit<MarketListing, 'id' | 'createdAt'> & { id?: string }): Promise<MarketListing> {
  await seedDatabase()
  const sb = getSupabase()
  const id = l.id || genId('l')
  const row: Record<string, any> = {
    id, item_type: l.itemType, reference_id: l.referenceId, name: l.name, emoji: l.emoji,
    rank: l.rank, price: l.price, quantity: l.quantity, seller_id: l.sellerId, seller_name: l.sellerName,
    is_official: !!l.isOfficial, created_at: Date.now(), buyer_id: l.buyerId || null, sold_at: l.soldAt || null, status: l.status || 'active',
  }
  const { error } = await sb.from('listings').insert(row)
  if (error) throw new Error(error.message)
  const listing = await findListing(id)
  if (!listing) throw new Error('创建挂售失败')
  return listing
}
export async function findListing(id: string): Promise<MarketListing | null> {
  const sb = getSupabase()
  const { data, error } = await sb.from('listings').select('*').eq('id', id).limit(1).maybeSingle()
  if (error || !data) return null
  return dbRowToListing(data)
}
export async function removeListing(id: string): Promise<boolean> {
  const sb = getSupabase()
  const { error } = await sb.from('listings').delete().eq('id', id)
  if (error) return false
  return true
}
export async function getListingItems(itemType?: string, limit = 100, offset = 0): Promise<{ items: any[]; total: number }> {
  await seedDatabase()
  const sb = getSupabase()
  let query: any = sb.from('listings').select('*', { count: 'exact' })
  if (itemType) query = query.eq('item_type', itemType)
  query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1)
  const { data, error, count } = await query
  const items: any[] = (data || []).map((r: any) => { const l = dbRowToListing(r); return { ...l, source: l.isOfficial ? 'official' : 'player' } })
  return { items, total: count ?? items.length }
}
export async function createAdminListing(data: { itemType: 'flower' | 'seed' | 'tool'; referenceId: string; name: string; emoji: string; rank?: number; price: number; quantity: number }): Promise<{ success: boolean; error?: string; listing?: MarketListing }> {
  if (data.price <= 0) return { success: false, error: '价格需大于 0' }
  if (data.quantity <= 0) return { success: false, error: '数量需大于 0' }
  try { const listing = await createListing({ sellerId: 'official', sellerName: '官方商城', isOfficial: true, itemType: data.itemType, referenceId: data.referenceId, name: data.name, emoji: data.emoji, rank: (data.rank as any) || 1, price: data.price, quantity: data.quantity }); return { success: true, listing } } catch (e: any) { return { success: false, error: e.message } }
}
export async function removeListingExt(userId: string | null | undefined, id: string, forceAdmin = false): Promise<{ success: boolean; error?: string }> {
  const l = await findListing(id)
  if (!l) return { success: false, error: '商品不存在' }
  if (forceAdmin) { const ok = await removeListing(id); return { success: ok, error: ok ? undefined : '删除失败' } }
  if (!userId) return { success: false, error: '未登录' }
  if (l.sellerId !== userId) return { success: false, error: '不能下架他人商品' }
  const ok = await removeListing(id)
  return { success: ok, error: ok ? undefined : '删除失败' }
}
export async function getAllUserBaseCount(): Promise<number> { await seedDatabase(); const sb = getSupabase(); const { count, error } = await sb.from('users').select('id', { count: 'exact', head: true }); if (error) return 0; return count ?? 0 }
export async function getAllFamilies(): Promise<Family[]> { return getFamilies(undefined, 500) }
export async function findAdminByUserId(userId: string): Promise<User | null> { const user = await findUserById(userId); if (!user || !user.isAdmin) return null; return user }
export async function updateAdminPassword(userId: string, newPasswordHash: string): Promise<void> { await updateUser(userId, { password: newPasswordHash }) }
export async function updateUserPassword(userId: string, newPasswordHash: string): Promise<void> { await updateUser(userId, { password: newPasswordHash }) }

// ============================================================
// 私聊系统：Private Messages
// ============================================================
function dbRowToPrivateMessage(row: any): PrivateMessage {
  return {
    id: row.id,
    fromUserId: row.from_user_id,
    toUserId: row.to_user_id,
    content: row.content,
    fromName: row.from_name,
    fromAvatar: row.from_avatar,
    toName: row.to_name,
    toAvatar: row.to_avatar,
    createdAt: (typeof row.created_at === 'number' ? row.created_at : Number(row.created_at)) ?? Date.now(),
    readAt: row.read_at ? (typeof row.read_at === 'number' ? row.read_at : Number(row.read_at)) : null,
  }
}
function canPrivateMessage(fromId: string, toId: string, fromUser: User | null): boolean {
  if (!fromId || !toId || fromId === toId) return false
  const user = fromUser
  if (!user) return false
  return Array.isArray(user.friends) && user.friends.includes(toId)
}
export async function sendPrivateMessage(fromUser: User, toUserId: string, content: string): Promise<{ success: boolean; message?: PrivateMessage; error?: string }> {
  if (!content || !content.trim()) return { success: false, error: '消息内容不能为空' }
  if (!canPrivateMessage(fromUser.id, toUserId, fromUser)) return { success: false, error: '只能与好友私聊' }
  if (fromUser.mutedUntil && fromUser.mutedUntil > Date.now()) return { success: false, error: '您已被禁言，无法发送消息' }
  await seedDatabase()
  const sb = getSupabase()
  const target = await findUserById(toUserId)
  if (!target) return { success: false, error: '对方用户不存在' }
  const now = Date.now()
  const msg: PrivateMessage = {
    id: `pm_${now}_${Math.random().toString(36).slice(2, 8)}`,
    fromUserId: fromUser.id,
    toUserId: target.id,
    content: content.trim().slice(0, 500),
    fromName: fromUser.nickname,
    fromAvatar: fromUser.avatar,
    toName: target.nickname,
    toAvatar: target.avatar,
    createdAt: now,
  }
  const row = { id: msg.id, from_user_id: msg.fromUserId, to_user_id: msg.toUserId, content: msg.content, from_name: msg.fromName, from_avatar: msg.fromAvatar, to_name: msg.toName, to_avatar: msg.toAvatar, created_at: msg.createdAt, read_at: null }
  try {
    const { error } = await sb.from('private_messages').insert(row)
    if (error) { if (isMissingColumnError(error) || /relation .* does not exist/i.test(error.message)) { logger.warn('pm', `私聊表未就绪: ${error.message}`); return { success: false, error: '私聊系统暂时不可用，请稍后再试' } }; return { success: false, error: error.message } }
    return { success: true, message: msg }
  } catch (e: any) { return { success: false, error: e?.message || '发送失败' } }
}
export async function getPrivateMessages(currentUserId: string, peerId: string, limit = 100): Promise<PrivateMessage[]> {
  if (!currentUserId || !peerId || currentUserId === peerId) return []
  await seedDatabase()
  const sb = getSupabase()
  try {
    const { data, error } = await sb.from('private_messages').select('*').or(`and(from_user_id.eq.${currentUserId},to_user_id.eq.${peerId}),and(from_user_id.eq.${peerId},to_user_id.eq.${currentUserId})`).order('created_at', { ascending: false }).limit(limit)
    if (error) { if (isMissingColumnError(error) || /relation .* does not exist/i.test(error.message)) return []; logger.warn('pm', `getPrivateMessages 查询错误: ${error.message}`); return [] }
    const msgs = (data || []).map(dbRowToPrivateMessage)
    msgs.reverse()
    return msgs
  } catch (e: any) { logger.warn('pm', `getPrivateMessages 异常: ${e?.message}`); return [] }
}
export async function markPrivateConversationRead(currentUserId: string, peerId: string): Promise<void> {
  if (!currentUserId || !peerId) return
  await seedDatabase()
  const sb = getSupabase()
  const now = Date.now()
  try {
    const { error } = await sb.from('private_messages').update({ read_at: now }).eq('to_user_id', currentUserId).eq('from_user_id', peerId).is('read_at', null)
    if (error) { if (isMissingColumnError(error) || /relation .* does not exist/i.test(error.message)) return; logger.warn('pm', `markPrivateConversationRead 错误: ${error.message}`) }
  } catch (e: any) { logger.warn('pm', `markPrivateConversationRead 异常: ${e?.message}`) }
}
export async function getPrivateConversations(currentUserId: string): Promise<PrivateConversation[]> {
  if (!currentUserId) return []
  await seedDatabase()
  const sb = getSupabase()
  try {
    const { data, error } = await sb.from('private_messages').select('*').or(`from_user_id.eq.${currentUserId},to_user_id.eq.${currentUserId}`).order('created_at', { ascending: false }).limit(1000)
    if (error) { if (isMissingColumnError(error) || /relation .* does not exist/i.test(error.message)) return []; logger.warn('pm', `getPrivateConversations 查询错误: ${error.message}`); return [] }
    const user = await findUserById(currentUserId)
    const friendIds = user?.friends || []
    const map = new Map<string, { lastMsg: PrivateMessage; unreadCount: number }>()
    for (const row of (data || [])) {
      const m = dbRowToPrivateMessage(row)
      const peerId = m.fromUserId === currentUserId ? m.toUserId : m.fromUserId
      if (!friendIds.includes(peerId)) continue
      if (!map.has(peerId)) map.set(peerId, { lastMsg: m, unreadCount: 0 })
      if (m.toUserId === currentUserId && !m.readAt) map.get(peerId)!.unreadCount++
    }
    for (const fid of friendIds) {
      if (!map.has(fid)) {
        const friendUser = await findUserById(fid)
        if (friendUser) map.set(fid, { lastMsg: { id: 'placeholder_' + fid, fromUserId: fid, toUserId: currentUserId, content: '', createdAt: friendUser.lastActiveAt || 0 }, unreadCount: 0 })
      }
    }
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
    const result: PrivateConversation[] = []
    for (const [peerId, info] of map.entries()) {
      const m = info.lastMsg
      const peer = (peerId === m.fromUserId) ? { name: m.fromName || peerId, avatar: m.fromAvatar || '🌱' } : { name: m.toName || peerId, avatar: m.toAvatar || '🌱' }
      let isOnline = false
      try {
        const friend = await findUserById(peerId)
        if (friend) { peer.name = friend.nickname || peer.name; peer.avatar = friend.avatar || peer.avatar; isOnline = (friend.lastActiveAt || 0) >= fiveMinutesAgo }
      } catch {}
      result.push({ peerId, peerName: peer.name, peerAvatar: peer.avatar, lastMessage: m.content || '暂未开始聊天，发送第一句问候吧~', lastMessageAt: m.createdAt || 0, unreadCount: info.unreadCount, isOnline })
    }
    result.sort((a, b) => b.lastMessageAt - a.lastMessageAt)
    return result
  } catch (e: any) { logger.warn('pm', `getPrivateConversations 异常: ${e?.message}`); return [] }
}
export async function getPrivateMessageUnreadCount(currentUserId: string): Promise<number> {
  if (!currentUserId) return 0
  await seedDatabase()
  const sb = getSupabase()
  try {
    const { count, error } = await sb.from('private_messages').select('id', { count: 'exact', head: true }).eq('to_user_id', currentUserId).is('read_at', null)
    if (error) { if (isMissingColumnError(error) || /relation .* does not exist/i.test(error.message)) return 0; return 0 }
    return count ?? 0
  } catch { return 0 }
}
