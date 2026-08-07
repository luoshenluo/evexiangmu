// 服务端数据层 - Supabase 异步实现（替代内存+fs存储）
import { getSupabase } from './supabase'
import { logger } from './logger'
import type {
  User, Family, ChatMessage, ChatChannel, MarketListing, BuyOrder,
  Task, CDK, Notification, GameState, Announcement,
  StealLog, PestSeverity, PlantedFlower, Plot, RankLevel,
  SensitiveWord, ChatSettings, ChatStats,
} from './types'
import {
  FLOWER_TYPES, INITIAL_GAME_STATE, INITIAL_ANNOUNCEMENTS,
  getPlotUnlockPrice, PEST_CONFIG, STEAL_CONFIG, rollPestSeverity,
  getFlowerSellPrice,
} from './game-data'
import bcrypt from 'bcryptjs'

// ==================== 工具函数 ====================

// DB 行 → User 对象（snake_case → camelCase）
function dbRowToUser(row: any): User {
  return {
    id: row.id,
    username: row.username,
    password: row.password,
    nickname: row.nickname,
    avatar: row.avatar,
    coins: row.coins,
    createdAt: row.created_at,
    lastLogin: row.last_login,
    plots: row.plots || [],
    inventory: row.inventory || [],
    inventorySize: row.inventory_size,
    isAdmin: row.is_admin,
    mutedUntil: row.muted_until,
    bannedUntil: row.banned_until || null,
    familyId: row.family_id,
    friends: row.friends || [],
    deleted: row.deleted,
    stealCountToday: row.steal_count_today || 0,
    stealResetAt: row.steal_reset_at || 0,
    gardenProtectedUntil: row.garden_protected_until || 0,
    taskProgress: row.task_progress || {},
    taskClaimed: row.task_claimed || {},
    taskLastReset: row.task_last_reset || {},
  }
}

// User 对象 → DB 行（camelCase → snake_case）
function userToDbRow(user: Partial<User>): Record<string, any> {
  const row: Record<string, any> = {}
  if (user.username !== undefined) row.username = user.username
  if (user.password !== undefined) row.password = user.password
  if (user.nickname !== undefined) row.nickname = user.nickname
  if (user.avatar !== undefined) row.avatar = user.avatar
  if (user.coins !== undefined) row.coins = user.coins
  if (user.createdAt !== undefined) row.created_at = user.createdAt
  if (user.lastLogin !== undefined) row.last_login = user.lastLogin
  if (user.plots !== undefined) row.plots = user.plots
  if (user.inventory !== undefined) row.inventory = user.inventory
  if (user.inventorySize !== undefined) row.inventory_size = user.inventorySize
  if (user.isAdmin !== undefined) row.is_admin = user.isAdmin
  if (user.mutedUntil !== undefined) row.muted_until = user.mutedUntil
  if (user.bannedUntil !== undefined) row.banned_until = user.bannedUntil
  if (user.familyId !== undefined) row.family_id = user.familyId
  if (user.friends !== undefined) row.friends = user.friends
  if (user.deleted !== undefined) row.deleted = user.deleted
  if (user.stealCountToday !== undefined) row.steal_count_today = user.stealCountToday
  if (user.stealResetAt !== undefined) row.steal_reset_at = user.stealResetAt
  if (user.gardenProtectedUntil !== undefined) row.garden_protected_until = user.gardenProtectedUntil
  if (user.taskProgress !== undefined) row.task_progress = user.taskProgress
  if (user.taskClaimed !== undefined) row.task_claimed = user.taskClaimed
  if (user.taskLastReset !== undefined) row.task_last_reset = user.taskLastReset
  return row
}

function dbRowToFamily(row: any): Family {
  return {
    id: row.id,
    name: row.name,
    avatar: row.avatar,
    announcement: row.announcement,
    ownerId: row.owner_id,
    members: row.members || [],
    level: row.level,
    exp: row.exp,
    maxMembers: row.max_members,
    createdAt: row.created_at,
  }
}

function dbRowToMessage(row: any): ChatMessage {
  return {
    id: row.id,
    channel: row.channel,
    userId: row.user_id,
    userName: row.user_name,
    content: row.content,
    // 双兼容：数据库列可能叫 timestamp 也可能叫 created_at
    timestamp: (typeof row.timestamp === 'number' ? row.timestamp : row.created_at) ?? Date.now(),
    isSystem: row.is_system,
  }
}

function dbRowToListing(row: any): MarketListing {
  return {
    id: row.id,
    sellerId: row.seller_id,
    sellerName: row.seller_name,
    isOfficial: row.is_official,
    itemType: row.item_type,
    referenceId: row.reference_id,
    name: row.name,
    emoji: row.emoji,
    rank: row.rank,
    price: row.price,
    quantity: row.quantity,
    createdAt: row.created_at,
  }
}

function dbRowToBuyOrder(row: any): BuyOrder {
  return {
    id: row.id,
    buyerId: row.buyer_id,
    buyerName: row.buyer_name,
    isOfficial: row.is_official,
    itemType: row.item_type,
    referenceId: row.reference_id,
    name: row.name,
    emoji: row.emoji,
    rank: row.rank,
    price: row.price,
    quantity: row.quantity,
    createdAt: row.created_at,
  }
}

function dbRowToAnnouncement(row: any): Announcement {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    createdAt: row.created_at,
    priority: row.priority,
  }
}

function createInitialPlots(unlockedCount: number): Plot[] {
  const plots: Plot[] = []
  for (let i = 1; i <= 30; i++) {
    plots.push({
      id: i,
      unlocked: i <= unlockedCount,
      unlockPrice: getPlotUnlockPrice(i),
      flower: null,
    })
  }
  return plots
}

function genId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
}

// ==================== 数据库初始化/种子 ====================

let seedPromise: Promise<void> | null = null

export async function seedDatabase(): Promise<void> {
  if (seedPromise) return seedPromise
  seedPromise = doSeed()
  return seedPromise
}

