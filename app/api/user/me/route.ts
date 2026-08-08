import { NextRequest } from 'next/server'
import { authRequest, jsonResponse, sanitizeUser } from '@/lib/auth'
import { findUserById, incrementTaskProgress } from '@/lib/server-store'

export const runtime = 'edge'

// 返回当前登录用户自己的资料（脱敏）+ 触发一次当日登录任务进度（最多+1，幂等）
export async function GET(req: NextRequest) {
  try {
    const user = await authRequest(req)
    if (!user) return jsonResponse(false, null, '请先登录', 401)

    const fresh = await findUserById(user.id)
    if (!fresh) return jsonResponse(false, null, '用户不存在', 404)

    // 登录即推进一次 login 任务（每日重置后从 0 → 1，之后再调用不超过 target=1 也没事）
    // 即使 fail 也不影响接口主流程
    try { await incrementTaskProgress(fresh.id, 'login', 1) } catch {}

    return jsonResponse(true, sanitizeUser(fresh))
  } catch (e: any) {
    return jsonResponse(false, null, e.message || '服务器错误', 500)
  }
}
