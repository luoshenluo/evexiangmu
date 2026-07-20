// ==================== 类型定义 ====================

import { IManufactureProject } from '@/data/materials';
import { getSupabaseClient, isSupabaseConfigured } from '@/storage/database/browser-client';

export type MaterialType = 'minerals' | 'ship_materials' | 'build_materials';

export interface MaterialPriceItem {
  id: string;
  name: string;
  type: MaterialType;
  price: number;
  quantity: number;
  updated_at: string;
}

export interface MarketDataItem {
  id: string;
  name: string;
  type: string;
  sell_price: number;
  sell_quantity: number;
  sell_location: string;
  buy_price: number;
  buy_quantity: number;
  buy_location: string;
  updated_at: string;
}

export interface AdminAccount {
  id: string;
  username: string;
  password_hash: string;
  role: string;
  permissions: {
    manage_projects?: boolean;
    manage_materials?: boolean;
    manage_market?: boolean;
    manage_accounts?: boolean;
    manage_admins?: boolean;
    view_analytics?: boolean;
  };
  created_at: string;
  updated_at: string;
}

export interface AdminSession {
  account: AdminAccount;
  login_time: string;
}

export interface OnlineVisitor {
  visitor_id: string;
  page: string;
  user_agent: string;
  last_heartbeat: string;
}

export interface Announcement {
  content: string;
  title: string;
  enabled: boolean;
  updated_at: string;
}

// ==================== 工具函数 ====================

function hasSupabase(): boolean {
  return isSupabaseConfigured();
}

function getLocalDateString(): string {
  return new Date().toLocaleDateString('sv-SE');
}

function getLocalDateStringFrom(d: Date): string {
  return d.toLocaleDateString('sv-SE');
}