async function doSeed(): Promise<void> {
  const sb = getSupabase()

  // ============================================================
  //  自修复 1：检测 messages 表的时间戳列名
  //  （旧 schema 叫 "timestamp"，新 schema 叫 "created_at"）
  //  自动重命名，避免查询和插入时报错
  // ============================================================
  try {
    const { data: cols } = await sb
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'messages')
    const colNames = (cols || []).map((c: any) => c.column_name)
    if (colNames.includes('timestamp') && !colNames.includes('created_at')) {
      // 旧表：timestamp → 自动重命名为 created_at
      const { error: renameErr } = await sb.rpc('_garden_fix_messages_col', {})
      if (renameErr) {
        // RPC 不存在，用 raw SQL 通过 Supabase REST 无法执行，用单独的策略：
        // 下面 getMessages / addMessage 都会 fallback 兼容两列
        logger.warn('system', 'messages.timestamp 未改名，代码会用双兼容模式')
      } else {
        logger.info('system', 'messages.timestamp 已自动改名为 created_at')
      }
    }
  } catch (e: any) {
    logger.warn('system', `检测 messages 列名失败: ${e?.message || 'unknown'}`)
  }

  // ============================================================
  //  自修复 2：检测 buy_orders 表是否缺 fulfilled 列
  // ============================================================
  try {
    const { data: cols } = await sb
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'buy_orders')
    const colNames = (cols || []).map((c: any) => c.column_name)
    if (!colNames.includes('fulfilled')) {
      logger.warn('system', 'buy_orders 缺少 fulfilled 列，实际业务会用兼容代码跳过')
    }
  } catch (e: any) {
    logger.warn('system', `检测 buy_orders 列名失败: ${e?.message || 'unknown'}`)
  }

  // 检查是否已有用户
  const { data: allUsers, error: listErr } = await sb.from('users').select('id, plots, inventory, is_admin, task_progress, task_claimed, task_last_reset')
  if (listErr) {
    logger.error('system', '查询用户列表失败', { error: listErr.message })
    return
  }

  // 修复：对已有用户检查并修复空 plots + 缺失任务字段
  if (allUsers && allUsers.length > 0) {
    for (const u of allUsers) {
      const plots = u.plots
      const isEmpty = !plots || plots.length === 0
      const hasUnlocked = plots && plots.some((p: any) => p.unlocked)
      const needsTaskFix = !u.task_progress || !u.task_claimed || !u.task_last_reset

      if (isEmpty || !hasUnlocked || needsTaskFix) {
        const updates: Record<string, any> = {}
        if (isEmpty || !hasUnlocked) {
          const unlockedCount = u.is_admin ? 30 : isEmpty ? 1 : Math.max(3, (plots?.length || 0))
          updates.plots = createInitialPlots(unlockedCount)
          const existingInv = u.inventory
          updates.inventory = !existingInv || existingInv.length === 0
            ? (u.is_admin ? [] : [
                { id: 'inv_s1', type: 'seed', referenceId: 'seed_daisy', name: '雏菊种子', emoji: '🌱', quantity: 3, maxStack: 99, sellable: false, tradeable: true },
                { id: 'inv_s2', type: 'seed', referenceId: 'seed_tulip', name: '郁金香种子', emoji: '🌱', quantity: 2, maxStack: 99, sellable: false, tradeable: true },
                { id: 'inv_t1', type: 'tool', referenceId: 'watering_can', name: '水壶', emoji: '💧', quantity: 5, maxStack: 99, sellable: true, tradeable: true },
              ])
            : existingInv
        }
        if (needsTaskFix) {
          updates.task_progress = u.task_progress || {}
          updates.task_claimed = u.task_claimed || {}
          updates.task_last_reset = u.task_last_reset || {}
        }
        const { error } = await sb.from('users')
          .update(updates)
          .eq('id', u.id)
        if (error) {
          logger.error('system', `修复用户 ${u.id} 失败`, { error: error.message })
        } else {
          logger.info('system', `修复用户 ${u.id}`, { fields: Object.keys(updates).join(',') })
        }
      }
    }
    logger.info('system', '数据库已有用户数据，检查并修复完成')
    return
  }

  logger.info('system', '开始初始化数据库种子数据...')

  const now = Date.now()

  // 创建管理员用户
  const adminHash = bcrypt.hashSync('admin123', 10)
  const adminPlots = createInitialPlots(30)
  const { error: adminErr } = await sb.from('users').upsert({
    id: 'admin',
    username: 'admin',
    password: adminHash,
    nickname: '花园管理员',
    avatar: '👑',
    coins: 99999,
    created_at: now - 86400000,
    last_login: now,
    plots: adminPlots,
    inventory: [],
    inventory_size: 50,
    is_admin: true,
    muted_until: null,
    family_id: null,
    friends: [],
    deleted: false,
    steal_count_today: 0,
    steal_reset_at: 0,
    garden_protected_until: 0,
    task_progress: {},
    task_claimed: {},
    task_last_reset: {},
  })
  if (adminErr) logger.error('system', '创建管理员失败', { error: adminErr.message })
  else logger.info('system', '管理员账号创建成功')

  // 创建演示用户
  const userHash = bcrypt.hashSync('123456', 10)
  const demoPlots = createInitialPlots(3)
  const { error: demoErr } = await sb.from('users').upsert({
    id: 'user1',
    username: 'demo',
    password: userHash,
    nickname: '小花农',
    avatar: '🌱',
    coins: 200,
    created_at: now - 3600000,
    last_login: now,
    plots: demoPlots,
    inventory: [
      { id: 'inv_1', type: 'seed', referenceId: 'seed_rose', name: '玫瑰种子', emoji: '🌱', quantity: 5, maxStack: 99, sellable: false, tradeable: true },
      { id: 'inv_2', type: 'seed', referenceId: 'seed_daisy', name: '雏菊种子', emoji: '🌱', quantity: 3, maxStack: 99, sellable: false, tradeable: true },
      { id: 'inv_3', type: 'tool', referenceId: 'watering_can', name: '水壶', emoji: '💧', quantity: 10, maxStack: 99, sellable: true, tradeable: true },
      { id: 'inv_4', type: 'tool', referenceId: 'fertilizer', name: '化肥', emoji: '🧪', quantity: 5, maxStack: 99, sellable: true, tradeable: true },
    ],
    inventory_size: 10,
    is_admin: false,
    muted_until: null,
    family_id: null,
    friends: [],
    deleted: false,
    steal_count_today: 0,
    steal_reset_at: 0,
    garden_protected_until: 0,
    task_progress: {},
    task_claimed: {},
    task_last_reset: {},
  })
  if (demoErr) logger.error('system', '创建演示用户失败', { error: demoErr.message })
  else logger.info('system', '演示账号创建成功')

  // 游戏状态
  await sb.from('game_state').upsert({
    id: 1,
    current_season: INITIAL_GAME_STATE.currentSeason,
    season_start_at: now,
    season_duration: INITIAL_GAME_STATE.seasonDuration,
  })

  // 系统消息
  await sb.from('messages').upsert({
    id: 'msg_1',
    channel: 'world',
    user_id: 'system',
    user_name: '系统',
    content: '欢迎来到花园！祝大家游戏愉快~ 🌸🌺🌻🌷🌹',
    created_at: now - 60000,
    is_system: true,
  })

  // 官方挂售
  const listings: Record<string, any>[] = [
    { id: 'l1', seller_id: 'system', seller_name: '官方', is_official: true, item_type: 'seed', reference_id: 'seed_rose', name: '玫瑰种子', emoji: '🌱', price: 18, quantity: 99, created_at: now - 100000 },
    { id: 'l2', seller_id: 'system', seller_name: '官方', is_official: true, item_type: 'seed', reference_id: 'seed_tulip', name: '郁金香种子', emoji: '🌱', price: 15, quantity: 99, created_at: now - 90000 },
    { id: 'l3', seller_id: 'system', seller_name: '官方', is_official: true, item_type: 'seed', reference_id: 'seed_daisy', name: '雏菊种子', emoji: '🌱', price: 8, quantity: 99, created_at: now - 80000 },
    { id: 'l4', seller_id: 'system', seller_name: '官方', is_official: true, item_type: 'flower', reference_id: 'sunflower', name: '向日葵', emoji: '🌻', rank: 3, price: 45, quantity: 5, created_at: now - 70000 },
  ]
  for (const l of listings) {
    await sb.from('listings').upsert(l)
  }

  // 官方收购单
  const orders: Record<string, any>[] = [
    { id: 'o1', buyer_id: 'system', buyer_name: '官方', is_official: true, item_type: 'flower', reference_id: 'rose', name: '玫瑰', emoji: '🌹', rank: 1, price: 30, quantity: 50, created_at: now - 50000 },
    { id: 'o2', buyer_id: 'system', buyer_name: '官方', is_official: true, item_type: 'flower', reference_id: 'daisy', name: '雏菊', emoji: '🌼', rank: 1, price: 12, quantity: 100, created_at: now - 40000 },
  ]
  for (const o of orders) {
    await sb.from('buy_orders').upsert(o)
  }

  // 公告
  for (const ann of INITIAL_ANNOUNCEMENTS) {
    await sb.from('announcements').upsert({
      id: ann.id,
      title: ann.title,
      content: ann.content,
      priority: ann.priority,
      created_at: ann.createdAt,
    })
  }

  logger.info('system', '数据库种子数据初始化完成')
}

