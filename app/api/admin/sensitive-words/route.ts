import { NextRequest } from 'next/server'
import { getSensitiveWords, addSensitiveWord } from '@/lib/server-store'
import { authRequest, jsonResponse, userHasPermission } from '@/lib/auth'
import { logger } from '@/lib/logger'

export const runtime = 'edge'

// 获取敏感词列表
export async function GET(req: NextRequest) {
  try {
    const user = await authRequest(req)
    if (!user || !user.isAdmin) return jsonResponse(false, null, '无权访问', 403)
    if (!userHasPermission(user, 2)) return jsonResponse(false, null, '无「聊天管理」权限', 403)

    const words = await getSensitiveWords()
    return jsonResponse(true, words)
  } catch (e: any) {
    return jsonResponse(false, null, e.message, 500)
  }
}

// 添加敏感词（支持批量：words 数组 或 单个 word）
export async function POST(req: NextRequest) {
  try {
    const admin = await authRequest(req)
    if (!admin || !admin.isAdmin) return jsonResponse(false, null, '无权访问', 403)
    if (!userHasPermission(admin, 2)) return jsonResponse(false, null, '无「聊天管理」权限', 403)

    const body = await req.json()
    const rawWords: string[] = Array.isArray(body.words)
      ? body.words
      : (body.word ? [body.word] : [])

    const cleaned = Array.from(new Set(
      rawWords.map((w: string) => (w || '').trim()).filter(Boolean)
    ))
    if (cleaned.length === 0) return jsonResponse(false, null, '请输入敏感词', 400)

    const added: string[] = []
    const duplicated: string[] = []
    for (const w of cleaned) {
      const sw = await addSensitiveWord(w, admin.id)
      if (sw) added.push(sw.word)
      else duplicated.push(w)
    }

    logger.info('admin', '管理员添加敏感词', {
      adminId: admin.id, added: added.length, duplicated: duplicated.length,
    })

    return jsonResponse(true, { added, duplicated, addedCount: added.length })
  } catch (e: any) {
    return jsonResponse(false, null, e.message, 500)
  }
}
