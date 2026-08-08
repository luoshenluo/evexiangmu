import { NextRequest } from 'next/server'
import { updateUser, ensureSeasonTick, incrementTaskProgress } from '@/lib/server-store'
import { authRequest, sanitizeUser, jsonResponse } from '@/lib/auth'
import { logger } from '@/lib/logger'

export const runtime = 'edge'

// 解锁地块
export async function POST(req: NextRequest) {
  try {
    await ensureSeasonTick()
    const user = await authRequest(req)
    if (!user) return jsonResponse(false, null, '请先登录', 401)

    const { plotId } = await req.json()
    if (!plotId) return jsonResponse(false, null, '参数错误', 400)

    const plot = user.plots.find(p => p.id === plotId)
    if (!plot) return jsonResponse(false, null, '地块不存在', 400)
    if (plot.unlocked) return jsonResponse(false, null, '该地块已解锁', 400)
    if (user.coins < plot.unlockPrice) return jsonResponse(false, null, '金币不足', 400)

    const newPlots = user.plots.map(p => p.id === plotId ? { ...p, unlocked: true } : p)
    const updated = await updateUser(user.id, { plots: newPlots, coins: user.coins - plot.unlockPrice })

    // 任务进度：周常·花园扩张（解锁或打理共 10 次）
    try { await incrementTaskProgress(user.id, 'unlock', 1) } catch {}

    logger.info('garden', '解锁地块', {
      userId: user.id, plotId, cost: plot.unlockPrice,
      remainingCoins: user.coins - plot.unlockPrice,
      totalUnlocked: newPlots.filter(p => p.unlocked).length,
    })

    return jsonResponse(true, sanitizeUser(updated))
  } catch (e: any) {
    logger.error('garden', '解锁地块异常', { error: e.message })
    return jsonResponse(false, null, e.message, 500)
  }
}
