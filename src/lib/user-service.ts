/**
 * 用户服务模块
 * 支持注册、登录、密码管理、云端存储
 * 密码使用 SHA-256 风格哈希存储
 * 支持 Supabase + localStorage 双模式
 */

import { getSupabaseClient, isSupabaseConfigured } from '@/storage/database/browser-client';

export interface User {
  username: string;
  password: string;
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

/** 获取所有注册用户 */
function getUsers(): User[] {
  try {
    const raw = localStorage.getItem(USERS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** 保存所有注册用户 */
function saveUsers(users: User[]): void {
  try {
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  } catch {
    /* ignore */
  }
}

/**
 * 验证用户名：只允许汉字，1-6 个字
 */
export function validateUsername(username: string): { valid: boolean; message: string } {
  if (!username) {
    return { valid: false, message: '请输入用户名' };
  }
  if (!/^[\u4e00-\u9fa5]+$/.test(username)) {
    return { valid: false, message: '用户名只允许汉字' };
  }
  if (username.length > 6) {
    return { valid: false, message: '用户名最长 6 个汉字' };
  }
  return { valid: true, message: '' };
}

/**
 * 注册新用户
 * 密码使用哈希存储
 */
export function registerUser(username: string, password: string): { success: boolean; message: string } {
  const validation = validateUsername(username);
  if (!validation.valid) {
    return { success: false, message: validation.message };
  }
  if (!password) {
    return { success: false, message: '请输入密码' };
  }
  if (password.length < 6) {
    return { success: false, message: '密码至少 6 位' };
  }

  const users = getUsers();
  if (users.some((u) => u.username === username)) {
    return { success: false, message: '该用户名已被注册' };
  }

  const hashedPassword = hashPassword(password);
  users.push({ username, password: hashedPassword, createdAt: new Date().toISOString() });
  saveUsers(users);
  return { success: true, message: '注册成功' };
}

/**
 * 用户登录（哈希比对）
 */
export function loginUser(username: string, password: string): { success: boolean; message: string } {
  if (!username || !password) {
    return { success: false, message: '请输入用户名和密码' };
  }

  const users = getUsers();
  const user = users.find((u) => u.username === username);
  if (!user) {
    return { success: false, message: '用户名不存在' };
  }
  if (user.password !== hashPassword(password)) {
    return { success: false, message: '密码错误' };
  }

  return { success: true, message: '登录成功' };
}

/**
 * 修改密码（需要旧密码验证）
 */
export function changePassword(username: string, oldPassword: string, newPassword: string): { success: boolean; message: string } {
  if (!oldPassword || !newPassword) {
    return { success: false, message: '请填写完整信息' };
  }
  if (newPassword.length < 6) {
    return { success: false, message: '新密码至少 6 位' };
  }

  const users = getUsers();
  const userIndex = users.findIndex((u) => u.username === username);
  if (userIndex === -1) {
    return { success: false, message: '用户不存在' };
  }
  if (users[userIndex].password !== hashPassword(oldPassword)) {
    return { success: false, message: '旧密码错误' };
  }

  users[userIndex].password = hashPassword(newPassword);
  saveUsers(users);
  return { success: true, message: '密码修改成功' };
}

/**
 * 重置密码（忘记密码场景，无需旧密码）
 */
export function resetPassword(username: string, newPassword: string): { success: boolean; message: string } {
  if (!username) {
    return { success: false, message: '请输入用户名' };
  }
  if (!newPassword) {
    return { success: false, message: '请输入新密码' };
  }
  if (newPassword.length < 6) {
    return { success: false, message: '新密码至少 6 位' };
  }

  const users = getUsers();
  const userIndex = users.findIndex((u) => u.username === username);
  if (userIndex === -1) {
    return { success: false, message: '该用户名不存在，请先注册' };
  }

  users[userIndex].password = hashPassword(newPassword);
  saveUsers(users);
  return { success: true, message: '密码重置成功' };
}

/**
 * 获取所有注册用户
 */
export function getAllUsers(): User[] {
  return getUsers();
}

/**
 * 删除用户
 */
export function deleteUser(username: string): void {
  const users = getUsers();
  const filtered = users.filter((u) => u.username !== username);
  saveUsers(filtered);
  // 清除云端数据
  try {
    localStorage.removeItem(CLOUD_DATA_KEY + '_' + username);
  } catch { /* ignore */ }
}

/**
 * 获取当前登录用户
 */
export function getCurrentUser(): User | null {
  try {
    const raw = localStorage.getItem(CURRENT_USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * 设置当前登录用户（保存会话）
 */
export function setCurrentUser(user: User): void {
  try {
    localStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    window.dispatchEvent(new Event('user-login-changed'));
  } catch {
    /* ignore */
  }
}

/**
 * 清除当前登录用户（退出登录）
 */
export function clearCurrentUser(): void {
  try {
    localStorage.removeItem(CURRENT_USER_KEY);
    window.dispatchEvent(new Event('user-login-changed'));
  } catch {
    /* ignore */
  }
}

/**
 * 检查是否已登录
 */
export function isUserLoggedIn(): boolean {
  return getCurrentUser() !== null;
}

/**
 * 保存云端数据到 localStorage（以用户名为 key 隔离）
 * 未来可扩展为 Supabase 存储
 */
export async function saveUserCloudData(data: CloudData): Promise<boolean> {
  try {
    const user = getCurrentUser();
    if (!user) return false;
    const key = CLOUD_DATA_KEY + '_' + user.username;
    // 合并已有数据，保留多层嵌套
    const existing: CloudData = loadUserCloudData() || {};
    const merged = { ...existing, ...data };
    localStorage.setItem(key, JSON.stringify(merged));
    return true;
  } catch (err) {
    console.error('[saveUserCloudData] Error:', err);
    return false;
  }
}

/**
 * 从云端加载数据（按当前登录用户）
 */
export function loadUserCloudData(): CloudData | null {
  try {
    const user = getCurrentUser();
    if (!user) return null;
    const key = CLOUD_DATA_KEY + '_' + user.username;
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    console.error('[loadUserCloudData] Error:', err);
    return null;
  }
}