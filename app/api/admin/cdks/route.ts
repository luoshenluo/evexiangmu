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

    const { count = 1, coins = 100, days = 30 } = await req.json()
    const created: CDK[] = []
    for (let i = 0; i < Math.min(count, 100); i++) {
      created.push(await createCDK({
        code: genCDKCode(),
        rewards: { coins },
        maxUses: 1,
        usedCount: 0,
        expiresAt: Date.now() + (days || 30) * 24 * 60 * 60 * 1000,
        createdAt: Date.now(),
      }))
    }
    return jsonResponse(true, { count: created.length, firstCode: created[0]?.code })
  } catch (e: any) {
    return jsonResponse(false, null, e.message, 500)
  }
}
