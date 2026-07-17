import bcrypt from 'bcryptjs';
import { MANUFACTURE_PROJECTS, type IManufactureProject } from '@/data/materials';
import { isSupabaseConfigured, getSupabaseClient } from '@/storage/database/browser-client';

// ====================================================================
// 数据存储策略：Supabase 云端为主存储，localStorage 为离线降级
// 所有读写操作：先尝试 Supabase，失败时自动降级到 localStorage
// 写入操作：localStorage 先写入确保不丢，再异步同步到 Supabase
// ====================================================================

// ========== 工具函数 ==========

function lsGetItem(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function lsSetItem(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}
function lsRemoveItem(key: string): void {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

/** 获取本地日期字符串 (YYYY-MM-DD)，避免 UTC 时区偏差 */
function getLocalDateString(): string {
  return new Date().toLocaleDateString('sv-SE');
}

/** 从指定 Date 对象获取本地日期字符串 */
function getLocalDateStringFrom(d: Date): string {
  return d.toLocaleDateString('sv-SE');
}

/** 检查 Supabase 是否可用 */
function hasSupabase(): boolean {
  return isSupabaseConfigured();
}

// ========== bcrypt 密码哈希 ==========

const SALT_ROUNDS = 10;

/** 哈希密码 */
export function hashPassword(plain: string): string {
  return bcrypt.hashSync(plain, SALT_ROUNDS);
}

/** 校验密码 */
export function verifyPassword(plain: string, hash: string): boolean {
  return bcrypt.compareSync(plain, hash);
}

// ========== 管理员密码（Supabase 主存储 + localStorage 降级 + bcrypt 哈希） ==========

const LOGIN_KEY = 'eve_admin_logged_in';
const ADMIN_PASSWORD_KEY = 'eve_admin_password_hash';

function loadAdminPasswordHashFromLocal(): string | null {
  try { return localStorage.getItem(ADMIN_PASSWORD_KEY); } catch { return null; }
}

function saveAdminPasswordHashToLocal(hash: string): void {
  try { localStorage.setItem(ADMIN_PASSWORD_KEY, hash); } catch { /* ignore */ }
}

/** 获取管理员密码哈希（向后兼容：先查 hash，不存在则查明文） */
export async function getAdminPasswordHash(): Promise<string | null> {
  if (hasSupabase()) {
    try {
      const supabase = getSupabaseClient()!;
      // 先尝试读取 bcrypt 哈希
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'admin_password_hash')
        .single();
      if (!error && data?.value) {
        saveAdminPasswordHashToLocal(data.value as string);
        return data.value as string;
      }
      // 向后兼容：读取旧版明文密码
      const { data: oldData, error: oldErr } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'admin_password')
        .single();
      if (!oldErr && oldData?.value) {
        return oldData.value as string;
      }
    } catch (err) {
      console.error('[getAdminPasswordHash] Supabase error:', err);
    }
  }
  return loadAdminPasswordHashFromLocal();
}

/** 修改当前登录账号的密码 */
export async function updateCurrentAccountPassword(oldPassword: string, newPassword: string): Promise<boolean> {
  const current = getCurrentAdminAccount();
  if (!current) return false;

  // 验证旧密码
  const account = await verifyAdminLogin(current.username, oldPassword);
  if (!account) return false;

  const newHash = hashPassword(newPassword);
  if (hasSupabase()) {
    try {
      const supabase = getSupabaseClient()!;
      const { error } = await supabase
        .from('admin_accounts')
        .update({ password_hash: newHash, updated_at: new Date().toISOString() })
        .eq('id', current.id);
      if (error) throw error;
    } catch (err) {
      console.error('[updateCurrentAccountPassword] Error:', err);
    }
  }
  // 同步本地
  const allLocal = loadAdminAccountsFromLocal();
  const idx = allLocal.findIndex((a) => a.id === current.id);
  if (idx >= 0) {
    allLocal[idx].password_hash = newHash;
    saveAdminAccountsToLocal(allLocal);
  }
  return true;
}

/** 修改管理员密码（存储哈希） */
export async function setAdminPassword(newPassword: string): Promise<void> {
  const hash = hashPassword(newPassword);
  saveAdminPasswordHashToLocal(hash);
  if (hasSupabase()) {
    try {
      const supabase = getSupabaseClient()!;
      const { error } = await supabase
        .from('app_settings')
        .upsert(
          { key: 'admin_password_hash', value: hash, updated_at: new Date().toISOString() },
          { onConflict: 'key' },
        );
      if (error) throw error;
    } catch (err) {
      console.error('[setAdminPassword] Supabase error:', err);
      throw err;
    }
  }
}

