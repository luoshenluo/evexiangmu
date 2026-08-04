import { NextRequest } from 'next/server'
import { findCDK, redeemCDK, updateUser, ensureSeasonTick } from '@/lib/server-store'
import type { InventoryItem } from '@/lib/types'
import { authRequest, sanitizeUser, jsonResponse } from '@/lib/auth'

export const runtime = 'edge'

export async function POST(req: NextRequest) {
  try {
    const user = await authRequest(req)
    if (!user) return jsonResponse(false, null, '请先登录', 401)

    const { code } = await req.json()
    if (!code) return jsonResponse(false, null, '请输入 CDK', 400)

    const cdk = await redeemCDK(code.toUpperCase(), user.id)
    if (!cdk) return jsonResponse(false, null, 'CDK 无效或已用完', 400)

    // 发放奖励
    let newInv = [...user.inventory]
    let coins = user.coins + (cdk.rewards.coins || 0)

    if (cdk.rewards.items) {
      for (const reward of cdk.rewards.items) {
        const existing = newInv.find(
          i => i.type === reward.type && i.referenceId === reward.referenceId && i.quantity < i.maxStack
        )
        if (existing) {
          newInv = newInv.map(i => i.id === existing.id ? { ...i, quantity: i.quantity + reward.quantity } : i)
        } else {
          const isSeed = reward.type === 'seed'
          newInv.push({
            id: `cdk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            type: reward.type as any,
            referenceId: reward.referenceId,
            name: isSeed ? 'CDK种子' : 'CDK道具',
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
