import { NextRequest } from 'next/server'
import { updateUser, findUserById, incrementTaskProgress } from '@/lib/server-store'
import { authRequest, sanitizeUser, jsonResponse } from '@/lib/auth'
import { logger } from '@/lib/logger'

export const runtime = 'edge'

const TASK_TEMPLATES: any[] = [
  { id: 't_daily_1', type: 'daily', title: '登录游戏', description: '今日首次登录游戏', target: 1, rewards: { coins: 10 } },
  { id: 't_daily_2', type: 'daily', title: '勤劳花农', description: '种植或打理花朵3次', target: 3, rewards: { coins: 15 } },
  { id: 't_daily_3', type: 'daily', title: '收获季节', description: '收获任意 2 朵花', target: 2, rewards: { coins: 25, items: [{ referenceId: 'seed_rose', type: 'seed', quantity: 1 }] } },
  { id: 't_daily_4', type: 'daily', title: '贸易达人', description: '在市场完成 1 次交易', target: 1, rewards: { coins: 20 } },
  { id: 't_daily_5', type: 'daily', title: '聊天爱好者', description: '在世界频道发言 3 次', target: 3, rewards: { coins: 10 } },
  { id: 't_weekly_1', type: 'weekly', title: '周常·花园扩张', description: '解锁或打理共 10 次', target: 10, rewards: { coins: 80, items: [{ referenceId: 'seed_plum', type: 'seed', quantity: 1 }] } },
  { id: 't_weekly_2', type: 'weekly', title: '周常·富豪', description: '累计获得 500 金币', target: 500, rewards: { coins: 50 } },
  { id: 't_monthly_1', type: 'monthly', title: '月常·大收藏家', description: '收获 20 朵花', target: 20, rewards: { coins: 300, items: [{ referenceId: 'seed_plum', type: 'seed', quantity: 3 }] } },
]

function getPeriodStart(type: string): number {
  const now = new Date()
  if (type === 'daily') {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  }
  if (type === 'weekly') {
    const day = now.getDay() || 7
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() - day + 1).getTime()
  }
  if (type === 'monthly') {
    return new Date(now.getFullYear(), now.getMonth(), 1).getTime()
  }
  return 0
}

function getTaskType(taskId: string): string {
  if (taskId.includes('daily')) return 'daily'
  if (taskId.includes('weekly')) return 'weekly'
  if (taskId.includes('monthly')) return 'monthly'
  return 'daily'
}

function checkAndResetTasks(user: any): { progress: Record<string, number>; claimed: Record<string, boolean>; lastReset: Record<string, number> } {
  const progress = { ...(user.taskProgress || {}) }
  const claimed = { ...(user.taskClaimed || {}) }
  const lastReset = { ...(user.taskLastReset || {}) }

  for (const task of TASK_TEMPLATES) {
    const type = task.type
    const periodStart = getPeriodStart(type)
    const resetKey = type

    if (!lastReset[resetKey] || lastReset[resetKey] < periodStart) {
      const taskTypePrefix = type === 'daily' ? 't_daily_' : type === 'weekly' ? 't_weekly_' : 't_monthly_'
      for (const key of Object.keys(progress)) {
        if (key.startsWith(taskTypePrefix)) {
          progress[key] = 0
          delete claimed[key]
        }
      }
      lastReset[resetKey] = periodStart
    }
  }

  return { progress, claimed, lastReset }
}

