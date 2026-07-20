/**
 * 用户服务模块
 * 支持注册、登录、密码管理、云端存储
 * 密码使用哈希存储，明文永不落库/落网
 * Supabase 优先，localStorage 回退
 */

import { getSupabaseClient, isSupabaseConfigured } from '@/storage/database/browser-client';

export interface User {
  username: string;
  password: string; // 仅用于 setCurrentUser 传递，实际不存明文
  createdAt: string;
}

/** 云端存储数据结构 */
export interface CloudData {
  minerals?: any[];
  shipMaterials?: any[];
  buildMaterials?: any[];
  calcParams?: Record<string, number>;
  skills?: Record<string, number>;
  corp?: any;
  [key: string]: any;
}

// ---- Supabase 表行类型 ----
interface AppUserRow {
  username: string;
  password_hash: string;
  created_at: string;
  updated_at: string;
}

interface UserCloudDataRow {
  username: string;
  data_json: Record<string, any>;
  updated_at: string;
}

const USERS_KEY = 'eve_users';
const CURRENT_USER_KEY = 'eve_current_user';
const CLOUD_DATA_KEY = 'eve_user_cloud_data';

/** 哈希密码（与 admin-projects.ts 一致） */
function hashPassword(password: string): string {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return 'hash_' + Math.abs(hash).toString(16);
}

// =============== localStorage 回退 ===============

function getUsersLocal(): User[] {
  try { const raw = localStorage.getItem(USERS_KEY); return raw ? JSON.parse(raw) : []; } catch { return []; }
}

function saveUsersLocal(users: User[]): void {
  try { localStorage.setItem(USERS_KEY, JSON.stringify(users)); } catch { /* ignore */ }
}

function rowToUser(row: AppUserRow): User {
  return { username: row.username, password: '', createdAt: row.created_at };
}

// =============== 公共 API ===============

/** 验证用户名：只允许汉字，1-6 个字 */
export function validateUsername(username: string): { valid: boolean; message: string } {
  if (!username) return { valid: false, message: '请输入用户名' };
  if (!/^[\u4e00-\u9fa5]+$/.test(username)) return { valid: false, message: '用户名只允许汉字' };
  if (username.length > 6) return { valid: false, message: '用户名最长 6 个汉字' };
  return { valid: true, message: '' };
}

/**
 * 注册新用户
 * Supabase: INSERT INTO app_users → 失败则回退 localStorage
 */
export async function registerUser(username: string, password: string): Promise<{ success: boolean; message: string }> {
  const validation = validateUsername(username);
  if (!validation.valid) return { success: false, message: validation.message };
  if (!password) return { success: false, message: '请输入密码' };
  if (password.length < 6) return { success: false, message: '密码至少 6 位' };

  const hashedPassword = hashPassword(password);

  // --- Supabase ---
  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabaseClient()!;
      // 检查重复
      const { data: existing } = await supabase.from('app_users').select('username').eq('username', username).maybeSingle();
      if (existing) return { success: false, message: '该用户名已被注册' };
      // 插入
      const { error } = await supabase.from('app_users').insert({ username, password_hash: hashedPassword });
      if (error) throw error;
      return { success: true, message: '注册成功' };
    } catch (err) {
      console.error('[registerUser] Supabase error, falling back to localStorage:', err);
    }
  }

  // --- localStorage 回退 ---
  const users = getUsersLocal();
  if (users.some((u) => u.username === username)) return { success: false, message: '该用户名已被注册' };
  users.push({ username, password: hashedPassword, createdAt: new Date().toISOString() });
  saveUsersLocal(users);
  return { success: true, message: '注册成功' };
}

/**
 * 用户登录
 * Supabase: SELECT → 哈希比对 → 失败则回退 localStorage
 */
