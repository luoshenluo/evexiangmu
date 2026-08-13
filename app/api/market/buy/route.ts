import { NextRequest } from 'next/server'
import { findListing, removeListing, updateListingQuantity, atomicDecreaseListing, updateUser, findUserById, ensureSeasonTick, createNotification, incrementTaskProgress } from '@/lib/server-store'
import { FLOWER_TYPES, SEED_TYPES, TOOLS } from '@/lib/game-data'
import type { InventoryItem } from '@/lib/types'
import { authRequest, sanitizeUser, jsonResponse } from '@/lib/auth'

export const runtime = 'edge'

export async function POST(req: NextRequest) {
  try {
    await ensureSeasonTick()
    const user = await authRequest(req)
    if (!user) return jsonResponse(false, null, '请先登录', 401)

    const { listingId, quantity } = await req.json()
    if (!listingId || !quantity) return jsonResponse(false, null, '参数错误', 400)
    if (!Number.isInteger(quantity) || quantity < 1) return jsonResponse(false, null, '数量无效', 400)

    const listing = await findListing(listingId)
    if (!listing) return jsonResponse(false, null, '商品不存在', 404)
    if (listing.quantity < quantity) return jsonResponse(false, null, '库存不足', 400)

    const totalCost = listing.price * quantity
    if (user.coins < totalCost) return jsonResponse(false, null, '金币不足', 400)

    // 添加物品到背包
    let newInventory = [...user.inventory]
    for (let i = 0; i < quantity; i++) {
      let baseInfo: any = null
      if (listing.itemType === 'flower') {
        baseInfo = FLOWER_TYPES.find(f => f.id === listing.referenceId)
      } else if (listing.itemType === 'seed') {
        baseInfo = SEED_TYPES.find(s => s.id === listing.referenceId)
      } else if (listing.itemType === 'tool') {
        baseInfo = TOOLS.find(t => t.id === listing.referenceId)
      }
      if (!baseInfo) continue

      const existing = newInventory.find(
        it => it.type === listing.itemType
          && it.referenceId === listing.referenceId
          && (listing.itemType !== 'flower' || it.rank === (listing.rank || 1))
          && it.quantity < it.maxStack
      )
      if (existing) {
        newInventory = newInventory.map(it => it.id === existing.id ? { ...it, quantity: it.quantity + 1 } : it)
      } else {
        if (newInventory.filter(it => it.quantity > 0).length >= user.inventorySize) {
          return jsonResponse(false, null, '背包已满，请先清理或扩容', 400)
        }
        newInventory.push({
          id: `inv_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 5)}`,
          type: listing.itemType,
          referenceId: listing.referenceId,
          name: listing.name,
          emoji: listing.emoji,
          rank: listing.itemType === 'flower' ? listing.rank : undefined,
          quantity: 1,
          maxStack: 99,
          sellable: listing.itemType !== 'seed',
          tradeable: true,
        })
      }
    }

    // 更新 listing 库存（原子扣减，防并发超卖）——必须在任何发奖/扣款之前
    if (listing.isOfficial && listing.sellerId === 'system') {
      // 官方商品不减库存（无限供应）
    } else {
      const decreased = await atomicDecreaseListing(listingId, quantity)
      if (!decreased) {
        return jsonResponse(false, null, '商品已被抢购，请重试', 409)
      }
      const refreshed = await findListing(listingId)
      if (refreshed && refreshed.quantity <= 0) {
        await removeListing(listingId).catch(() => {})
      }
    }

    // 如果是玩家挂售，给卖家金币
    if (!listing.isOfficial && listing.sellerId !== 'system') {
      const seller = await findUserById(listing.sellerId)
      if (seller) {
        const sellerCoins = Math.floor(totalCost * 0.95) // 5% 手续费
        await updateUser(seller.id, { coins: seller.coins + sellerCoins })

        // 卖家任务：贸易达人（日） + 周常富豪（累计获得金币）
        try { await incrementTaskProgress(seller.id, 'trade', 1) } catch {}
        try { if (sellerCoins > 0) await incrementTaskProgress(seller.id, 'earn_coin', sellerCoins) } catch {}
      }
    }

    const updatedUser = await updateUser(user.id, {
      coins: user.coins - totalCost,
      inventory: newInventory.filter(i => i.quantity > 0 || true),
    })

    await createNotification({
      userId: user.id,
      type: 'purchase',
      title: '🛒 购买成功',
      content: `购买了 ${listing.name} × ${quantity}，花费 ${totalCost} 💰`,
    })

    // 买家任务：贸易达人（日）
    try { await incrementTaskProgress(user.id, 'trade', 1) } catch {}

    return jsonResponse(true, { user: sanitizeUser(updatedUser), message: `购买成功！获得 ${listing.name} × ${quantity}` })
  } catch (e: any) {
    return jsonResponse(false, null, e.message, 500)
  }
}