function getLocalStartOfDayISO(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function hashPassword(password: string): string {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return 'hash_' + Math.abs(hash).toString(16);
}

// ==================== 本地存储 ====================

function loadAdminAccountsFromLocal(): AdminAccount[] {
  try {
    const raw = localStorage.getItem('eve_admin_accounts');
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveAdminAccountsToLocal(accounts: AdminAccount[]): void {
  try { localStorage.setItem('eve_admin_accounts', JSON.stringify(accounts)); } catch {}
}

// ==================== 材料价格管理 ====================

const PRESET_MINERALS = [
  '三钛合金', '类晶体胶矿', '类银超金属', '同位聚合体',
  '超新星诺克石', '晶状石英核岩', '超噬矿', '莫尔石',
];
const PRESET_SHIP_MATERIALS = [
  '光泽合金', '光彩合金', '闪光合金', '浓缩合金', '精密合金',
  '杂色复合物', '纤维复合物', '透光复合物', '多样复合物', '光滑复合物',
  '晶体复合物', '黑暗复合物',
  '基础金属', '重金属', '贵金属', '反应金属', '有毒金属',
];
const PRESET_BUILD_MATERIALS = [
  '建筑模块', '纳米修复膏', '聚变反应堆单元', '地能发生器单元',
  '引力子脉冲发生器单元', '引力子感应器单元', '核能脉冲推进器',
  '护盾感应器集群', '核能脉冲炸弹', '氦燃料块', '制导系统',
];

function getPresetNames(type: MaterialType): string[] {
  if (type === 'minerals') return PRESET_MINERALS;
  if (type === 'ship_materials') return PRESET_SHIP_MATERIALS;
  return PRESET_BUILD_MATERIALS;
}

export async function loadMaterialPrices(type: MaterialType): Promise<MaterialPriceItem[]> {
  if (hasSupabase()) {
    try {
      const supabase = getSupabaseClient()!;
      const { data, error } = await supabase
        .from('material_prices')
        .select('*')
        .eq('type', type)
        .order('id', { ascending: true });
      if (error) throw error;
      if (data && data.length > 0) return data as MaterialPriceItem[];
    } catch (err) {
      console.error('[loadMaterialPrices] Error:', err);
    }
  }
  const raw = localStorage.getItem('eve_materials_' + type);
  if (raw) {
    try { return JSON.parse(raw); } catch {}
  }
  return getPresetNames(type).map((name, i) => ({
    id: type + '_' + i,
    name,
    type,
    price: 0,
    quantity: 0,
    updated_at: new Date().toISOString(),
  }));
}

export async function saveMaterialPrices(items: MaterialPriceItem[]): Promise<void> {
  const type = items[0]?.type;
  if (!type) return;
  if (hasSupabase()) {
    try {
      const supabase = getSupabaseClient()!;
      const { error: delErr } = await supabase.from('material_prices').delete().eq('type', type);
      if (delErr) throw delErr;
      const { error: insErr } = await supabase.from('material_prices').insert(items);
      if (insErr) throw insErr;
    } catch (err) {
      console.error('[saveMaterialPrices] Error:', err);
    }
  }
  try { localStorage.setItem('eve_materials_' + type, JSON.stringify(items)); } catch {}
}

export async function addMaterialPrice(item: MaterialPriceItem): Promise<void> {
  if (hasSupabase()) {
    try {
      const supabase = getSupabaseClient()!;
      const { error } = await supabase.from('material_prices').insert(item);
      if (error) throw error;
    } catch (err) {
      console.error('[addMaterialPrice] Error:', err);
    }
  }
  const all = await loadMaterialPrices(item.type);
  all.push(item);
  try { localStorage.setItem('eve_materials_' + item.type, JSON.stringify(all)); } catch {}
}

export async function deleteMaterialPrice(id: string, type: MaterialType): Promise<void> {
  if (hasSupabase()) {
    try {
      const supabase = getSupabaseClient()!;
      const { error } = await supabase.from('material_prices').delete().eq('id', id);
      if (error) throw error;
    } catch (err) {
      console.error('[deleteMaterialPrice] Error:', err);
    }
  }
  const all = await loadMaterialPrices(type);
  const filtered = all.filter((item) => item.id !== id);
  try { localStorage.setItem('eve_materials_' + type, JSON.stringify(filtered)); } catch {}
}

// ==================== 市场数据管理 ====================

export async function loadMarketData(type: string): Promise<MarketDataItem[]> {
  if (hasSupabase()) {
    try {
      const supabase = getSupabaseClient()!;
      const { data, error } = await supabase
        .from('market_data')
        .select('*')
        .eq('type', type)
        .order('id', { ascending: true });
      if (error) throw error;
      if (data && data.length > 0) return data as MarketDataItem[];
    } catch (err) {
      console.error('[loadMarketData] Error:', err);
    }
  }
  const raw = localStorage.getItem('eve_market_' + type);
  if (raw) {
    try { return JSON.parse(raw); } catch {}
  }
  const names = getPresetNames(type as MaterialType);
  return names.map((name, i) => ({
    id: type + '_' + i,
    name,
    type,
    sell_price: 0,
    sell_quantity: 0,
    sell_location: '',
    buy_price: 0,
    buy_quantity: 0,
    buy_location: '',
    updated_at: new Date().toISOString(),
  }));
}

export async function saveMarketData(items: MarketDataItem[]): Promise<void> {
  const type = items[0]?.type;
  if (!type) return;
  if (hasSupabase()) {
    try {
      const supabase = getSupabaseClient()!;
      const { error: delErr } = await supabase.from('market_data').delete().eq('type', type);
      if (delErr) throw delErr;
      const { error: insErr } = await supabase.from('market_data').insert(items);
      if (insErr) throw insErr;
    } catch (err) {
      console.error('[saveMarketData] Error:', err);
    }
  }
  try { localStorage.setItem('eve_market_' + type, JSON.stringify(items)); } catch {}
}

// ==================== 管理员认证 ====================

function getAdminPasswordHash(): string {
  return hashPassword('123456');
}

export async function verifyAdminPassword(password: string): Promise<boolean> {
  if (hasSupabase()) {
    try {
      const supabase = getSupabaseClient()!;
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'admin_password_hash')
        .maybeSingle();
      if (error) throw error;
      if (data && data.value) {
        return data.value === hashPassword(password) || data.value === password;
      }
    } catch (err) {
      console.error('[verifyAdminPassword] Error:', err);
    }
  }
  return hashPassword(password) === getAdminPasswordHash();
}

export async function setAdminPassword(newPassword: string): Promise<void> {
  const newHash = hashPassword(newPassword);
  if (hasSupabase()) {
    try {
      const supabase = getSupabaseClient()!;
      const { error } = await supabase
        .from('app_settings')
        .upsert({ key: 'admin_password_hash', value: newHash });
      if (error) throw error;
    } catch (err) {
      console.error('[setAdminPassword] Error:', err);
    }
  }
}

export async function verifyAdminLogin(username: string, password: string): Promise<AdminAccount | null> {
  const hash = hashPassword(password);
  if (hasSupabase()) {
    try {
      const supabase = getSupabaseClient()!;
      const { data, error } = await supabase
        .from('admin_accounts')
        .select('*')
        .eq('username', username)
        .maybeSingle();
      if (error) throw error;
      if (data && data.password_hash === hash) {
        return data as AdminAccount;
      }
    } catch (err) {
      console.error('[verifyAdminLogin] Error:', err);
    }
  }
  const allLocal = loadAdminAccountsFromLocal();
  const found = allLocal.find((a) => a.username === username && a.password_hash === hash);
  if (found) return found;
  if (username === 'admin' && (await verifyAdminPassword(password))) {
    return {
      id: 'default_admin',
      username: 'admin',
      password_hash: hash,
      role: 'super_admin',
      permissions: {
        manage_projects: true,
        manage_materials: true,
        manage_market: true,
        manage_accounts: true,
        view_analytics: true,
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }
  return null;
}

export function setAdminLoggedIn(account: AdminAccount): void {
  const session: AdminSession = { account, login_time: new Date().toISOString() };
  try { localStorage.setItem('eve_admin_session', JSON.stringify(session)); } catch {}
}

export function setCurrentAdminAccount(account: AdminAccount): void {
  setAdminLoggedIn(account);
}

export function getCurrentAdminAccount(): AdminAccount | null {
  try {
    const raw = localStorage.getItem('eve_admin_session');
    if (!raw) return null;
    const session: AdminSession = JSON.parse(raw);
    if (!session.account || !session.login_time) return null;
    return session.account;
  } catch { return null; }
}

export function clearAdminLogin(): void {
  try { localStorage.removeItem('eve_admin_session'); } catch {}
}

export function isAdminLoggedIn(): boolean {
  return getCurrentAdminAccount() !== null;
}

export function hasAdminPermission(permission: string): boolean {
  const account = getCurrentAdminAccount();
  if (!account) return false;
  if (account.role === 'super_admin') return true;
  return !!(account.permissions as Record<string, boolean>)[permission];
}

// ==================== 管理员账号管理 ====================

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
        const local = loadAdminAccountsFromLocal();
        const merged = [...data as AdminAccount[]];
        for (const localAcc of local) {
          if (!merged.find((m: AdminAccount) => m.id === localAcc.id)) {
            merged.push(localAcc);
          }
        }
        saveAdminAccountsToLocal(merged);
        return data as Omit<AdminAccount, 'password_hash'>[];
      }
    } catch (err) {
      console.error('[loadAdminAccounts] Error:', err);
    }
  }
  const local = loadAdminAccountsFromLocal();
  return local.map(({ password_hash: _, ...rest }) => rest);
}

