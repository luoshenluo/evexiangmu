import { NextRequest } from 'next/server'
import {
  updateUser, findUserById, ensureSeasonTick, getBuyOrders,
  updateBuyOrderQuantity, atomicDecreaseBuyOrder, addInventoryItem, createNotification, incrementTaskProgress,
} from '@/lib/server-store'
import { authRequest, sanitizeUser, jsonResponse } from '@/lib/auth'

export const runtime = 'edge'

export async function POST(req: NextRequest) {
  try {
    await ensureSeasonTick()
    const user = await authRequest(req)
    if (!user) return jsonResponse(false, null, '请先登录', 401)

    const { orderId, quantity, inventoryItemId } = await req.json()
    if (!orderId || !quantity || !inventoryItemId) return jsonResponse(false, null, '参数错误', 400)
    if (!Number.isInteger(quantity) || quantity < 1) return jsonResponse(false, null, '数量无效', 400)

    const orders = await getBuyOrders()
    const order = orders.find(o => o.id === orderId)
    if (!order) return jsonResponse(false, null, '收购单不存在', 404)
    if (order.quantity < quantity) return jsonResponse(false, null, '收购数量不足', 400)

    const invItem = user.inventory.find(i => i.id === inventoryItemId && i.quantity >= quantity)
    if (!invItem) return jsonResponse(false, null, '背包中没有该物品', 400)

    if (invItem.type !== order.itemType) return jsonResponse(false, null, '物品类型不匹配', 400)
    if (invItem.referenceId !== order.referenceId) return jsonResponse(false, null, '物品与收购单不匹配', 400)
    if (order.itemType === 'flower' && invItem.rank !== order.rank) return jsonResponse(false, null, '物品品质与收购单不匹配', 400)

    const coinsEarned = order.price * quantity

    // 原子扣减收购单剩余数量（防并发超卖）——必须在任何发奖/扣背包之前
    const decreased = await atomicDecreaseBuyOrder(order.id, quantity)
    if (!decreased) {
      return jsonResponse(false, null, '收购单数量不足，请重试', 409)
    }

    // 扣除背包物品
    const newInventory = user.inventory.map(i =>
      i.id === inventoryItemId ? { ...i, quantity: i.quantity - quantity } : i
    ).filter(i => i.quantity > 0)

    // 玩家收购单：物品直接送入买家背包；金币已经在创建收购单时锁定，因此这里不再扣买家金币
    if (!order.isOfficial && order.buyerId !== 'system') {
      const buyer = await findUserById(order.buyerId)
      if (buyer) {
        try {
          const buyerInv = addInventoryItem(
            buyer.inventory,
            {
              type: order.itemType as any,
              referenceId: order.referenceId,
              name: order.name,
              emoji: order.emoji,
              quantity,
              maxStack: 99,
              sellable: true,
              tradeable: true,
            },
            buyer.inventorySize,
          )
          await updateUser(buyer.id, { inventory: buyerInv })
          await createNotification({
            userId: buyer.id,
            type: 'trade',
            title: '收购成功',
            content: `你收购的 ${order.emoji} ${order.name} x${quantity} 已放入背包。`,
          })
        } catch (_e) {
          // 买家背包满等异常：放弃发货，金币仍锁定，通知买家
          await createNotification({
            userId: order.buyerId,
            type: 'trade',
            title: '收购失败',
            content: `${order.emoji} ${order.name} x${quantity} 收购成功但背包已满，请联系客服处理。`,
          })
        }
      }
    }

    // 更新收购单剩余数量（已在前面通过 atomicDecreaseBuyOrder 原子扣减）

    const updated = await updateUser(user.id, {
      coins: user.coins + coinsEarned,
      inventory: newInventory,
    })

    await createNotification({
      userId: user.id,
      type: 'trade',
      title: '出售成功',
      content: `出售 ${order.emoji} ${order.name} x${quantity}，获得 ${coinsEarned} 金币。`,
    })

    // 任务进度：贸易达人（日） + 周常富豪（累计获得金币）
    try { await incrementTaskProgress(user.id, 'trade', 1) } catch {}
    try { if (coinsEarned > 0) await incrementTaskProgress(user.id, 'earn_coin', coinsEarned) } catch {}

    return jsonResponse(true, { user: sanitizeUser(updated), coinsEarned })
  } catch (e: any) {
    return jsonResponse(false, null, e.message, 500)
  }
}
