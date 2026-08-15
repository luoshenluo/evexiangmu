import { NextRequest } from 'next/server'
import {
  findUserById,
  createListing, removeListing, findListing,
  removeInventoryItem,
  createNotification,
  createBuyOrder, getBuyOrders, removeBuyOrder, findBuyOrder,
  atomicConsumeInventory, atomicAddInventory, atomicSpendCoins, atomicAddCoins,
  getFlowerSellPriceEffective, getSeedPriceEffective, getEffectivePrices,
} from '@/lib/server-store'
import { authRequest, jsonResponse } from '@/lib/auth'
import type { InventoryItem } from '@/lib/types'
import { SEED_TYPES, FLOWER_TYPES } from '@/lib/game-data'

export const runtime = 'edge'

// 创建挂售（POST）：玩家从背包出售商品
// 下架挂售（DELETE ?id=xxx）
export async function POST(req: NextRequest) {
  try {
    const user = await authRequest(req)
    if (!user) return jsonResponse(false, null, '请先登录', 401)

    const body = await req.json()
    const mode = body.mode as 'create-listing' | 'cancel-listing' | 'create-order' | 'cancel-order'

    if (mode === 'create-listing') {
      return await handleCreateListing(user, body)
    } else if (mode === 'cancel-listing') {
      return await handleCancelListing(user, body)
    } else if (mode === 'create-order') {
      return await handleCreateBuyOrder(user, body)
    } else if (mode === 'cancel-order') {
      return await handleCancelOrder(user, body)
    }
    return jsonResponse(false, null, 'mode 参数错误', 400)
  } catch (e: any) {
    return jsonResponse(false, null, e.message || '服务器错误', 500)
  }
}

// 处理创建挂售
async function handleCreateListing(user: any, body: any) {
  const { itemType, referenceId, rank, quantity, price } = body
  if (!itemType || !referenceId || !quantity || quantity <= 0) {
    return jsonResponse(false, null, '参数错误', 400)
  }
  if (!price || price <= 0) return jsonResponse(false, null, '价格必须大于 0', 400)

  // 在背包中查找物品
  const item = user.inventory.find(
    (i: InventoryItem) =>
      i.type === itemType &&
      i.referenceId === referenceId &&
      (rank === undefined || i.rank === rank) &&
      i.quantity > 0,
  )
  if (!item) return jsonResponse(false, null, '背包中没有可出售的该物品', 400)
  if (item.quantity < quantity) return jsonResponse(false, null, '数量不足', 400)
  if (!item.tradeable) return jsonResponse(false, null, '该物品不可交易', 400)

  // 价格合理性检查：不低于官方收购价的 30%，防止恶意洗号（应用价格覆盖）
  const eff = await getEffectivePrices()
  let minPrice = 1
  let maxPrice = eff.maxListPrice
  if (itemType === 'flower') {
    minPrice = Math.max(1, Math.floor((await getFlowerSellPriceEffective(referenceId, (item.rank || 1) as any)) * 0.3))
  } else if (itemType === 'seed') {
    minPrice = Math.max(1, Math.floor((await getSeedPriceEffective(referenceId)) * 0.3))
  }
  minPrice = Math.max(minPrice, eff.minListPrice)
  if (price < minPrice) return jsonResponse(false, null, `单价过低（最低 ${minPrice} 金币）`, 400)
  if (price > maxPrice) return jsonResponse(false, null, `单价过高（最高 ${maxPrice} 金币）`, 400)

  // 从背包扣除（原子，防并发复制道具）
  const consumed = await atomicConsumeInventory(user.id, item.id, quantity)
  if (!consumed) return jsonResponse(false, null, '背包数量校验失败', 400)

  // 创建挂售
  const listing = await createListing({
    sellerId: user.id,
    sellerName: user.nickname,
    isOfficial: false,
    itemType,
    referenceId,
    name: item.name,
    emoji: item.emoji,
    rank: item.rank,
    price,
    quantity,
  })

  return jsonResponse(true, { listing })
}

