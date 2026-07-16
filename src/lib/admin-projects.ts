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

/** Base64 编码 */
function encodePwd(pwd: string): string {
  try { return btoa(pwd); } catch { return pwd; }
}
/** Base64 解码 */
function decodePwd(encoded: string): string {
  try { return atob(encoded); } catch { return encoded; }
}

/** 检查 Supabase 是否可用 */
function hasSupabase(): boolean {
  return isSupabaseConfigured();
}

// ========== 管理员密码（Supabase 主存储 + localStorage 降级 + Base64 编码） ==========

const LOGIN_KEY = 'eve_admin_logged_in';
const ADMIN_PASSWORD_KEY = 'eve_admin_password';

function loadAdminPasswordFromLocal(): string {
  try {
    const stored = localStorage.getItem(ADMIN_PASSWORD_KEY);
    if (!stored) return 'admin123';
    return decodePwd(stored);
  } catch { return 'admin123'; }
}

function saveAdminPasswordToLocal(password: string): void {
  try { localStorage.setItem(ADMIN_PASSWORD_KEY, encodePwd(password)); } catch { /* ignore */ }
}

/** 获取管理员密码 */
export async function getAdminPassword(): Promise<string> {
  if (hasSupabase()) {
    try {
      const supabase = getSupabaseClient()!;
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'admin_password')
        .single();
      if (data?.value) {
        saveAdminPasswordToLocal(data.value as string);
        return data.value as string;
      }
    } catch { /* fallback to localStorage */ }
  }
  return loadAdminPasswordFromLocal();
}

/** 修改管理员密码 */
export async function setAdminPassword(newPassword: string): Promise<void> {
  saveAdminPasswordToLocal(newPassword);
  if (hasSupabase()) {
    try {
      const supabase = getSupabaseClient()!;
      await supabase
        .from('app_settings')
        .upsert(
          { key: 'admin_password', value: newPassword, updated_at: new Date().toISOString() },
          { onConflict: 'key' },
        );
    } catch { /* Supabase 同步失败，localStorage 已保存 */ }
  }
}

/** 校验管理员密码 */
export async function verifyAdminPassword(password: string): Promise<boolean> {
  const stored = await getAdminPassword();
  return password === stored;
}

// ========== 登录态（本地 localStorage） ==========

export function setAdminLoggedIn(value: boolean): void {
  lsSetItem(LOGIN_KEY, value ? '1' : '0');
}
export function isAdminLoggedIn(): boolean {
  return lsGetItem(LOGIN_KEY) === '1';
}
export function clearAdminLogin(): void {
  lsRemoveItem(LOGIN_KEY);
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
  // 先从 localStorage 加载
  let localProjects = loadProjectsFromLocal();
  if (localProjects.length === 0) {
    localProjects = getFallbackProjects();
    saveProjectsToLocal(localProjects);
  }

  if (hasSupabase()) {
    try {
      const supabase = getSupabaseClient()!;
      const { data } = await supabase
        .from('manufacture_projects')
        .select('*')
        .order('created_at', { ascending: true });
      if (data && data.length > 0) {
        // 合并 Supabase 数据与 localStorage 数据
        // 确保 localStorage 中新增但未同步到 Supabase 的项目不丢失
        const supabaseIds = new Set(data.map((item: any) => item.id));
        const merged = [...data.map((item: any) => {
          const localItem = localProjects.find((p) => p.id === item.id);
          // 使用 localStorage 中的最新数据（可能包含未保存的修改）
          return localItem || item;
        }) as IManufactureProject[]];
        // 补充 localStorage 中有但 Supabase 中没有的项目
        for (const localItem of localProjects) {
          if (!supabaseIds.has(localItem.id)) {
            merged.push(localItem);
          }
        }
        saveProjectsToLocal(merged);
        return merged;
      }
    } catch { /* fallback to localStorage */ }
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
      await supabase.from('manufacture_projects').upsert(rows, { onConflict: 'id' });
    } catch { /* ignore */ }
  }
}

/** 根据 id 查找项目 */
export async function findAdminProject(id: string): Promise<IManufactureProject | null> {
  if (hasSupabase()) {
    try {
      const supabase = getSupabaseClient()!;
      const { data } = await supabase.from('manufacture_projects').select('*').eq('id', id).single();
      if (data) return data as IManufactureProject;
    } catch { /* fallback */ }
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
      await supabase.from('manufacture_projects').upsert(
        { ...newProject, sort_order: projects.length - 1, created_at: now, updated_at: now },
        { onConflict: 'id' },
      );
    } catch (e) {
      console.warn('addAdminProject: Supabase sync failed, using localStorage only', e);
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
      await supabase.from('manufacture_projects').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id);
    } catch { /* ignore */ }
  }
}

