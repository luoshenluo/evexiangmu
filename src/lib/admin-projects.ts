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
import { getSupabaseClient } from '@/storage/database/browser-client';

// ========== 项目数据 CRUD（Supabase 云端） ==========

/** 将数据库行转换为 IManufactureProject */
function rowToProject(row: Record<string, unknown>): IManufactureProject {
  return {
    id: row.id as string,
    name: row.name as string,
    category: row.category as string,
    isPreset: row.is_preset as boolean,
    materialCost150: Number(row.material_cost_150),
    blueprintPrice: Number(row.blueprint_price),
    fixedManufactureFee: Number(row.fixed_manufacture_fee),
    buyOrderPrice: Number(row.buy_order_price),
    marketSellPrice: Number(row.market_sell_price),
    materials: (row.materials ?? { minerals: [], shipMaterials: [], buildMaterials: [] }) as IManufactureProject['materials'],
  } as IManufactureProject;
}

/** 将 IManufactureProject 转换为数据库行 */
function projectToRow(project: IManufactureProject): Record<string, unknown> {
  return {
    id: project.id,
    name: project.name,
    category: project.category,
    is_preset: project.isPreset ?? false,
    material_cost_150: project.materialCost150,
    blueprint_price: project.blueprintPrice,
    fixed_manufacture_fee: project.fixedManufactureFee,
    buy_order_price: project.buyOrderPrice,
    market_sell_price: project.marketSellPrice,
    materials: project.materials,
  };
}

/** 从 Supabase 加载项目列表 */
export async function loadAdminProjects(): Promise<IManufactureProject[]> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('manufacture_projects')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[loadAdminProjects] Supabase error:', error);
      return getFallbackProjects();
    }

    if (!data || data.length === 0) {
      return getFallbackProjects();
    }

    return data.map(rowToProject);
  } catch (err) {
    console.error('[loadAdminProjects] Error:', err);
    return getFallbackProjects();
  }
}

function getFallbackProjects(): IManufactureProject[] {
  return MANUFACTURE_PROJECTS.map((p) => ({ ...p, isPreset: undefined }));
}

/** 保存全部项目到 Supabase（全量覆盖） */
export async function saveAdminProjects(projects: IManufactureProject[]): Promise<void> {
  const supabase = getSupabaseClient();

  // 获取数据库中现有的所有 id
  const { data: existing } = await supabase
    .from('manufacture_projects')
    .select('id');
  const existingIds = new Set((existing ?? []).map((r: Record<string, unknown>) => r.id as string));
  const newIds = new Set(projects.map((p) => p.id));

  // 删除不在新列表中的项目
  const toDelete = [...existingIds].filter((id) => !newIds.has(id));
  if (toDelete.length > 0) {
    await supabase.from('manufacture_projects').delete().in('id', toDelete);
  }

  // Upsert 所有项目
  if (projects.length > 0) {
    const rows = projects.map(projectToRow);
    await supabase.from('manufacture_projects').upsert(rows, { onConflict: 'id' });
  }
}

/** 根据 id 查找项目 */
export async function findAdminProject(id: string): Promise<IManufactureProject | null> {
  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('manufacture_projects')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return rowToProject(data);
  } catch {
    return null;
  }
}

/** 新增项目 */
export async function addAdminProject(project: Omit<IManufactureProject, 'id'> & { id?: string }): Promise<IManufactureProject> {
  const supabase = getSupabaseClient();
  const newProject: IManufactureProject = {
    ...project,
    id: project.id || `proj_${Date.now()}`,
  } as IManufactureProject;

  const row = projectToRow(newProject);
  await supabase.from('manufacture_projects').insert(row);
  return newProject;
}

/** 更新项目 */
export async function updateAdminProject(id: string, updates: Partial<IManufactureProject>): Promise<void> {
  const supabase = getSupabaseClient();
  const existing = await findAdminProject(id);
  if (!existing) return;

  const merged = { ...existing, ...updates };
  const row = projectToRow(merged);
  await supabase.from('manufacture_projects').update(row).eq('id', id);
}

/** 删除项目 */
export async function deleteAdminProject(id: string): Promise<void> {
  const supabase = getSupabaseClient();
  await supabase.from('manufacture_projects').delete().eq('id', id);
}

// ========== 管理员密码（Supabase 云端 app_settings 表） ==========

const LOGIN_KEY = 'eve_admin_logged_in';

/** 从 Supabase 获取管理员密码 */
export async function getAdminPassword(): Promise<string> {
  try {
    const supabase = getSupabaseClient();
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'admin_password')
      .single();
    return (data?.value as string) ?? 'admin123';
  } catch {
    return 'admin123';
  }
}

