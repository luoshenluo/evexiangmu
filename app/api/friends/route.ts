import { NextRequest } from 'next/server'
import {
  searchUsers,
  sendFriendRequest,
  handleFriendRequest,
  removeFriend,
  getFriendProfiles,
  findUserById,
} from '@/lib/server-store'
import { authRequest, jsonResponse, sanitizeUser } from '@/lib/auth'

export const runtime = 'edge'

// GET: 好友列表、好友资料、搜索好友、待处理申请
export async function GET(req: NextRequest) {
  try {
    const user = await authRequest(req)
    if (!user) return jsonResponse(false, null, '请先登录', 401)

    const url = new URL(req.url)
    const action = url.searchParams.get('action') || 'list'

    if (action === 'search') {
      const keyword = url.searchParams.get('kw') || ''
      const users = await searchUsers(user.id, keyword, 30)
      return jsonResponse(true, users.map((u) => sanitizeUser(u)))
    }

    if (action === 'requests') {
      // 待处理的申请：我收到的 + 我发出的
      const me = await findUserById(user.id)
      if (!me) return jsonResponse(false, null, '用户不存在', 404)
      return jsonResponse(true, {
        incoming: (me.incomingFriendRequests || []).filter((r) => r.status === 'pending'),
        outgoing: (me.outgoingFriendRequests || []).filter((r) => r.status === 'pending'),
      })
    }

    if (action === 'list') {
      const profiles = await getFriendProfiles(user.id)
      return jsonResponse(true, profiles)
    }

    return jsonResponse(false, null, 'action 参数错误', 400)
  } catch (e: any) {
    return jsonResponse(false, null, e.message || '服务器错误', 500)
  }
}

// POST: 发送申请 / 接受申请 / 拒绝申请 / 删除好友
export async function POST(req: NextRequest) {
  try {
    const user = await authRequest(req)
    if (!user) return jsonResponse(false, null, '请先登录', 401)

    const body = await req.json()
    const mode = body.mode as 'send-request' | 'accept-request' | 'reject-request' | 'remove-friend' | 'visit-friend'

    if (mode === 'send-request') {
      const { toUserId, message } = body
      if (!toUserId) return jsonResponse(false, null, '缺少目标用户', 400)
      const r = await sendFriendRequest(user.id, toUserId, message)
      if (!r.success) return jsonResponse(false, null, r.error, 400)
      return jsonResponse(true, r.request)
    }

    if (mode === 'accept-request' || mode === 'reject-request') {
      const { requestId } = body
      if (!requestId) return jsonResponse(false, null, '缺少申请ID', 400)
      const action = mode === 'accept-request' ? 'accept' : 'reject'
      const r = await handleFriendRequest(user.id, requestId, action)
      if (!r.success) return jsonResponse(false, null, r.error, 400)
      return jsonResponse(true, { ok: true })
    }

    if (mode === 'remove-friend') {
      const { friendId } = body
      if (!friendId) return jsonResponse(false, null, '缺少好友ID', 400)
      const r = await removeFriend(user.id, friendId)
      if (!r.success) return jsonResponse(false, null, r.error, 400)
      return jsonResponse(true, { ok: true })
    }

    return jsonResponse(false, null, 'mode 参数错误', 400)
  } catch (e: any) {
    return jsonResponse(false, null, e.message || '服务器错误', 500)
  }
}