/** 删除项目 */
export async function deleteAdminProject(id: string): Promise<void> {
  const projects = loadProjectsFromLocal();
  saveProjectsToLocal(projects.filter((p) => p.id !== id));
  if (hasSupabase()) {
    try {
      const supabase = getSupabaseClient()!;
      await supabase.from('manufacture_projects').delete().eq('id', id);
    } catch { /* ignore */ }
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
      const { data } = await supabase
        .from('material_prices')
        .select('*')
        .eq('type', type)
        .order('sort_order', { ascending: true });
      if (data && data.length > 0) {
        const items = data.map((row: any) => ({
          id: row.id,
          type: row.type as MaterialType,
          name: row.name,
          price: Number(row.price) || 0,
          quantity: Number(row.quantity) || 0,
          sortOrder: row.sort_order || 0,
        }));
        // 同步到 localStorage
        const allLocal = loadAllMaterialPricesFromLocal();
        const otherTypes = allLocal.filter((item) => item.type !== type);
        saveAllMaterialPricesToLocal([...otherTypes, ...items]);
        return items;
      }
    } catch { /* fallback to localStorage */ }
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
      await supabase.from('material_prices').upsert(rows, { onConflict: 'id' });
    } catch { /* ignore */ }
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
      await supabase.from('material_prices').insert({
        id: item.id,
        type: item.type,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        sort_order: item.sortOrder,
        updated_at: new Date().toISOString(),
      });
    } catch { /* ignore */ }
  }
}

/** 删除材料 */
export async function deleteMaterialPrice(id: string): Promise<void> {
  const allLocal = loadAllMaterialPricesFromLocal();
  saveAllMaterialPricesToLocal(allLocal.filter((item) => item.id !== id));
  if (hasSupabase()) {
    try {
      const supabase = getSupabaseClient()!;
      await supabase.from('material_prices').delete().eq('id', id);
    } catch { /* ignore */ }
  }
}

// ==================== 管理员账号管理（Supabase + localStorage） ====================

export interface AdminAccount {
  id: string;
  username: string;
  password: string;
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

/** 加载所有管理员账号 */
export async function loadAdminAccounts(): Promise<AdminAccount[]> {
  if (hasSupabase()) {
    try {
      const supabase = getSupabaseClient()!;
      const { data } = await supabase
        .from('admin_accounts')
        .select('*')
        .order('created_at', { ascending: true });
      if (data && data.length > 0) {
        saveAdminAccountsToLocal(data as AdminAccount[]);
        return data as AdminAccount[];
      }
    } catch { /* fallback to localStorage */ }
  }
  return loadAdminAccountsFromLocal();
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
      await supabase.from('admin_accounts').upsert({
        id: account.id,
        username: account.username,
        password: account.password,
        role: account.role,
        permissions: account.permissions,
        created_at: accountWithTimestamps.created_at,
        updated_at: now,
      });
    } catch { /* ignore */ }
  }
}

/** 删除管理员账号 */
export async function deleteAdminAccount(id: string): Promise<void> {
  const allLocal = loadAdminAccountsFromLocal();
  saveAdminAccountsToLocal(allLocal.filter((a) => a.id !== id));
  if (hasSupabase()) {
    try {
      const supabase = getSupabaseClient()!;
      await supabase.from('admin_accounts').delete().eq('id', id);
    } catch { /* ignore */ }
  }
}

/** 验证管理员登录 */
export async function verifyAdminLogin(username: string, password: string): Promise<AdminAccount | null> {
  if (hasSupabase()) {
    try {
      const supabase = getSupabaseClient()!;
      const { data } = await supabase
        .from('admin_accounts')
        .select('*')
        .eq('username', username)
        .eq('password', password)
        .maybeSingle();
      if (data) return data as AdminAccount;
    } catch { /* fallback to localStorage */ }
  }
  const accounts = loadAdminAccountsFromLocal();
  return accounts.find((a) => a.username === username && a.password === password) || null;
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
  // 先从 localStorage 加载
  const localItems = loadMarketDataFromLocal().filter((item) => item.type === type);

  if (hasSupabase()) {
    try {
      const supabase = getSupabaseClient()!;
      const { data } = await supabase
        .from('market_data')
        .select('*')
        .eq('type', type)
        .order('updated_at', { ascending: false });
      if (data && data.length > 0) {
        const allLocal = loadMarketDataFromLocal();
        const otherTypes = allLocal.filter((item) => item.type !== type);
        saveMarketDataToLocal([...otherTypes, ...(data as MarketDataItem[])]);
        return data as MarketDataItem[];
      }
    } catch { /* fallback to localStorage */ }
  }

  // 如果 localStorage 和 Supabase 都为空，初始化默认数据
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
      await supabase.from('market_data').upsert(rows, { onConflict: 'id' });
    } catch { /* ignore */ }
  }
}