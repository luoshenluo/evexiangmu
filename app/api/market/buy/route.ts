import { NextRequest } from 'next/server'
import { findListing, removeListing, updateListingQuantity, updateUser, findUserById, ensureSeasonTick } from '@/lib/server-store'
import { FLOWER_TYPES, SEED_TYPES } from '@/lib/game-data'
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
    if (quantity < 1) return jsonResponse(false, null, '数量无效', 400)

    const listing = await findListing(listingId)
    if (!listing) return jsonResponse(false, null, '商品不存在', 404)
    if (listing.quantity < quantity) return jsonResponse(false, null, '库存不足', 400)

    const totalCost = listing.price * quantity
    if (user.coins < totalCost) return jsonResponse(false, null, '金币不足', 400)

    // 添加物品到背包
    let newInventory = [...user.inventory]
    for (let i = 0; i < quantity; i++) {
      const baseInfo = listing.itemType === 'flower'
        ? FLOWER_TYPES.find(f => f.id === listing.referenceId)
        : SEED_TYPES.find(s => s.id === listing.referenceId)
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
          rank: listing.rank,
          quantity: 1,
          maxStack: 99,
          sellable: listing.itemType !== 'seed',
          tradeable: true,
        })
      }
    }

    // 如果是玩家挂售，给卖家金币
    if (!listing.isOfficial && listing.sellerId !== 'system') {
      const seller = await findUserById(listing.sellerId)
      if (seller) {
        await updateUser(seller.id, { coins: seller.coins + totalCost * 0.95 }) // 5% 手续费
      }
    }

    // 更新 listing 库存
    if (listing.isOfficial && listing.sellerId === 'system') {
      // 官方商品不减库存（无限供应）
    } else {
      if (listing.quantity - quantity <= 0) {
        await removeListing(listingId)
      } else {
        await updateListingQuantity(listingId, listing.quantity - quantity)
      }
    }

    const updatedUser = await updateUser(user.id, {
      coins: user.coins - totalCost,
      inventory: newInventory.filter(i => i.quantity > 0 || true),
    })
    return jsonResponse(true, { user: sanitizeUser(updatedUser) })
  } catch (e: any) {
    return jsonResponse(false, null, e.message, 500)
  }
}
