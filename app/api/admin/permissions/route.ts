import { getAllUsers } from '@/lib/server-store'
import { authRequest, jsonResponse, userHasPermission, isSuperAdmin, ADMIN_PERMISSIONS } from '@/lib/auth'

export const runtime = 'edge'

// GET: 列出所有管理员及其权限
export async function GET(req: Request) {
  try {
    const admin = await authRequest(req)
    if (!admin || !admin.isAdmin) return jsonResponse(false, null, '无权访问', 403)
    // 只有超级管理员或具备「权限管理」位(bit 5)的管理员可查看
    if (!isSuperAdmin(admin.id) && !userHasPermission(admin, 5)) {
      return jsonResponse(false, null, '无「权限管理」权限', 403)
    }

    const users = await getAllUsers('id,username,nickname,avatar,is_admin,admin_permissions,created_at')
    const admins = users
      .filter((u) => u.isAdmin)
      .map((u) => {
        const perms = Number(u.adminPermissions) || 0
        const isSuper = isSuperAdmin(u.id)
        // 权限位解析：返回每项权限的启用状态
        const permFlags: Record<string, boolean> = {}
        for (const p of ADMIN_PERMISSIONS) {
          permFlags[p.key] = isSuper ? true : ((perms & (1 << p.bit)) !== 0)
        }
        return {
          id: u.id,
          username: u.username,
          nickname: u.nickname,
          avatar: u.avatar,
          isSuperAdmin: isSuper,
          adminPermissions: perms,
          permFlags,
          createdAt: u.createdAt,
        }
      })
      .sort((a, b) => {
        // 超级管理员置顶，其余按权限数倒序
        if (a.isSuperAdmin && !b.isSuperAdmin) return -1
        if (!a.isSuperAdmin && b.isSuperAdmin) return 1
        return (b.adminPermissions || 0) - (a.adminPermissions || 0)
      })

    return jsonResponse(true, { admins, permMeta: ADMIN_PERMISSIONS })
  } catch (e: any) {
    return jsonResponse(false, null, e.message || '服务器错误', 500)
  }
}
