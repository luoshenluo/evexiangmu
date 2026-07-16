import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let _client: SupabaseClient | null = null

function isConfigured(): boolean {
  const url = import.meta.env.VITE_SUPABASE_URL as string
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string
  // 支持 sb_publishable_ 前缀（新版 Supabase）和 eyJ 前缀（旧版 JWT 格式）
  const validKey = !!key && (key.startsWith('sb_publishable_') || key.startsWith('eyJ'))
  return !!(url && validKey && url.startsWith('https://') && url.includes('.supabase.co'))
}

export function isSupabaseConfigured(): boolean {
  return isConfigured()
}

export function getSupabaseClient(): SupabaseClient {
  if (_client) return _client

  if (!isConfigured()) {
    // 返回一个哑客户端，避免直接崩溃
    // 业务层应先检查 isSupabaseConfigured()
    console.warn('[Supabase] 环境变量未配置，请先在 Vercel Settings → Environment Variables 中添加 VITE_SUPABASE_URL 和 VITE_SUPABASE_ANON_KEY')
    _client = createClient(
      'https://placeholder.supabase.co',
      'placeholder-key',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
    return _client
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

  _client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  return _client
}