// ==================== 用户 ====================

export async function findUserByUsername(username: string): Promise<User | null> {
  await seedDatabase()
  const sb = getSupabase()
  const { data, error } = await sb.from('users')
    .select('*')
    .eq('username', username)
    .single()
  if (error || !data) return null
  return dbRowToUser(data)
}

export async function findUserById(id: string): Promise<User | null> {
  await seedDatabase()
  const sb = getSupabase()
  const { data, error } = await sb.from('users')
    .select('*')
    .eq('id', id)
    .single()
  if (error || !data) return null
  return dbRowToUser(data)
}

export async function getAllUsers(): Promise<User[]> {
  await seedDatabase()
  const sb = getSupabase()
  const { data, error } = await sb.from('users')
    .select('*')
    .order('created_at', { ascending: true })
  if (error || !data) return []
  return data.map(dbRowToUser)
}

export async function createUser(data: { username: string; password: string; nickname: string }): Promise<User> {
  await seedDatabase()
  const existing = await findUserByUsername(data.username)
  if (existing) throw new Error('用户名已存在')

  const sb = getSupabase()
  const userId = genId('u')
  const now = Date.now()
  const hash = bcrypt.hashSync(data.password, 10)

  const newRow = {
    id: userId,
    username: data.username,
    password: hash,
    nickname: data.nickname || data.username,
    avatar: ['🌱', '🌿', '🍀', '🌵', '🎍'][Math.floor(Math.random() * 5)],
    coins: 100,
    created_at: now,
    last_login: now,
    plots: createInitialPlots(1),
    inventory: [
      { id: 'inv_s1', type: 'seed', referenceId: 'seed_daisy', name: '雏菊种子', emoji: '🌱', quantity: 3, maxStack: 99, sellable: false, tradeable: true },
      { id: 'inv_s2', type: 'seed', referenceId: 'seed_tulip', name: '郁金香种子', emoji: '🌱', quantity: 2, maxStack: 99, sellable: false, tradeable: true },
      { id: 'inv_t1', type: 'tool', referenceId: 'watering_can', name: '水壶', emoji: '💧', quantity: 5, maxStack: 99, sellable: true, tradeable: true },
    ],
    inventory_size: 5,
    is_admin: false,
    muted_until: null,
    family_id: null,
    friends: [],
    deleted: false,
    steal_count_today: 0,
    steal_reset_at: 0,
    garden_protected_until: 0,
    task_progress: {},
    task_claimed: {},
    task_last_reset: {},
  }

  const { error } = await sb.from('users').insert(newRow)
  if (error) throw new Error(`创建用户失败: ${error.message}`)

  logger.info('auth', '新用户注册', { userId, username: data.username })
  return dbRowToUser(newRow)
}

export async function updateUser(userId: string, updates: Partial<User>): Promise<User | null> {
  await seedDatabase()
  const sb = getSupabase()
  const dbRow = userToDbRow(updates)
  const { data, error } = await sb.from('users')
    .update(dbRow)
    .eq('id', userId)
    .select('*')
    .single()
  if (error || !data) {
    logger.error('system', '更新用户失败', { userId, error: error?.message })
    return null
  }
  return dbRowToUser(data)
}

export async function updateUserLogin(userId: string): Promise<void> {
  await updateUser(userId, { lastLogin: Date.now() })
}

export async function deleteUser(userId: string): Promise<boolean> {
  const sb = getSupabase()
  const now = Date.now()
  const { error } = await sb.from('users')
    .update({
      nickname: `已删除用户_${now}`,
      username: `deleted_${now}`,
      deleted: true,
    })
    .eq('id', userId)
  if (error) {
    logger.error('system', '删除用户失败', { userId, error: error.message })
    return false
  }
  return true
}

export async function muteUser(userId: string, durationMs: number): Promise<void> {
  await updateUser(userId, { mutedUntil: Date.now() + durationMs })
}

// ==================== 游戏状态 / 季节 ====================

export async function getGameState(): Promise<GameState> {
  await seedDatabase()
  const sb = getSupabase()
  const { data, error } = await sb.from('game_state').select('*').eq('id', 1).single()
  if (error || !data) {
    return { ...INITIAL_GAME_STATE, seasonStartAt: Date.now() }
  }
  return {
    currentSeason: data.current_season,
    seasonStartAt: data.season_start_at,
    seasonDuration: data.season_duration,
  }
}

export async function setGameState(state: Partial<GameState>): Promise<void> {
  const sb = getSupabase()
  const updates: Record<string, any> = {}
  if (state.currentSeason !== undefined) updates.current_season = state.currentSeason
  if (state.seasonStartAt !== undefined) updates.season_start_at = state.seasonStartAt
  if (state.seasonDuration !== undefined) updates.season_duration = state.seasonDuration
  await sb.from('game_state').update(updates).eq('id', 1)
}

export async function ensureSeasonTick(): Promise<GameState> {
  const gs = await getGameState()
  const now = Date.now()
  const seasonOrder: GameState['currentSeason'][] = ['spring', 'summer', 'autumn', 'winter']

  let changed = false
  let currentSeason = gs.currentSeason
  let seasonStartAt = gs.seasonStartAt

  while (now - seasonStartAt >= gs.seasonDuration) {
    const idx = seasonOrder.indexOf(currentSeason)
    const oldSeason = currentSeason
    currentSeason = seasonOrder[(idx + 1) % 4]
    seasonStartAt += gs.seasonDuration
    changed = true
    logger.info('season', `季节切换: ${oldSeason} → ${currentSeason}`, {
      oldSeason, newSeason: currentSeason, seasonStartAt,
    })
  }

  if (changed) {
    await setGameState({ currentSeason, seasonStartAt })
  }

  return { ...gs, currentSeason, seasonStartAt }
}