export async function saveAdminAccount(account: AdminAccount): Promise<void> {
  if (hasSupabase()) {
    try {
      const supabase = getSupabaseClient()!;
      const { error } = await supabase
        .from('admin_accounts')
        .upsert(account);
      if (error) throw error;
    } catch (err) {
      console.error('[saveAdminAccount] Error:', err);
    }
  }
  const allLocal = loadAdminAccountsFromLocal();
  const idx = allLocal.findIndex((a) => a.id === account.id);
  if (idx >= 0) {
    allLocal[idx] = account;
  } else {
    allLocal.push(account);
  }
  saveAdminAccountsToLocal(allLocal);
}

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
  const allLocal = loadAdminAccountsFromLocal();
  const idx = allLocal.findIndex((a) => a.id === id);
  if (idx >= 0) {
    allLocal[idx] = { ...allLocal[idx], ...updates, updated_at: new Date().toISOString() };
    saveAdminAccountsToLocal(allLocal);
  }
}

export async function updateCurrentAccountPassword(oldPassword: string, newPassword: string): Promise<boolean> {
  const current = getCurrentAdminAccount();
  if (!current) return false;
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
  const allLocal = loadAdminAccountsFromLocal();
  const idx = allLocal.findIndex((a) => a.id === current.id);
  if (idx >= 0) {
    allLocal[idx].password_hash = newHash;
    saveAdminAccountsToLocal(allLocal);
  }
  return true;
}

