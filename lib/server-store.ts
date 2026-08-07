// 服务端数据层 - Supabase 异步实现（替代内存+fs存储）
import { getSupabase } from './supabase'
import { logger } from './logger'
import type {
  User, Family, ChatMessage, MarketListing, BuyOrder,
  Task, CDK, Notification, GameState, Announcement,
  StealLog, PestSeverity, PlantedFlower, Plot, RankLevel,
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
    familyId: row.family_id,
    friends: row.friends || [],
    deleted: row.deleted,
    stealCountToday: row.steal_count_today || 0,
    stealResetAt: row.steal_reset_at || 0,
    gardenProtectedUntil: row.garden_protected_until || 0,
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
  if (user.familyId !== undefined) row.family_id = user.familyId
  if (user.friends !== undefined) row.friends = user.friends
  if (user.deleted !== undefined) row.deleted = user.deleted
  if (user.stealCountToday !== undefined) row.steal_count_today = user.stealCountToday
  if (user.stealResetAt !== undefined) row.steal_reset_at = user.stealResetAt
  if (user.gardenProtectedUntil !== undefined) row.garden_protected_until = user.gardenProtectedUntil
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
  const { data: allUsers, error: listErr } = await sb.from('users').select('id, plots, inventory, is_admin')
  if (listErr) {
    logger.error('system', '查询用户列表失败', { error: listErr.message })
    return
  }

  // 修复：对已有用户检查并修复空 plots
  if (allUsers && allUsers.length > 0) {
    for (const u of allUsers) {
      const plots = u.plots
      const isEmpty = !plots || plots.length === 0
      // 如果 plots 为空或没有解锁的地块，修复它
      const hasUnlocked = plots && plots.some((p: any) => p.unlocked)
      if (isEmpty || !hasUnlocked) {
        const unlockedCount = u.is_admin ? 30 : isEmpty ? 1 : Math.max(3, (plots?.length || 0))
        const fixedPlots = createInitialPlots(unlockedCount)
        const existingInv = u.inventory
        const fixedInv = !existingInv || existingInv.length === 0
          ? (u.is_admin ? [] : [
              { id: 'inv_s1', type: 'seed', referenceId: 'seed_daisy', name: '雏菊种子', emoji: '🌱', quantity: 3, maxStack: 99, sellable: false, tradeable: true },
              { id: 'inv_s2', type: 'seed', referenceId: 'seed_tulip', name: '郁金香种子', emoji: '🌱', quantity: 2, maxStack: 99, sellable: false, tradeable: true },
              { id: 'inv_t1', type: 'tool', referenceId: 'watering_can', name: '水壶', emoji: '💧', quantity: 5, maxStack: 99, sellable: true, tradeable: true },
            ])
          : existingInv
        const { error } = await sb.from('users')
          .update({ plots: fixedPlots, inventory: fixedInv })
          .eq('id', u.id)
        if (error) {
          logger.error('system', `修复用户 ${u.id} plots 失败`, { error: error.message })
        } else {
          logger.info('system', `修复用户 ${u.id} plots`, { unlockedCount })
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
    .eq('deleted', false)
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
    .eq('deleted', false)
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