// ==================== 聊天 ====================

// 缓存 messages 表实际使用的时间戳列名（首次检测后不再重复）
let _messagesTimeCol: 'timestamp' | 'created_at' | null = null

async function detectMessagesTimeCol(): Promise<'timestamp' | 'created_at'> {
  if (_messagesTimeCol) return _messagesTimeCol
  const sb = getSupabase()
  try {
    const { data: cols } = await sb
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'messages')
    const names = (cols || []).map((c: any) => c.column_name)
    _messagesTimeCol = names.includes('created_at')
      ? 'created_at'
      : names.includes('timestamp')
      ? 'timestamp'
      : 'created_at'
  } catch {
    _messagesTimeCol = 'created_at'
  }
  return _messagesTimeCol
}

export async function getMessages(channel: string, limit = 200): Promise<ChatMessage[]> {
  await seedDatabase()
  const sb = getSupabase()
  const col = await detectMessagesTimeCol()
  try {
    const { data, error } = await sb.from('messages')
      .select('*')
      .eq('channel', channel)
      .order(col, { ascending: true })
      .limit(limit)
    if (error || !data) return []
    return data.map(dbRowToMessage)
  } catch (e: any) {
    // 兜底：如果 order 用的列名报错，换另一列重试
    try {
      const fallback = col === 'created_at' ? 'timestamp' : 'created_at'
      const { data } = await sb.from('messages')
        .select('*')
        .eq('channel', channel)
        .order(fallback, { ascending: true })
        .limit(limit)
      return (data || []).map(dbRowToMessage)
    } catch {
      return []
    }
  }
}

export async function addMessage(msg: Omit<ChatMessage, 'id' | 'timestamp'>): Promise<ChatMessage> {
  await seedDatabase()
  const sb = getSupabase()
  const col = await detectMessagesTimeCol()
  const message: ChatMessage = {
    ...msg,
    id: genId('m'),
    timestamp: Date.now(),
  }
  const payload: Record<string, any> = {
    id: message.id,
    channel: message.channel,
    user_id: message.userId,
    user_name: message.userName,
    content: message.content,
    is_system: message.isSystem,
  }
  payload[col] = message.timestamp

  const { error } = await sb.from('messages').insert(payload)
  if (error) {
    logger.error('chat', '保存消息失败', { error: error.message, usedCol: col })
    // 换列名重试一次
    try {
      const fallback = col === 'created_at' ? 'timestamp' : 'created_at'
      const p2: Record<string, any> = { ...payload }
      delete p2[col]
      p2[fallback] = message.timestamp
      const { error: err2 } = await sb.from('messages').insert(p2)
      if (err2) logger.error('chat', '重试保存消息仍失败', { error: err2.message })
    } catch { /* ignore */ }
  }
  return message
}

// ==================== 市场 ====================

export async function getListings(itemType?: 'flower' | 'seed'): Promise<MarketListing[]> {
  await seedDatabase()
  const sb = getSupabase()
  let query = sb.from('listings').select('*').order('created_at', { ascending: true })
  if (itemType) query = query.eq('item_type', itemType)
  const { data, error } = await query
  if (error || !data) return []
  return data.map(dbRowToListing)
}

export async function getBuyOrders(): Promise<BuyOrder[]> {
  await seedDatabase()
  const sb = getSupabase()
  const { data, error } = await sb.from('buy_orders').select('*').order('created_at', { ascending: true })
  if (error || !data) return []
  return data.map(dbRowToBuyOrder)
}

export async function createListing(data: Omit<MarketListing, 'id' | 'createdAt'>): Promise<MarketListing> {
  const sb = getSupabase()
  const listing: MarketListing = {
    ...data,
    id: genId('l'),
    createdAt: Date.now(),
  }
  await sb.from('listings').insert({
    id: listing.id,
    seller_id: listing.sellerId,
    seller_name: listing.sellerName,
    is_official: listing.isOfficial,
    item_type: listing.itemType,
    reference_id: listing.referenceId,
    name: listing.name,
    emoji: listing.emoji,
    rank: listing.rank,
    price: listing.price,
    quantity: listing.quantity,
    created_at: listing.createdAt,
  })
  return listing
}

export async function removeListing(id: string): Promise<boolean> {
  const sb = getSupabase()
  const { error } = await sb.from('listings').delete().eq('id', id)
  return !error
}

export async function updateListingQuantity(id: string, quantity: number): Promise<void> {
  const sb = getSupabase()
  await sb.from('listings').update({ quantity }).eq('id', id)
}

export async function findListing(id: string): Promise<MarketListing | null> {
  const sb = getSupabase()
  const { data, error } = await sb.from('listings').select('*').eq('id', id).single()
  if (error || !data) return null
  return dbRowToListing(data)
}

// ==================== 公告 ====================

export async function getAnnouncements(): Promise<Announcement[]> {
  await seedDatabase()
  const sb = getSupabase()
  const { data, error } = await sb.from('announcements')
    .select('*')
    .order('created_at', { ascending: false })
  if (error || !data) return []
  return data.map(dbRowToAnnouncement)
}

export async function createAnnouncement(data: Omit<Announcement, 'id' | 'createdAt'>): Promise<Announcement> {
  const sb = getSupabase()
  const a: Announcement = { ...data, id: `ann_${Date.now()}`, createdAt: Date.now() }
  await sb.from('announcements').insert({
    id: a.id,
    title: a.title,
    content: a.content,
    priority: a.priority,
    created_at: a.createdAt,
  })
  return a
}

export async function deleteAnnouncement(id: string): Promise<boolean> {
  const sb = getSupabase()
  const { error } = await sb.from('announcements').delete().eq('id', id)
  return !error
}

// ==================== CDK ====================

export async function findCDK(code: string): Promise<CDK | null> {
  const sb = getSupabase()
  const { data, error } = await sb.from('cdks').select('*').eq('code', code.toUpperCase()).single()
  if (error || !data) return null
  return {
    code: data.code,
    rewards: data.rewards,
    maxUses: data.max_uses,
    usedCount: data.used_count,
    expiresAt: data.expires_at,
    createdAt: data.created_at,
  }
}

export async function createCDK(cdk: CDK): Promise<CDK> {
  const sb = getSupabase()
  const c = { ...cdk, code: cdk.code.toUpperCase(), createdAt: Date.now() }
  await sb.from('cdks').insert({
    code: c.code,
    rewards: c.rewards,
    max_uses: c.maxUses,
    used_count: c.usedCount,
    expires_at: c.expiresAt,
    created_at: c.createdAt,
    used_by: [],
  })
  return c
}

export async function redeemCDK(code: string, userId: string): Promise<CDK | null> {
  const cdk = await findCDK(code)
  if (!cdk) return null
  if (cdk.expiresAt && cdk.expiresAt < Date.now()) return null
  if (cdk.usedCount >= cdk.maxUses) return null

  const sb = getSupabase()
  await sb.from('cdks')
    .update({ used_count: cdk.usedCount + 1 })
    .eq('code', code.toUpperCase())

  return { ...cdk, usedCount: cdk.usedCount + 1 }
}

