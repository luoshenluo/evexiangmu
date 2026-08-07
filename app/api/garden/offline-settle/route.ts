import { NextRequest } from 'next/server'
import { updateUser, createNotification } from '@/lib/server-store'
import { FLOWER_TYPES } from '@/lib/game-data'
import type { PlantedFlower } from '@/lib/types'
import { authRequest, sanitizeUser, jsonResponse } from '@/lib/auth'
import { logger } from '@/lib/logger'

export const runtime = 'edge'

// 离线收益结算：根据离开时长，按被动速率给种植中的花推进生长
// 设计原则：
//   1. 只增不减（绝不扣进度、不删花）
//   2. 每朵花的「时间锚点」= lastSettledAt（缺省 plantedAt），结算后更新为 now，避免重复结算
//   3. 已成熟(isReady)的花不再推进，保留等待玩家手动收获
//   4. 有虫害的花离线期间生长速率减半
//   5. 离线超过上限时长后封顶（防异常），默认 8 小时
const PASSIVE_GROWTH_PER_MIN = 0.5 // 每分钟 +0.5%（≈每小时 30%）
const MAX_OFFLINE_MINUTES = 8 * 60 // 离线最长计 8 小时
const PEST_GROWTH_FACTOR = 0.5

export async function POST(req: NextRequest) {
  try {
    const user = await authRequest(req)
    if (!user) return jsonResponse(false, null, '请先登录', 401)

    const now = Date.now()
    // 离线起点：取最近一次登录 / 最后操作（浇水/施肥）的较晚者；无则用 plantedAt
    // 这里以用户级别 lastLogin 作为「上次活跃」近似值
    const lastActive = user.lastLogin || now
    const awayMs = Math.max(0, now - lastActive)
    const awayMin = Math.min(awayMs / 60000, MAX_OFFLINE_MINUTES)

    // 离线不足 1 分钟，直接返回（避免频繁结算）
    if (awayMin < 1) {
      return jsonResponse(true, {
        timeAwayMs: awayMs,
        settledCount: 0,
        maturedCount: 0,
        flowers: [],
        message: '刚刚活跃，无需结算',
      })
    }

    const settleResults: {
      plotId: number
      name: string
      emoji: string
      addedProgress: number
      matured: boolean
      wasReady: boolean
    }[] = []

    let changed = false
    let totalAdded = 0
    let maturedCount = 0

    const newPlots = user.plots.map(plot => {
      if (!plot.unlocked || !plot.flower || plot.flower.isReady) return plot
      const f: PlantedFlower = { ...plot.flower }
      const ft = FLOWER_TYPES.find(t => t.id === f.flowerTypeId)
      if (!ft) return plot

      const anchor = f.lastSettledAt || f.plantedAt
      const elapsedMin = Math.min(Math.max(0, (now - anchor) / 60000), MAX_OFFLINE_MINUTES)
      if (elapsedMin < 1) return plot

      let rate = PASSIVE_GROWTH_PER_MIN
      if (f.hasPest) rate *= PEST_GROWTH_FACTOR

      const added = Math.min(elapsedMin * rate, 100 - f.growthProgress)
      if (added <= 0.01) {
        // 已经满进度但没标记 ready 的情况，补一下
        if (f.growthProgress >= 100 && !f.isReady) {
          f.isReady = true
          f.growthProgress = 100
          f.lastSettledAt = now
          changed = true
          settleResults.push({
            plotId: plot.id, name: ft.name, emoji: ft.emoji,
            addedProgress: 0, matured: true, wasReady: false,
          })
          maturedCount++
        }
        return { ...plot, flower: f }
      }

      const prevReady = f.isReady
      f.growthProgress = Math.min(100, f.growthProgress + added)
      f.lastSettledAt = now
      totalAdded += added

      // 被动生长也能小幅提升等级（保底到 2 级，避免离线白嫖高级花）
      if (f.growthProgress > 40 && f.rank < 2) f.rank = 2 as any
      if (f.growthProgress >= 100) {
        f.isReady = true
        f.growthProgress = 100
      }

      const matured = !prevReady && f.isReady
      if (matured) maturedCount++
      changed = true
      settleResults.push({
        plotId: plot.id, name: ft.name, emoji: ft.emoji,
        addedProgress: Math.round(added * 10) / 10,
        matured, wasReady: prevReady,
      })
      return { ...plot, flower: f }
    })

    if (!changed) {
      return jsonResponse(true, {
        timeAwayMs: awayMs,
        settledCount: 0,
        maturedCount: 0,
        flowers: [],
        message: '没有需要结算的花朵',
      })
    }

    // 更新 lastLogin 为现在，作为新的活跃锚点
    const updated = await updateUser(user.id, { plots: newPlots, lastLogin: now })
    if (!updated) return jsonResponse(false, null, '结算失败', 500)

    const settledCount = settleResults.filter(r => r.addedProgress > 0).length
    const hours = Math.floor(awayMin / 60)
    const mins = Math.round(awayMin % 60)
    const timeStr = hours > 0 ? `${hours}小时${mins}分钟` : `${mins}分钟`

    logger.info('garden', '离线结算完成', {
      userId: user.id,
      awayMin: Math.round(awayMin),
      settledCount, maturedCount, totalAdded: Math.round(totalAdded),
    })

    if (maturedCount > 0) {
      await createNotification({
        userId: user.id,
        type: 'harvest',
        title: '🌙 离线结算',
        content: `离开 ${timeStr}，${settledCount} 朵花生长了，其中 ${maturedCount} 朵已成熟，快去收获！`,
      })
    }

    return jsonResponse(true, {
      user: sanitizeUser(updated),
      timeAwayMs: awayMs,
      timeStr,
      settledCount,
      maturedCount,
      flowers: settleResults,
      message: maturedCount > 0
        ? `🌙 离线 ${timeStr}，${maturedCount} 朵花成熟啦！`
        : `🌙 离线 ${timeStr}，${settledCount} 朵花共生长 ${Math.round(totalAdded)}%`,
    })
  } catch (e: any) {
    logger.error('garden', '离线结算异常', { error: e?.message })
    return jsonResponse(false, null, e.message, 500)
  }
}