export async function loginUser(username: string, password: string): Promise<{ success: boolean; message: string }> {
  if (!username || !password) return { success: false, message: '请输入用户名和密码' };
  const hashedPassword = hashPassword(password);

  // --- Supabase ---
  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabaseClient()!;
      const { data, error } = await supabase.from('app_users').select('username, password_hash, created_at').eq('username', username).maybeSingle();
      if (error) throw error;
      if (!data) return { success: false, message: '用户名不存在' };
      if (data.password_hash !== hashedPassword) return { success: false, message: '密码错误' };
      return { success: true, message: '登录成功' };
    } catch (err) {
      console.error('[loginUser] Supabase error, falling back to localStorage:', err);
    }
  }

  // --- localStorage 回退 ---
  const users = getUsersLocal();
  const user = users.find((u) => u.username === username);
  if (!user) return { success: false, message: '用户名不存在' };
  if (user.password !== hashedPassword) return { success: false, message: '密码错误' };
  return { success: true, message: '登录成功' };
}

/**
 * 修改密码（需旧密码验证）
 */
export async function changePassword(username: string, oldPassword: string, newPassword: string): Promise<{ success: boolean; message: string }> {
  if (!oldPassword || !newPassword) return { success: false, message: '请填写完整信息' };
  if (newPassword.length < 6) return { success: false, message: '新密码至少 6 位' };
  const oldHash = hashPassword(oldPassword);
  const newHash = hashPassword(newPassword);

  // --- Supabase ---
  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabaseClient()!;
      const { data, error } = await supabase.from('app_users').select('password_hash').eq('username', username).maybeSingle();
      if (error) throw error;
      if (!data) return { success: false, message: '用户不存在' };
      if (data.password_hash !== oldHash) return { success: false, message: '旧密码错误' };
      const { error: updateErr } = await supabase.from('app_users').update({ password_hash: newHash, updated_at: new Date().toISOString() }).eq('username', username);
      if (updateErr) throw updateErr;
      return { success: true, message: '密码修改成功' };
    } catch (err) {
      console.error('[changePassword] Supabase error, falling back to localStorage:', err);
    }
  }

  // --- localStorage 回退 ---
  const users = getUsersLocal();
  const idx = users.findIndex((u) => u.username === username);
  if (idx === -1) return { success: false, message: '用户不存在' };
  if (users[idx].password !== oldHash) return { success: false, message: '旧密码错误' };
  users[idx].password = newHash;
  saveUsersLocal(users);
  return { success: true, message: '密码修改成功' };
}

/**
 * 重置密码（忘记密码，无需旧密码）
 */
export async function resetPassword(username: string, newPassword: string): Promise<{ success: boolean; message: string }> {
  if (!username) return { success: false, message: '请输入用户名' };
  if (!newPassword) return { success: false, message: '请输入新密码' };
  if (newPassword.length < 6) return { success: false, message: '新密码至少 6 位' };
  const newHash = hashPassword(newPassword);

  // --- Supabase ---
  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabaseClient()!;
      const { data, error } = await supabase.from('app_users').select('username').eq('username', username).maybeSingle();
      if (error) throw error;
      if (!data) return { success: false, message: '该用户名不存在，请先注册' };
      const { error: updateErr } = await supabase.from('app_users').update({ password_hash: newHash, updated_at: new Date().toISOString() }).eq('username', username);
      if (updateErr) throw updateErr;
      return { success: true, message: '密码重置成功' };
    } catch (err) {
      console.error('[resetPassword] Supabase error, falling back to localStorage:', err);
    }
  }

  // --- localStorage 回退 ---
  const users = getUsersLocal();
  const idx = users.findIndex((u) => u.username === username);
  if (idx === -1) return { success: false, message: '该用户名不存在，请先注册' };
  users[idx].password = newHash;
  saveUsersLocal(users);
  return { success: true, message: '密码重置成功' };
}

/**
 * 获取所有注册用户（管理后台用）
 */
