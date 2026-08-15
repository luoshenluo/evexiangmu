import { NextRequest } from 'next/server'
import { findUserById, createNotification, atomicSpendPetals, atomicAddCoins } from '@/lib/server-store'
import { authRequest, jsonResponse, sanitizeUser } from '@/lib/auth'

export const runtime = 'edge'

// 猜大小游戏：消耗花瓣，猜中数字范围赢金币（不发花瓣，单次最多 50 金币）
const DICE_BET = 5 // 固定下注 5 花瓣
// 赔率：小/大 ×2、7 ×5、精确 ×10
const DICE_MULTIPLIERS: Record<string, number> = {
  small: 2,
  big: 2,
  middle: 5,
  exact: 10,
}
const DICE_MAX_COINS = 50 // 单次命中最多 50 金币

export async function POST(req: NextRequest) {
  try {
    const user = await authRequest(req)
    if (!user) return jsonResponse(false, null, '请先登录', 401)
    const u: any = await findUserById(user.id)
    if (!u) return jsonResponse(false, null, '用户不存在', 404)

    const body = await req.json()
    const betType = (body?.betType || 'middle') as 'small' | 'big' | 'middle' | 'exact'
    const betAmount = DICE_BET // 固定 5 花瓣
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
        multiplier = win ? DICE_MULTIPLIERS.small : 0
        break
      case 'big':
        win = sum >= 8 && sum <= 12
        multiplier = win ? DICE_MULTIPLIERS.big : 0
        break
      case 'middle':
        win = sum === 7
        multiplier = win ? DICE_MULTIPLIERS.middle : 0
        break
      case 'exact':
        win = target !== undefined && sum === target
        multiplier = win ? DICE_MULTIPLIERS.exact : 0
        break
    }

    // 命中：只发金币（押注 × 赔率，封顶 50）
    const netCoins = win ? Math.min(DICE_MAX_COINS, betAmount * multiplier) : 0

    // 原子发放金币（只加不减，不会覆盖并发扣减结果）
    if (netCoins > 0) await atomicAddCoins(u.id, netCoins)

    // 重新读取最新余额返回
    const fresh = await findUserById(u.id)

    await createNotification({
      userId: u.id,
      type: 'reward',
      title: `猜大小 ${win ? '命中' : '未中'}`,
      content: `骰子 ${d1} + ${d2} = ${sum}，下注 ${betType}，${win ? `获得 ${netCoins} 金币` : `损失 ${betAmount} 花瓣`}`,
    })

    return jsonResponse(true, {
      user: fresh ? sanitizeUser(fresh) : null,
      dice: [d1, d2],
      sum,
      won: win,
      netPetals: win ? 0 : -betAmount,
      netCoins,
      multiplier,
    })
  } catch (e: any) {
    return jsonResponse(false, null, e.message, 500)
  }
}