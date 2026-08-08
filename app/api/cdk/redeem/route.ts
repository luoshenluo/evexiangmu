import { NextRequest } from 'next/server'
import { findCDK, redeemCDK, updateUser, ensureSeasonTick, createNotification } from '@/lib/server-store'
import { FLOWER_TYPES, SEED_TYPES, TOOLS } from '@/lib/game-data'
import type { InventoryItem } from '@/lib/types'
import { authRequest, sanitizeUser, jsonResponse } from '@/lib/auth'

export const runtime = 'edge'

const TITLE_NAMES: Record<string, string> = {
  newbie: '🌱 种花新人',
  green_hand: '🌿 园艺新秀',
  expert: '🌻 种花专家',
  master: '🌹 花园大师',
  legend: '👑 传奇园丁',
  first_blood: '⚔️ 首战告捷',
  wealthy: '💰 小富即安',
  philanthropist: '🎁 慷慨之心',
  checkin_dragon: '🐉 签到达人',
}

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
    let petalCoins = (user.petalCoins || 0) + (cdk.rewards.petalCoins || 0)

    if (cdk.rewards.items) {
      for (const reward of cdk.rewards.items) {
        let displayName = reward.name || 'CDK道具'
        let displayEmoji = reward.emoji || '🎁'
        const typeLower = String(reward.type || '').toLowerCase()
        if (typeLower === 'seed') {
          const seed = (SEED_TYPES as any[]).find((s: any) => s.id === reward.referenceId)
          if (seed) { displayName = seed.name; displayEmoji = seed.emoji || '🌱' }
        } else if (typeLower === 'flower') {
          const f = (FLOWER_TYPES as any[]).find((x: any) => x.id === reward.referenceId)
          if (f) { displayName = f.name; displayEmoji = f.emoji }
        } else if (typeLower === 'tool') {
          const t = (TOOLS as any[]).find((x: any) => x.id === reward.referenceId)
          if (t) { displayName = t.name; displayEmoji = t.emoji || '🧰' }
        }

        const existing = newInv.find(
          i => i.type === reward.type && i.referenceId === reward.referenceId && (i.quantity || 0) < (i.maxStack || 99)
        )
        if (existing) {
          newInv = newInv.map(i => i.id === existing.id ? { ...i, quantity: (i.quantity || 0) + reward.quantity } : i)
        } else {
          newInv.push({
            id: `cdk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            type: reward.type as any,
            referenceId: reward.referenceId,
            name: displayName,
            emoji: displayEmoji,
            quantity: reward.quantity,
            maxStack: 99,
            sellable: typeLower !== 'seed',
            tradeable: true,
          })
        }
      }
    }

    // 发放称号（去重追加）
    let newTitles = Array.isArray((user as any).titles) ? [...((user as any).titles)] : []
    if (Array.isArray(cdk.rewards.titles) && cdk.rewards.titles.length > 0) {
      for (const t of cdk.rewards.titles) {
        if (!newTitles.includes(t)) newTitles.push(t)
      }
    }

    const patch: any = {
      coins,
      petalCoins,
      inventory: newInv,
    }
    if (cdk.rewards.titles && cdk.rewards.titles.length > 0) patch.titles = newTitles

    const updated = await updateUser(user.id, patch)

    const rewardParts: string[] = []
    if (cdk.rewards.coins) rewardParts.push(`${cdk.rewards.coins} 💰`)
    if (cdk.rewards.petalCoins) rewardParts.push(`${cdk.rewards.petalCoins} 🌸`)
    if (cdk.rewards.titles) {
      for (const tk of cdk.rewards.titles) rewardParts.push(TITLE_NAMES[tk] || `称号[${tk}]`)
    }
    if (cdk.rewards.items) {
      for (const item of cdk.rewards.items) {
        rewardParts.push(`×${item.quantity} ${item.name || item.referenceId}`)
      }
    }
    await createNotification({
      userId: user.id,
      type: 'cdk_redeem',
      title: '🎉 CDK 兑换成功',
      content: `兑换码 ${code.toUpperCase()} 使用成功，获得: ${rewardParts.join('，')}`,
    })

    return jsonResponse(true, { user: sanitizeUser(updated), rewards: cdk.rewards, message: `兑换成功！获得 ${rewardParts.join('，')}` })
  } catch (e: any) {
    return jsonResponse(false, null, e.message, 500)
  }
}