export async function deleteAdminAccount(id: string): Promise<void> {
  if (hasSupabase()) {
    try {
      const supabase = getSupabaseClient()!;
      const { error } = await supabase.from('admin_accounts').delete().eq('id', id);
      if (error) throw error;
    } catch (err) {
      console.error('[deleteAdminAccount] Error:', err);
    }
  }
  const allLocal = loadAdminAccountsFromLocal();
  const filtered = allLocal.filter((a) => a.id !== id);
  saveAdminAccountsToLocal(filtered);
}

// ==================== 项目管理 ====================

export async function loadAdminProjects(): Promise<IManufactureProject[]> {
  if (hasSupabase()) {
    try {
      const supabase = getSupabaseClient()!;
      const { data, error } = await supabase
        .from('manufacture_projects')
        .select('*')
        .order('created_at', { ascending: true });
      if (error) throw error;
      if (data && data.length > 0) {
        const remote = data as unknown as IManufactureProject[];
        const raw = localStorage.getItem('eve_admin_projects');
        const local: IManufactureProject[] = raw ? JSON.parse(raw) : [];
        const merged = [...remote];
        for (const localItem of local) {
          const exists = merged.findIndex((r) => r.id === localItem.id);
          if (exists >= 0) {
            const localTs = (localItem as any).updated_at;
            const remoteTs = (merged[exists] as any).updated_at;
            if (localTs && remoteTs && new Date(localTs) > new Date(remoteTs)) {
              merged[exists] = localItem;
            }
          } else {
            merged.push(localItem);
          }
        }
        return merged;
      }
    } catch (err) {
      console.error('[loadAdminProjects] Error:', err);
    }
  }
  const raw = localStorage.getItem('eve_admin_projects');
  if (raw) {
    try { return JSON.parse(raw); } catch {}
  }
  return [];
}

export async function addAdminProject(project: Omit<IManufactureProject, 'id'>): Promise<IManufactureProject> {
  const id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
  const fullProject: IManufactureProject = { ...project, id };
  if (hasSupabase()) {
    try {
      const supabase = getSupabaseClient()!;
      const { error } = await supabase.from('manufacture_projects').insert(fullProject);
      if (error) throw error;
    } catch (err) {
      console.error('[addAdminProject] Error:', err);
    }
  }
  const all = await loadAdminProjects();
  all.push(fullProject);
  try { localStorage.setItem('eve_admin_projects', JSON.stringify(all)); } catch {}
  return fullProject;
}

export async function updateAdminProject(id: string, updates: Partial<IManufactureProject>): Promise<void> {
  if (hasSupabase()) {
    try {
      const supabase = getSupabaseClient()!;
      const { error } = await supabase.from('manufacture_projects').update(updates).eq('id', id);
      if (error) throw error;
    } catch (err) {
      console.error('[updateAdminProject] Error:', err);
    }
  }
  const all = await loadAdminProjects();
  const idx = all.findIndex((p) => p.id === id);
  if (idx >= 0) {
    all[idx] = { ...all[idx], ...updates };
    try { localStorage.setItem('eve_admin_projects', JSON.stringify(all)); } catch {}
  }
}

export async function deleteAdminProject(id: string): Promise<void> {
  if (hasSupabase()) {
    try {
      const supabase = getSupabaseClient()!;
      const { error } = await supabase.from('manufacture_projects').delete().eq('id', id);
      if (error) throw error;
    } catch (err) {
      console.error('[deleteAdminProject] Error:', err);
    }
  }
  const all = await loadAdminProjects();
  const filtered = all.filter((p) => p.id !== id);
  try { localStorage.setItem('eve_admin_projects', JSON.stringify(filtered)); } catch {}
}

