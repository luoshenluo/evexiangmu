import { NextRequest } from 'next/server'
import { updateUser, findUserById, createNotification, atomicSpendPetals } from '@/lib/server-store'
import { authRequest, jsonResponse, sanitizeUser } from '@/lib/auth'
import { WHEEL_REWARDS, pickWheelIndex, FLOWER_TYPES, SEED_TYPES } from '@/lib/game-data'

export const runtime = 'edge'

// 每次抽奖消耗的花瓣数（花瓣回收机制）
const COST_PER_SPIN = 10

// 种子奖励的默认名称映射
const SEED_NAMES: Record<string, string> = {
  'seed_rose': '玫瑰种子', 'seed_tulip': '郁金香种子', 'seed_daisy': '雏菊种子',
  'seed_plum': '梅花种子', 'seed_sunflower': '向日葵种子', 'seed_chrysanthemum': '菊花种子',
  'seed_cherry': '樱花种子', 'seed_lotus': '荷花种子',
}

// 根据奖励生成背包物品（seed/flower），不发放则返回 null
function buildRewardItem(reward: (typeof WHEEL_REWARDS)[number]) {
  if (reward.itemType === 'seed' && reward.referenceId) {
    const seed = SEED_TYPES.find(s => s.id === reward.referenceId)
    return {
      id: `wheel_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: 'seed' as const,
      referenceId: reward.referenceId,
      name: seed?.name || SEED_NAMES[reward.referenceId] || '种子',
      emoji: '🌱',
      quantity: reward.quantity || 1,
      maxStack: 99,
      sellable: false,
      tradeable: true,
    }
  }
  if (reward.itemType === 'flower') {
    // 随机花朵：随机选一种当季适种的花
    const randomFlower = FLOWER_TYPES[Math.floor(Math.random() * FLOWER_TYPES.length)]
    // flower_common → rank1，flower_rare → rank3
    const rank: 1 | 3 = reward.key === 'flower_rare' ? 3 : 1
    return {
      id: `wheel_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      type: 'flower' as const,
      referenceId: randomFlower.id,
      name: randomFlower.name,
      emoji: randomFlower.emoji,
      rank,
      quantity: reward.quantity || 1,
      maxStack: 99,
      sellable: false,
      tradeable: true,
    }
  }
  return null
}

export async function GET(req: NextRequest) {
  try {
    const user = await authRequest(req)
    if (!user) return jsonResponse(false, null, '请先登录', 401)
    const u: any = await findUserById(user.id)
    return jsonResponse(true, {
      petalCoins: u?.petalCoins || 0,
      rewards: WHEEL_REWARDS.map(r => ({ key: r.key, label: r.label, weight: r.weight, coins: r.coins, petals: r.petals })),
      costPerSpin: COST_PER_SPIN,
    })
  } catch (e: any) {
    return jsonResponse(false, null, e.message, 500)
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await authRequest(req)
    if (!user) return jsonResponse(false, null, '请先登录', 401)
    const u: any = await findUserById(user.id)
    if (!u) return jsonResponse(false, null, '用户不存在', 404)

    const body = await req.json()
    const times = Math.max(1, Math.min(10, Number(body?.times || 1)))
    if (!Number.isFinite(times) || !Number.isInteger(times) || times < 1) {
      return jsonResponse(false, null, '次数无效', 400)
    }
    const cost = times * COST_PER_SPIN // 10 花瓣/次
    if ((u.petalCoins || 0) < cost) return jsonResponse(false, null, `花瓣不足，每次抽奖需要 ${COST_PER_SPIN} 花瓣`, 400)

    // 原子扣减花瓣（防并发超扣）：仅当余额足够时成功
    const spent = await atomicSpendPetals(u.id, cost)
    if (!spent) return jsonResponse(false, null, `花瓣不足，每次抽奖需要 ${COST_PER_SPIN} 花瓣`, 400)

    const results: number[] = []
    let totalCoins = 0, totalPetals = 0
    // 收集需要入背包的种子/花朵奖励
    const itemRewards: ReturnType<typeof buildRewardItem>[] = []
    for (let i = 0; i < times; i++) {
      const idx = pickWheelIndex()
      results.push(idx)
      const reward = WHEEL_REWARDS[idx]
      totalCoins += reward.coins
      totalPetals += reward.petals || 0
      if (reward.itemType) itemRewards.push(buildRewardItem(reward))
    }

    // 原子扣减后重新读取最新花瓣数，避免用旧值覆盖并发扣减结果
    const fresh = await findUserById(u.id)
    const basePetals = fresh?.petalCoins ?? (u.petalCoins || 0)

    // 将种子/花朵奖励合并进背包
    let newInventory = fresh?.inventory ? [...fresh.inventory] : []
    if (itemRewards.length > 0) {
      for (const item of itemRewards) {
        if (!item) continue
        const existing = newInventory.find(
          i => i && i.type === item.type && i.referenceId === item.referenceId && (i.rank || 1) === (item.rank || 1)
        )
        if (existing) {
          newInventory = newInventory.map(i =>
            i.id === existing.id
              ? { ...i, quantity: Math.min(i.maxStack || 99, (i.quantity || 0) + (item.quantity || 1)) }
              : i,
          )
        } else {
          newInventory.push(item)
        }
      }
    }

    const patch: any = {
      petalCoins: basePetals + totalPetals,
      coins: (u.coins || 0) + totalCoins,
    }
    if (newInventory.length > 0) patch.inventory = newInventory
    const updated = await updateUser(u.id, patch)

    const lastIdx = results[results.length - 1]
    const rewardLabels = results.map(idx => WHEEL_REWARDS[idx].label).join('、')
    await createNotification({
      userId: u.id,
      type: 'reward',
      title: times > 1 ? `幸运转盘 x${times}` : '幸运转盘',
      content: `共获得 ${totalCoins} 金币${totalPetals ? ` + ${totalPetals} 花瓣` : ''}${itemRewards.length ? `，物品：${itemRewards.map(i => i?.name).join('、')}` : ''}`,
    })

    return jsonResponse(true, {
      user: updated ? sanitizeUser(updated) : null,
      results,
      totalCoins,
      totalPetals,
      items: itemRewards.map(i => i ? { type: i.type, name: i.name, emoji: i.emoji, quantity: i.quantity } : null).filter(Boolean),
      lastLabel: WHEEL_REWARDS[lastIdx].label,
      netCost: cost - totalPetals,
    })
  } catch (e: any) {
    return jsonResponse(false, null, e.message, 500)
  }
}