export async function getAllCDKs(): Promise<CDK[]> {
  const sb = getSupabase()
  const { data, error } = await sb.from('cdks').select('*').order('created_at', { ascending: false })
  if (error || !data) return []
  return data.map((d: any) => ({
    code: d.code,
    rewards: d.rewards,
    maxUses: d.max_uses,
    usedCount: d.used_count,
    expiresAt: d.expires_at,
    createdAt: d.created_at,
  }))
}

// ==================== 通知 ====================

export async function getNotifications(userId: string): Promise<Notification[]> {
  const sb = getSupabase()
  const { data, error } = await sb.from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error || !data) return []
  return data.map((d: any) => ({
    id: d.id,
    userId: d.user_id,
    type: d.type,
    title: d.title,
    content: d.content,
    read: d.read,
    createdAt: d.created_at,
  }))
}

export async function createNotification(data: Omit<Notification, 'id' | 'createdAt' | 'read'>): Promise<void> {
  const sb = getSupabase()
  await sb.from('notifications').insert({
    id: genId('n'),
    user_id: data.userId,
    type: data.type,
    title: data.title,
    content: data.content,
    read: false,
    created_at: Date.now(),
  })
}

// ==================== 任务进度 ====================

const TASK_INCREMENT_MAP: Record<string, string> = {
  'plant': 't_daily_2',
  'water': 't_daily_2',
  'fertilize': 't_daily_2',
  'pesticide': 't_daily_2',
  'harvest': 't_daily_3',
  'chat': 't_daily_5',
  'trade': 't_daily_4',
}

export async function incrementTaskProgress(userId: string, action: string, amount = 1): Promise<void> {
  const taskId = TASK_INCREMENT_MAP[action]
  if (!taskId) return

  const user = await findUserById(userId)
  if (!user) return

  const progress = { ...(user.taskProgress || {}) }
  progress[taskId] = (progress[taskId] || 0) + amount

  // 同时推进对应的周任务/月任务
  if (action === 'harvest') {
    progress['t_monthly_1'] = (progress['t_monthly_1'] || 0) + amount
  }
  if (action === 'plant' || action === 'water' || action === 'fertilize') {
    progress['t_weekly_1'] = (progress['t_weekly_1'] || 0) + amount
  }

  // 登录任务特殊处理
  if (action === 'login') {
    progress['t_daily_1'] = 1
  }

  const lastReset = { ...(user.taskLastReset || {}) }
  const now = Date.now()
  const periodStart = (type: string) => {
    const d = new Date()
    if (type === 'daily') return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
    if (type === 'weekly') {
      const day = d.getDay() || 7
      return new Date(d.getFullYear(), d.getMonth(), d.getDate() - day + 1).getTime()
    }
    if (type === 'monthly') return new Date(d.getFullYear(), d.getMonth(), 1).getTime()
    return 0
  }

  // 重置过期任务
  const typeMap: Record<string, string> = {
    't_daily_': 'daily', 't_weekly_': 'weekly', 't_monthly_': 'monthly',
  }
  for (const [prefix, type] of Object.entries(typeMap)) {
    if (!lastReset[type] || lastReset[type] < periodStart(type)) {
      for (const key of Object.keys(progress)) {
        if (key.startsWith(prefix)) {
          progress[key] = 0
        }
      }
      lastReset[type] = now
    }
  }

  await updateUser(userId, { taskProgress: progress, taskLastReset: lastReset })
}

// ==================== 官方收购价调整 ====================

export async function setOfficialBuyPrice(referenceId: string, rank: number, newPrice: number): Promise<void> {
  const sb = getSupabase()
  // 查找是否已有官方收购单
  const { data: existing } = await sb.from('buy_orders')
    .select('*')
    .eq('is_official', true)
    .eq('reference_id', referenceId)
    .eq('rank', rank)
    .single()

  if (existing) {
    await sb.from('buy_orders').update({ price: newPrice }).eq('id', existing.id)
  } else {
    const flower = FLOWER_TYPES.find(f => f.id === referenceId)
    if (flower) {
      await sb.from('buy_orders').insert({
        id: genId('o'),
        buyer_id: 'system',
        buyer_name: '官方',
        is_official: true,
        item_type: 'flower',
        reference_id: referenceId,
        name: flower.name,
        emoji: flower.emoji,
        rank: rank,
        price: newPrice,
        quantity: 9999,
        created_at: Date.now(),
      })
    }
  }
}

// ==================== 虫灾系统 ====================

/**
 * 检查并触发随机虫灾事件
 * 在用户访问花园时调用，基于概率触发
 */
export async function checkPestDisaster(userId: string): Promise<{
  triggered: boolean
  severity?: PestSeverity
  affectedPlots?: number[]
}> {
  const user = await findUserById(userId)
  if (!user) return { triggered: false }

  // 只对有种植花朵的地块触发
  const plotsWithFlowers = user.plots.filter(p => p.unlocked && p.flower && !p.flower.hasPest)
  if (plotsWithFlowers.length === 0) return { triggered: false }

  // 概率检查
  if (Math.random() > PEST_CONFIG.disasterBaseChance) {
    return { triggered: false }
  }

  const severity = rollPestSeverity()
  const [min, max] = PEST_CONFIG.severity[severity].plotsAffected
  const numAffected = Math.min(
    plotsWithFlowers.length,
    min + Math.floor(Math.random() * (max - min + 1))
  )

  // 随机选择受影响的地块
  const shuffled = [...plotsWithFlowers].sort(() => Math.random() - 0.5)
  const affected = shuffled.slice(0, numAffected)
  const affectedPlotIds = affected.map(p => p.id)
  const now = Date.now()

  // 更新地块中的花
  const newPlots = user.plots.map(p => {
    if (affectedPlotIds.includes(p.id) && p.flower) {
      return {
        ...p,
        flower: {
          ...p.flower,
          hasPest: true,
          pestAt: now,
          pestCount: p.flower.pestCount + 1,
        },
      }
    }
    return p
  })

  await updateUser(userId, { plots: newPlots })

  // 给用户发通知
  await createNotification({
    userId,
    type: 'system',
    title: '🐛 虫灾警报！',
    content: `你的花园遭遇了${severity === 'minor' ? '轻微' : severity === 'major' ? '严重' : '灾难性'}虫灾！${affectedPlotIds.length}块地的花受到了影响，请尽快使用除虫剂！`,
  })

  logger.warn('pest', '虫灾事件触发', {
    userId, severity, affectedPlots: affectedPlotIds,
  })

  return { triggered: true, severity, affectedPlots: affectedPlotIds }
}

/**
 * 检查虫害是否导致花死亡（超过6小时未处理）
 */