export async function findAdminProject(id: string): Promise<IManufactureProject | null> {
  const all = await loadAdminProjects();
  return all.find((p) => p.id === id) || null;
}

// ==================== 网站分析 ====================

export async function recordPageView(visitorId: string, page: string): Promise<void> {
  if (!hasSupabase()) return;
  try {
    const supabase = getSupabaseClient()!;
    const { error: insertErr } = await supabase.from('site_page_views').insert({ visitor_id: visitorId, page });
    if (insertErr) throw insertErr;
  } catch (err) {
    console.error('[recordPageView] Error:', err);
  }
  triggerDailyAggregation();
}

export async function sendHeartbeat(visitorId: string, page: string, userAgent: string): Promise<void> {
  if (!hasSupabase()) return;
  try {
    const supabase = getSupabaseClient()!;
    const { error } = await supabase
      .from('site_visitors_online')
      .upsert({
        visitor_id: visitorId,
        page,
        user_agent: userAgent,
        last_heartbeat: new Date().toISOString(),
      });
    if (error) throw error;
  } catch (err) {
    console.error('[sendHeartbeat] Error:', err);
  }
}

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

export async function getOnlineCount(): Promise<number> {
  if (!hasSupabase()) return 0;
  try {
    const supabase = getSupabaseClient()!;
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const { count, error } = await supabase
      .from('site_visitors_online')
      .select('*', { count: 'exact', head: true })
      .gte('last_heartbeat', twoMinutesAgo);
    if (error) throw error;
    return count ?? 0;
  } catch (err) {
    console.error('[getOnlineCount] Error:', err);
    return 0;
  }
}

export async function getOnlineVisitors(): Promise<OnlineVisitor[]> {
  if (!hasSupabase()) return [];
  try {
    const supabase = getSupabaseClient()!;
    const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
    const { data, error } = await supabase
      .from('site_visitors_online')
      .select('*')
      .gte('last_heartbeat', twoMinutesAgo)
      .order('last_heartbeat', { ascending: false });
    if (error) throw error;
    return (data as OnlineVisitor[]) || [];
  } catch (err) {
    console.error('[getOnlineVisitors] Error:', err);
    return [];
  }
}

export async function getTodayStats(): Promise<{ pv: number; uv: number }> {
  if (!hasSupabase()) return { pv: 0, uv: 0 };
  try {
    const supabase = getSupabaseClient()!;
    const today = getLocalDateString();
    const { data, error } = await supabase
      .from('site_analytics_daily')
      .select('page_views, unique_visitors')
      .eq('date', today)
      .maybeSingle();
    if (error) throw error;
    return { pv: data?.page_views ?? 0, uv: data?.unique_visitors ?? 0 };
  } catch (err) {
    console.error('[getTodayStats] Error:', err);
    return { pv: 0, uv: 0 };
  }
}

export async function getTotalStats(): Promise<{ totalPV: number; totalDays: number; avgPV: number }> {
  if (!hasSupabase()) return { totalPV: 0, totalDays: 0, avgPV: 0 };
  try {
    const supabase = getSupabaseClient()!;
    const { data, error } = await supabase
      .from('site_analytics_daily')
      .select('page_views, date');
    if (error) throw error;
    if (!data || data.length === 0) return { totalPV: 0, totalDays: 0, avgPV: 0 };
    const totalPV = data.reduce((sum: number, row: any) => sum + (row.page_views || 0), 0);
    const totalDays = data.length;
    const avgPV = Math.round(totalPV / totalDays);
    return { totalPV, totalDays, avgPV };
  } catch (err) {
    console.error('[getTotalStats] Error:', err);
    return { totalPV: 0, totalDays: 0, avgPV: 0 };
  }
}

export async function getDailyAnalytics(days: number = 30): Promise<{ date: string; page_views: number; unique_visitors: number }[]> {
  if (!hasSupabase()) return [];
  try {
    const supabase = getSupabaseClient()!;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days + 1);
    const startDateStr = getLocalDateStringFrom(startDate);
    const { data, error } = await supabase
      .from('site_analytics_daily')
      .select('date, page_views, unique_visitors')
      .gte('date', startDateStr)
      .order('date', { ascending: true });
    if (error) throw error;
    return (data || []) as any[];
  } catch (err) {
    console.error('[getDailyAnalytics] Error:', err);
    return [];
  }
}

