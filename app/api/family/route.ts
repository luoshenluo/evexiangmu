import { NextRequest } from 'next/server'
import {
  createFamilyReal,
  joinFamily,
  leaveFamilyReal,
  getFamilies,
  findFamilyById,
  setFamilyMemberRole,
  kickFamilyMember,
  updateFamilyInfo,
  getAllUsers,
  findUserById,
  getFamilyLevel,
  getFamilyMaxMembers,
} from '@/lib/server-store'
import { authRequest, sanitizeUser, jsonResponse } from '@/lib/auth'
import { createNotification } from '@/lib/server-store'
import { getSupabase } from '@/lib/supabase'
import {
  computeFamilyTasks,
  claimFamilyTask,
} from '@/lib/family-tasks'

export const runtime = 'edge'

// GET: 家族列表 / 搜索 / 详情
export async function GET(req: NextRequest) {
  try {
    const user = await authRequest(req)
    if (!user) return jsonResponse(false, null, '请先登录', 401)
    const url = new URL(req.url)
    const action = url.searchParams.get('action') || 'list'

    if (action === 'list') {
      const kw = url.searchParams.get('kw') || undefined
      const list = await getFamilies(kw, 50)
      // 补充族长昵称
      const allUsers = await getAllUsers()
      const enriched = list.map((f) => ({
        id: f.id,
        name: f.name,
        avatar: f.avatar,
        announcement: f.announcement,
        ownerId: f.ownerId,
        ownerName: allUsers.find((u) => u.id === f.ownerId)?.nickname || '',
        level: f.level,
        exp: f.exp,
        maxMembers: f.maxMembers,
        memberCount: f.members.length,
        createdAt: f.createdAt,
      }))
      return jsonResponse(true, enriched)
    }

    if (action === 'detail') {
      const id = url.searchParams.get('id') || user.familyId
      if (!id) return jsonResponse(false, null, '你还未加入家族', 400)
      const fam = await findFamilyById(id)
      if (!fam) return jsonResponse(false, null, '家族不存在', 404)
      const allUsers = await getAllUsers()
      const membersWithInfo = fam.members.map((m) => {
        const u = allUsers.find((x) => x.id === m.userId)
        return {
          ...m,
          nickname: u?.nickname || '(已注销)',
          avatar: u?.avatar || '❓',
          lastLogin: u?.lastLogin || 0,
          online: u ? Date.now() - u.lastLogin < 5 * 60 * 1000 : false,
          plotsUnlocked: u?.plots.filter((p) => p.unlocked).length || 0,
          coins: u?.coins || 0,
        }
      })
      return jsonResponse(true, {
        id: fam.id,
        name: fam.name,
        avatar: fam.avatar,
        announcement: fam.announcement,
        ownerId: fam.ownerId,
        ownerName: allUsers.find((u) => u.id === fam.ownerId)?.nickname || '',
        level: fam.level,
        exp: fam.exp,
        maxMembers: fam.maxMembers,
        members: membersWithInfo,
        createdAt: fam.createdAt,
        myRole: fam.members.find((m) => m.userId === user.id)?.role || null,
      })
    }

    if (action === 'tasks') {
      if (!user.familyId) return jsonResponse(false, null, '你还未加入家族', 400)
      const tasks = computeFamilyTasks(user.familyId)
      return jsonResponse(true, tasks)
    }

    return jsonResponse(false, null, 'action 参数错误', 400)
  } catch (e: any) {
    return jsonResponse(false, null, e.message || '服务器错误', 500)
  }
}