export async function GET(req: NextRequest) {
  try {
    const user = await authRequest(req)
    if (!user) return jsonResponse(false, null, '请先登录', 401)

    // 进入任务页时先推进一次登录任务（幂等：目标是 1，多次调用不会超过 target）
    try { await incrementTaskProgress(user.id, 'login', 1) } catch {}

    // 从数据库获取最新用户数据，确保任务数据是最新的
    const freshUser = await findUserById(user.id)
    if (!freshUser) return jsonResponse(false, null, '用户不存在', 404)

    const { progress, claimed, lastReset } = checkAndResetTasks(freshUser)

    // 如果有重置，保存回数据库
    const needSave = JSON.stringify(progress) !== JSON.stringify(freshUser.taskProgress || {}) ||
                     JSON.stringify(claimed) !== JSON.stringify(freshUser.taskClaimed || {})
    if (needSave) {
      await updateUser(freshUser.id, { taskProgress: progress, taskClaimed: claimed, taskLastReset: lastReset })
    }

    const tasks = TASK_TEMPLATES.map(t => {
      const prog = progress[t.id] || 0
      const completed = prog >= t.target
      return {
        ...t,
        progress: prog,
        completed,
        claimed: !!claimed[t.id],
      }
    })

    return jsonResponse(true, tasks)
  } catch (e: any) {
    logger.error('tasks', '获取任务列表失败', { error: e?.message })
    return jsonResponse(false, null, e?.message || '获取任务失败', 500)
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await authRequest(req)
    if (!user) return jsonResponse(false, null, '请先登录', 401)

    let body: any
    try {
      body = await req.json()
    } catch {
      return jsonResponse(false, null, '请求格式错误', 400)
    }

    const taskId = body?.taskId
    if (!taskId) return jsonResponse(false, null, '缺少任务ID', 400)

    const task = TASK_TEMPLATES.find(t => t.id === taskId)
    if (!task) return jsonResponse(false, null, '任务不存在', 404)

    // 从数据库获取最新用户数据
    const freshUser = await findUserById(user.id)
    if (!freshUser) return jsonResponse(false, null, '用户不存在', 404)

    // 检查并重置过期任务
    const { progress, claimed, lastReset } = checkAndResetTasks(freshUser)

    // 检查任务进度
    const currentProgress = progress[taskId] || 0
    if (currentProgress < task.target) return jsonResponse(false, null, '任务未完成', 400)

    // 检查是否已领取
    if (claimed[taskId]) return jsonResponse(false, null, '奖励已领取', 400)

    // 标记为已领取
    claimed[taskId] = true

    // 发放奖励
    const newInv = [...(freshUser.inventory || [])]
    const coins = (freshUser.coins || 0) + (task.rewards.coins || 0)

    const rewardDetails: string[] = []
    if (task.rewards.coins) rewardDetails.push(`💰 ${task.rewards.coins} 金币`)

    if (task.rewards.items) {
      for (const reward of task.rewards.items) {
        const isSeed = reward.type === 'seed'
        const seedNames: Record<string, string> = {
          'seed_rose': '玫瑰种子', 'seed_tulip': '郁金香种子',
          'seed_daisy': '雏菊种子', 'seed_plum': '梅花种子',
          'seed_sunflower': '向日葵种子', 'seed_chrysanthemum': '菊花种子',
        }
        const name = seedNames[reward.referenceId] || (isSeed ? '种子' : '道具')

        const existing = newInv.find(
          i => i && i.type === reward.type && i.referenceId === reward.referenceId
        )
        if (existing) {
          const idx = newInv.indexOf(existing)
          newInv[idx] = { ...existing, quantity: (existing.quantity || 0) + reward.quantity }
        } else {
          newInv.push({
            id: `reward_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            type: reward.type as any,
            referenceId: reward.referenceId,
            name,
            emoji: isSeed ? '🌱' : '🎁',
            quantity: reward.quantity,
            maxStack: 99,
            sellable: !isSeed,
            tradeable: true,
          })
        }
        rewardDetails.push(`${isSeed ? '🌱' : '🎁'} ${name} × ${reward.quantity}`)
      }
    }

    const updated = await updateUser(freshUser.id, {
      coins,
      inventory: newInv,
      taskProgress: progress,
      taskClaimed: claimed,
      taskLastReset: lastReset,
    })

    if (!updated) {
      logger.error('tasks', '更新用户失败', { userId: freshUser.id, taskId })
      return jsonResponse(false, null, '更新用户数据失败', 500)
    }

    logger.info('tasks', '任务奖励领取', { userId: freshUser.id, taskId, coins: task.rewards.coins })

    // 周常·富豪：领取到的金币计入"累计获得"
    try { if (task.rewards.coins > 0) await incrementTaskProgress(freshUser.id, 'earn_coin', task.rewards.coins) } catch {}

    return jsonResponse(true, {
      user: sanitizeUser(updated),
      rewards: {
        coins: task.rewards.coins || 0,
        items: task.rewards.items || [],
        details: rewardDetails,
      },
      message: `🎁 领取成功！获得 ${rewardDetails.join('，')}`,
    })
  } catch (e: any) {
    logger.error('tasks', '领取任务奖励失败', { error: e?.message })
    return jsonResponse(false, null, e?.message || '服务器内部错误', 500)
  }
}
