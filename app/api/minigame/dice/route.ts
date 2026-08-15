import { NextRequest } from 'next/server'
import { findUserById, createNotification, atomicSpendPetals, atomicAddPetals, atomicAddCoins } from '@/lib/server-store'
import { authRequest, jsonResponse, sanitizeUser } from '@/lib/auth'

export const runtime = 'edge'

// 猜大小游戏：消耗花瓣，猜中数字范围赢奖励
export async function POST(req: NextRequest) {
  try {
    const user = await authRequest(req)
    if (!user) return jsonResponse(false, null, '请先登录', 401)
    const u: any = await findUserById(user.id)
    if (!u) return jsonResponse(false, null, '用户不存在', 404)

    const body = await req.json()
    const betType = (body?.betType || 'middle') as 'small' | 'big' | 'middle' | 'exact'
    const betAmount = Math.max(1, Math.min(50, Number(body?.betAmount || 1)))
    const target = body?.target !== undefined ? Number(body.target) : undefined

    // 原子扣减花瓣（防并发超扣）：仅当余额足够时成功
    const spent = await atomicSpendPetals(u.id, betAmount)
    if (!spent) return jsonResponse(false, null, `花瓣不足，需要 ${betAmount} 花瓣`, 400)

    // 骰子结果 1..6
    const d1 = Math.floor(Math.random() * 6) + 1
    const d2 = Math.floor(Math.random() * 6) + 1
    const sum = d1 + d2

    let win = false
    let multiplier = 0
    switch (betType) {
      case 'small':
        win = sum >= 2 && sum <= 6
        multiplier = win ? 2 : 0
        break
      case 'big':
        win = sum >= 8 && sum <= 12
        multiplier = win ? 2 : 0
        break
      case 'middle':
        win = sum === 7
        multiplier = win ? 4 : 0
        break
      case 'exact':
        win = target !== undefined && sum === target
        multiplier = win ? 18 : 0
        break
    }

    const netPetals = win ? betAmount * multiplier : 0
    const netCoins = win ? Math.floor(betAmount * multiplier * 5) : 0

    // 原子发放奖励（只加不减，不会覆盖并发扣减结果）
    if (netPetals > 0) await atomicAddPetals(u.id, netPetals)
    if (netCoins > 0) await atomicAddCoins(u.id, netCoins)

    // 重新读取最新余额返回
    const fresh = await findUserById(u.id)

    await createNotification({
      userId: u.id,
      type: 'reward',
      title: `猜大小 ${win ? '命中' : '未中'}`,
      content: `骰子 ${d1} + ${d2} = ${sum}，下注 ${betType}，${win ? `获得 ${netPetals} 花瓣 + ${netCoins} 金币` : `损失 ${betAmount} 花瓣`}`,
    })

    return jsonResponse(true, {
      user: fresh ? sanitizeUser(fresh) : null,
      dice: [d1, d2],
      sum,
      won: win,
      netPetals: win ? netPetals : -betAmount,
      netCoins,
      multiplier,
    })
  } catch (e: any) {
    return jsonResponse(false, null, e.message, 500)
  }
}