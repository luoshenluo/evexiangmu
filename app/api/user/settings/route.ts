import { NextRequest } from 'next/server'
import { updateUser, findUserById } from '@/lib/server-store'
import { authRequest, jsonResponse, sanitizeUser } from '@/lib/auth'

export const runtime = 'edge'

const VALID_THEMES = ['light', 'dark', 'garden', 'sunset', 'ocean'] as const
type Theme = (typeof VALID_THEMES)[number]

const VALID_GARDEN_BGS = [
  'default', 'green', 'purple', 'blue', 'sunset', 'sakura', 'autumn', 'night', 'ocean',
]

const VALID_FONTS = ['system', 'kaiti', 'hei', 'yuan', 'song'] as const
type Font = (typeof VALID_FONTS)[number]

// 获取用户设置
export async function GET(req: NextRequest) {
  try {
    const user = await authRequest(req)
    if (!user) return jsonResponse(false, null, '请先登录', 401)
    return jsonResponse(true, {
      theme: (user as any).theme || 'light',
      gardenBg: (user as any).gardenBg || 'default',
      font: (user as any).font || 'system',
      lastCheckInAt: (user as any).lastCheckInAt || 0,
      checkInStreak: (user as any).checkInStreak || 0,
      petalCoins: (user as any).petalCoins || 0,
      title: (user as any).title || '',
    })
  } catch (e: any) {
    return jsonResponse(false, null, e.message, 500)
  }
}

// 更新用户设置
export async function POST(req: NextRequest) {
  try {
    const user = await authRequest(req)
    if (!user) return jsonResponse(false, null, '请先登录', 401)
    const body = await req.json()
    const mode: any = {}
    if (body.theme !== undefined) {
      const t = body.theme as Theme
      if (!VALID_THEMES.includes(t)) return jsonResponse(false, null, '主题参数不合法', 400)
      mode.theme = t
    }
    if (body.gardenBg !== undefined) {
      const bg = body.gardenBg
      if (bg && !VALID_GARDEN_BGS.includes(bg)) return jsonResponse(false, null, '背景参数不合法', 400)
      mode.gardenBg = bg
    }
    if (body.font !== undefined) {
      const f = body.font as Font
      if (!VALID_FONTS.includes(f)) return jsonResponse(false, null, '字体参数不合法', 400)
      mode.font = f
    }
    if (body.title !== undefined) {
      if (typeof body.title !== 'string' || body.title.length > 12) return jsonResponse(false, null, '称号长度最多12字', 400)
      // 称号必须是用户已解锁的称号（通过 CDK / 成就 / 活动获得）
      const grantedTitles = Array.isArray((user as any).titles) ? ((user as any).titles as string[]) : []
      const allowed = ['', 'newbie', 'green_hand', 'expert', 'master', 'legend', 'first_blood', 'wealthy', 'philanthropist', 'checkin_dragon']
      if (body.title && !grantedTitles.includes(body.title)) {
        return jsonResponse(false, null, '该称号尚未解锁，请通过成就、CDK或活动获得', 400)
      }
      if (body.title && !allowed.includes(body.title)) {
        return jsonResponse(false, null, '称号不合法', 400)
      }
      mode.title = body.title
    }
    if (Object.keys(mode).length === 0) return jsonResponse(false, null, '没有要更新的内容', 400)
    const updated = await updateUser(user.id, mode)
    return jsonResponse(true, updated ? sanitizeUser(updated) : null)
  } catch (e: any) {
    return jsonResponse(false, null, e.message, 500)
  }
}
