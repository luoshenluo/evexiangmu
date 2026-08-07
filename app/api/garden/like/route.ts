import { NextRequest } from 'next/server'
import { findUserById, toggleGardenLike } from '@/lib/server-store'
import { authRequest, sanitizeUser, jsonResponse } from '@/lib/auth'
import { logger } from '@/lib/logger'

export const runtime = 'edge'

// 花园点赞 / 取消点赞
export async function POST(req: NextRequest) {
  try {
    const user = await authRequest(req)
    if (!user) return jsonResponse(false, null, '请先登录', 401)

    const { targetId } = await req.json()
    if (!targetId) return jsonResponse(false, null, '参数错误', 400)
    if (targetId === user.id) return jsonResponse(false, null, '不能给自己的花园点赞', 400)

    const target = await findUserById(targetId)
    if (!target) return jsonResponse(false, null, '目标玩家不存在', 404)

    const result = await toggleGardenLike(user.id, targetId)

    logger.info('garden', '花园点赞', {
      likerId: user.id, targetId, liked: result.liked, count: result.count,
    })

    return jsonResponse(true, result)
  } catch (e: any) {
    return jsonResponse(false, null, e.message, 500)
  }
}