export async function checkPestDeath(userId: string): Promise<{ deadFlowers: number[] }> {
  const user = await findUserById(userId)
  if (!user) return { deadFlowers: [] }

  const now = Date.now()
  const deadPlotIds: number[] = []

  const newPlots = user.plots.map(p => {
    if (p.flower && p.flower.hasPest && p.flower.pestAt) {
      if (now - p.flower.pestAt > PEST_CONFIG.pestDeathTimeout) {
        deadPlotIds.push(p.id)
        logger.warn('pest', '花朵因虫灾死亡', {
          userId, plotId: p.id, flowerType: p.flower.flowerTypeId,
          pestAt: p.flower.pestAt, elapsed: now - p.flower.pestAt,
        })
        return { ...p, flower: null }
      }
    }
    return p
  })

  if (deadPlotIds.length > 0) {
    await updateUser(userId, { plots: newPlots })
    await createNotification({
      userId,
      type: 'system',
      title: '💀 花朵死亡',
      content: `由于虫灾未及时处理，${deadPlotIds.length}朵花已经枯萎死亡。请下次注意及时除虫！`,
    })
  }

  return { deadFlowers: deadPlotIds }
}

// ==================== 偷花系统 ====================

/**
 * 尝试偷取其他玩家的花
 */
export async function attemptSteal(
  thiefId: string,
  victimId: string,
  plotId: number
): Promise<{
  success: boolean
  message: string
  flower?: { flowerTypeId: string; name: string; emoji: string; rank: RankLevel }
}> {
  const thief = await findUserById(thiefId)
  const victim = await findUserById(victimId)

  if (!thief || !victim) return { success: false, message: '用户不存在' }
  if (thiefId === victimId) return { success: false, message: '不能偷自己的花' }

  logger.info('steal', '偷花尝试', {
    thiefId, thiefName: thief.nickname,
    victimId, victimName: victim.nickname, plotId,
  })

  // 检查每日偷花次数
  const now = Date.now()
  let stealCountToday = thief.stealCountToday
  if (now > thief.stealResetAt) {
    stealCountToday = 0
  }
  if (stealCountToday >= STEAL_CONFIG.dailyStealLimit) {
    logger.info('steal', '偷花失败：达到每日上限', { thiefId, stealCountToday })
    return { success: false, message: `今日偷花次数已达上限（${STEAL_CONFIG.dailyStealLimit}次）` }
  }

  // 检查花园保护
  if (victim.gardenProtectedUntil > now) {
    logger.info('steal', '偷花失败：花园受保护', { victimId, protectedUntil: victim.gardenProtectedUntil })
    return { success: false, message: '对方花园正在保护中，无法偷取' }
  }

  // 检查目标地块
  const plot = victim.plots.find(p => p.id === plotId)
  if (!plot || !plot.unlocked || !plot.flower) {
    return { success: false, message: '该地块没有花朵' }
  }

  // 只有成熟的花才能被偷
  if (STEAL_CONFIG.requireReady && !plot.flower.isReady) {
    return { success: false, message: '只有成熟的花才能被偷取' }
  }

  // 检查同地块冷却
  const sb = getSupabase()
  const { data: stealRecord } = await sb.from('plot_steal_records')
    .select('*')
    .eq('victim_id', victimId)
    .eq('plot_id', plotId)
    .gt('reset_at', now)
    .single()

  if (stealRecord) {
    return { success: false, message: '该地块今天已经被偷过了' }
  }

  // 计算成功率
  const isFriend = thief.friends.includes(victimId)
  const successRate = isFriend ? STEAL_CONFIG.friendSuccessRate : STEAL_CONFIG.strangerSuccessRate
  const success = Math.random() < successRate

  if (!success) {
    // 偷花失败，增加计数
    await updateUser(thiefId, {
      stealCountToday: stealCountToday + 1,
      stealResetAt: now + STEAL_CONFIG.plotStealCooldown,
    })

    // 给受害者发通知
    await createNotification({
      userId: victimId,
      type: 'system',
      title: '🔍 有人来偷花！',
      content: `${thief.nickname} 试图偷取你的花，但失败了！`,
    })

    logger.info('steal', '偷花失败', { thiefId, victimId, plotId, successRate })
    return { success: false, message: '偷花失败！花太牢固了，没能得手' }
  }

  // 偷花成功！
  const flowerType = FLOWER_TYPES.find(f => f.id === plot.flower!.flowerTypeId)
  if (!flowerType) return { success: false, message: '花朵类型异常' }

  const stolenFlower = plot.flower
  const flowerName = flowerType.name
  const flowerEmoji = flowerType.emoji

  // 从受害者地块移除花
  const victimNewPlots = victim.plots.map(p =>
    p.id === plotId ? { ...p, flower: null } : p
  )

  // 给受害者补偿金币
  const sellPrice = getFlowerSellPrice(flowerType, stolenFlower.rank)
  const compensation = Math.floor(sellPrice * STEAL_CONFIG.victimCompensationRate)

  await updateUser(victimId, {
    plots: victimNewPlots,
    coins: victim.coins + compensation,
  })

  // 更新偷花者计数
  await updateUser(thiefId, {
    stealCountToday: stealCountToday + 1,
    stealResetAt: now + STEAL_CONFIG.plotStealCooldown,
  })

  // 记录偷花日志
  const logId = genId('sl')
  await sb.from('steal_logs').insert({
    id: logId,
    thief_id: thiefId,
    thief_name: thief.nickname,
    victim_id: victimId,
    victim_name: victim.nickname,
    plot_id: plotId,
    flower_type_id: stolenFlower.flowerTypeId,
    flower_name: flowerName,
    flower_emoji: flowerEmoji,
    rank: stolenFlower.rank,
    stolen_at: now,
  })

  // 记录地块偷花冷却
  await sb.from('plot_steal_records').insert({
    id: genId('psr'),
    victim_id: victimId,
    plot_id: plotId,
    thief_id: thiefId,
    stolen_at: now,
    reset_at: now + STEAL_CONFIG.plotStealCooldown,
  })

  // 给受害者发通知
  await createNotification({
    userId: victimId,
    type: 'system',
    title: '💔 花被偷了！',
    content: `${thief.nickname} 偷走了你的 ${flowerEmoji} ${flowerName}！获得补偿 ${compensation} 金币。`,
  })

  logger.warn('steal', '偷花成功', {
    thiefId, thiefName: thief.nickname,
    victimId, victimName: victim.nickname,
    plotId, flowerType: stolenFlower.flowerTypeId, rank: stolenFlower.rank,
    compensation,
  })

  return {
    success: true,
    message: `偷花成功！获得 ${flowerEmoji} ${flowerName}（${['黑铁', '青铜', '白银', '黄金', '铂金', '钻石', '传说'][stolenFlower.rank - 1]}）`,
    flower: {
      flowerTypeId: stolenFlower.flowerTypeId,
      name: flowerName,
      emoji: flowerEmoji,
      rank: stolenFlower.rank,
    },
  }
}

/**
 * 获取偷花日志（受害者视角）
 */