/** 校验管理员密码（向后兼容：支持 bcrypt 哈希和明文） */
export async function verifyAdminPassword(password: string): Promise<boolean> {
  const stored = await getAdminPasswordHash();
  if (!stored) return false;
  // 如果是 bcrypt 哈希（以 $2 开头）
  if (stored.startsWith('$2')) {
    return verifyPassword(password, stored);
  }
  // 向后兼容：明文密码
  return password === stored;
}

// ========== 登录态（本地 session，含时间戳防长期有效） ==========

const SESSION_KEY = 'eve_admin_session';
const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 小时

export interface AdminSession {
  id: string;
  username: string;
  role: 'super_admin' | 'admin';
  permissions: {
    manage_projects: boolean;
    manage_materials: boolean;
    manage_market: boolean;
    manage_admins: boolean;
  };
  ts: number; // 登录时间戳
}

/** 保存登录 session */
export function setAdminLoggedIn(session: AdminSession): void {
  lsSetItem(LOGIN_KEY, '1');
  lsSetItem(SESSION_KEY, JSON.stringify(session));
}

/** 检查登录态（验证时间戳，防止长期有效） */
export function isAdminLoggedIn(): boolean {
  const flag = lsGetItem(LOGIN_KEY) === '1';
  if (!flag) return false;
  try {
    const raw = lsGetItem(SESSION_KEY);
    if (!raw) return false;
    const session = JSON.parse(raw) as AdminSession;
    const expired = Date.now() - session.ts > SESSION_MAX_AGE_MS;
    if (expired) {
      clearAdminLogin();
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/** 获取当前 session */
export function getAdminSession(): AdminSession | null {
  try {
    const raw = lsGetItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as AdminSession;
    if (Date.now() - session.ts > SESSION_MAX_AGE_MS) {
      clearAdminLogin();
      return null;
    }
    return session;
  } catch { return null; }
}

/** 清除登录态 */
export function clearAdminLogin(): void {
  lsRemoveItem(LOGIN_KEY);
  lsRemoveItem(SESSION_KEY);
}

// ========== 项目数据 CRUD（Supabase + localStorage） ==========

const PROJECTS_KEY = 'eve_admin_projects';

function loadProjectsFromLocal(): IManufactureProject[] {
  try {
    const raw = localStorage.getItem(PROJECTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function saveProjectsToLocal(projects: IManufactureProject[]): void {
  try { localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects)); } catch { /* ignore */ }
}
function getFallbackProjects(): IManufactureProject[] {
  return MANUFACTURE_PROJECTS.map((p) => ({ ...p, isPreset: undefined }));
}

/** 加载项目列表 */
export async function loadAdminProjects(): Promise<IManufactureProject[]> {
  let localProjects = loadProjectsFromLocal();
  if (localProjects.length === 0) {
    localProjects = getFallbackProjects();
    saveProjectsToLocal(localProjects);
  }

  if (hasSupabase()) {
    try {
      const supabase = getSupabaseClient()!;
      const { data, error } = await supabase
        .from('manufacture_projects')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;
      if (data && data.length > 0) {
        const supabaseIds = new Set(data.map((item: Record<string, unknown>) => item.id as string));
        const merged = [...data.map((item: Record<string, unknown>) => {
          const localItem = localProjects.find((p) => p.id === item.id);
          // 优先使用 updated_at 更新的版本
          if (localItem && localItem.updated_at && item.updated_at) {
            return new Date(localItem.updated_at) > new Date(item.updated_at as string)
              ? localItem
              : item as unknown as IManufactureProject;
          }
          return (localItem || item) as unknown as IManufactureProject;
        })];
        for (const localItem of localProjects) {
          if (!supabaseIds.has(localItem.id)) {
            merged.push(localItem);
          }
        }
        saveProjectsToLocal(merged);
        return merged;
      }
    } catch (err) {
      console.error('[loadAdminProjects] Error:', err);
    }
  }

  return localProjects;
}

/** 保存全部项目 */
export async function saveAdminProjects(projects: IManufactureProject[]): Promise<void> {
  saveProjectsToLocal(projects);
  if (hasSupabase()) {
    try {
      const supabase = getSupabaseClient()!;
      const rows = projects.map((p, i) => ({ ...p, sort_order: i, updated_at: new Date().toISOString() }));
      const { error } = await supabase.from('manufacture_projects').upsert(rows, { onConflict: 'id' });
      if (error) throw error;
    } catch (err) {
      console.error('[saveAdminProjects] Error:', err);
      throw err;
    }
  }
}

/** 根据 id 查找项目 */
export async function findAdminProject(id: string): Promise<IManufactureProject | null> {
  if (hasSupabase()) {
    try {
      const supabase = getSupabaseClient()!;
      const { data, error } = await supabase.from('manufacture_projects').select('*').eq('id', id).single();
      if (error) throw error;
      if (data) return data as unknown as IManufactureProject;
    } catch (err) {
      console.error('[findAdminProject] Error:', err);
    }
  }
  const projects = loadProjectsFromLocal();
  return projects.find((p) => p.id === id) || null;
}

/** 新增项目 */
export async function addAdminProject(project: Omit<IManufactureProject, 'id'> & { id?: string }): Promise<IManufactureProject> {
  const now = new Date().toISOString();
  const newProject = { ...project, id: project.id || `proj_${Date.now()}` } as IManufactureProject;
  const projects = loadProjectsFromLocal();
  projects.push({ ...newProject, created_at: now, updated_at: now });
  saveProjectsToLocal(projects);
  if (hasSupabase()) {
    try {
      const supabase = getSupabaseClient()!;
      const { error } = await supabase.from('manufacture_projects').upsert(
        { ...newProject, sort_order: projects.length - 1, created_at: now, updated_at: now },
        { onConflict: 'id' },
      );
      if (error) throw error;
    } catch (err) {
      console.error('[addAdminProject] Supabase sync failed:', err);
      throw err;
    }
  }
  return newProject;
}

/** 更新项目 */
export async function updateAdminProject(id: string, updates: Partial<IManufactureProject>): Promise<void> {
  const projects = loadProjectsFromLocal();
  const idx = projects.findIndex((p) => p.id === id);
  if (idx >= 0) {
    projects[idx] = { ...projects[idx], ...updates };
    saveProjectsToLocal(projects);
  }
  if (hasSupabase()) {
    try {
      const supabase = getSupabaseClient()!;
      const { error } = await supabase.from('manufacture_projects').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
    } catch (err) {
      console.error('[updateAdminProject] Error:', err);
      throw err;
    }
  }
}

/** 删除项目 */
export async function deleteAdminProject(id: string): Promise<void> {
  const projects = loadProjectsFromLocal();
  saveProjectsToLocal(projects.filter((p) => p.id !== id));
  if (hasSupabase()) {
    try {
      const supabase = getSupabaseClient()!;
      const { error } = await supabase.from('manufacture_projects').delete().eq('id', id);
      if (error) throw error;
    } catch (err) {
      console.error('[deleteAdminProject] Error:', err);
      throw err;
    }
  }
}

// ========== 材料价格管理（Supabase + localStorage） ==========

export type MaterialType = 'minerals' | 'ship_materials' | 'build_materials';

export interface MaterialPriceItem {
  id: string;
  type: MaterialType;
  name: string;
  price: number;
  quantity: number;
  sortOrder: number;
}

const MATERIAL_PRICES_KEY = 'eve_material_prices';

function loadAllMaterialPricesFromLocal(): MaterialPriceItem[] {
  try {
    const raw = localStorage.getItem(MATERIAL_PRICES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function saveAllMaterialPricesToLocal(items: MaterialPriceItem[]): void {
  try { localStorage.setItem(MATERIAL_PRICES_KEY, JSON.stringify(items)); } catch { /* ignore */ }
}

/** 加载指定类型的材料价格列表 */
export async function loadMaterialPrices(type: MaterialType): Promise<MaterialPriceItem[]> {
  if (hasSupabase()) {
    try {
      const supabase = getSupabaseClient()!;
      const { data, error } = await supabase
        .from('material_prices')
        .select('*')
        .eq('type', type)
        .order('sort_order', { ascending: true });
      if (error) throw error;
      if (data && data.length > 0) {
        const items = data.map((row: Record<string, unknown>) => ({
          id: row.id as string,
          type: row.type as MaterialType,
          name: row.name as string,
          price: Number(row.price) || 0,
          quantity: Number(row.quantity) || 0,
          sortOrder: (row.sort_order as number) || 0,
        }));
        const allLocal = loadAllMaterialPricesFromLocal();
        const otherTypes = allLocal.filter((item) => item.type !== type);
        saveAllMaterialPricesToLocal([...otherTypes, ...items]);
        return items;
      }
    } catch (err) {
      console.error('[loadMaterialPrices] Error:', err);
    }
  }
  return loadAllMaterialPricesFromLocal().filter((item) => item.type === type);
}

/** 批量保存材料价格 */
export async function saveMaterialPrices(items: MaterialPriceItem[]): Promise<void> {
  const allLocal = loadAllMaterialPricesFromLocal();
  const otherTypes = allLocal.filter((item) => item.type !== (items[0]?.type || ''));
  saveAllMaterialPricesToLocal([...otherTypes, ...items]);

  if (hasSupabase() && items.length > 0) {
    try {
      const supabase = getSupabaseClient()!;
      const rows = items.map((item, index) => ({
        id: item.id,
        type: item.type,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        sort_order: item.sortOrder || index,
        updated_at: new Date().toISOString(),
      }));
      const { error } = await supabase.from('material_prices').upsert(rows, { onConflict: 'id' });
      if (error) throw error;
    } catch (err) {
      console.error('[saveMaterialPrices] Error:', err);
      throw err;
    }
  }
}

/** 添加新材料 */
export async function addMaterialPrice(item: MaterialPriceItem): Promise<void> {
  const allLocal = loadAllMaterialPricesFromLocal();
  allLocal.push(item);
  saveAllMaterialPricesToLocal(allLocal);
  if (hasSupabase()) {
    try {
      const supabase = getSupabaseClient()!;
      const { error } = await supabase.from('material_prices').insert({
        id: item.id,
        type: item.type,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        sort_order: item.sortOrder,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
    } catch (err) {
      console.error('[addMaterialPrice] Error:', err);
      throw err;
    }
  }
}

/** 删除材料 */
export async function deleteMaterialPrice(id: string): Promise<void> {
  const allLocal = loadAllMaterialPricesFromLocal();
  saveAllMaterialPricesToLocal(allLocal.filter((item) => item.id !== id));
  if (hasSupabase()) {
    try {
      const supabase = getSupabaseClient()!;
      const { error } = await supabase.from('material_prices').delete().eq('id', id);
      if (error) throw error;
    } catch (err) {
      console.error('[deleteMaterialPrice] Error:', err);
      throw err;
    }
  }
}

// ==================== 管理员账号管理（Supabase + localStorage） ====================

export interface AdminAccount {
  id: string;
  username: string;
  password_hash: string;
  role: 'super_admin' | 'admin';
  permissions: {
    manage_projects: boolean;
    manage_materials: boolean;
    manage_market: boolean;
    manage_admins: boolean;
  };
  created_at?: string;
  updated_at?: string;
}

const ADMIN_ACCOUNTS_KEY = 'eve_admin_accounts';

function loadAdminAccountsFromLocal(): AdminAccount[] {
  try {
    const raw = localStorage.getItem(ADMIN_ACCOUNTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function saveAdminAccountsToLocal(accounts: AdminAccount[]): void {
  try { localStorage.setItem(ADMIN_ACCOUNTS_KEY, JSON.stringify(accounts)); } catch { /* ignore */ }
}

/** 加载所有管理员账号（返回不含 password_hash 的安全视图） */
export async function loadAdminAccounts(): Promise<Omit<AdminAccount, 'password_hash'>[]> {
  if (hasSupabase()) {
    try {
      const supabase = getSupabaseClient()!;
      const { data, error } = await supabase
        .from('admin_accounts')
        .select('id, username, role, permissions, created_at, updated_at')
        .order('created_at', { ascending: true });
      if (error) throw error;
      if (data && data.length > 0) {
        saveAdminAccountsToLocal(data as AdminAccount[]);
        return data as Omit<AdminAccount, 'password_hash'>[];
      }
    } catch (err) {
      console.error('[loadAdminAccounts] Error:', err);
    }
  }
  return loadAdminAccountsFromLocal().map(({ password_hash, ...rest }) => rest);
}

/** 更新管理员账号元信息（不修改密码） */
export async function updateAdminAccountMeta(
  id: string,
  updates: { username: string; role: string; permissions: AdminAccount['permissions'] },
): Promise<void> {
  if (hasSupabase()) {
    try {
      const supabase = getSupabaseClient()!;
      const { error } = await supabase
        .from('admin_accounts')
        .update({ username: updates.username, role: updates.role, permissions: updates.permissions as any, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    } catch (err) {
      console.error('[updateAdminAccountMeta] Error:', err);
    }
  }
  // 同步本地
  const allLocal = loadAdminAccountsFromLocal();
  const idx = allLocal.findIndex((a) => a.id === id);
  if (idx >= 0) {
    allLocal[idx] = { ...allLocal[idx], ...updates, updated_at: new Date().toISOString() };
    saveAdminAccountsToLocal(allLocal);
  }
}

/** 保存管理员账号 */
export async function saveAdminAccount(account: AdminAccount): Promise<void> {
  const now = new Date().toISOString();
  const allLocal = loadAdminAccountsFromLocal();
  const idx = allLocal.findIndex((a) => a.id === account.id);
  const accountWithTimestamps = {
    ...account,
    created_at: account.created_at || now,
    updated_at: now,
  };
  if (idx >= 0) {
    allLocal[idx] = accountWithTimestamps;
  } else {
    allLocal.push(accountWithTimestamps);
  }
  saveAdminAccountsToLocal(allLocal);

  if (hasSupabase()) {
    try {
      const supabase = getSupabaseClient()!;
      const { error } = await supabase.from('admin_accounts').upsert({
        id: account.id,
        username: account.username,
        password_hash: account.password_hash,
        role: account.role,
        permissions: account.permissions,
        created_at: accountWithTimestamps.created_at,
        updated_at: now,
      });
      if (error) throw error;
    } catch (err) {
      console.error('[saveAdminAccount] Error:', err);
      throw err;
    }
  }
}

/** 删除管理员账号 */
export async function deleteAdminAccount(id: string): Promise<void> {
  const allLocal = loadAdminAccountsFromLocal();
  saveAdminAccountsToLocal(allLocal.filter((a) => a.id !== id));
  if (hasSupabase()) {
    try {
      const supabase = getSupabaseClient()!;
      const { error } = await supabase.from('admin_accounts').delete().eq('id', id);
      if (error) throw error;
    } catch (err) {
      console.error('[deleteAdminAccount] Error:', err);
      throw err;
    }
  }
}

/** 验证管理员登录（bcrypt 哈希比对，向后兼容明文） */
export async function verifyAdminLogin(username: string, password: string): Promise<AdminAccount | null> {
  if (hasSupabase()) {
    try {
      const supabase = getSupabaseClient()!;
      // 先尝试查询新版 password_hash 列
      const { data, error } = await supabase
        .from('admin_accounts')
        .select('id, username, password_hash, role, permissions, created_at, updated_at')
        .eq('username', username)
        .maybeSingle();
      if (!error && data) {
        const hash = data.password_hash as string;
        const valid = hash.startsWith('$2') ? verifyPassword(password, hash) : password === hash;
        if (valid) return data as AdminAccount;
      }
    } catch {
      // 列可能不存在，尝试旧版 password 列
      try {
        const supabase = getSupabaseClient()!;
        const { data, error } = await supabase
          .from('admin_accounts')
          .select('id, username, password, role, permissions, created_at, updated_at')
          .eq('username', username)
          .maybeSingle();
        if (!error && data && password === (data.password as string)) {
          return { ...data, password_hash: data.password as string } as AdminAccount;
        }
      } catch (err2) {
        console.error('[verifyAdminLogin] fallback error:', err2);
      }
    }
  }
  // 本地缓存兼容
  const accounts = loadAdminAccountsFromLocal();
  const account = accounts.find((a) => a.username === username);
  if (account) {
    const stored = account.password_hash || (account as any).password;
    const valid = stored?.startsWith('$2') ? verifyPassword(password, stored) : password === stored;
    if (valid) return account;
  }
  return null;
}

// ========== 当前登录账号（localStorage，不含密码） ==========

const CURRENT_ADMIN_KEY = 'eve_current_admin_account';

/** 保存当前登录账号（安全视图，剔除 password_hash） */
export function setCurrentAdminAccount(account: Omit<AdminAccount, 'password_hash'> | null): void {
  try {
    if (account) {
      localStorage.setItem(CURRENT_ADMIN_KEY, JSON.stringify(account));
    } else {
      localStorage.removeItem(CURRENT_ADMIN_KEY);
    }
  } catch { /* ignore */ }
}

/** 获取当前登录账号 */
export function getCurrentAdminAccount(): Omit<AdminAccount, 'password_hash'> | null {
  try {
    const raw = localStorage.getItem(CURRENT_ADMIN_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

/** 检查当前账号是否有指定权限 */
export function hasAdminPermission(permission: keyof AdminAccount['permissions']): boolean {
  const account = getCurrentAdminAccount();
  if (!account) return false;
  if (account.role === 'super_admin') return true;
  return account.permissions?.[permission] ?? false;
}

/** 检查当前账号是否是超级管理员 */
export function isCurrentAdminSuper(): boolean {
  const account = getCurrentAdminAccount();
  return account?.role === 'super_admin';
}

// ==================== 市场数据管理（Supabase + localStorage） ====================

export interface MarketDataItem {
  id: string;
  type: 'minerals' | 'ship_materials' | 'build_materials';
  name: string;
  sell_price: number;
  sell_quantity: number;
  sell_location: string;
  buy_price: number;
  buy_quantity: number;
  buy_location: string;
  updated_at?: string;
}

const MARKET_DATA_KEY = 'eve_market_data';

function loadMarketDataFromLocal(): MarketDataItem[] {
  try {
    const raw = localStorage.getItem(MARKET_DATA_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function saveMarketDataToLocal(items: MarketDataItem[]): void {
  try { localStorage.setItem(MARKET_DATA_KEY, JSON.stringify(items)); } catch { /* ignore */ }
}

/** 市场数据默认名称 */
export const MARKET_DEFAULT_NAMES: Record<string, string[]> = {
  minerals: ['三钛合金', '类晶体胶矿', '类银超金属', '同位聚合体', '超新星诺克石', '晶状石英核岩', '超噬矿', '莫尔石'],
  ship_materials: ['光泽合金', '光彩合金', '闪光合金', '浓缩合金', '精密合金', '杂色复合物', '纤维复合物', '透光复合物', '多样复合物', '光滑复合物', '晶体复合物', '黑暗复合物', '基础金属', '重金属', '贵金属', '反应金属', '有毒金属'],
  build_materials: ['活性气体', '稀有气体', '工业纤维', '超张力塑料', '聚芳酰胺', '冷却剂', '凝缩液', '建筑模块', '纳米体', '硅结构铸材', '灵巧单元建筑模块'],
};

/** 创建默认市场数据 */
export function createDefaultMarketData(type: string): MarketDataItem[] {
  const names = MARKET_DEFAULT_NAMES[type] || [];
  return names.map((name, i) => ({
    id: `${type}_${i}`,
    type: type as MarketDataItem['type'],
    name,
    sell_price: 0,
    sell_quantity: 0,
    sell_location: '',
    buy_price: 0,
    buy_quantity: 0,
    buy_location: '',
    updated_at: new Date().toISOString(),
  }));
}

/** 加载市场数据 */
export async function loadMarketData(type: string): Promise<MarketDataItem[]> {
  const localItems = loadMarketDataFromLocal().filter((item) => item.type === type);

  if (hasSupabase()) {
    try {
      const supabase = getSupabaseClient()!;
      const { data, error } = await supabase
        .from('market_data')
        .select('*')
        .eq('type', type)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      if (data && data.length > 0) {
        const allLocal = loadMarketDataFromLocal();
        const otherTypes = allLocal.filter((item) => item.type !== type);
        saveMarketDataToLocal([...otherTypes, ...(data as MarketDataItem[])]);
        return data as MarketDataItem[];
      }
    } catch (err) {
      console.error('[loadMarketData] Error:', err);
    }
  }

  if (localItems.length === 0) {
    const defaults = createDefaultMarketData(type);
    const allLocal = loadMarketDataFromLocal();
    const otherTypes = allLocal.filter((item) => item.type !== type);
    saveMarketDataToLocal([...otherTypes, ...defaults]);
    return defaults;
  }

  return localItems;
}

/** 保存市场数据 */
export async function saveMarketData(items: MarketDataItem[]): Promise<void> {
  const allLocal = loadMarketDataFromLocal();
  const otherTypes = allLocal.filter((item) => item.type !== (items[0]?.type || ''));
  saveMarketDataToLocal([...otherTypes, ...items]);
  if (hasSupabase() && items.length > 0) {
    try {
      const supabase = getSupabaseClient()!;
      const rows = items.map((item) => ({ ...item, updated_at: new Date().toISOString() }));
      const { error } = await supabase.from('market_data').upsert(rows, { onConflict: 'id' });
      if (error) throw error;
    } catch (err) {
      console.error('[saveMarketData] Error:', err);
      throw err;
    }
  }
}

// ==================== 网站数据分析 ====================

export interface AnalyticsDailyRow {
  date: string;
  page_views: number;
  unique_visitors: number;
}

export interface OnlineVisitor {
  visitor_id: string;
  page: string;
  user_agent: string;
  last_heartbeat: string;
}

export interface PageViewRow {
  id?: number;
  visitor_id: string;
  page: string;
  created_at: string;
}

/** 发送心跳（upsert 在线访客记录） */
export async function sendHeartbeat(visitorId: string, page: string, userAgent: string): Promise<void> {
  if (!hasSupabase()) return;
  try {
    const supabase = getSupabaseClient()!;
    const { error } = await supabase.from('site_visitors_online').upsert(
      { visitor_id: visitorId, page, user_agent: userAgent, last_heartbeat: new Date().toISOString() },
      { onConflict: 'visitor_id' },
    );
    if (error) throw error;
  } catch (err) {
    console.error('[sendHeartbeat] Error:', err);
  }
}

/** 离开时移除在线记录 */
export async function removeOnlineVisitor(visitorId: string): Promise<void> {
  if (!hasSupabase()) return;
  try {
    const supabase = getSupabaseClient()!;
    const { error } = await supabase.from('site_visitors_online').delete().eq('visitor_id', visitorId);
    if (error) throw error;
  } catch (err) {
    console.error('[removeOnlineVisitor] Error:', err);
  }
}

/** 记录一次页面访问 */
export async function recordPageView(visitorId: string, page: string): Promise<void> {
  if (!hasSupabase()) return;
  try {
    const supabase = getSupabaseClient()!;
    const { error: insertErr } = await supabase.from('site_page_views').insert({ visitor_id: visitorId, page });
    if (insertErr) throw insertErr;
  } catch (err) {
    console.error('[recordPageView] Error:', err);
  }
}

/** 清理过期在线记录（5 分钟未心跳的视为离线） */
async function cleanupExpiredVisitors(): Promise<void> {
  if (!hasSupabase()) return;
  try {
    const supabase = getSupabaseClient()!;
    const { error } = await supabase
      .from('site_visitors_online')
      .delete()
      .lt('last_heartbeat', new Date(Date.now() - 300_000).toISOString());
    if (error) throw error;
  } catch (err) {
    console.error('[cleanupExpiredVisitors] Error:', err);
  }
}

/** 获取当前在线人数（90 秒内有心跳） */
export async function getOnlineCount(): Promise<number> {
  if (!hasSupabase()) return 0;
  try {
    const supabase = getSupabaseClient()!;
    await cleanupExpiredVisitors();
    const { count, error } = await supabase
      .from('site_visitors_online')
      .select('visitor_id', { count: 'exact', head: true })
      .gte('last_heartbeat', new Date(Date.now() - 90_000).toISOString());
    if (error) throw error;
    return count ?? 0;
  } catch (err) {
    console.error('[getOnlineCount] Error:', err);
    return 0;
  }
}

/** 获取在线访客列表 */
export async function getOnlineVisitors(): Promise<OnlineVisitor[]> {
  if (!hasSupabase()) return [];
  try {
    const supabase = getSupabaseClient()!;
    const { data, error } = await supabase
      .from('site_visitors_online')
      .select('*')
      .gte('last_heartbeat', new Date(Date.now() - 90_000).toISOString())
      .order('last_heartbeat', { ascending: false });
    if (error) throw error;
    return (data || []) as OnlineVisitor[];
  } catch (err) {
    console.error('[getOnlineVisitors] Error:', err);
    return [];
  }
}

/** 获取最近 N 天的每日统计 */
export async function getDailyAnalytics(days: number = 30): Promise<AnalyticsDailyRow[]> {
  if (!hasSupabase()) return [];
  try {
    const supabase = getSupabaseClient()!;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days + 1);
    // 使用本地日期而非 UTC 日期，与 getTodayStats 的 getLocalDateString 保持一致
    const startDateStr = getLocalDateStringFrom(startDate);
    const { data, error } = await supabase
      .from('site_analytics_daily')
      .select('date, page_views, unique_visitors')
      .gte('date', startDateStr)
      .order('date', { ascending: true });
    if (error) throw error;
    return (data || []).map((row: Record<string, unknown>) => ({
      date: row.date as string,
      page_views: Number(row.page_views) || 0,
      unique_visitors: Number(row.unique_visitors) || 0,
    }));
  } catch (err) {
    console.error('[getDailyAnalytics] Error:', err);
    return [];
  }
}

/** 获取今日访问量统计 */
export async function getTodayStats(): Promise<{ pageViews: number; uniqueVisitors: number }> {
  if (!hasSupabase()) return { pageViews: 0, uniqueVisitors: 0 };
  try {
    const supabase = getSupabaseClient()!;
    const { data, error } = await supabase
      .from('site_analytics_daily')
      .select('page_views, unique_visitors')
      .eq('date', getLocalDateString())
      .maybeSingle();
    if (error) throw error;
    return {
      pageViews: Number(data?.page_views) || 0,
      uniqueVisitors: Number(data?.unique_visitors) || 0,
    };
  } catch (err) {
    console.error('[getTodayStats] Error:', err);
    return { pageViews: 0, uniqueVisitors: 0 };
  }
}

/** 获取今天本地零点对应的 UTC ISO 字符串，用于 timestamptz 比较 */
function getLocalStartOfDayISO(): string {
  const d = new Date();
  // setHours 设置本地时区零点，toISOString 转为 UTC
  // 例如 UTC+8 本地 2026-07-17 00:00:00 → UTC 2026-07-16T16:00:00.000Z
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/** 获取今日各页面 PV 分布 */
export async function getTodayPageDistribution(): Promise<{ page: string; count: number }[]> {
  if (!hasSupabase()) return [];
  try {
    const supabase = getSupabaseClient()!;
    const today = getLocalStartOfDayISO();
    const { data, error } = await supabase
      .from('site_page_views')
      .select('page')
      .gte('created_at', today);
    if (error) throw error;
    if (!data || data.length === 0) return [];

    const pageMap = new Map<string, number>();
    for (const row of data) {
      const page = (row as Record<string, unknown>).page as string;
      pageMap.set(page, (pageMap.get(page) || 0) + 1);
    }
    return Array.from(pageMap.entries())
      .map(([page, count]) => ({ page, count }))
      .sort((a, b) => b.count - a.count);
  } catch (err) {
    console.error('[getTodayPageDistribution] Error:', err);
    return [];
  }
}

/** 获取今日每小时 PV 分布（24 小时柱状图） */
export async function getTodayHourlyDistribution(): Promise<{ hour: number; pv: number }[]> {
  if (!hasSupabase()) return [];
  try {
    const supabase = getSupabaseClient()!;
    const today = getLocalStartOfDayISO();
    const { data, error } = await supabase
      .from('site_page_views')
      .select('created_at')
      .gte('created_at', today);
    if (error) throw error;
    if (!data || data.length === 0) return [];

    const hours = new Array(24).fill(0) as number[];
    for (const row of data) {
      const h = new Date((row as Record<string, unknown>).created_at as string).getHours();
      hours[h]++;
    }
    return hours.map((pv, hour) => ({ hour, pv }));
  } catch (err) {
    console.error('[getTodayHourlyDistribution] Error:', err);
    return [];
  }
}

/** 获取总访问量统计 */
export async function getTotalStats(): Promise<{ totalPv: number; totalDays: number; avgDailyPv: number }> {
  if (!hasSupabase()) return { totalPv: 0, totalDays: 0, avgDailyPv: 0 };
  try {
    const supabase = getSupabaseClient()!;
    const { data, error } = await supabase
      .from('site_analytics_daily')
      .select('page_views');
    if (error) throw error;
    if (!data || data.length === 0) return { totalPv: 0, totalDays: 0, avgDailyPv: 0 };
    const totalPv = data.reduce((sum: number, row: Record<string, unknown>) => sum + (Number(row.page_views) || 0), 0);
    return { totalPv, totalDays: data.length, avgDailyPv: Math.round(totalPv / data.length) };
  } catch (err) {
    console.error('[getTotalStats] Error:', err);
    return { totalPv: 0, totalDays: 0, avgDailyPv: 0 };
  }
}