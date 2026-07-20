import { useState, useEffect, useCallback } from 'react';
import { Trash2, Users, Loader2, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { getAllUsers, deleteUser, type User } from '@/lib/user-service';
import AdminModal from '@/components/admin/AdminModal';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteUsername, setDeleteUsername] = useState('');

  const loadData = useCallback(() => {
    setLoading(true);
    try {
      const data = getAllUsers();
      // 按注册时间倒序排列
      data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setUsers(data);
    } catch (err) {
      console.error('[AdminUsersPage] loadData error:', err);
      toast.error('加载用户列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const confirmDelete = (username: string) => {
    setDeleteUsername(username);
    setDeleteOpen(true);
  };

  const handleDelete = () => {
    if (!deleteUsername) return;
    try {
      deleteUser(deleteUsername);
      toast.success('用户已删除');
      loadData();
    } catch (err) {
      console.error('[AdminUsersPage] delete error:', err);
      toast.error('删除失败');
    } finally {
      setDeleteOpen(false);
      setDeleteUsername('');
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-[#888] flex items-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin text-[#888]" />
          加载中...
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-8">
      <div>
        <h2 className="text-xl font-bold text-white">用户管理</h2>
        <p className="text-xs text-[#888] mt-0.5">管理所有注册用户账号</p>
      </div>

      {/* 桌面端表格 */}
      <div className="rounded-xl border border-[#2C2C2C] bg-[#1a1a1a] overflow-hidden hidden md:block">
        <div className="grid grid-cols-[1fr_1fr_100px] gap-3 px-4 py-3 text-xs font-medium text-[#888] border-b border-[#2C2C2C] bg-[#151515]">
          <span>用户名</span>
          <span>注册时间</span>
          <span className="text-right">操作</span>
        </div>
        {users.map((user) => (
          <div
            key={user.username}
            className="grid grid-cols-[1fr_1fr_100px] gap-3 px-4 py-3 items-center border-b border-[#2C2C2C]/50 hover:bg-[#222] transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Users className="h-4 w-4 shrink-0 text-[#7C3AED]" />
              <span className="text-sm text-white truncate">{user.username}</span>
            </div>
            <div className="flex items-center gap-1.5 text-sm text-[#A0A0A0]">
              <Calendar className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{formatDate(user.createdAt)}</span>
            </div>
            <div className="flex items-center justify-end gap-1">
              <button
                onClick={() => confirmDelete(user.username)}
                className="p-1.5 rounded-md text-[#888] hover:text-red-400 hover:bg-red-400/10 transition-colors"
                title="删除用户"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
        {users.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-[#666]">暂无注册用户</div>
        )}
      </div>

      {/* 移动端卡片 */}
      <div className="md:hidden space-y-2">
        {users.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-[#666]">暂无注册用户</div>
        ) : (
          users.map((user) => (
            <div key={user.username} className="rounded-xl border border-[#2C2C2C] bg-[#1a1a1a] p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Users className="h-4 w-4 shrink-0 text-[#7C3AED]" />
                  <span className="text-sm font-medium text-white truncate">{user.username}</span>
                </div>
                <button
                  onClick={() => confirmDelete(user.username)}
                  className="p-1.5 rounded-md text-[#888] hover:text-red-400 hover:bg-red-400/10 transition-colors shrink-0"
                  title="删除用户"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="mt-1.5 flex items-center gap-1.5 text-xs text-[#666]">
                <Calendar className="h-3 w-3" />
                {formatDate(user.createdAt)}
              </div>
            </div>
          ))
        )}
      </div>

      {/* 删除确认弹窗 */}
      <AdminModal
        open={deleteOpen}
        onClose={() => { setDeleteOpen(false); setDeleteUsername(''); }}
        icon={<Trash2 className="h-5 w-5 text-red-400" />}
        iconBgClass="bg-red-400/15"
        iconColorClass="text-red-400"
        title="确认删除用户"
        description={`确定要删除用户"${deleteUsername}"吗？此操作不可恢复。`}
      >
        <div className="flex gap-2">
          <button
            onClick={() => { setDeleteOpen(false); setDeleteUsername(''); }}
            className="flex-1 rounded-lg border border-[#3A3A3A] bg-[#1E1E1E] py-2.5 text-sm text-[#888] hover:bg-[#2C2C2C] transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleDelete}
            className="flex-1 rounded-lg bg-red-500 py-2.5 text-sm font-medium text-white hover:bg-red-600 transition-colors"
          >
            删除
          </button>
        </div>
      </AdminModal>
    </div>
  );
}