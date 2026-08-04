// Supabase 客户端（服务端使用 service_role key，绕过 RLS）
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { logger } from './logger'

// 支持多种环境变量命名（兼容不同部署配置）
const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  'https://reiiujndmlvvagaulyns.supabase.co'

// publishable / anon key（公开，前端可用）
export const supabasePublishableKey =
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  ''

// secret / service_role key（仅服务端使用，绝不能暴露）
const supabaseSecretKey =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
  ''

let client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (!client) {
    if (!supabaseSecretKey) {
      logger.error('system', 'SUPABASE_SECRET_KEY 未设置，数据库操作将失败')
    }
    client = createClient(supabaseUrl, supabaseSecretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  }
  return client
}