export async function getStealLogs(victimId: string, limit = 20): Promise<StealLog[]> {
  const sb = getSupabase()
  const { data, error } = await sb.from('steal_logs')
    .select('*')
    .eq('victim_id', victimId)
    .order('stolen_at', { ascending: false })
    .limit(limit)
  if (error || !data) return []
  return data.map((d: any) => ({
    id: d.id,
    thiefId: d.thief_id,
    thiefName: d.thief_name,
    victimId: d.victim_id,
    victimName: d.victim_name,
    plotId: d.plot_id,
    flowerTypeId: d.flower_type_id,
    flowerName: d.flower_name,
    flowerEmoji: d.flower_emoji,
    rank: d.rank,
    stolenAt: d.stolen_at,
  }))
}

// ==================== 敏感词库（后台化） ====================

// 敏感词缓存（带 TTL，减少 DB 查询）
let _sensitiveWordsCache: { words: string[]; expireAt: number } | null = null
const SENSITIVE_CACHE_TTL = 30 * 1000 // 30 秒

export async function getSensitiveWords(): Promise<SensitiveWord[]> {
  const sb = getSupabase()
  try {
    const { data, error } = await sb.from('sensitive_words')
      .select('*')
      .order('created_at', { ascending: true })
    if (error || !data) return []
    return data.map((d: any) => ({
      id: d.id,
      word: d.word,
      createdAt: d.created_at,
      createdBy: d.created_by,
    }))
  } catch (e: any) {
    logger.warn('chat', `获取敏感词失败: ${e?.message}`)
    return []
  }
}

// 获取敏感词字符串列表（带缓存），供 filterSensitiveWords 使用
export async function getSensitiveWordList(): Promise<string[]> {
  const now = Date.now()
  if (_sensitiveWordsCache && now < _sensitiveWordsCache.expireAt) {
    return _sensitiveWordsCache.words
  }
  const list = await getSensitiveWords()
  const words = list.map(w => w.word)
  _sensitiveWordsCache = { words, expireAt: now + SENSITIVE_CACHE_TTL }
  return words
}

export function clearSensitiveWordsCache(): void {
  _sensitiveWordsCache = null
}

export async function addSensitiveWord(word: string, createdBy: string | null = null): Promise<SensitiveWord | null> {
  const sb = getSupabase()
  const trimmed = word.trim()
  if (!trimmed) return null
  const sw: SensitiveWord = {
    id: genId('sw'),
    word: trimmed,
    createdAt: Date.now(),
    createdBy,
  }
  const { error } = await sb.from('sensitive_words').insert({
    id: sw.id,
    word: sw.word,
    created_at: sw.createdAt,
    created_by: sw.createdBy,
  })
  if (error) {
    // 唯一约束冲突 = 已存在
    if (error.code === '23505') return null
    logger.error('chat', '添加敏感词失败', { error: error.message })
    return null
  }
  clearSensitiveWordsCache()
  return sw
}

export async function removeSensitiveWord(id: string): Promise<boolean> {
  const sb = getSupabase()
  const { error } = await sb.from('sensitive_words').delete().eq('id', id)
  if (error) {
    logger.error('chat', '删除敏感词失败', { error: error.message })
    return false
  }
  clearSensitiveWordsCache()
  return true
}

// ==================== 聊天设置（频率限制配置） ====================

const DEFAULT_CHAT_SETTINGS: ChatSettings = {
  maxMessagesPerMinute: 5,
  maxMessageLength: 200,
  minMessageIntervalMs: 2000,
  enabled: true,
  updatedAt: 0,
}

export async function getChatSettings(): Promise<ChatSettings> {
  const sb = getSupabase()
  try {
    const { data, error } = await sb.from('chat_settings').select('*').eq('id', 1).single()
    if (error || !data) return { ...DEFAULT_CHAT_SETTINGS, updatedAt: Date.now() }
    return {
      maxMessagesPerMinute: data.max_messages_per_minute,
      maxMessageLength: data.max_message_length,
      minMessageIntervalMs: data.min_message_interval_ms,
      enabled: data.enabled,
      updatedAt: data.updated_at,
    }
  } catch {
    return { ...DEFAULT_CHAT_SETTINGS, updatedAt: Date.now() }
  }
}

export async function updateChatSettings(updates: Partial<ChatSettings>): Promise<ChatSettings | null> {
  const sb = getSupabase()
  const current = await getChatSettings()
  const merged: ChatSettings = { ...current, ...updates, updatedAt: Date.now() }
  const row: Record<string, any> = {
    id: 1,
    max_messages_per_minute: merged.maxMessagesPerMinute,
    max_message_length: merged.maxMessageLength,
    min_message_interval_ms: merged.minMessageIntervalMs,
    enabled: merged.enabled,
    updated_at: merged.updatedAt,
  }
  const { error } = await sb.from('chat_settings').upsert(row)
  if (error) {
    logger.error('chat', '更新聊天设置失败', { error: error.message })
    return null
  }
  return merged
}

// ==================== 服务端消息频率限制 ====================

// 用户最近发言时间戳（内存 + globalAsm fallback，Edge 重启后会清空，可接受）
function getRateLimitStore(): Map<string, number[]> {
  try {
    const g = globalThis as any
    g.__gardenRateLimit = g.__gardenRateLimit || new Map<string, number[]>()
    return g.__gardenRateLimit
  } catch {
    return new Map<string, number[]>()
  }
}

// 用户最近一次发言时间（用于最小间隔限制）
function getLastMessageStore(): Map<string, number> {
  try {
    const g = globalThis as any
    g.__gardenLastMsg = g.__gardenLastMsg || new Map<string, number>()
    return g.__gardenLastMsg
  } catch {
    return new Map<string, number>()
  }
}

export interface RateLimitResult {
  allowed: boolean
  reason?: string
  retryAfterMs?: number
}

export async function checkMessageRateLimit(userId: string): Promise<RateLimitResult> {
  const settings = await getChatSettings()
  if (!settings.enabled) return { allowed: true }

  const now = Date.now()
  const lastStore = getLastMessageStore()
  const lastTs = lastStore.get(userId) || 0
  const sinceLast = now - lastTs

  // 最小发言间隔检查
  if (sinceLast < settings.minMessageIntervalMs) {
    return {
      allowed: false,
      reason: `发言太快，请稍候`,
      retryAfterMs: settings.minMessageIntervalMs - sinceLast,
    }
  }

  // 每分钟最大条数检查
  const rateStore = getRateLimitStore()
  const times = (rateStore.get(userId) || []).filter(t => now - t < 60000)
  if (times.length >= settings.maxMessagesPerMinute) {
    const oldest = Math.min(...times)
    return {
      allowed: false,
      reason: `每分钟最多 ${settings.maxMessagesPerMinute} 条，请稍候`,
      retryAfterMs: 60000 - (now - oldest),
    }
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

// 获取所有频道最近消息（供后台审查）
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
  } catch {
    return []
  }
}

export async function deleteMessage(id: string): Promise<boolean> {
  const sb = getSupabase()
  const { error } = await sb.from('messages').delete().eq('id', id)
  if (error) {
    logger.error('chat', '删除消息失败', { id, error: error.message })
    return false
  }
  logger.info('chat', '管理员删除消息', { id })
  return true
}

