// 服务端数据层 - Supabase 异步实现（替代内存+fs存储）
import { getSupabase } from './supabase'
import { logger } from './logger'
import type {
  User, Family, ChatMessage, ChatChannel, MarketListing, BuyOrder,
  Task, CDK, Notification, GameState, Announcement,
  StealLog, PestSeverity, PlantedFlower, Plot, RankLevel,
  SensitiveWord, ChatSettings, ChatStats, InventoryItem,
} from './types'
import {
  FLOWER_TYPES, INITIAL_GAME_STATE, INITIAL_ANNOUNCEMENTS,
  getPlotUnlockPrice, PEST_CONFIG, STEAL_CONFIG, rollPestSeverity,
  getFlowerSellPrice, getSeasonByMonth,
  FAMILY_LEVEL_EXP, calcFamilyLevel, calcFamilyMaxMembers,
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
    incomingFriendRequests: row.incoming_friend_requests || [],
    outgoingFriendRequests: row.outgoing_friend_requests || [],
    adminPermissions: row.admin_permissions ?? 0,
    theme: row.theme || 'light',
    gardenBg: row.garden_bg || '',
    lastCheckInAt: row.last_check_in_at || 0,
    checkInStreak: row.check_in_streak || 0,
    totalCheckinDays: row.total_checkin_days || 0,
    totalCheckinDaysAccum: row.total_checkin_days_accum || 0,
    achievements: row.achievements || {},
    title: row.title || '',
    petalCoins: row.petal_coins || 0,
    titles: row.titles || [],
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
  if (user.incomingFriendRequests !== undefined) row.incoming_friend_requests = user.incomingFriendRequests
  if (user.outgoingFriendRequests !== undefined) row.outgoing_friend_requests = user.outgoingFriendRequests
  if (user.adminPermissions !== undefined) row.admin_permissions = user.adminPermissions
  if (user.theme !== undefined) row.theme = user.theme
  if (user.gardenBg !== undefined) row.garden_bg = user.gardenBg
  if (user.lastCheckInAt !== undefined) row.last_check_in_at = user.lastCheckInAt
  if (user.checkInStreak !== undefined) row.check_in_streak = user.checkInStreak
  if ((user as any).totalCheckinDays !== undefined) row.total_checkin_days = (user as any).totalCheckinDays
  if ((user as any).totalCheckinDaysAccum !== undefined) row.total_checkin_days_accum = (user as any).totalCheckinDaysAccum
  if (user.achievements !== undefined) row.achievements = user.achievements
  if (user.title !== undefined) row.title = user.title
  if (user.petalCoins !== undefined) row.petal_coins = user.petalCoins
  if ((user as any).titles !== undefined) row.titles = (user as any).titles
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

// ========== 管理员操作审计日志（内存缓存，最多 10000 条） ==========
export interface AdminLogEntry {
  id: string
  adminId: string
  adminName: string
  action: string
  targetType?: 'user' | 'announcement' | 'cdk' | 'chat' | 'market' | 'setting' | 'permissions' | 'economy' | 'other'
  targetId?: string
  detail?: Record<string, any>
  createdAt: number
  ip?: string
}

let _adminLogsCache: AdminLogEntry[] = []
const MAX_ADMIN_LOGS = 10000

export async function logAdminAction(
  admin: { id: string; nickname?: string; username?: string } | null,
  action: string,
  extra: Omit<Partial<AdminLogEntry>, 'id' | 'adminId' | 'adminName' | 'action' | 'createdAt'> = {},
): Promise<void> {
  if (!admin) return
  try {
    const entry: AdminLogEntry = {
      id: 'log_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36),
      adminId: admin.id,
      adminName: admin.nickname || admin.username || admin.id,
      action,
      createdAt: Date.now(),
      ...extra,
    }
    _adminLogsCache.unshift(entry)
    if (_adminLogsCache.length > MAX_ADMIN_LOGS) _adminLogsCache = _adminLogsCache.slice(0, MAX_ADMIN_LOGS)
    // 尽量写入 admin_logs 表（如果有的话）
    try {
      await seedDatabase()
      const sb = getSupabase()
      await sb.from('admin_logs').insert({
        id: entry.id, admin_id: entry.adminId, admin_name: entry.adminName,
        action: entry.action, target_type: entry.targetType || null, target_id: entry.targetId || null,
        detail: entry.detail || null, created_at: entry.createdAt, ip: entry.ip || null,
      }).select().maybeSingle()
    } catch (_e) { /* noop: 没有表也可以 */ }
  } catch (e: any) {
    logger.warn('admin', `logAdminAction 失败: ${e?.message || 'unknown'}`)
  }
}

export async function listAdminLogs(options: {
  adminId?: string;
  action?: string;
  targetType?: AdminLogEntry['targetType'];
  limit?: number;
  offset?: number;
} = {}): Promise<{ items: AdminLogEntry[]; total: number }> {
  await seedDatabase()
  const sb = getSupabase()
  let q: any = sb.from('admin_logs').select('*', { count: 'exact' })
  let hasTable = true
  try {
    if (options.adminId) q = q.eq('admin_id', options.adminId)
    if (options.targetType) q = q.eq('target_type', options.targetType)
    if (options.action) q = q.eq('action', options.action)
    q = q.order('created_at', { ascending: false }).range(options.offset || 0, (options.offset || 0) + (options.limit || 200) - 1)
    const { data, error, count } = await q
    if (error || !Array.isArray(data)) throw new Error(error?.message || 'no table')
    return { total: count || data.length, items: data.map((r: any) => ({
      id: r.id, adminId: r.admin_id, adminName: r.admin_name,
      action: r.action, targetType: r.target_type || undefined, targetId: r.target_id || undefined,
      detail: r.detail || undefined, createdAt: r.created_at, ip: r.ip || undefined,
    })) }
  } catch (_e) {
    hasTable = false
  }
  // 退化为内存
  let arr = _adminLogsCache.slice()
  if (options.adminId) arr = arr.filter(x => x.adminId === options.adminId)
  if (options.targetType) arr = arr.filter(x => x.targetType === options.targetType)
  if (options.action) arr = arr.filter(x => x.action === options.action)
  const total = arr.length
  const limit = options.limit || 200
  const offset = options.offset || 0
  return { items: arr.slice(offset, offset + limit), total }
}

export async function seedDatabase(): Promise<void> {
  if (seedPromise) return seedPromise
  // 失败时重置缓存，避免 isolate 内永久持有 rejected promise 导致后续全部请求失败
  seedPromise = doSeed().catch((e) => {
    seedPromise = null
    logger.error('system', `seedDatabase 失败已重置缓存: ${e?.message || 'unknown'}`)
    // 不抛出，让调用方继续走（各数据函数已有兜底）
  })
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

  // ============================================================
  //  自修复 3：检测 users 表是否缺少 admin_permissions / family_id 等关键列
  //  （线上老用户如果数据库没迁移，会导致管理员/家族功能写入失败）
  //  如缺列则通过内部 _garden_ensure_users_cols RPC 自动补列；无 RPC 则打 warn
  // ============================================================
  try {
    const { data: cols } = await sb
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_schema', 'public')
      .eq('table_name', 'users')
    const colNames = new Set((cols || []).map((c: any) => c.column_name))
    const REQUIRED_COLS: { name: string; type: string; def: string }[] = [
      { name: 'admin_permissions', type: 'INTEGER',   def: 'DEFAULT 0' },
      { name: 'family_id',        type: 'TEXT',      def: '' },
      { name: 'is_admin',         type: 'BOOLEAN',   def: 'DEFAULT FALSE' },
      { name: 'petal_coins',      type: 'INTEGER',   def: 'DEFAULT 0' },
      { name: 'title',            type: 'TEXT',      def: "DEFAULT ''" },
      { name: 'titles',           type: 'JSONB',     def: "DEFAULT '[]'::jsonb" },
      { name: 'achievements',     type: 'JSONB',     def: "DEFAULT '[]'::jsonb" },
      { name: 'muted_until',      type: 'BIGINT',    def: '' },
      { name: 'banned_until',     type: 'BIGINT',    def: '' },
    ]
    const missing = REQUIRED_COLS.filter(c => !colNames.has(c.name))
    if (missing.length > 0) {
      logger.warn('system', `users 表缺少列: ${missing.map(c=>c.name).join(',')}。尝试补列...`)
      // 尝试通过 RPC 补列（需要管理员先在 Supabase SQL Editor 创建该 RPC，见 hotupdate_supabase.sql）
      try {
        const { error } = await sb.rpc('_garden_ensure_users_cols', {})
        if (error) logger.warn('system', `RPC 补列失败（需先创建 _garden_ensure_users_cols）: ${error.message}`)
        else logger.info('system', 'users 缺失列已通过 RPC 自动补齐')
      } catch (rpcE: any) {
        logger.warn('system', `users 缺列补 RPC 失败，请手动执行 hotupdate_supabase.sql: ${rpcE?.message || 'unknown'}`)
      }
    } else {
      logger.info('system', 'users 表字段完整校验通过')
    }
  } catch (e: any) {
    logger.warn('system', `检测 users 列名失败: ${e?.message || 'unknown'}`)
  }

  // 轻量存在性检查：只取 id 判断是否已有用户，避免拉取重量级 JSONB 列导致 Edge 超时
  // 注意：空 plots / 缺失 task 字段等已在 dbRowToUser 读取层用 || [] / || {} 兜底，无需在 seed 阶段逐条 UPDATE 修复
  const { data: existingIds, error: listErr } = await sb.from('users').select('id').limit(1)
  if (listErr) {
    logger.error('system', '查询用户列表失败', { error: listErr.message })
    return
  }

  if (existingIds && existingIds.length > 0) {
    logger.info('system', '数据库已有用户数据，跳过种子初始化')
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
    inventory: [
      { id: 'inv_admin_t1', type: 'tool', referenceId: 'watering_can', name: '水壶', emoji: '💧', quantity: 999, maxStack: 9999, sellable: true, tradeable: true },
      { id: 'inv_admin_t2', type: 'tool', referenceId: 'fertilizer',   name: '化肥', emoji: '🧪', quantity: 999, maxStack: 9999, sellable: true, tradeable: true },
      { id: 'inv_admin_t3', type: 'tool', referenceId: 'pesticide',    name: '除虫剂', emoji: '🧴', quantity: 999, maxStack: 9999, sellable: true, tradeable: true },
      { id: 'inv_admin_t4', type: 'tool', referenceId: 'speedup_card', name: '加速卡', emoji: '⚡', quantity: 999, maxStack: 9999, sellable: true, tradeable: true },
      { id: 'inv_admin_s1', type: 'seed', referenceId: 'seed_rose',   name: '玫瑰种子',   emoji: '🌱', quantity: 99, maxStack: 99, sellable: false, tradeable: true },
      { id: 'inv_admin_s2', type: 'seed', referenceId: 'seed_daisy',  name: '雏菊种子',   emoji: '🌱', quantity: 99, maxStack: 99, sellable: false, tradeable: true },
      { id: 'inv_admin_s3', type: 'seed', referenceId: 'seed_tulip',  name: '郁金香种子', emoji: '🌱', quantity: 99, maxStack: 99, sellable: false, tradeable: true },
      { id: 'inv_admin_s4', type: 'seed', referenceId: 'seed_sunflower', name: '向日葵种子', emoji: '🌱', quantity: 99, maxStack: 99, sellable: false, tradeable: true },
    ],
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
    { id: 'l_t1', seller_id: 'system', seller_name: '官方', is_official: true, item_type: 'tool', reference_id: 'watering_can', name: '水壶', emoji: '💧', price: 10, quantity: 99, created_at: now - 65000 },
    { id: 'l_t2', seller_id: 'system', seller_name: '官方', is_official: true, item_type: 'tool', reference_id: 'fertilizer', name: '化肥', emoji: '🧪', price: 25, quantity: 99, created_at: now - 60000 },
    { id: 'l_t3', seller_id: 'system', seller_name: '官方', is_official: true, item_type: 'tool', reference_id: 'pesticide', name: '除虫剂', emoji: '🧴', price: 30, quantity: 99, created_at: now - 55000 },
    { id: 'l_t4', seller_id: 'system', seller_name: '官方', is_official: true, item_type: 'tool', reference_id: 'speedup_card', name: '加速卡', emoji: '⚡', price: 100, quantity: 50, created_at: now - 50000 },
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

  // ============================================================
  //  自修复 4：给所有已有用户补齐 4 种基础工具
  // （老用户/用老版本 seed 创建的用户 inventory 里没有 pesticide 和 speedup_card，
  //   导致背包和地块操作弹窗看不到数量。这里在每次 seed 时做一次补齐。）
  // ============================================================
  try {
    const { data: allUsers, error: usersErr } = await sb
      .from('users')
      .select('id, inventory, deleted')
    if (!usersErr && allUsers) {
      const DEFAULT_TOOLS = [
        { ref: 'watering_can', name: '水壶', emoji: '💧', quantity: 5 },
        { ref: 'fertilizer',   name: '化肥', emoji: '🧪', quantity: 3 },
        { ref: 'pesticide',    name: '除虫剂', emoji: '🧴', quantity: 2 },
        { ref: 'speedup_card', name: '加速卡', emoji: '⚡', quantity: 1 },
      ]
      for (const u of allUsers) {
        if (u.deleted) continue
        const inv = Array.isArray(u.inventory) ? [...u.inventory] : []
        const toolIdPrefix = `t_${u.id.replace(/[^a-zA-Z0-9_]/g, '')}`
        let changed = false
        DEFAULT_TOOLS.forEach((tool, idx) => {
          const exists = inv.find(i => i && i.type === 'tool' && i.referenceId === tool.ref)
          if (!exists) {
            inv.push({
              id: `inv_${toolIdPrefix}_${idx}`,
              type: 'tool',
              referenceId: tool.ref,
              name: tool.name,
              emoji: tool.emoji,
              quantity: tool.quantity,
              maxStack: 99,
              sellable: true,
              tradeable: true,
            })
            changed = true
          }
        })
        if (changed) {
          const { error: updErr } = await sb.from('users').update({ inventory: inv }).eq('id', u.id)
          if (updErr) logger.warn('system', `补全用户 ${u.id} 工具失败: ${updErr.message}`)
          else logger.info('system', `已为用户 ${u.id} 补全背包基础工具`)
        }
      }
    }
  } catch (e: any) {
    logger.warn('system', `补全所有用户基础工具失败: ${e?.message || 'unknown'}`)
  }

  logger.info('system', '数据库种子数据初始化完成')
}

// ==================== 用户 ====================

/**
 * 确保用户背包拥有 4 种基础工具（水壶/化肥/除虫剂/加速卡）。
 * 每次 findUserById / findUserByUsername 返回前调用，
 * 缺失的工具自动补齐并写回 DB。这样无论 seed 是否跑过，
 * 老用户登录时都会被兜底。
 */
const DEFAULT_TOOLS = [
  { ref: 'watering_can', name: '水壶',   emoji: '💧', quantity: 5 },
  { ref: 'fertilizer',   name: '化肥',   emoji: '🧪', quantity: 3 },
  { ref: 'pesticide',    name: '除虫剂', emoji: '🧴', quantity: 2 },
  { ref: 'speedup_card', name: '加速卡', emoji: '⚡', quantity: 1 },
]

async function ensureUserTools(row: any): Promise<any> {
  if (!row || row.deleted) return row
  const inv = Array.isArray(row.inventory) ? [...row.inventory] : []
  let changed = false
  const uid = String(row.id || '').replace(/[^a-zA-Z0-9_]/g, '')
  DEFAULT_TOOLS.forEach((tool, idx) => {
    const exists = inv.find((i: any) => i && i.type === 'tool' && i.referenceId === tool.ref)
    if (!exists) {
      inv.push({
        id: `inv_t_${uid}_${idx}`,
        type: 'tool',
        referenceId: tool.ref,
        name: tool.name,
        emoji: tool.emoji,
        quantity: tool.quantity,
        maxStack: 99,
        sellable: true,
        tradeable: true,
      })
      changed = true
    }
  })
  if (changed) {
    const sb = getSupabase()
    const { error } = await sb.from('users').update({ inventory: inv }).eq('id', row.id)
    if (error) logger.warn('system', `补全用户 ${row.id} 工具失败: ${error.message}`)
    else { logger.info('system', `已为用户 ${row.id} 补全背包基础工具`); row.inventory = inv }
  }
  return row
}

export async function findUserByUsername(username: string): Promise<User | null> {
  await seedDatabase()
  const sb = getSupabase()
  const { data, error } = await sb.from('users')
    .select('*')
    .eq('username', username)
    .single()
  if (error || !data) return null
  await ensureUserTools(data)
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
  await ensureUserTools(data)
  return dbRowToUser(data)
}

export async function getAllUsers(columns?: string): Promise<User[]> {
  await seedDatabase()
  const sb = getSupabase()
  // 优先用调用方指定的轻量列集；若因数据库缺列报错，自动降级为 select('*')（已被
  // findUserById 验证可用），避免显式列名引用不存在的列导致整查询失败返回空。
  const trySelect = async (cols: string) => {
    const { data, error } = await sb.from('users')
      .select(cols)
      .order('created_at', { ascending: true })
    return { data, error }
  }
  let { data, error } = await trySelect(columns || '*')
  if (error && columns) {
    // 指定列失败（可能缺列），降级为全列重试
    logger.warn('system', `getAllUsers 指定列查询失败，降级为 select(*): ${error.message}`)
    const fallback = await trySelect('*')
    data = fallback.data
    error = fallback.error
  }
  if (error) {
    logger.error('system', `getAllUsers 查询失败: ${error.message}`, { code: error.code })
    return []
  }
  if (!data) return []
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
      { id: 'inv_t2', type: 'tool', referenceId: 'fertilizer',   name: '化肥', emoji: '🧪', quantity: 3, maxStack: 99, sellable: true, tradeable: true },
      { id: 'inv_t3', type: 'tool', referenceId: 'pesticide',    name: '除虫剂', emoji: '🧴', quantity: 2, maxStack: 99, sellable: true, tradeable: true },
      { id: 'inv_t4', type: 'tool', referenceId: 'speedup_card', name: '加速卡', emoji: '⚡', quantity: 1, maxStack: 99, sellable: true, tradeable: true },
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

// 本轮新增的列（签到/设置/小游戏/成就）——用于热更新降级：
// 当 users 表尚未 ALTER 添加这些列时，update 会整条失败，这里在失败后自动剥离重试
const NEW_USER_COLUMNS = new Set([
  'theme', 'garden_bg', 'title',
  'last_check_in_at', 'check_in_streak',
  'total_checkin_days', 'total_checkin_days_accum',
  'petal_coins', 'achievements', 'titles',
])

function isMissingColumnError(err: any): boolean {
  const msg = String(err?.message || '')
  return /column .* does not exist|Could not find the column|could not find column|relation .* does not exist/i.test(msg)
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
    // 热更新降级：若因新列不存在导致整条 update 失败，剥离新列后重试，保证旧字段仍能写入
    if (isMissingColumnError(error)) {
      const stripped: Record<string, any> = {}
      let removed = false
      for (const [k, v] of Object.entries(dbRow)) {
        if (NEW_USER_COLUMNS.has(k)) { removed = true; continue }
        stripped[k] = v
      }
      if (removed && Object.keys(stripped).length > 0) {
        logger.warn('system', `updateUser 热更新降级：剥离新列重试`, { userId, removedCols: Object.keys(dbRow).filter(k => NEW_USER_COLUMNS.has(k)) })
        const { data: data2, error: error2 } = await sb.from('users')
          .update(stripped)
          .eq('id', userId)
          .select('*')
          .single()
        if (!error2 && data2) return dbRowToUser(data2)
      }
    }
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
  // 按月份计算季节，确保与真实季节一致
  const monthSeason = getSeasonByMonth()
  if (gs.currentSeason !== monthSeason) {
    await setGameState({ currentSeason: monthSeason, seasonStartAt: Date.now() })
    return { ...gs, currentSeason: monthSeason, seasonStartAt: Date.now() }
  }
  return gs
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

export async function getListings(itemType?: 'flower' | 'seed' | 'tool'): Promise<MarketListing[]> {
  await seedDatabase()
  const sb = getSupabase()
  let query = sb.from('listings').select('*').order('created_at', { ascending: true })
  if (itemType) query = query.eq('item_type', itemType as string)
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

export async function createBuyOrder(data: Omit<BuyOrder, 'id' | 'createdAt'>): Promise<BuyOrder> {
  const sb = getSupabase()
  const order: BuyOrder = { ...data, id: genId('o'), createdAt: Date.now() }
  const row: any = {
    id: order.id,
    buyer_id: order.buyerId,
    buyer_name: order.buyerName,
    is_official: order.isOfficial,
    item_type: order.itemType,
    reference_id: order.referenceId,
    name: order.name,
    emoji: order.emoji,
    price: order.price,
    quantity: order.quantity,
    created_at: order.createdAt,
  }
  // buy_orders 表有 rank 列（历史数据），但 BuyOrder 类型无 rank；保持兼容
  const { rank } = (data as any)
  if (rank !== undefined) row.rank = rank
  await sb.from('buy_orders').insert(row)
  return order
}

export async function removeBuyOrder(id: string): Promise<boolean> {
  const sb = getSupabase()
  const { error } = await sb.from('buy_orders').delete().eq('id', id)
  return !error
}

export async function findBuyOrder(id: string): Promise<BuyOrder | null> {
  const sb = getSupabase()
  const { data, error } = await sb.from('buy_orders').select('*').eq('id', id).single()
  if (error || !data) return null
  return dbRowToBuyOrder(data)
}

export async function updateBuyOrderQuantity(id: string, quantity: number): Promise<void> {
  const sb = getSupabase()
  if (quantity <= 0) {
    await sb.from('buy_orders').delete().eq('id', id)
  } else {
    await sb.from('buy_orders').update({ quantity }).eq('id', id)
  }
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

// ==================== 背包工具函数（共享） ====================

export function addInventoryItem(
  inventory: InventoryItem[],
  item: Partial<InventoryItem> & Pick<InventoryItem, 'name' | 'type' | 'referenceId' | 'emoji'>,
  inventorySize: number,
): InventoryItem[] {
  const existing = inventory.find(
    (i) =>
      i.type === item.type &&
      i.referenceId === item.referenceId &&
      (!item.rank || i.rank === item.rank) &&
      i.quantity < i.maxStack,
  )
  if (existing) {
    return inventory.map((i) =>
      i.id === existing.id
        ? { ...i, quantity: Math.min(i.maxStack, i.quantity + (item.quantity || 1)) }
        : i,
    )
  }
  if (inventory.filter((i) => i.quantity > 0).length >= inventorySize) {
    throw new Error('背包已满，请先清理或扩容')
  }
  return [
    ...inventory,
    {
      id: `inv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: item.type,
      referenceId: item.referenceId,
      name: item.name,
      emoji: item.emoji,
      rank: item.rank,
      quantity: item.quantity || 1,
      maxStack: item.maxStack || 99,
      sellable: item.sellable ?? true,
      tradeable: item.tradeable ?? true,
    } as InventoryItem,
  ]
}

export function removeInventoryItem(
  inventory: InventoryItem[],
  type: InventoryItem['type'],
  referenceId: string,
  rank: number | undefined,
  quantity: number,
): [InventoryItem[], number] {
  const out: InventoryItem[] = []
  let remaining = quantity
  for (const it of inventory) {
    const match =
      it.type === type &&
      it.referenceId === referenceId &&
      (rank === undefined || it.rank === rank)
    if (!match || remaining <= 0) {
      if (it.quantity > 0) out.push(it)
      continue
    }
    const take = Math.min(it.quantity, remaining)
    const left = it.quantity - take
    remaining -= take
    if (left > 0) out.push({ ...it, quantity: left })
  }
  return [out, quantity - remaining]
}

export function consumeTool(inventory: InventoryItem[], toolId: string): InventoryItem[] | null {
  const [newInv] = removeInventoryItem(inventory, 'tool', toolId, undefined, 1)
  if (newInv.length >= inventory.length) return null
  return newInv
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
  'login': 't_daily_1',
  'daily_checkin': 't_daily_1',
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

  const channels: ChatChannel[] = ['world', 'family', 'friend']
  const counts: Record<string, number> = { world: 0, family: 0, friend: 0 }
  let totalCount = 0
  let todayCount = 0
  const userCounter: Record<string, { userId: string; userName: string; count: number }> = {}

  try {
    // 直接查询全部消息再在内存里过滤，避免 .in() 在某些 Edge 环境下返回空集
    // （getRecentMessagesAllChannels 用 select('*') 能正常返回，这里保持一致）
    const { data, error } = await sb.from('messages').select('*')

    if (error) {
      logger.warn('chat', `获取聊天统计查询错误: ${error.message}`)
    } else if (data && Array.isArray(data)) {
      processChannelData(data)
    }
  } catch (e: any) {
    logger.warn('chat', `获取聊天统计失败: ${e?.message}`)
  }

  function processChannelData(msgs: any[]) {
    for (const m of msgs) {
      const ch = m.channel as ChatChannel
      if (ch && channels.includes(ch)) {
        counts[ch]++
        totalCount++
      }
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

// ==================== 好友系统 ====================

// 搜索用户（按昵称或用户名匹配，排除自己和已好友）
export async function searchUsers(currentUserId: string, keyword: string, limit = 20): Promise<User[]> {
  const all = await getAllUsers()
  const kw = keyword.trim().toLowerCase()
  if (!kw) return []
  return all
    .filter((u) =>
      u.id !== currentUserId
      && !u.deleted
      && !u.friends.includes(currentUserId)
      && (
        u.nickname.toLowerCase().includes(kw)
        || u.username.toLowerCase().includes(kw)
        || u.id.toLowerCase().includes(kw)
      )
    )
    .slice(0, limit)
}

// 发送好友申请
export async function sendFriendRequest(
  fromUserId: string,
  toUserId: string,
  message?: string
): Promise<{ success: boolean; error?: string; request?: any }> {
  if (fromUserId === toUserId) return { success: false, error: '不能加自己为好友' }

  const from = await findUserById(fromUserId)
  const to = await findUserById(toUserId)
  if (!from || !to) return { success: false, error: '用户不存在' }
  if (to.deleted) return { success: false, error: '该用户已注销' }
  if (from.friends.includes(toUserId)) return { success: false, error: '已经是好友了' }

  // 检查是否已发送/已收到
  const outgoing = from.outgoingFriendRequests || []
  if (outgoing.some((r) => r.toUserId === toUserId && r.status === 'pending')) {
    return { success: false, error: '已发送过申请，等待对方处理' }
  }
  const incoming = to.incomingFriendRequests || []
  if (incoming.some((r) => r.fromUserId === fromUserId && r.status === 'pending')) {
    return { success: false, error: '对方已有你的待处理申请' }
  }

  const now = Date.now()
  const request: any = {
    id: `fr_${now}_${Math.random().toString(36).slice(2, 8)}`,
    fromUserId,
    fromUserName: from.nickname,
    fromUserAvatar: from.avatar,
    toUserId,
    toUserName: to.nickname,
    toUserAvatar: to.avatar,
    status: 'pending',
    createdAt: now,
    message: message || '',
  }

  // 写入双方
  await Promise.all([
    updateUser(fromUserId, {
      outgoingFriendRequests: [...outgoing, request],
    }),
    updateUser(toUserId, {
      incomingFriendRequests: [...incoming, request],
    }),
  ])

  // 通知对方
  await createNotification({
    userId: toUserId,
    type: 'friend',
    title: '👋 好友申请',
    content: `${from.nickname} 申请加你为好友${message ? `：「${message}」` : ''}`,
  })

  return { success: true, request }
}

// 处理好友申请（接受/拒绝）
export async function handleFriendRequest(
  currentUserId: string,
  requestId: string,
  action: 'accept' | 'reject'
): Promise<{ success: boolean; error?: string }> {
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
    // 双向加好友
    const myFriends = [...me.friends, req.fromUserId]
    const theirFriends = [...fromUser.friends, currentUserId]
    await Promise.all([
      updateUser(currentUserId, {
        friends: myFriends,
        incomingFriendRequests: incoming.map((r) =>
          r.id === requestId ? { ...r, status: newStatus } : r
        ),
      }),
      updateUser(req.fromUserId, {
        friends: theirFriends,
        outgoingFriendRequests: (fromUser.outgoingFriendRequests || []).map((r) =>
          r.id === requestId ? { ...r, status: newStatus } : r
        ),
      }),
    ])

    // 通知对方
    await createNotification({
      userId: req.fromUserId,
      type: 'friend',
      title: '🎉 好友申请通过',
      content: `你和 ${me.nickname} 已经是好友了！`,
    })
  } else {
    await Promise.all([
      updateUser(currentUserId, {
        incomingFriendRequests: incoming.map((r) =>
          r.id === requestId ? { ...r, status: newStatus } : r
        ),
      }),
      updateUser(req.fromUserId, {
        outgoingFriendRequests: (fromUser.outgoingFriendRequests || []).map((r) =>
          r.id === requestId ? { ...r, status: newStatus } : r
        ),
      }),
    ])
  }

  return { success: true }
}

// 删除好友
export async function removeFriend(currentUserId: string, friendId: string): Promise<{ success: boolean; error?: string }> {
  const me = await findUserById(currentUserId)
  const friend = await findUserById(friendId)
  if (!me || !friend) return { success: false, error: '用户不存在' }
  if (!me.friends.includes(friendId)) return { success: false, error: '不是好友' }

  await Promise.all([
    updateUser(currentUserId, {
      friends: me.friends.filter((f) => f !== friendId),
    }),
    updateUser(friendId, {
      friends: friend.friends.filter((f) => f !== currentUserId),
    }),
  ])
  return { success: true }
}

// 获取好友列表资料
export async function getFriendProfiles(currentUserId: string): Promise<any[]> {
  const me = await findUserById(currentUserId)
  if (!me) return []
  const all = await getAllUsers()
  return me.friends
    .map((fid) => {
      const u = all.find((x) => x.id === fid && !x.deleted)
      if (!u) return null
      return {
        id: u.id,
        nickname: u.nickname,
        avatar: u.avatar,
        online: Date.now() - u.lastLogin < 5 * 60 * 1000,
        lastLogin: u.lastLogin,
        plotsUnlocked: u.plots.filter((p) => p.unlocked).length,
        coins: u.coins,
        familyId: u.familyId,
        familyName: null,
        title: u.title || '',
      }
    })
    .filter(Boolean)
}

// ==================== 家族系统（真实版） ====================

// 向后兼容：统一使用 game-data 中的共享阈值/算法，避免前后端不一致
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
    if (keyword) {
      const kw = keyword.trim().toLowerCase()
      return list.filter((f) => f.name.toLowerCase().includes(kw))
    }
    return list
  } catch {
    return []
  }
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
  const row = {
    id,
    name: name.trim(),
    avatar,
    announcement: announcement || '',
    owner_id: ownerId,
    members: [{ userId: ownerId, role: 'owner', contribution: 0 }],
    level: 1,
    exp: 0,
    max_members: 10,
    created_at: now,
  }
  const { error } = await sb.from('families').insert(row)
  if (error) return { success: false, error: error.message }

  // 扣金币 + 绑定家族ID
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

  // 通知族长
  await createNotification({
    userId: fam.ownerId,
    type: 'family',
    title: '👪 新成员加入',
    content: `${u.nickname} 加入了你的家族！`,
  })
  return { success: true }
}

export async function leaveFamilyReal(userId: string): Promise<{ success: boolean; error?: string }> {
  const u = await findUserById(userId)
  const sb = getSupabase()

  // Step 1: 强制清理所有 families 表中 members 数组里的该用户记录（跨表兜底，解决用户在 family.members 里但 family_id 为空或不一致的脏数据）
  try {
    const { data: allFamilies } = await sb.from('families').select('id, members')
    if (allFamilies && Array.isArray(allFamilies)) {
      for (const fam of allFamilies as any[]) {
        if (!Array.isArray(fam.members)) continue
        if (fam.members.some((m: any) => m && m.userId === userId)) {
          const newMembers = fam.members.filter((m: any) => m && m.userId !== userId)
          let updates: Record<string, any> = { members: newMembers }
          // 如果该用户是族长，并且删完之后还有人，自动转让
          if (fam.owner_id === userId && newMembers.length > 0) {
            const newOwner = newMembers.find((m: any) => m.role === 'admin') || newMembers[0]
            updates.owner_id = newOwner.userId
            updates.members = newMembers.map((m: any) =>
              m.userId === newOwner.userId ? { ...m, role: 'owner' } : m
            )
          }
          // 如果删完没人了，直接解散家族
          if (newMembers.length === 0) {
            await sb.from('families').delete().eq('id', fam.id)
          } else {
            await sb.from('families').update(updates).eq('id', fam.id)
          }
        }
      }
    }
  } catch (e: any) {
    logger.warn('family', `leaveFamilyReal 清理 families.members 脏数据失败: ${e?.message}`)
  }

  // Step 2: 常规 leave 逻辑
  if (!u) return { success: false, error: '用户不存在' }
  // 不管 familyId 是否为空，最后都强制设空，保证本地/DB一致
  if (!u.familyId) {
    await updateUser(userId, { familyId: null })
    return { success: true }
  }
  const fam = await findFamilyById(u.familyId)
  if (!fam) {
    // 家族已不存在（可能被解散或数据异常）：强制清空用户 familyId，避免卡死
    await updateUser(userId, { familyId: null })
    return { success: true }
  }

  const isOwner = fam.ownerId === userId

  if (isOwner) {
    // 族长退出 = 解散家族（仅当只剩族长1人时，否则转移给 admin 或报错）
    const other = fam.members.filter((m) => m.userId !== userId)
    if (other.length > 0) {
      const admin = other.find((m) => m.role === 'admin') || other[0]
      const newOwnerId = admin.userId
      const newMembers = fam.members.filter((m) => m.userId !== userId).map((m) =>
        m.userId === newOwnerId ? { ...m, role: 'owner' as const } : m
      )
      await sb.from('families').update({
        members: newMembers,
        owner_id: newOwnerId,
      }).eq('id', fam.id)
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
  let newMembers = fam.members.map((m) =>
    m.userId === targetUserId ? { ...m, role } : m
  )
  let ownerId = fam.ownerId
  if (role === 'owner') {
    // 转让族长：旧族长降级为 member
    newMembers = newMembers.map((m) =>
      m.userId === operatorId ? { ...m, role: 'member' as const } : m
    )
    ownerId = targetUserId
  }
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
  await sb.from('families').update({
    exp: newExp,
    level: newLevel,
    max_members: newMax,
  }).eq('id', familyId)
}

export async function updateFamilyInfo(operatorId: string, familyId: string, data: { name?: string; announcement?: string; avatar?: string }): Promise<{ success: boolean; error?: string }> {
  const fam = await findFamilyById(familyId)
  if (!fam) return { success: false, error: '家族不存在' }
  if (fam.ownerId !== operatorId) return { success: false, error: '仅族长可编辑' }

  const sb = getSupabase()
  const updates: Record<string, any> = {}
  if (data.announcement !== undefined) updates.announcement = data.announcement
  if (data.avatar !== undefined) updates.avatar = data.avatar
  if (data.name !== undefined) {
    const trimmed = data.name.trim()
    if (!trimmed) return { success: false, error: '家族名不能为空' }
    const dup = await findFamilyByName(trimmed)
    if (dup && dup.id !== familyId) return { success: false, error: '家族名称已存在' }
    updates.name = trimmed
  }
  if (Object.keys(updates).length === 0) return { success: true }
  const { error } = await sb.from('families').update(updates).eq('id', familyId)
  if (error) return { success: false, error: error.message }
  return { success: true }
}

// ============== 价格覆盖（后台调控） ==============

export interface PriceOverrides {
  flowers?: Record<string, { baseSellPrice?: number; seedPrice?: number }>
  seeds?: Record<string, { price?: number }>
  tools?: Record<string, { price?: number }>
  feeRate?: number          // 手续费倍率，默认 0.05
  minListPrice?: number     // 挂售最低价
  maxListPrice?: number     // 挂售最高价
  updatedAt?: number
  updatedBy?: string
}

let _priceOverridesCache: PriceOverrides | null = null

function priceOverridesRow(row: any): PriceOverrides {
  if (!row) return {}
  return {
    flowers: row.flowers || undefined,
    seeds: row.seeds || undefined,
    tools: row.tools || undefined,
    feeRate: row.fee_rate ?? undefined,
    minListPrice: row.min_list_price ?? undefined,
    maxListPrice: row.max_list_price ?? undefined,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by,
  }
}

export async function getPriceOverrides(): Promise<PriceOverrides> {
  await seedDatabase()
  if (_priceOverridesCache) return _priceOverridesCache
  const sb = getSupabase()
  const { data, error } = await sb.from('price_overrides').select('*').order('updated_at', { ascending: false }).limit(1)
  if (error || !data || data.length === 0) {
    try {
      // 无表则 fall back 空
      _priceOverridesCache = {}
    } catch {}
    return _priceOverridesCache || {}
  }
  _priceOverridesCache = priceOverridesRow(data[0])
  return _priceOverridesCache
}

export async function setPriceOverrides(adminId: string, overrides: PriceOverrides): Promise<{ success: boolean; error?: string }> {
  await seedDatabase()
  const sb = getSupabase()
  const { error } = await sb.from('price_overrides').insert({
    flowers: overrides.flowers || null,
    seeds: overrides.seeds || null,
    tools: overrides.tools || null,
    fee_rate: overrides.feeRate ?? null,
    min_list_price: overrides.minListPrice ?? null,
    max_list_price: overrides.maxListPrice ?? null,
    updated_by: adminId,
    updated_at: Date.now(),
  })
  if (error) return { success: false, error: error.message }
  _priceOverridesCache = { ...overrides, updatedAt: Date.now(), updatedBy: adminId }
  return { success: true }
}

// 应用价格覆盖到实际售价 / 收购价 / 工具价
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

/** 带分页和 source 的 listing 列表（source: official / player） */
export async function getListingItems(
  itemType?: string,
  limit = 100,
  offset = 0,
): Promise<{ items: any[]; total: number }> {
  await seedDatabase()
  const sb = getSupabase()
  let query: any = sb.from('listings').select('*', { count: 'exact' })
  if (itemType) query = query.eq('item_type', itemType)
  query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1)
  const { data, error, count } = await query
  const items: any[] = (data || []).map((r: any) => {
    const l = dbRowToListing(r)
    return { ...l, source: l.isOfficial ? 'official' : 'player' }
  })
  return { items, total: count ?? items.length }
}

/** 管理员创建官方挂售（不从背包扣） */
export async function createAdminListing(data: {
  itemType: 'flower' | 'seed' | 'tool';
  referenceId: string;
  name: string;
  emoji: string;
  rank?: number;
  price: number;
  quantity: number;
}): Promise<{ success: boolean; error?: string; listing?: MarketListing }> {
  if (data.price <= 0) return { success: false, error: '价格需大于 0' }
  if (data.quantity <= 0) return { success: false, error: '数量需大于 0' }
  try {
    const listing = await createListing({
      sellerId: 'official',
      sellerName: '官方商城',
      isOfficial: true,
      itemType: data.itemType,
      referenceId: data.referenceId,
      name: data.name,
      emoji: data.emoji,
      rank: (data.rank as any) || 1,
      price: data.price,
      quantity: data.quantity,
    })
    return { success: true, listing }
  } catch (e: any) {
    return { success: false, error: e.message }
  }
}

// 扩展 removeListing：保留原签名 (id)，也支持 (userId?, id, forceAdmin?)
export async function removeListingExt(userId: string | null | undefined, id: string, forceAdmin = false): Promise<{ success: boolean; error?: string }> {
  const l = await findListing(id)
  if (!l) return { success: false, error: '商品不存在' }
  if (forceAdmin) {
    const ok = await removeListing(id)
    return { success: ok, error: ok ? undefined : '删除失败' }
  }
  if (!userId) return { success: false, error: '未登录' }
  if (l.sellerId !== userId) return { success: false, error: '不能下架他人商品' }
  const ok = await removeListing(id)
  return { success: ok, error: ok ? undefined : '删除失败' }
}

export async function getAllUserBaseCount(): Promise<number> {
  await seedDatabase()
  const sb = getSupabase()
  const { count, error } = await sb.from('users').select('id', { count: 'exact', head: true })
  if (error) return 0
  return count ?? 0
}

export async function getAllFamilies(): Promise<Family[]> {
  return getFamilies(undefined, 500)
}