export async function getTodayPageDistribution(): Promise<{ page: string; count: number }[]> {
  if (!hasSupabase()) return [];
  try {
    const supabase = getSupabaseClient()!;
    const start = getLocalStartOfDayISO();
    const { data, error } = await supabase
      .from('site_page_views')
      .select('page')
      .gte('created_at', start);
    if (error) throw error;
    if (!data) return [];
    const dist: Record<string, number> = {};
    for (const row of data) {
      dist[row.page] = (dist[row.page] || 0) + 1;
    }
    return Object.entries(dist).map(([page, count]) => ({ page, count }));
  } catch (err) {
    console.error('[getTodayPageDistribution] Error:', err);
    return [];
  }
}

export async function getTodayHourlyDistribution(): Promise<{ hour: number; count: number }[]> {
  if (!hasSupabase()) return [];
  try {
    const supabase = getSupabaseClient()!;
    const start = getLocalStartOfDayISO();
    const { data, error } = await supabase
      .from('site_page_views')
      .select('created_at')
      .gte('created_at', start);
    if (error) throw error;
    if (!data) return [];
    const hours: number[] = new Array(24).fill(0);
    for (const row of data) {
      const h = new Date(row.created_at).getHours();
      hours[h] = (hours[h] || 0) + 1;
    }
    return hours.map((count, hour) => ({ hour, count }));
  } catch (err) {
    console.error('[getTodayHourlyDistribution] Error:', err);
    return [];
  }
}

let _lastAggregateTime = 0;
async function triggerDailyAggregation(): Promise<void> {
  const now = Date.now();
  if (now - _lastAggregateTime < 3_600_000) return;
  _lastAggregateTime = now;
  if (!hasSupabase()) return;
  try {
    await getSupabaseClient()!.rpc('aggregate_daily_stats');
  } catch (err: any) {
    console.warn('[triggerDailyAggregation] rpc not available:', err?.message);
  }
}

// ==================== 公告管理 ====================

export async function getAnnouncement(): Promise<Announcement | null> {
  if (!hasSupabase()) {
    try {
      const raw = localStorage.getItem('eve_announcement');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }
  try {
    const supabase = getSupabaseClient()!;
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'announcement')
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
  } catch (err) {
    console.error('[getAnnouncement] Error:', err);
    return null;
  }
}

export async function saveAnnouncement(announcement: Announcement): Promise<void> {
  if (hasSupabase()) {
    try {
      const supabase = getSupabaseClient()!;
      const { error } = await supabase
        .from('app_settings')
        .upsert({ key: 'announcement', value: announcement });
      if (error) throw error;
    } catch (err) {
      console.error('[saveAnnouncement] Error:', err);
    }
  }
  try {
    localStorage.setItem('eve_announcement', JSON.stringify(announcement));
  } catch {}
}

// ==================== 登录锁定 ====================

const LOGIN_ATTEMPTS_KEY = 'eve_admin_login_attempts';
const MAX_ATTEMPTS = 5;
const LOCK_DURATION_MS = 5 * 60 * 1000;

export function isLocked(): boolean {
  try {
    const raw = localStorage.getItem(LOGIN_ATTEMPTS_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (data.count >= MAX_ATTEMPTS) {
      const elapsed = Date.now() - data.lastAttempt;
      if (elapsed < LOCK_DURATION_MS) return true;
      localStorage.removeItem(LOGIN_ATTEMPTS_KEY);
    }
  } catch {}
  return false;
}

export function recordLoginAttempt(): void {
  try {
    const raw = localStorage.getItem(LOGIN_ATTEMPTS_KEY);
    const data = raw ? JSON.parse(raw) : { count: 0, lastAttempt: 0 };
    data.count = data.count + 1;
    data.lastAttempt = Date.now();
    localStorage.setItem(LOGIN_ATTEMPTS_KEY, JSON.stringify(data));
  } catch {}
}

export { hashPassword };