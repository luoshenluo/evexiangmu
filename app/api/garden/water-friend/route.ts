import { NextRequest } from 'next/server'
import { waterFriendFlower, findUserById } from '@/lib/server-store'
import { authRequest, sanitizeUser, jsonResponse } from '@/lib/auth'
import { logger } from '@/lib/logger'

export const runtime = 'edge'

// 好友浇水：帮好友的花浇水，+5% 生长，自己得 2 金币
export async function POST(req: NextRequest) {
  try {
    const user = await authRequest(req)
    if (!user) return jsonResponse(false, null, '请先登录', 401)

    const { targetId, plotId } = await req.json()
    if (!targetId || !plotId) return jsonResponse(false, null, '参数错误', 400)

    const result = await waterFriendFlower(user.id, targetId, plotId)
    if (!result.success) {
      return jsonResponse(false, null, result.message, 400)
    }

    // 返回更新后的浇水者数据（金币增加了）
    const updated = await findUserById(user.id)

    logger.info('garden', '好友浇水成功', {
      watererId: user.id, targetId, plotId, reward: result.reward,
    })

    return jsonResponse(true, {
      user: sanitizeUser(updated),
      message: result.message,
      reward: result.reward,
    })
  } catch (e: any) {
    logger.error('garden', '好友浇水异常', { error: e?.message })
    return jsonResponse(false, null, e.message, 500)
  }
}