// 批量删除某用户的消息
export async function deleteMessagesByUser(userId: string): Promise<number> {
  const sb = getSupabase()
  const { data, error } = await sb.from('messages').delete().eq('user_id', userId).select('id')
  if (error) {
    logger.error('chat', '批量删除用户消息失败', { userId, error: error.message })
    return 0
  }
  const count = data?.length || 0
  logger.info('chat', '管理员批量删除用户消息', { userId, count })
  return count
}

export async function getChatStats(): Promise<ChatStats> {
  await seedDatabase()
  const sb = getSupabase()
  const now = Date.now()
  const todayStart = now - 24 * 60 * 60 * 1000

  // 各频道消息数
  const channels: ChatChannel[] = ['world', 'family', 'friend']
  const counts: Record<string, number> = { world: 0, family: 0, friend: 0 }
  let totalCount = 0
  let todayCount = 0
  const userCounter: Record<string, { userId: string; userName: string; count: number }> = {}

  try {
    for (const ch of channels) {
      const { data } = await sb.from('messages').select('user_id, user_name, is_system, created_at, timestamp').eq('channel', ch)
      if (data) {
        counts[ch] = data.length
        totalCount += data.length
        for (const m of data) {
          const ts = (typeof m.timestamp === 'number' ? m.timestamp : m.created_at) || 0
          if (ts > todayStart && !m.is_system) todayCount++
          if (m.user_id && m.user_id !== 'system' && !m.is_system) {
            if (!userCounter[m.user_id]) {
              userCounter[m.user_id] = { userId: m.user_id, userName: m.user_name || '未知', count: 0 }
            }
            userCounter[m.user_id].count++
          }
        }
      }
    }
  } catch (e: any) {
    logger.warn('chat', `获取聊天统计失败: ${e?.message}`)
  }

  const topUsers = Object.values(userCounter).sort((a, b) => b.count - a.count).slice(0, 10)

  return {
    worldCount: counts.world,
    familyCount: counts.family,
    friendCount: counts.friend,
    totalCount,
    todayCount,
    topUsers,
  }
}

// ==================== 花园点赞（社交增强） ====================

export async function getGardenLikeCount(targetId: string): Promise<number> {
  const sb = getSupabase()
  try {
    const { count, error } = await sb.from('garden_likes')
      .select('*', { count: 'exact', head: true })
      .eq('target_id', targetId)
    if (error || count === null) return 0
    return count
  } catch {
    return 0
  }
}

export async function hasLiked(likerId: string, targetId: string): Promise<boolean> {
  const sb = getSupabase()
  try {
    const { data } = await sb.from('garden_likes')
      .select('id')
      .eq('liker_id', likerId)
      .eq('target_id', targetId)
      .limit(1)
    return !!(data && data.length > 0)
  } catch {
    return false
  }
}

export async function toggleGardenLike(likerId: string, targetId: string): Promise<{ liked: boolean; count: number }> {
  const sb = getSupabase()
  const existed = await hasLiked(likerId, targetId)
  if (existed) {
    await sb.from('garden_likes').delete()
      .eq('liker_id', likerId)
      .eq('target_id', targetId)
  } else {
    await sb.from('garden_likes').insert({
      id: genId('gl'),
      liker_id: likerId,
      target_id: targetId,
      created_at: Date.now(),
    })
  }
  const count = await getGardenLikeCount(targetId)
  return { liked: !existed, count }
}

// ==================== 好友浇水（社交增强） ====================
// 每日给好友浇水次数限制（内存计数，Edge 重启清空可接受）
function getFriendWaterStore(): Map<string, number[]> {
  try {
    const g = globalThis as any
    g.__gardenFriendWater = g.__gardenFriendWater || new Map<string, number[]>()
    return g.__gardenFriendWater
  } catch {
    return new Map<string, number[]>()
  }
}

const FRIEND_WATER_DAILY_LIMIT = 5
const FRIEND_WATER_GROWTH_BONUS = 5 // 每次浇水 +5% 生长
const FRIEND_WATER_COIN_REWARD = 2 // 浇水者获得 2 金币奖励

export async function waterFriendFlower(
  watererId: string,
  targetId: string,
  plotId: number
): Promise<{ success: boolean; message: string; reward?: number }> {
  if (watererId === targetId) {
    return { success: false, message: '不能给自己的花浇水（请用花园页浇水）' }
  }

  // 每日次数检查
  const now = Date.now()
  const store = getFriendWaterStore()
  const times = (store.get(watererId) || []).filter(t => now - t < 86400000)
  if (times.length >= FRIEND_WATER_DAILY_LIMIT) {
    return { success: false, message: `今日好友浇水次数已用完（${FRIEND_WATER_DAILY_LIMIT}次）` }
  }

  const target = await findUserById(targetId)
  if (!target) return { success: false, message: '目标用户不存在' }

  const plot = target.plots.find(p => p.id === plotId)
  if (!plot || !plot.unlocked || !plot.flower) {
    return { success: false, message: '该地块没有花朵' }
  }
  if (plot.flower.isReady) {
    return { success: false, message: '花已成熟，无需浇水' }
  }

  // 推进生长
  const newFlower = { ...plot.flower }
  newFlower.growthProgress = Math.min(100, newFlower.growthProgress + FRIEND_WATER_GROWTH_BONUS)
  newFlower.waterCount += 1
  newFlower.lastWaterAt = now
  if (newFlower.growthProgress >= 100) {
    newFlower.growthProgress = 100
    newFlower.isReady = true
  }
  const newPlots = target.plots.map(p => p.id === plotId ? { ...p, flower: newFlower } : p)
  await updateUser(targetId, { plots: newPlots })

  // 给浇水者金币奖励
  const waterer = await findUserById(watererId)
  if (waterer) {
    await updateUser(watererId, { coins: waterer.coins + FRIEND_WATER_COIN_REWARD })
  }

  // 记录次数
  times.push(now)
  store.set(watererId, times)

  // 通知被浇水者
  const watererName = waterer?.nickname || '好友'
  await createNotification({
    userId: targetId,
    type: 'system',
    title: '💧 好友帮你浇水啦',
    content: `${watererName} 帮你的花浇了水，生长 +${FRIEND_WATER_GROWTH_BONUS}%`,
  })

  logger.info('garden', '好友浇水', {
    watererId, targetId, plotId,
    growthBonus: FRIEND_WATER_GROWTH_BONUS, coinReward: FRIEND_WATER_COIN_REWARD,
  })

  return {
    success: true,
    message: `浇水成功！花朵生长 +${FRIEND_WATER_GROWTH_BONUS}%，你获得 ${FRIEND_WATER_COIN_REWARD} 金币`,
    reward: FRIEND_WATER_COIN_REWARD,
  }
}

export function getFriendWaterRemainingToday(userId: string): number {
  const store = getFriendWaterStore()
  const now = Date.now()
  const times = (store.get(userId) || []).filter(t => now - t < 86400000)
  return Math.max(0, FRIEND_WATER_DAILY_LIMIT - times.length)
}


