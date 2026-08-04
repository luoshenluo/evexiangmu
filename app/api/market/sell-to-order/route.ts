import { NextRequest } from 'next/server'
import { updateUser, findUserById, ensureSeasonTick, getBuyOrders } from '@/lib/server-store'
import { authRequest, sanitizeUser, jsonResponse } from '@/lib/auth'

export const runtime = 'edge'

export async function POST(req: NextRequest) {
  try {
    await ensureSeasonTick()
    const user = await authRequest(req)
    if (!user) return jsonResponse(false, null, '请先登录', 401)

    const { orderId, quantity, inventoryItemId } = await req.json()
    if (!orderId || !quantity || !inventoryItemId) return jsonResponse(false, null, '参数错误', 400)

    const orders = await getBuyOrders()
    const order = orders.find(o => o.id === orderId)
    if (!order) return jsonResponse(false, null, '收购单不存在', 404)
    if (order.quantity < quantity) return jsonResponse(false, null, '收购数量不足', 400)

    const invItem = user.inventory.find(i => i.id === inventoryItemId && i.quantity >= quantity)
    if (!invItem) return jsonResponse(false, null, '背包中没有该物品', 400)

    // 类型匹配
    if (invItem.type !== order.itemType) return jsonResponse(false, null, '物品类型不匹配', 400)

    const coinsEarned = order.price * quantity

    // 扣除背包物品
    const newInventory = user.inventory.map(i =>
      i.id === inventoryItemId ? { ...i, quantity: i.quantity - quantity } : i
    ).filter(i => i.quantity > 0)

    // 非官方订单：买家扣金币
    if (!order.isOfficial && order.buyerId !== 'system') {
      const buyer = await findUserById(order.buyerId)
      if (buyer && buyer.coins < coinsEarned) {
        return jsonResponse(false, null, '买家金币不足', 400)
      }
      if (buyer) {
        await updateUser(buyer.id, { coins: buyer.coins - coinsEarned })
      }
    }

    const updated = await updateUser(user.id, {
      coins: user.coins + coinsEarned,
      inventory: newInventory,
    })
    return jsonResponse(true, { user: sanitizeUser(updated), coinsEarned })
  } catch (e: any) {
    return jsonResponse(false, null, e.message, 500)
  }
}
