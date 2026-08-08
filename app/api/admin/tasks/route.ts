import { NextRequest } from 'next/server'
import {
  getAllTaskTemplates, createTaskTemplate, updateTaskTemplate, deleteTaskTemplate,
  logAdminAction,
} from '@/lib/server-store'
import { authRequest, jsonResponse, userHasPermission, isSuperAdmin } from '@/lib/auth'
import { logger } from '@/lib/logger'

export const runtime = 'edge'

// GET：获取所有任务模板（含禁用的）
export async function GET(req: NextRequest) {
  try {
    const admin = await authRequest(req)
    if (!admin || !admin.isAdmin) return jsonResponse(false, null, '无权访问', 403)
    if (!isSuperAdmin(admin.id) && !userHasPermission(admin, 7)) {
      return jsonResponse(false, null, '无「经济调控」权限', 403)
    }

    const templates = await getAllTaskTemplates(false)
    return jsonResponse(true, templates)
  } catch (e: any) {
    logger.error('admin', '获取任务模板失败', { error: e?.message })
    return jsonResponse(false, null, e?.message || '服务器错误', 500)
  }
}

// POST：创建/更新/删除任务模板
export async function POST(req: NextRequest) {
  try {
    const admin = await authRequest(req)
    if (!admin || !admin.isAdmin) return jsonResponse(false, null, '无权访问', 403)
    if (!isSuperAdmin(admin.id) && !userHasPermission(admin, 7)) {
      return jsonResponse(false, null, '无「经济调控」权限', 403)
    }

    const body = await req.json()
    const { op, ...data } = body

    // 创建
    if (op === 'create') {
      if (!data.title || !data.type || !data.action) {
        return jsonResponse(false, null, '缺少必填字段（标题/类型/触发行为）', 400)
      }
      const created = await createTaskTemplate({
        id: data.id,
        type: data.type,
        title: data.title,
        description: data.description || '',
        target: Number(data.target) || 1,
        action: data.action,
        rewards: data.rewards || { coins: 0 },
        enabled: data.enabled ?? true,
        sortOrder: Number(data.sortOrder) || 99,
      })
      await logAdminAction(admin, 'create_task', { targetType: 'other', targetId: created.id, detail: { desc: `创建任务: ${data.title}` } })
      logger.info('admin', '管理员创建任务模板', { adminId: admin.id, taskId: created.id, title: data.title })
      return jsonResponse(true, created)
    }

    // 更新
    if (op === 'update') {
      if (!data.id) return jsonResponse(false, null, '缺少任务ID', 400)
      const updated = await updateTaskTemplate(data.id, {
        type: data.type,
        title: data.title,
        description: data.description,
        target: data.target !== undefined ? Number(data.target) : undefined,
        action: data.action,
        rewards: data.rewards,
        enabled: data.enabled,
        sortOrder: data.sortOrder !== undefined ? Number(data.sortOrder) : undefined,
      })
      await logAdminAction(admin, 'update_task', { targetType: 'other', targetId: data.id, detail: { desc: `更新任务: ${data.title || data.id}` } })
      logger.info('admin', '管理员更新任务模板', { adminId: admin.id, taskId: data.id })
      return jsonResponse(true, updated)
    }

    // 删除
    if (op === 'delete') {
      if (!data.id) return jsonResponse(false, null, '缺少任务ID', 400)
      await deleteTaskTemplate(data.id)
      await logAdminAction(admin, 'delete_task', { targetType: 'other', targetId: data.id, detail: { desc: `删除任务: ${data.id}` } })
      logger.info('admin', '管理员删除任务模板', { adminId: admin.id, taskId: data.id })
      return jsonResponse(true, null)
    }

    // 切换启用/禁用
    if (op === 'toggle') {
      if (!data.id) return jsonResponse(false, null, '缺少任务ID', 400)
      const updated = await updateTaskTemplate(data.id, { enabled: !!data.enabled })
      await logAdminAction(admin, 'toggle_task', { targetType: 'other', targetId: data.id, detail: { desc: `${data.enabled ? '启用' : '禁用'}任务: ${data.id}` } })
      return jsonResponse(true, updated)
    }

    return jsonResponse(false, null, '未知操作类型', 400)
  } catch (e: any) {
    logger.error('admin', '管理任务模板失败', { error: e?.message })
    return jsonResponse(false, null, e?.message || '服务器错误', 500)
  }
}