export async function getAllUsers(): Promise<User[]> {
  // --- Supabase ---
  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabaseClient()!;
      const { data, error } = await supabase.from('app_users').select('username, created_at').order('created_at', { ascending: false });
      if (error) throw error;
      if (data && data.length > 0) {
        return (data as AppUserRow[]).map(rowToUser);
      }
    } catch (err) {
      console.error('[getAllUsers] Supabase error, falling back to localStorage:', err);
    }
  }

  // --- localStorage 回退 ---
  return getUsersLocal().map((u) => ({ username: u.username, password: '', createdAt: u.createdAt }));
}

/**
 * 删除用户
 */
export async function deleteUser(username: string): Promise<void> {
  // --- Supabase ---
  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabaseClient()!;
      await supabase.from('app_users').delete().eq('username', username);
      // user_cloud_data 通过 ON DELETE CASCADE 自动删除
      return;
    } catch (err) {
      console.error('[deleteUser] Supabase error, falling back to localStorage:', err);
    }
  }

  // --- localStorage 回退 ---
  const users = getUsersLocal().filter((u) => u.username !== username);
  saveUsersLocal(users);
  try { localStorage.removeItem(CLOUD_DATA_KEY + '_' + username); } catch { /* ignore */ }
}

// =============== 会话管理 ===============

export function getCurrentUser(): User | null {
  try { const raw = localStorage.getItem(CURRENT_USER_KEY); return raw ? JSON.parse(raw) : null; } catch { return null; }
}

export function setCurrentUser(user: User): void {
  try { localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user)); window.dispatchEvent(new Event('user-login-changed')); } catch { /* ignore */ }
}

export function clearCurrentUser(): void {
  try { localStorage.removeItem(CURRENT_USER_KEY); window.dispatchEvent(new Event('user-login-changed')); } catch { /* ignore */ }
}

export function isUserLoggedIn(): boolean {
  return getCurrentUser() !== null;
}

// =============== 云端存储 ===============

/**
 * 保存云端数据（按用户名隔离）
 */
export async function saveUserCloudData(data: CloudData): Promise<boolean> {
  const user = getCurrentUser();
  if (!user) return false;

  // --- Supabase ---
  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabaseClient()!;
      const { error } = await supabase.from('user_cloud_data').upsert(
        { username: user.username, data_json: data as Record<string, any>, updated_at: new Date().toISOString() },
        { onConflict: 'username' },
      );
      if (error) throw error;
      return true;
    } catch (err) {
      console.error('[saveUserCloudData] Supabase error, falling back to localStorage:', err);
    }
  }

  // --- localStorage 回退 ---
  try {
    const key = CLOUD_DATA_KEY + '_' + user.username;
    const existing: CloudData = loadUserCloudData() || {};
    const merged = { ...existing, ...data };
    localStorage.setItem(key, JSON.stringify(merged));
    return true;
  } catch (err) {
    console.error('[saveUserCloudData] localStorage error:', err);
    return false;
  }
}

/**
 * 加载云端数据（按当前登录用户）
 */
export function loadUserCloudData(): CloudData | null {
  const user = getCurrentUser();
  if (!user) return null;

  // 注意：此函数是同步的（供 React 初始化用），Supabase 部分在 HomePage 中异步处理
  // 这里先返回 localStorage 缓存
  try {
    const key = CLOUD_DATA_KEY + '_' + user.username;
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * 从 Supabase 异步加载云端数据（供 HomePage useEffect 调用）
 */
export async function fetchCloudDataFromSupabase(): Promise<CloudData | null> {
  const user = getCurrentUser();
  if (!user || !isSupabaseConfigured()) return null;
  try {
    const supabase = getSupabaseClient()!;
    const { data, error } = await supabase.from('user_cloud_data').select('data_json').eq('username', user.username).maybeSingle();
    if (error) throw error;
    if (data?.data_json) {
      // 同步到 localStorage 缓存
      const key = CLOUD_DATA_KEY + '_' + user.username;
      localStorage.setItem(key, JSON.stringify(data.data_json));
      return data.data_json as CloudData;
    }
    return null;
  } catch (err) {
    console.error('[fetchCloudDataFromSupabase] Error:', err);
    return null;
  }
}
