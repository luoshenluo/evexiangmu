import { NextRequest } from 'next/server'
import { updateUser, findUserById, createNotification } from '@/lib/server-store'
import { authRequest, jsonResponse, sanitizeUser } from '@/lib/auth'
import { WHEEL_REWARDS, pickWheelIndex } from '@/lib/game-data'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  try {
    const user = await authRequest(req)
    if (!user) return jsonResponse(false, null, '请先登录', 401)
    const u: any = await findUserById(user.id)
    return jsonResponse(true, {
      petalCoins: u?.petalCoins || 0,
      rewards: WHEEL_REWARDS.map(r => ({ key: r.key, label: r.label, weight: r.weight, coins: r.coins, petals: r.petals })),
      costPerSpin: 1,
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
    const cost = times // 1 花瓣/次
    if ((u.petalCoins || 0) < cost) return jsonResponse(false, null, `花瓣不足，每次抽奖需要 ${cost} 花瓣`, 400)

    const results: number[] = []
    let totalCoins = 0, totalPetals = 0
    for (let i = 0; i < times; i++) {
      const idx = pickWheelIndex()
      results.push(idx)
      totalCoins += WHEEL_REWARDS[idx].coins
      totalPetals += WHEEL_REWARDS[idx].petals || 0
    }
    const patch: any = {
      petalCoins: (u.petalCoins || 0) - cost + totalPetals,
      coins: (u.coins || 0) + totalCoins,
    }
    const updated = await updateUser(u.id, patch)

    const lastIdx = results[results.length - 1]
    await createNotification({
      userId: u.id,
      type: 'reward',
      title: times > 1 ? `幸运转盘 x${times}` : '幸运转盘',
      content: `共获得 ${totalCoins} 金币${totalPetals ? ` + ${totalPetals} 花瓣` : ''}，最后一次：${WHEEL_REWARDS[lastIdx].label}`,
    })

    return jsonResponse(true, {
      user: updated ? sanitizeUser(updated) : null,
      results,
      totalCoins,
      totalPetals,
      netCost: cost - totalPetals,
    })
  } catch (e: any) {
    return jsonResponse(false, null, e.message, 500)
  }
}
