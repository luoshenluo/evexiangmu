/**
 * 用户服务模块
 * 支持注册、登录、密码管理、密保问题、云端存储
 * 密码使用哈希存储，明文永不落库/落网
 * Supabase 优先，localStorage 回退
 */

import { getSupabaseClient, isSupabaseConfigured } from '@/storage/database/browser-client';

export interface User {
  username: string;
  password: string;
  createdAt: string;
}

export interface CloudData {
  minerals?: any[];
  shipMaterials?: any[];
  buildMaterials?: any[];
  calcParams?: Record<string, number>;
  skills?: Record<string, number>;
  corp?: any;
  [key: string]: any;
}

interface AppUserRow {
  username: string;
  password_hash: string;
  security_question: string;
  security_answer: string;
  created_at: string;
  updated_at: string;
}

const USERS_KEY = 'eve_users';
const CURRENT_USER_KEY = 'eve_current_user';
const CLOUD_DATA_KEY = 'eve_user_cloud_data';

const SECURITY_QUESTIONS = [
  '您父亲的姓名是什么？',
  '您母亲的姓名是什么？',
  '您的出生地是哪里？',
  '您第一艘制造的舰船是什么？',
  '您最喜欢的 EVE 阵营是哪个？',
];

export function getSecurityQuestions(): string[] {
  return SECURITY_QUESTIONS;
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

function getUsersLocal(): User[] {
  try { const raw = localStorage.getItem(USERS_KEY); return raw ? JSON.parse(raw) : []; } catch { return []; }
}

function saveUsersLocal(users: User[]): void {
  try { localStorage.setItem(USERS_KEY, JSON.stringify(users)); } catch { /* ignore */ }
}

function rowToUser(row: AppUserRow): User {
  return { username: row.username, password: '', createdAt: row.created_at };
}

/** 验证用户名 */
export function validateUsername(username: string): { valid: boolean; message: string } {
  if (!username) return { valid: false, message: '请输入用户名' };
  if (!/^[\u4e00-\u9fa5]+$/.test(username)) return { valid: false, message: '用户名只允许汉字' };
  if (username.length > 6) return { valid: false, message: '用户名最长 6 个汉字' };
  return { valid: true, message: '' };
}

/**
 * 注册新用户（含密保问题）
 */
export async function registerUser(
  username: string,
  password: string,
  securityQuestion: string,
  securityAnswer: string,
): Promise<{ success: boolean; message: string }> {
  const validation = validateUsername(username);
  if (!validation.valid) return { success: false, message: validation.message };
  if (!password) return { success: false, message: '请输入密码' };
  if (password.length < 6) return { success: false, message: '密码至少 6 位' };
  if (!securityQuestion) return { success: false, message: '请选择密保问题' };
  if (!securityAnswer) return { success: false, message: '请输入密保答案' };

  const hashedPassword = hashPassword(password);
  const hashedAnswer = hashPassword(securityAnswer);

  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabaseClient()!;
      const { data: existing } = await supabase.from('app_users').select('username').eq('username', username).maybeSingle();
      if (existing) return { success: false, message: '该用户名已被注册' };
      const { error } = await supabase.from('app_users').insert({
        username,
        password_hash: hashedPassword,
        security_question: securityQuestion,
        security_answer: hashedAnswer,
      });
      if (error) throw error;
      return { success: true, message: '注册成功' };
    } catch (err) {
      console.error('[registerUser] Supabase error, falling back:', err);
    }
  }

  const users = getUsersLocal();
  if (users.some((u) => u.username === username)) return { success: false, message: '该用户名已被注册' };
  users.push({ username, password: hashedPassword, createdAt: new Date().toISOString() });
  saveUsersLocal(users);
  return { success: true, message: '注册成功' };
}

/**
 * 用户登录
 */
export async function loginUser(username: string, password: string): Promise<{ success: boolean; message: string }> {
  if (!username || !password) return { success: false, message: '请输入用户名和密码' };
  const hashedPassword = hashPassword(password);

  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabaseClient()!;
      const { data, error } = await supabase.from('app_users').select('*').eq('username', username).maybeSingle();
      if (error) throw error;
      if (!data) return { success: false, message: '用户名不存在' };
      if (data.password_hash !== hashedPassword) return { success: false, message: '密码错误' };
      return { success: true, message: '登录成功' };
    } catch (err) {
      console.error('[loginUser] Supabase error, falling back:', err);
    }
  }

  const users = getUsersLocal();
  const user = users.find((u) => u.username === username);
  if (!user) return { success: false, message: '用户名不存在' };
  if (user.password !== hashedPassword) return { success: false, message: '密码错误' };
  return { success: true, message: '登录成功' };
}

/**
 * 获取用户密保问题（用于忘记密码/修改密码）
 */
export async function getUserSecurityQuestion(username: string): Promise<string | null> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabaseClient()!;
      const { data } = await supabase.from('app_users').select('security_question').eq('username', username).maybeSingle();
      return data?.security_question || null;
    } catch {
      // fallthrough
    }
  }
  return null;
}