/** 修改管理员密码 */
export async function setAdminPassword(newPassword: string): Promise<void> {
  const supabase = getSupabaseClient();
  await supabase
    .from('app_settings')
    .update({ value: newPassword, updated_at: new Date().toISOString() })
    .eq('key', 'admin_password');
}

/** 校验管理员密码 */
export async function verifyAdminPassword(password: string): Promise<boolean> {
  const stored = await getAdminPassword();
  return password === stored;
}

// ========== 登录态（本地 localStorage，仅当前设备） ==========

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

// ========== 材料价格管理（云端 Supabase） ==========

export type MaterialType = 'minerals' | 'ship_materials' | 'build_materials';

export interface MaterialPriceItem {
  id: string;
  type: MaterialType;
  name: string;
  price: number;
  quantity: number;
  sortOrder: number;
}

/** 加载指定类型的材料价格列表 */
export async function loadMaterialPrices(type: MaterialType): Promise<MaterialPriceItem[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('material_prices')
    .select('*')
    .eq('type', type)
    .order('sort_order', { ascending: true });
  if (error) {
    console.error('loadMaterialPrices error:', error);
    return [];
  }
  return (data || []).map((row: any) => ({
    id: row.id,
    type: row.type as MaterialType,
    name: row.name,
    price: Number(row.price) || 0,
    quantity: Number(row.quantity) || 0,
    sortOrder: row.sort_order || 0,
  }));
}

/** 批量保存材料价格（全量覆盖） */
export async function saveMaterialPrices(items: MaterialPriceItem[]): Promise<void> {
  if (items.length === 0) return;
  const supabase = getSupabaseClient();
  const rows = items.map((item, index) => ({
    id: item.id,
    type: item.type,
    name: item.name,
    price: item.price,
    quantity: item.quantity,
    sort_order: item.sortOrder || index,
    updated_at: new Date().toISOString(),
  }));
  const { error } = await supabase
    .from('material_prices')
    .upsert(rows, { onConflict: 'id' });
  if (error) throw error;
}

/** 更新单个材料价格 */
export async function updateMaterialPrice(item: MaterialPriceItem): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('material_prices')
    .update({
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      updated_at: new Date().toISOString(),
    })
    .eq('id', item.id);
  if (error) throw error;
}

/** 添加新材料 */
export async function addMaterialPrice(item: MaterialPriceItem): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('material_prices')
    .insert({
      id: item.id,
      type: item.type,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      sort_order: item.sortOrder,
      updated_at: new Date().toISOString(),
    });
  if (error) throw error;
}

/** 删除材料 */
export async function deleteMaterialPrice(id: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('material_prices')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ==================== 管理员账号管理 ====================

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

/** 加载所有管理员账号 */
export async function loadAdminAccounts(): Promise<AdminAccount[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('admin_accounts')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

/** 保存管理员账号（新增或更新） */
export async function saveAdminAccount(account: AdminAccount): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('admin_accounts')
    .upsert({
      id: account.id,
      username: account.username,
      password: account.password,
      role: account.role,
      permissions: account.permissions,
      updated_at: new Date().toISOString(),
    });
  if (error) throw error;
}

/** 删除管理员账号 */
export async function deleteAdminAccount(id: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from('admin_accounts')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

/** 验证管理员登录 */
export async function verifyAdminLogin(username: string, password: string): Promise<AdminAccount | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('admin_accounts')
    .select('*')
    .eq('username', username)
    .eq('password', password)
    .single();
  if (error) return null;
  return data;
}

// ==================== 市场数据管理 ====================

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

/** 加载市场数据 */
export async function loadMarketData(type: string): Promise<MarketDataItem[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('market_data')
    .select('*')
    .eq('type', type)
    .order('id', { ascending: true });
  if (error) throw error;
  return data || [];
}

/** 保存市场数据 */
export async function saveMarketData(items: MarketDataItem[]): Promise<void> {
  const supabase = getSupabaseClient();
  const rows = items.map(item => ({
    id: item.id,
    type: item.type,
    name: item.name,
    sell_price: item.sell_price,
    sell_quantity: item.sell_quantity,
    sell_location: item.sell_location,
    buy_price: item.buy_price,
    buy_quantity: item.buy_quantity,
    buy_location: item.buy_location,
    updated_at: new Date().toISOString(),
  }));
  const { error } = await supabase
    .from('market_data')
    .upsert(rows);
  if (error) throw error;
}
