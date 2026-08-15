import { NextRequest } from 'next/server'
import { authRequest, jsonResponse, isSuperAdminUser, userHasPermission } from '@/lib/auth'
import {
  getPriceOverrides, setPriceOverrides,
  getListingItems, removeListingExt, createAdminListing,
  getAllFamilies, logAdminAction, getEconomyStats, listAdminLogs,
} from '@/lib/server-store'
import { FLOWER_TYPES, SEED_TYPES, TOOL_TYPES } from '@/lib/game-data'

export const runtime = 'edge'

// 管理员：市场价格调控、官方商品上下架、统计等
export async function GET(req: NextRequest) {
  try {
    const admin = await authRequest(req)
    if (!admin) return jsonResponse(false, null, '请先登录', 401)
    if (!admin.isAdmin) return jsonResponse(false, null, '无权访问', 403)
    if (!userHasPermission(admin, 4)) return jsonResponse(false, null, '无「市场调控」权限', 403)

    const url = new URL(req.url)
    const action = url.searchParams.get('action') || 'overview'

    if (action === 'price-overrides') {
      const overrides = await getPriceOverrides()
      return jsonResponse(true, {
        overrides,
        flowerTypes: FLOWER_TYPES.map((f) => {
          const seed = SEED_TYPES.find(s => s.flowerTypeId === f.id)
          return {
            id: f.id, name: f.name, emoji: f.emoji,
            baseSellPrice: f.baseSellPrice, seedPrice: seed?.price ?? 0,
            seasons: f.season, maxRank: f.maxRank,
          }
        }),
        seedTypes: SEED_TYPES,
        toolTypes: TOOL_TYPES,
      })
    }

    if (action === 'market-items') {
      const listings = await getListingItems(undefined, 500, 0)
      const official = listings.items.filter((l: any) => l.source === 'official')
      const player = listings.items.filter((l: any) => l.source === 'player')
      return jsonResponse(true, { official, player, totalListings: listings.total })
    }

    if (action === 'econ-stats') {
      // 经济仪表盘实时快照
      const stats = await getEconomyStats()
      const families = await getAllFamilies()
      return jsonResponse(true, { ...stats, familyCount: families.length })
    }

    if (action === 'override-history') {
      const logs = await listAdminLogs({ action: 'market_price', limit: 50 })
      return jsonResponse(true, { items: logs.items })
    }

    return jsonResponse(false, null, 'action 错误', 400)
  } catch (e: any) {
    return jsonResponse(false, null, e.message, 500)
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await authRequest(req)
    if (!admin) return jsonResponse(false, null, '请先登录', 401)
    if (!admin.isAdmin) return jsonResponse(false, null, '无权访问', 403)
    if (!isSuperAdminUser(admin)) return jsonResponse(false, null, '仅超级管理员可操作市场', 403)

    const body = await req.json()
    const mode = body.mode as
      | 'set-price-overrides'
      | 'create-official-listing'
      | 'remove-official-listing'

    if (mode === 'set-price-overrides') {
      // overrides 形状： { flowers:{[id]:{baseSellPrice, seedPrice}}, seeds:{[id]:{price}}, tools:{[id]:{price}}, feeRate, minListPrice, maxListPrice }
      const res = await setPriceOverrides(admin.id, body.overrides)
      if (!res.success) return jsonResponse(false, null, res.error, 400)
      await logAdminAction(admin, 'market_price', { targetType: 'other', detail: { desc: '修改市场价格调控', overrides: body.overrides } })
      return jsonResponse(true, { ok: true })
    }

    if (mode === 'create-official-listing') {
      const { itemType, referenceId, name, emoji, price, quantity } = body
      if (!itemType || !referenceId || !name || !price || !quantity) return jsonResponse(false, null, '参数缺失', 400)
      const r = await createAdminListing({
        itemType: itemType as any,
        referenceId,
        name,
        emoji: emoji || '🌱',
        price: Number(price),
        quantity: Number(quantity),
      })
      if (!r.success) return jsonResponse(false, null, r.error, 400)
      await logAdminAction(admin, 'market_create', { targetType: 'other', targetId: r.listing?.id, detail: { desc: `创建官方商品「${name}」(${itemType}/${referenceId}) 价格${price} 数量${quantity}` } })
      return jsonResponse(true, { ok: true, listing: r.listing })
    }

    if (mode === 'remove-official-listing') {
      const { id } = body
      if (!id) return jsonResponse(false, null, 'id 缺失', 400)
      const r = await removeListingExt(null, id, true)
      if (!r.success) return jsonResponse(false, null, r.error, 400)
      await logAdminAction(admin, 'market_remove', { targetType: 'other', targetId: id, detail: { desc: `下架官方商品 ${id}` } })
      return jsonResponse(true, { ok: true })
    }

    return jsonResponse(false, null, 'mode 错误', 400)
  } catch (e: any) {
    return jsonResponse(false, null, e.message, 500)
  }
}
