import { NextRequest } from 'next/server'
import {
  ensureSeasonTick, findUserById,
  getGardenLikeCount, hasLiked, getFriendWaterRemainingToday,
} from '@/lib/server-store'
import { authRequest, sanitizeUser, jsonResponse } from '@/lib/auth'
import { logger } from '@/lib/logger'
import { STEAL_CONFIG } from '@/lib/game-data'

export const runtime = 'edge'

// 访问其他玩家的花园
export async function GET(
  req: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    await ensureSeasonTick()
    const visitor = await authRequest(req)
    if (!visitor) return jsonResponse(false, null, '请先登录', 401)

    const victimId = params.userId
    const victim = await findUserById(victimId)
    if (!victim) return jsonResponse(false, null, '玩家不存在', 404)

    // 检查是否是自己
    const isSelf = visitor.id === victimId
    // 检查是否是好友
    const isFriend = visitor.friends.includes(victimId)
    // 检查花园保护
    const now = Date.now()
    const isProtected = victim.gardenProtectedUntil > now

    // 检查每日偷花次数
    let stealCountToday = visitor.stealCountToday
    if (now > visitor.stealResetAt) stealCountToday = 0
    const canSteal = !isSelf && stealCountToday < STEAL_CONFIG.dailyStealLimit

    // 返回可偷取的花（只有成熟的）
    const stealablePlots = isSelf ? [] : victim.plots.filter(p =>
      p.unlocked && p.flower && p.flower.isReady && !isProtected
    )

    // 社交数据：点赞数、是否已点赞、好友浇水剩余次数
    const [likeCount, liked, friendWaterRemaining] = await Promise.all([
      getGardenLikeCount(victimId),
      isSelf ? Promise.resolve(false) : hasLiked(visitor.id, victimId),
      Promise.resolve(getFriendWaterRemainingToday(visitor.id)),
    ])

    logger.info('steal', '访问花园', {
      visitorId: visitor.id, visitorName: visitor.nickname,
      victimId, victimName: victim.nickname,
      isFriend, isProtected, stealableCount: stealablePlots.length,
      likeCount, liked,
    })

    return jsonResponse(true, {
      user: {
        id: victim.id,
        nickname: victim.nickname,
        avatar: victim.avatar,
        coins: victim.coins,
      },
      isSelf,
      isFriend,
      isProtected,
      canSteal,
      stealCountToday,
      stealLimit: STEAL_CONFIG.dailyStealLimit,
      likeCount,
      liked,
      friendWaterRemaining,
      plots: victim.plots.map(p => ({
        id: p.id,
        unlocked: p.unlocked,
        unlockPrice: p.unlockPrice,
        flower: p.flower ? {
          flowerTypeId: p.flower.flowerTypeId,
          rank: p.flower.rank,
          growthProgress: p.flower.growthProgress,
          isReady: p.flower.isReady,
          hasPest: p.flower.hasPest,
          waterCount: p.flower.waterCount,
          fertilizeCount: p.flower.fertilizeCount,
        } : null,
        canSteal: !isSelf && p.flower?.isReady && !isProtected && canSteal,
        canWater: !isSelf && !!p.flower && !p.flower.isReady && friendWaterRemaining > 0,
      })),
    })
  } catch (e: any) {
    logger.error('steal', '访问花园异常', { error: e.message })
    return jsonResponse(false, null, e.message, 500)
  }
}
