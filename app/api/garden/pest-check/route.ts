import { NextRequest } from 'next/server'
import { ensureSeasonTick, checkPestDisaster, checkPestDeath } from '@/lib/server-store'
import { authRequest, sanitizeUser, jsonResponse } from '@/lib/auth'
import { logger } from '@/lib/logger'

export const runtime = 'edge'

// 虫灾检查 - 在用户加载花园页面时调用
export async function POST(req: NextRequest) {
  try {
    await ensureSeasonTick()
    const user = await authRequest(req)
    if (!user) return jsonResponse(false, null, '请先登录', 401)

    // 1. 检查虫害导致的花朵死亡
    const deathResult = await checkPestDeath(user.id)

    // 2. 检查并触发随机虫灾事件
    const pestResult = await checkPestDisaster(user.id)

    // 3. 如果有变化，重新获取用户数据
    let updatedUser = user
    if (deathResult.deadFlowers.length > 0 || pestResult.triggered) {
      const { findUserById } = await import('@/lib/server-store')
      updatedUser = (await findUserById(user.id)) || user
    }

    logger.info('pest', '虫灾检查完成', {
      userId: user.id,
      pestTriggered: pestResult.triggered,
      pestSeverity: pestResult.severity,
      pestAffectedPlots: pestResult.affectedPlots,
      deadFlowers: deathResult.deadFlowers,
    })

    return jsonResponse(true, {
      user: sanitizeUser(updatedUser),
      pestEvent: pestResult.triggered ? {
        severity: pestResult.severity,
        affectedPlots: pestResult.affectedPlots,
      } : null,
      deadFlowers: deathResult.deadFlowers,
    })
  } catch (e: any) {
    logger.error('pest', '虫灾检查异常', { error: e.message })
    return jsonResponse(false, null, e.message, 500)
  }
}
