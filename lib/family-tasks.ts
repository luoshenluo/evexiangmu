// 家族任务模板与进度存储（进程内，适用于单机开发；生产环境建议落库）
export const FAMILY_TASK_TEMPLATES = [
  { id: 't_plant', title: '家族种植达人', desc: '所有成员合计种植 30 棵植物', target: 30, rewardCoins: 80 },
  { id: 't_checkin', title: '家族签到热潮', desc: '所有成员合计签到 10 次', target: 10, rewardCoins: 50 },
  { id: 't_coin', title: '家族财富累积', desc: '所有成员合计获得 5000 金币', target: 5000, rewardCoins: 100 },
  { id: 't_trade', title: '家族贸易繁荣', desc: '市场交易成交 5 笔', target: 5, rewardCoins: 120 },
]

const familyTasksStore: Record<string, { progress: Record<string, number>; claimed: Record<string, string[]> }> = {}

export function getOrInitFamilyStore(familyId: string) {
  if (!familyTasksStore[familyId]) {
    familyTasksStore[familyId] = { progress: {}, claimed: {} }
  }
  return familyTasksStore[familyId]
}

export function computeFamilyTasks(familyId: string) {
  const store = getOrInitFamilyStore(familyId)
  return FAMILY_TASK_TEMPLATES.map(t => {
    const progress = store.progress[t.id] || 0
    const claimedBy = store.claimed[t.id] || []
    return {
      id: t.id,
      title: t.title,
      desc: t.desc,
      target: t.target,
      rewardCoins: t.rewardCoins,
      progress,
      claimedBy,
    }
  })
}

export function bumpFamilyTaskProgress(familyId: string, taskId: string, delta: number) {
  const store = getOrInitFamilyStore(familyId)
  store.progress[taskId] = (store.progress[taskId] || 0) + delta
}

export function claimFamilyTask(familyId: string, taskId: string, userId: string): { success: boolean; error?: string; rewardCoins?: number } {
  const store = getOrInitFamilyStore(familyId)
  const tpl = FAMILY_TASK_TEMPLATES.find(t => t.id === taskId)
  if (!tpl) return { success: false, error: '任务不存在' }
  if ((store.progress[taskId] || 0) < tpl.target) return { success: false, error: '任务未达成' }
  const claimed = store.claimed[taskId] || []
  if (claimed.includes(userId)) return { success: false, error: '你已领取过该任务奖励' }
  store.claimed[taskId] = [...claimed, userId]
  return { success: true, rewardCoins: tpl.rewardCoins }
}
