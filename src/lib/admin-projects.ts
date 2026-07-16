function lsGetItem(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function lsSetItem(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* ignore */ }
}
function lsRemoveItem(key: string): void {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

import { MANUFACTURE_PROJECTS, type IManufactureProject } from '@/data/materials';

// ====================================================================
// 数据存储策略：localStorage 为主存储，Supabase 仅做可选同步
// 所有读写操作优先操作 localStorage，Supabase 同步失败不影响正常使用
// ====================================================================

// ========== 管理员密码（localStorage 主存储） ==========

const LOGIN_KEY = 'eve_admin_logged_in';
const ADMIN_PASSWORD_KEY = 'eve_admin_password';

/** 从 localStorage 获取管理员密码 */
function loadAdminPassword(): string {
  try {
    return localStorage.getItem(ADMIN_PASSWORD_KEY) || 'admin123';
  } catch { return 'admin123'; }
}

/** 保存管理员密码到 localStorage */
function saveAdminPassword(password: string): void {
  try { localStorage.setItem(ADMIN_PASSWORD_KEY, password); } catch { /* ignore */ }
}

/** 获取管理员密码 */
export async function getAdminPassword(): Promise<string> {
  return loadAdminPassword();
}

/** 修改管理员密码 */
export async function setAdminPassword(newPassword: string): Promise<void> {
  saveAdminPassword(newPassword);
  // 可选：异步同步到 Supabase（不阻塞，失败不影响）
  trySyncSupabasePassword(newPassword);
}

async function trySyncSupabasePassword(password: string): Promise<void> {
  try {
    const { getSupabaseClient } = await import('@/storage/database/browser-client');
    const supabase = getSupabaseClient();
    await supabase
      .from('app_settings')
      .update({ value: password, updated_at: new Date().toISOString() })
      .eq('key', 'admin_password');
  } catch { /* Supabase 不可用时静默跳过 */ }
}

/** 校验管理员密码 */
export async function verifyAdminPassword(password: string): Promise<boolean> {
  return password === loadAdminPassword();
}

// ========== 登录态（本地 localStorage） ==========

/** 保存登录态 */
export function setAdminLoggedIn(value: boolean): void {
  lsSetItem(LOGIN_KEY, value ? '1' : '0');
}

/** 检查登录态 */
export function isAdminLoggedIn(): boolean {
  return lsGetItem(LOGIN_KEY) === '1';
}

/** 清除登录态 */
export function clearAdminLogin(): void {
  lsRemoveItem(LOGIN_KEY);
}

// ========== 项目数据 CRUD（localStorage 主存储） ==========

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

/** 从 localStorage 加载项目列表 */
export async function loadAdminProjects(): Promise<IManufactureProject[]> {
  let projects = loadProjectsFromLocal();
  if (projects.length === 0) {
    projects = getFallbackProjects();
    saveProjectsToLocal(projects);
  }
  return projects;
}

/** 保存全部项目到 localStorage */
export async function saveAdminProjects(projects: IManufactureProject[]): Promise<void> {
  saveProjectsToLocal(projects);
}

/** 根据 id 查找项目 */
export async function findAdminProject(id: string): Promise<IManufactureProject | null> {
  const projects = loadProjectsFromLocal();
  return projects.find((p) => p.id === id) || null;
}

/** 新增项目 */
export async function addAdminProject(project: Omit<IManufactureProject, 'id'> & { id?: string }): Promise<IManufactureProject> {
  const projects = loadProjectsFromLocal();
  const newProject: IManufactureProject = {
    ...project,
    id: project.id || `proj_${Date.now()}`,
  } as IManufactureProject;
  projects.push(newProject);
  saveProjectsToLocal(projects);
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
}

/** 删除项目 */
export async function deleteAdminProject(id: string): Promise<void> {
  const projects = loadProjectsFromLocal();
  saveProjectsToLocal(projects.filter((p) => p.id !== id));
}

// ========== 材料价格管理（localStorage 主存储） ==========

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

function loadAllMaterialPrices(): MaterialPriceItem[] {
  try {
    const raw = localStorage.getItem(MATERIAL_PRICES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveAllMaterialPrices(items: MaterialPriceItem[]): void {
  try { localStorage.setItem(MATERIAL_PRICES_KEY, JSON.stringify(items)); } catch { /* ignore */ }
}

/** 加载指定类型的材料价格列表（直接从 localStorage 读取） */
export async function loadMaterialPrices(type: MaterialType): Promise<MaterialPriceItem[]> {
  return loadAllMaterialPrices().filter((item) => item.type === type);
}

/** 批量保存材料价格（全量覆盖，写入 localStorage） */
export async function saveMaterialPrices(items: MaterialPriceItem[]): Promise<void> {
  const allLocal = loadAllMaterialPrices();
  const otherTypes = allLocal.filter((item) => item.type !== (items[0]?.type || ''));
  saveAllMaterialPrices([...otherTypes, ...items]);
}

/** 更新单个材料价格 */
export async function updateMaterialPrice(item: MaterialPriceItem): Promise<void> {
  const allLocal = loadAllMaterialPrices();
  const idx = allLocal.findIndex((i) => i.id === item.id);
  if (idx >= 0) {
    allLocal[idx] = item;
    saveAllMaterialPrices(allLocal);
  }
}

/** 添加新材料 */
export async function addMaterialPrice(item: MaterialPriceItem): Promise<void> {
  const allLocal = loadAllMaterialPrices();
  allLocal.push(item);
  saveAllMaterialPrices(allLocal);
}

/** 删除材料 */
export async function deleteMaterialPrice(id: string): Promise<void> {
  const allLocal = loadAllMaterialPrices();
  saveAllMaterialPrices(allLocal.filter((item) => item.id !== id));
}

// ==================== 管理员账号管理（localStorage 主存储） ====================

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

/** 加载所有管理员账号（直接从 localStorage 读取） */
export async function loadAdminAccounts(): Promise<AdminAccount[]> {
  return loadAdminAccountsFromLocal();
}

/** 保存管理员账号（新增或更新，写入 localStorage） */
export async function saveAdminAccount(account: AdminAccount): Promise<void> {
  const allLocal = loadAdminAccountsFromLocal();
  const idx = allLocal.findIndex((a) => a.id === account.id);
  if (idx >= 0) {
    allLocal[idx] = { ...account, updated_at: new Date().toISOString() };
  } else {
    allLocal.push({ ...account, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
  }
  saveAdminAccountsToLocal(allLocal);
}

/** 删除管理员账号 */
export async function deleteAdminAccount(id: string): Promise<void> {
  const allLocal = loadAdminAccountsFromLocal();
  saveAdminAccountsToLocal(allLocal.filter((a) => a.id !== id));
}

/** 验证管理员登录 */
export async function verifyAdminLogin(username: string, password: string): Promise<AdminAccount | null> {
  const accounts = loadAdminAccountsFromLocal();
  return accounts.find((a) => a.username === username && a.password === password) || null;
}

// ==================== 市场数据管理（localStorage 主存储） ====================

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

/** 加载市场数据（直接从 localStorage 读取） */
export async function loadMarketData(type: string): Promise<MarketDataItem[]> {
  return loadMarketDataFromLocal().filter((item) => item.type === type);
}

/** 保存市场数据（写入 localStorage） */
export async function saveMarketData(items: MarketDataItem[]): Promise<void> {
  const allLocal = loadMarketDataFromLocal();
  const otherTypes = allLocal.filter((item) => item.type !== (items[0]?.type || ''));
  saveMarketDataToLocal([...otherTypes, ...items]);
}