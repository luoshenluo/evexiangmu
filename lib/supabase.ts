// Supabase 客户端（服务端使用 service_role key，绕过 RLS）
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { logger } from './logger'

// 支持 NEXT_PUBLIC_ 和 VITE_ 两种前缀（兼容 Cloudflare Pages dashboard 配置）
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  'https://reiiujndmlvvagaulyns.supabase.co'
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
  ''

let client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (!client) {
    if (!supabaseServiceKey) {
      logger.error('system', 'SUPABASE_SERVICE_ROLE_KEY 未设置，数据库操作将失败')
    }
    client = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return client
}