// POST: 创建 / 加入 / 退出 / 踢人 / 转让族长 / 任命管理员 / 修改资料 / 贡献 / 领取任务
export async function POST(req: NextRequest) {
  try {
    const user = await authRequest(req)
    if (!user) return jsonResponse(false, null, '请先登录', 401)
    const body = await req.json()
    const mode = body.mode as
      | 'create' | 'join' | 'leave'
      | 'kick' | 'set-role' | 'update-info'
      | 'contribute' | 'claim-task'

    if (mode === 'create') {
      const r = await createFamilyReal(user.id, body.name, body.announcement || '', body.avatar || '🏰')
      if (!r.success) return jsonResponse(false, null, r.error, 400)
      const u = await getAllUsers().then((us) => us.find((x) => x.id === user.id))
      return jsonResponse(true, { family: r.family, user: u ? sanitizeUser(u) : null })
    }

    if (mode === 'join') {
      const r = await joinFamily(user.id, body.familyId)
      if (!r.success) return jsonResponse(false, null, r.error, 400)
      return jsonResponse(true, { ok: true })
    }

    if (mode === 'leave') {
      const r = await leaveFamilyReal(user.id)
      if (!r.success) return jsonResponse(false, null, r.error, 400)
      return jsonResponse(true, { ok: true })
    }

    if (!user.familyId) return jsonResponse(false, null, '你还未加入家族', 400)

    if (mode === 'kick') {
      const r = await kickFamilyMember(user.id, user.familyId, body.targetUserId)
      if (!r.success) return jsonResponse(false, null, r.error, 400)
      return jsonResponse(true, { ok: true })
    }

    if (mode === 'set-role') {
      const r = await setFamilyMemberRole(user.id, user.familyId, body.targetUserId, body.role)
      if (!r.success) return jsonResponse(false, null, r.error, 400)
      return jsonResponse(true, { ok: true })
    }

    if (mode === 'update-info') {
      const r = await updateFamilyInfo(user.id, user.familyId, {
        name: body.name,
        announcement: body.announcement,
        avatar: body.avatar,
      })
      if (!r.success) return jsonResponse(false, null, r.error, 400)
      return jsonResponse(true, { ok: true })
    }

    if (mode === 'contribute') {
      const amount = Math.max(1, Math.min(5000, Number(body.amount || 0)))
      if (amount <= 0) return jsonResponse(false, null, '无效金额', 400)
      const u = await findUserById(user.id)
      if (!u) return jsonResponse(false, null, '用户不存在', 404)
      if ((u.coins || 0) < amount) return jsonResponse(false, null, '金币不足', 400)
      const fam = await findFamilyById(user.familyId)
      if (!fam) return jsonResponse(false, null, '家族不存在', 404)

      // 扣除用户金币
      const newCoins = (u.coins || 0) - amount
      // 增加家族经验（1金币=0.1经验，取整至少1）
      const expGain = Math.max(1, Math.floor(amount / 10))
      const newExp = (fam.exp || 0) + expGain
      const newLevel = getFamilyLevel(newExp)
      // 扩容：Lv1=10人，每升级增加10人上限，Lv10=100人（百人）
      const newMax = getFamilyMaxMembers(newLevel)

      // 更新用户贡献
      const newMembers = (fam.members || []).map((m: any) =>
        m.userId === user.id ? { ...m, contribution: (m.contribution || 0) + amount } : m
      )

      const sb = getSupabase()
      const { error: e1 } = await sb.from('users').update({ coins: newCoins }).eq('id', user.id)
      if (e1) return jsonResponse(false, null, e1.message, 500)

      const { error: e2 } = await sb.from('families').update({
        exp: newExp,
        level: newLevel,
        max_members: newMax,
        members: newMembers,
      }).eq('id', fam.id)
      if (e2) return jsonResponse(false, null, e2.message, 500)

      const updated = await findUserById(user.id)
      if (newLevel > fam.level) {
        await createNotification({
          userId: user.id,
          type: 'reward',
          title: '🎉 家族升级',
          content: `家族已升级到 Lv.${newLevel}！成员上限提升至 ${newMax} 人。`,
        })
      }
      return jsonResponse(true, { user: updated ? sanitizeUser(updated) : null, expGained: expGain })
    }

    if (mode === 'claim-task') {
      const taskId = body.taskId
      if (!taskId) return jsonResponse(false, null, '缺少任务ID', 400)
      const fam = await findFamilyById(user.familyId)
      if (!fam) return jsonResponse(false, null, '家族不存在', 404)
      const res = claimFamilyTask(fam.id, taskId, user.id)
      if (!res.success) return jsonResponse(false, null, res.error || '领取失败', 400)

      const u = await findUserById(user.id)
      if (!u) return jsonResponse(false, null, '用户不存在', 404)
      const newCoins = (u.coins || 0) + (res.rewardCoins || 0)
      const { error } = await getSupabase().from('users').update({ coins: newCoins }).eq('id', user.id)
      if (error) return jsonResponse(false, null, error.message, 500)
      const updated = await findUserById(user.id)
      return jsonResponse(true, { user: updated ? sanitizeUser(updated) : null, rewardCoins: res.rewardCoins })
    }

    return jsonResponse(false, null, 'mode 参数错误', 400)
  } catch (e: any) {
    return jsonResponse(false, null, e.message || '服务器错误', 500)
  }
}
