import { NextRequest } from 'next/server'
import { getAllCDKs, createCDK } from '@/lib/server-store'
import type { CDK } from '@/lib/types'
import { authRequest, jsonResponse, userHasPermission } from '@/lib/auth'

export const runtime = 'edge'

function genCDKCode(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 12; i++) {
    if (i > 0 && i % 4 === 0) code += '-'
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

export async function GET(req: Request) {
  try {
    const user = await authRequest(req)
    if (!user || !user.isAdmin) return jsonResponse(false, null, '无权访问', 403)
    if (!userHasPermission(user, 3)) return jsonResponse(false, null, '无「CDK 管理」权限', 403)
    return jsonResponse(true, await getAllCDKs())
  } catch (e: any) {
    return jsonResponse(false, null, e.message, 500)
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await authRequest(req)
    if (!admin || !admin.isAdmin) return jsonResponse(false, null, '无权访问', 403)
    if (!userHasPermission(admin, 3)) return jsonResponse(false, null, '无「CDK 管理」权限', 403)

    const body = await req.json()
    const count = Math.max(1, Math.min(100, Number(body.count || 1)))
    const days = Math.max(1, Number(body.days || 30))

    const rewards: CDK['rewards'] = {}
    const coins = Number(body.coins || 0)
    const petalCoins = Number(body.petalCoins || 0)
    if (coins > 0) rewards.coins = coins
    if (petalCoins > 0) rewards.petalCoins = petalCoins
    if (Array.isArray(body.titles) && body.titles.length > 0) rewards.titles = body.titles
    if (Array.isArray(body.items) && body.items.length > 0) rewards.items = body.items

    const created: CDK[] = []
    for (let i = 0; i < count; i++) {
      created.push(await createCDK({
        code: genCDKCode(),
        rewards,
        maxUses: Math.max(1, Number(body.maxUses || 1)),
        usedCount: 0,
        expiresAt: Date.now() + days * 24 * 60 * 60 * 1000,
        createdAt: Date.now(),
      }))
    }
    return jsonResponse(true, { count: created.length, codes: created.map(c => c.code), firstCode: created[0]?.code })
  } catch (e: any) {
    return jsonResponse(false, null, e.message, 500)
  }
}