/**
 * 验证密保答案
 */
export async function verifySecurityAnswer(username: string, answer: string): Promise<boolean> {
  const hashedAnswer = hashPassword(answer);
  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabaseClient()!;
      const { data } = await supabase.from('app_users').select('security_answer').eq('username', username).maybeSingle();
      return data?.security_answer === hashedAnswer;
    } catch {
      // fallthrough
    }
  }
  return false;
}

/**
 * 修改密码（旧密码 + 密保答案双验证）
 */
export async function changePassword(
  username: string,
  oldPassword: string,
  securityAnswer: string,
  newPassword: string,
): Promise<{ success: boolean; message: string }> {
  if (!oldPassword || !newPassword || !securityAnswer) return { success: false, message: '请填写完整信息' };
  if (newPassword.length < 6) return { success: false, message: '新密码至少 6 位' };

  const newHash = hashPassword(newPassword);

  // 验证密保答案
  const answerOk = await verifySecurityAnswer(username, securityAnswer);
  if (!answerOk) return { success: false, message: '密保答案错误' };

  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabaseClient()!;
      const oldHash = hashPassword(oldPassword);
      const { data } = await supabase.from('app_users').select('password_hash').eq('username', username).maybeSingle();
      if (!data) return { success: false, message: '用户不存在' };
      if (data.password_hash !== oldHash) return { success: false, message: '旧密码错误' };
      const { error } = await supabase.from('app_users').update({ password_hash: newHash, updated_at: new Date().toISOString() }).eq('username', username);
      if (error) throw error;
      return { success: true, message: '密码修改成功' };
    } catch (err) {
      console.error('[changePassword] Supabase error, falling back:', err);
    }
  }

  const users = getUsersLocal();
  const idx = users.findIndex((u) => u.username === username);
  if (idx === -1) return { success: false, message: '用户不存在' };
  if (users[idx].password !== hashPassword(oldPassword)) return { success: false, message: '旧密码错误' };
  users[idx].password = newHash;
  saveUsersLocal(users);
  return { success: true, message: '密码修改成功' };
}

/**
 * 重置密码（密保答案验证，无需旧密码）
 */
export async function resetPassword(
  username: string,
  securityAnswer: string,
  newPassword: string,
): Promise<{ success: boolean; message: string }> {
  if (!username) return { success: false, message: '请输入用户名' };
  if (!newPassword) return { success: false, message: '请输入新密码' };
  if (newPassword.length < 6) return { success: false, message: '新密码至少 6 位' };

  const answerOk = await verifySecurityAnswer(username, securityAnswer);
  if (!answerOk) return { success: false, message: '密保答案错误' };

  const newHash = hashPassword(newPassword);

  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabaseClient()!;
      const { error } = await supabase.from('app_users').update({ password_hash: newHash, updated_at: new Date().toISOString() }).eq('username', username);
      if (error) throw error;
      return { success: true, message: '密码重置成功' };
    } catch (err) {
      console.error('[resetPassword] Supabase error, falling back:', err);
    }
  }

  const users = getUsersLocal();
  const idx = users.findIndex((u) => u.username === username);
  if (idx === -1) return { success: false, message: '该用户名不存在' };
  users[idx].password = newHash;
  saveUsersLocal(users);
  return { success: true, message: '密码重置成功' };
}

export async function getAllUsers(): Promise<User[]> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabaseClient()!;
      const { data, error } = await supabase.from('app_users').select('username, created_at').order('created_at', { ascending: false });
      if (error) throw error;
      if (data && data.length > 0) return (data as AppUserRow[]).map(rowToUser);
    } catch (err) {
      console.error('[getAllUsers] Supabase error, falling back:', err);
    }
  }
  return getUsersLocal().map((u) => ({ username: u.username, password: '', createdAt: u.createdAt }));
}

export async function deleteUser(username: string): Promise<void> {
  if (isSupabaseConfigured()) {
    try {
      const supabase = getSupabaseClient()!;
      await supabase.from('app_users').delete().eq('username', username);
      return;
    } catch (err) {
      console.error('[deleteUser] Supabase error, falling back:', err);
    }
  }
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
export async function saveUserCloudData(data: CloudData): Promise<boolean> {
  const user = getCurrentUser();
  if (!user) return false;
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
      console.error('[saveUserCloudData] Supabase error, falling back:', err);
    }
  }
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

export function loadUserCloudData(): CloudData | null {
  const user = getCurrentUser();
  if (!user) return null;
  try {
    const key = CLOUD_DATA_KEY + '_' + user.username;
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export async function fetchCloudDataFromSupabase(): Promise<CloudData | null> {
  const user = getCurrentUser();
  if (!user || !isSupabaseConfigured()) return null;
  try {
    const supabase = getSupabaseClient()!;
    const { data, error } = await supabase.from('user_cloud_data').select('data_json').eq('username', user.username).maybeSingle();
    if (error) throw error;
    if (data?.data_json) {
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
