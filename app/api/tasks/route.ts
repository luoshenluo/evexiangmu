import { NextRequest } from 'next/server'
import { updateUser, ensureSeasonTick } from '@/lib/server-store'
import { authRequest, sanitizeUser, jsonResponse } from '@/lib/auth'

export const runtime = 'edge'

// 简化版：返回固定任务列表（MVP）
const TASK_TEMPLATES: any[] = [
  { id: 't_daily_1', type: 'daily', title: '登录游戏', description: '今日首次登录游戏', target: 1, rewards: { coins: 20 } },
  { id: 't_daily_2', type: 'daily', title: '勤劳花农', description: '种植或打理花朵3次', target: 3, rewards: { coins: 30 } },
  { id: 't_daily_3', type: 'daily', title: '收获季节', description: '收获任意 2 朵花', target: 2, rewards: { coins: 50, items: [{ referenceId: 'seed_rose', type: 'seed', quantity: 1 }] } },
  { id: 't_daily_4', type: 'daily', title: '贸易达人', description: '在市场完成 1 次交易', target: 1, rewards: { coins: 40 } },
  { id: 't_daily_5', type: 'daily', title: '聊天爱好者', description: '在世界频道发言 3 次', target: 3, rewards: { coins: 20 } },
  { id: 't_weekly_1', type: 'weekly', title: '周常·花园扩张', description: '解锁或打理共 10 次', target: 10, rewards: { coins: 200, items: [{ referenceId: 'seed_plum', type: 'seed', quantity: 2 }] } },
  { id: 't_weekly_2', type: 'weekly', title: '周常·富豪', description: '累计获得 500 金币', target: 500, rewards: { coins: 100 } },
  { id: 't_monthly_1', type: 'monthly', title: '月常·大收藏家', description: '收获 20 朵花', target: 20, rewards: { coins: 1000, items: [{ referenceId: 'seed_plum', type: 'seed', quantity: 5 }] } },
]

const userTaskProgress: Record<string, Record<string, number>> = {}

export async function GET(req: NextRequest) {
  try {
    const user = await authRequest(req)
    if (!user) return jsonResponse(false, null, '请先登录', 401)

    const progress = userTaskProgress[user.id] || {
      t_daily_1: 1, t_daily_2: 1, t_daily_3: 1, t_daily_4: 0, t_daily_5: 2,
      t_weekly_1: 3, t_weekly_2: 200, t_monthly_1: 4,
    }
    userTaskProgress[user.id] = progress

    const claimed: Record<string, boolean> = (globalThis as any).__claimedTasks?.[user.id] || {}

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
    return jsonResponse(false, null, e.message, 500)
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await authRequest(req)
    if (!user) return jsonResponse(false, null, '请先登录', 401)

    const { taskId } = await req.json()
    const task = TASK_TEMPLATES.find(t => t.id === taskId)
    if (!task) return jsonResponse(false, null, '任务不存在', 404)

    const progress = (userTaskProgress[user.id] || {})[taskId] || 0
    if (progress < task.target) return jsonResponse(false, null, '任务未完成', 400)

    const claimedStore = (globalThis as any).__claimedTasks = (globalThis as any).__claimedTasks || {}
    claimedStore[user.id] = claimedStore[user.id] || {}
    if (claimedStore[user.id][taskId]) return jsonResponse(false, null, '奖励已领取', 400)
    claimedStore[user.id][taskId] = true

    // 发放奖励
    let newInv = [...user.inventory]
    let coins = user.coins + (task.rewards.coins || 0)

    if (task.rewards.items) {
      for (const reward of task.rewards.items) {
        const existing = newInv.find(
          i => i.type === reward.type && i.referenceId === reward.referenceId && i.quantity < i.maxStack
        )
        if (existing) {
          newInv = newInv.map(i => i.id === existing.id ? { ...i, quantity: i.quantity + reward.quantity } : i)
        } else {
          const isSeed = reward.type === 'seed'
          const name = isSeed ? (reward.referenceId.includes('rose') ? '玫瑰种子' : reward.referenceId.includes('plum') ? '梅花种子' : '种子') : '道具'
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
      }
    }

    const updated = await updateUser(user.id, { coins, inventory: newInv })
    return jsonResponse(true, { user: sanitizeUser(updated) })
  } catch (e: any) {
    return jsonResponse(false, null, e.message, 500)
  }
}
