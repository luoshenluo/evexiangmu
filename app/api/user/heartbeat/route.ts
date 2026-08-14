import { NextRequest } from 'next/server'
import { authRequest, jsonResponse } from '@/lib/auth'
import { touchUserActive } from '@/lib/server-store'

export const runtime = 'edge'

// 客户端心跳：节流更新 users.last_active_at（约每 30s 调一次即可）
// 返回当前时间戳，前端用于同步时间
export async function POST(req: NextRequest) {
  try {
    const user = await authRequest(req)
    if (!user) return jsonResponse(false, null, '请先登录', 401)

    const now = Date.now()
    // 异步写，避免阻塞返回（实际 await 确保写入，因为 Edge 下 async 未 await 会被裁）
    await touchUserActive(user.id, now)

    return jsonResponse(true, { ts: now })
  } catch (e: any) {
    // 静默错误：心跳失败不应影响前台体验
    return jsonResponse(false, { ts: Date.now() }, e?.message || 'heartbeat error')
  }
}
