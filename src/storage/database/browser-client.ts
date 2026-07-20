import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

/**
 * 安全检查：只允许 publishable key（anon key）
 * 如果检测到 secret / service_role key，拒绝使用并报警
 */
function isSafeKey(key: string): boolean {
  if (!key) return false;
  // 只允许这两种前缀
  if (key.startsWith('sb_publishable_')) return true;
  if (key.startsWith('eyJ')) return true;
  // 安全检查：如果包含 secret/service_role，警告并拒绝
  if (key.includes('secret') || key.includes('service_role')) {
    console.error(
      '[Supabase Security] 检测到服务端密钥泄露到前端！' +
      'SUPABASE_SECRET_KEY 只能在服务端使用，绝不能出现在前端代码或 .env 文件中。' +
      '请使用 SUPABASE_PUBLISHABLE_KEY（anon key）替代。'
    );
    return false;
  }
  return false;
}

export function isSupabaseConfigured(): boolean {
  try {
    const url = import.meta.env.VITE_SUPABASE_URL as string;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
    const safeUrl = !!url && url.startsWith('https://') && url.includes('.supabase.co');
    return !!(safeUrl && isSafeKey(key));
  } catch { return false; }
}

export function getSupabaseClient(): SupabaseClient | null {
  if (_client) return _client;

  if (!isSupabaseConfigured()) {
    console.warn('[Supabase] 环境变量未配置或密钥不安全');
    return null;
  }

  _client = createClient(
    import.meta.env.VITE_SUPABASE_URL as string,
    import.meta.env.VITE_SUPABASE_ANON_KEY as string,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  return _client;
}