// 下架自己的挂售
async function handleCancelListing(user: any, body: any) {
  const { id } = body
  if (!id) return jsonResponse(false, null, '参数错误', 400)

  const listing = await findListing(id)
  if (!listing) return jsonResponse(false, null, '挂售不存在', 404)
  if (listing.sellerId !== user.id) return jsonResponse(false, null, '只能下架自己的挂售', 403)

  // 归还物品到背包（原子加库存，防并发覆盖）
  const newInventory = await atomicAddInventory(
    user.id,
    {
      type: listing.itemType as any,
      referenceId: listing.referenceId,
      name: listing.name,
      emoji: listing.emoji,
      rank: listing.rank as any,
      quantity: listing.quantity,
      maxStack: 99,
      sellable: true,
      tradeable: true,
    },
    user.inventorySize,
  )
  if (!newInventory) return jsonResponse(false, null, '背包已满，请先清理或扩容', 400)
  await removeListing(id)
  return jsonResponse(true, { newInventory })
}

// 玩家发布收购单（我出金币收物品）
async function handleCreateBuyOrder(user: any, body: any) {
  const { itemType, referenceId, quantity, price } = body
  if (!itemType || !referenceId || !quantity || !price) {
    return jsonResponse(false, null, '参数错误', 400)
  }
  if (quantity <= 0 || price <= 0) return jsonResponse(false, null, '数量/价格必须大于 0', 400)

  const total = quantity * price
  if (user.coins < total) return jsonResponse(false, null, '金币不足，无法发布收购单（已锁定所需金币）', 400)

  // 价格上限
  let maxPrice = 10000000
  let name = '物品', emoji = '📦'
  if (itemType === 'flower') {
    const f = SEED_TYPES.find((s) => s.flowerTypeId === referenceId)
    const ft: any = (globalThis as any).__FLOWER_TYPES__?.find?.((x: any) => x.id === referenceId)
    name = f?.name || ft?.name || '花朵'
    emoji = f?.emoji || ft?.emoji || '🌸'
  } else if (itemType === 'seed') {
    const s = SEED_TYPES.find((s) => s.id === referenceId)
    name = s?.name || '种子'
    emoji = s?.emoji || '🌱'
    maxPrice = (await getSeedPriceEffective(referenceId)) * 20
  }
  if (price > maxPrice) return jsonResponse(false, null, `收购价过高（最多 ${maxPrice} 金币/件）`, 400)

  // 锁定金币（原子扣减，防并发超扣）
  const spent = await atomicSpendCoins(user.id, total)
  if (!spent) return jsonResponse(false, null, '金币不足，无法发布收购单（已锁定所需金币）', 400)

  const order = await createBuyOrder({
    buyerId: user.id,
    buyerName: user.nickname,
    isOfficial: false,
    itemType,
    referenceId,
    name,
    emoji,
    price,
    quantity,
  })

  await createNotification({
    userId: user.id,
    type: 'trade',
    title: '收购单已发布',
    content: `已发布 ${name} x${quantity} 的收购单，单价 ${price}，共锁定 ${total} 金币。`,
  })

  return jsonResponse(true, { order })
}

// 取消收购单（退还锁定金币）
async function handleCancelOrder(user: any, body: any) {
  const { id } = body
  if (!id) return jsonResponse(false, null, '参数错误', 400)
  const order = await findBuyOrder(id)
  if (!order) return jsonResponse(false, null, '收购单不存在', 404)
  if (order.buyerId !== user.id) return jsonResponse(false, null, '只能取消自己的收购单', 403)

  const refund = order.price * order.quantity
  await removeBuyOrder(id)
  // 原子退还金币
  await atomicAddCoins(user.id, refund)

  await createNotification({
    userId: user.id,
    type: 'trade',
    title: '收购单已取消',
    content: `已退还 ${refund} 金币。`,
  })

  return jsonResponse(true, { refund })
}

// 查询当前用户挂售
export async function GET(req: NextRequest) {
  try {
    const user = await authRequest(req)
    if (!user) return jsonResponse(false, null, '请先登录', 401)
    const url = new URL(req.url)
    const kind = url.searchParams.get('kind') || 'listings'
    if (kind === 'listings') {
      const all = await (await import('@/lib/server-store')).getListings()
      return jsonResponse(true, all.filter((l: any) => l.sellerId === user.id))
    } else if (kind === 'orders') {
      const all = await getBuyOrders()
      return jsonResponse(true, all.filter((o: any) => o.buyerId === user.id))
    }
    return jsonResponse(false, null, 'kind 参数错误', 400)
  } catch (e: any) {
    return jsonResponse(false, null, e.message || '服务器错误', 500)
  }
}
