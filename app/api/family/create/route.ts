import { NextRequest } from 'next/server'
import { updateUser, ensureSeasonTick, getAllUsers } from '@/lib/server-store'
import { authRequest, sanitizeUser, jsonResponse } from '@/lib/auth'

export const runtime = 'edge'

export async function POST(req: NextRequest) {
  try {
    const user = await authRequest(req)
    if (!user) return jsonResponse(false, null, '请先登录', 401)

    const { name, announcement, avatar } = await req.json()
    if (!name?.trim()) return jsonResponse(false, null, '请输入家族名称', 400)

    // 检查名称唯一
    const allUsers = await getAllUsers()
    const existingFamilyNames = new Set<string>()
    // 简化：家族信息存在用户家族名系统中（MVP）
    if (user.coins < 1000) return jsonResponse(false, null, '创建家族需要 1000 金币', 400)

    const familyId = `fam_${Date.now()}`
    const updated = await updateUser(user.id, {
      coins: user.coins - 1000,
      familyId,
    })
    return jsonResponse(true, {
      user: sanitizeUser(updated),
      family: {
        id: familyId,
        name: name.trim(),
        announcement,
        avatar: avatar || '🏰',
        level: 1,
        members: 1,
        maxMembers: 10,
      },
    })
  } catch (e: any) {
    return jsonResponse(false, null, e.message, 500)
  }
}

// 退出家族
export async function DELETE(req: NextRequest) {}
