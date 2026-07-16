import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  try {
    const url = import.meta.env.VITE_SUPABASE_URL as string;
    const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
    const validKey = !!key && (key.startsWith('sb_publishable_') || key.startsWith('eyJ'));
    return !!(url && validKey && url.startsWith('https://') && url.includes('.supabase.co'));
  } catch { return false; }
}

export function getSupabaseClient(): SupabaseClient | null {
  if (_client) return _client;

  if (!isSupabaseConfigured()) {
    console.warn('[Supabase] 环境变量未配置');
    return null;
  }

  _client = createClient(
    import.meta.env.VITE_SUPABASE_URL as string,
    import.meta.env.VITE_SUPABASE_ANON_KEY as string,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );

  return _client;
}