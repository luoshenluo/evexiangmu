import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Pencil, Trash2, Users, UserPlus, Check, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  loadAdminAccounts,
  saveAdminAccount,
  updateAdminAccountMeta,
  deleteAdminAccount,
  hashPassword,
  getCurrentAdminAccount,
  clearAdminLogin,
  type AdminAccount,
} from '@/lib/admin-projects';
import AdminModal from '@/components/admin/AdminModal';

export default function AdminAccountsPage() {
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<Omit<AdminAccount, 'password_hash'>[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState('');
  const [editingId, setEditingId] = useState('');

  const [formData, setFormData] = useState({
    username: '',
    password: '',
    role: 'admin' as 'super_admin' | 'admin',
    permissions: {
      manage_projects: false,
      manage_materials: false,
      manage_market: false,
      manage_admins: false,
    },
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await loadAdminAccounts();
      setAccounts(data);
    } catch (err) {
      console.error('[AdminAccountsPage] loadData error:', err);
      toast.error('加载账号列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openAdd = () => {
    setEditingId('');
    setFormData({
      username: '',
      password: '',
      role: 'admin' as 'super_admin' | 'admin',
      permissions: {
        manage_projects: false,
        manage_materials: false,
        manage_market: false,
        manage_accounts: false,
        manage_admins: false,
        view_analytics: false,
      },
    });
    setModalOpen(true);
  };

  const openEdit = (account: Omit<AdminAccount, 'password_hash'>) => {
    setEditingId(account.id);
    setFormData({
      username: account.username,
      password: '',
      role: account.role as 'super_admin' | 'admin',
      permissions: { ...account.permissions },
    });
    setModalOpen(true);
  };

  const confirmDelete = (id: string) => {
    setDeleteId(id);
    setDeleteOpen(true);
  };

  const handleSave = async () => {
    if (!formData.username.trim()) {
      toast.error('请输入用户名');
      return;
    }
    if (!editingId && !formData.password.trim()) {
      toast.error('请输入密码');
      return;
    }
    try {
      if (editingId && !formData.password.trim()) {
        await updateAdminAccountMeta(editingId, {
          username: formData.username.trim(),
          role: formData.role,
          permissions: formData.permissions,
        });
      } else {
        const account: AdminAccount = {
          id: editingId || 'acc_' + Date.now(),
          username: formData.username.trim(),
          password_hash: hashPassword(formData.password.trim()),
          role: formData.role,
          permissions: formData.permissions,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        await saveAdminAccount(account);
      }

      await loadData();
      setModalOpen(false);
      toast.success(editingId ? '账号更新成功' : '账号创建成功');
    } catch (err) {
      console.error('[AdminAccountsPage] save error:', err);
      toast.error('保存失败，请检查网络');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteAdminAccount(deleteId);
      const current = getCurrentAdminAccount();
      if (current && current.id === deleteId) {
        clearAdminLogin();
        navigate('/admin/login', { replace: true });
        return;
      }
      await loadData();
      toast.success('账号已删除');
    } catch (err) {
      console.error('[AdminAccountsPage] delete error:', err);
      toast.error('删除失败，请检查网络');
    } finally {
      setDeleteOpen(false);
    }
  };

  const togglePermission = (key: keyof typeof formData.permissions) => {
    setFormData((prev) => ({
      ...prev,
      permissions: { ...prev.permissions, [key]: !prev.permissions[key] },
    }));
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">账号管理</h2>
          <p className="text-xs text-[#888] mt-0.5">管理后台管理员账号和权限</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 self-start sm:self-auto rounded-lg bg-[#7C3AED] px-4 py-2 text-sm font-medium text-white transition-all hover:bg-[#6D28D9]"
        >
          <UserPlus className="h-4 w-4" />
          新增账号
        </button>
      </div>

      <div className="rounded-xl border border-[#2C2C2C] bg-[#1a1a1a] overflow-hidden hidden md:block">
        <div className="grid grid-cols-[1fr_100px_140px_80px] gap-3 px-4 py-3 text-xs font-medium text-[#888] border-b border-[#2C2C2C] bg-[#151515]">
          <span>用户名</span>
          <span>角色</span>
          <span>权限</span>
          <span className="text-right">操作</span>
        </div>
        {accounts.map((account) => (
          <div
            key={account.id}
            className="grid grid-cols-[1fr_100px_140px_80px] gap-3 px-4 py-3 items-center border-b border-[#2C2C2C]/50 hover:bg-[#222] transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Users className="h-4 w-4 shrink-0 text-[#7C3AED]" />
              <span className="text-sm text-white truncate">{account.username}</span>
            </div>
            <span className={'text-xs px-2 py-0.5 rounded-full w-fit ' + (account.role === 'super_admin' ? 'bg-[#7C3AED]/15 text-[#A78BFA]' : 'bg-[#2C2C2C] text-[#888]')}>
              {account.role === 'super_admin' ? '超级管理员' : '管理员'}
            </span>
            <div className="flex flex-wrap gap-1">
              {Object.entries(account.permissions).filter(([, v]) => v).map(([k]) => (
                <span key={k} className="text-[10px] text-[#666] bg-[#222] px-1.5 py-0.5 rounded">
                  {k === 'manage_projects' ? '项目' : k === 'manage_materials' ? '材料' : k === 'manage_market' ? '市场' : '账号'}
                </span>
              ))}
            </div>
            <div className="flex items-center justify-end gap-1">
              <button onClick={() => openEdit(account)} className="p-1.5 rounded-md text-[#888] hover:text-white hover:bg-[#333] transition-colors" title="编辑">
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => confirmDelete(account.id)} className="p-1.5 rounded-md text-[#888] hover:text-red-400 hover:bg-red-400/10 transition-colors" title="删除">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
        {accounts.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-[#666]">暂无管理员账号</div>
        )}
      </div>

      <div className="md:hidden space-y-2">
        {accounts.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-[#666]">暂无管理员账号</div>
        ) : (
          accounts.map((account) => (
            <div key={account.id} className="rounded-xl border border-[#2C2C2C] bg-[#1a1a1a] p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Users className="h-4 w-4 shrink-0 text-[#7C3AED]" />
                  <span className="text-sm font-medium text-white truncate">{account.username}</span>
                  <span className={'shrink-0 text-[10px] px-1.5 py-0.5 rounded-full ' + (account.role === 'super_admin' ? 'bg-[#7C3AED]/15 text-[#A78BFA]' : 'bg-[#2C2C2C] text-[#888]')}>
                    {account.role === 'super_admin' ? '超管' : '管理员'}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => openEdit(account)} className="p-1.5 rounded-md text-[#888] hover:text-white hover:bg-[#333] transition-colors">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => confirmDelete(account.id)} className="p-1.5 rounded-md text-[#888] hover:text-red-400 hover:bg-red-400/10 transition-colors">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              {Object.values(account.permissions).some((v) => v) && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {Object.entries(account.permissions).filter(([, v]) => v).map(([k]) => (
                    <span key={k} className="text-[10px] text-[#666] bg-[#222] px-1.5 py-0.5 rounded">
                      {k === 'manage_projects' ? '项目' : k === 'manage_materials' ? '材料' : k === 'manage_market' ? '市场' : '账号'}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <AdminModal open={modalOpen} onClose={() => setModalOpen(false)} icon={<UserPlus className="h-5 w-5" />} iconBgClass="bg-[#7C3AED]/15" iconColorClass="text-[#A78BFA]" title={editingId ? '编辑账号' : '新增账号'}>
        <div className="space-y-4">
          <div>
            <label className="text-xs text-[#888] mb-1 block">用户名</label>
            <input type="text" value={formData.username} onChange={(e) => setFormData((p) => ({ ...p, username: e.target.value }))} placeholder="请输入用户名" className="w-full rounded-lg border border-[#3A3A3A] bg-[#1E1E1E] px-3 py-2 text-sm text-white placeholder-[#666] outline-none focus:border-[#7C3AED]" />
          </div>
          <div>
            <label className="text-xs text-[#888] mb-1 block">密码 {editingId ? <span className="text-[#666]">（留空则不修改）</span> : ''}</label>
            <input type="password" value={formData.password} onChange={(e) => setFormData((p) => ({ ...p, password: e.target.value }))} placeholder={editingId ? '如需修改请输入新密码' : '请输入密码'} className="w-full rounded-lg border border-[#3A3A3A] bg-[#1E1E1E] px-3 py-2 text-sm text-white placeholder-[#666] outline-none focus:border-[#7C3AED]" />
          </div>
          <div>
            <label className="text-xs text-[#888] mb-1 block">角色</label>
            <div className="flex gap-2">
              {(['admin', 'super_admin'] as const).map((role) => (
                <button key={role} onClick={() => setFormData((p) => ({ ...p, role }))} className={'flex-1 rounded-lg border px-3 py-2 text-sm transition-all ' + (formData.role === role ? 'border-[#7C3AED] bg-[#7C3AED]/15 text-[#A78BFA]' : 'border-[#3A3A3A] bg-[#1E1E1E] text-[#888] hover:border-[#555]')}>
                  {role === 'super_admin' ? '超级管理员' : '管理员'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-[#888] mb-2 block">权限设置</label>
            <div className="grid grid-cols-2 gap-2">
              {([{ key: 'manage_projects' as const, label: '项目管理' }, { key: 'manage_materials' as const, label: '材料管理' }, { key: 'manage_market' as const, label: '市场管理' }, { key: 'manage_admins' as const, label: '账号管理' }]).map(({ key, label }) => (
                <button key={key} onClick={() => togglePermission(key)} className={'flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-all ' + (formData.permissions[key] ? 'border-[#7C3AED] bg-[#7C3AED]/15 text-[#A78BFA]' : 'border-[#3A3A3A] bg-[#1E1E1E] text-[#888] hover:border-[#555]')}>
                  {formData.permissions[key] ? <Check className="h-3.5 w-3.5" /> : <div className="h-3.5 w-3.5 rounded border border-[#666]" />}
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={() => setModalOpen(false)} className="flex-1 rounded-lg border border-[#3A3A3A] bg-[#1E1E1E] py-2.5 text-sm text-[#888] hover:bg-[#2C2C2C]">取消</button>
            <button onClick={handleSave} className="flex-1 rounded-lg bg-[#7C3AED] py-2.5 text-sm font-medium text-white hover:bg-[#6D28D9]">{editingId ? '保存' : '创建'}</button>
          </div>
        </div>
      </AdminModal>

      <AdminModal open={deleteOpen} onClose={() => setDeleteOpen(false)} icon={<Trash2 className="h-5 w-5 text-red-400" />} iconBgClass="bg-red-400/15" iconColorClass="text-red-400" title="确认删除" description="此操作不可恢复，是否确认删除该账号？">
        <div className="flex gap-2">
          <button onClick={() => setDeleteOpen(false)} className="flex-1 rounded-lg border border-[#3A3A3A] bg-[#1E1E1E] py-2.5 text-sm text-[#888] hover:bg-[#2C2C2C]">取消</button>
          <button onClick={handleDelete} className="flex-1 rounded-lg bg-red-500 py-2.5 text-sm font-medium text-white hover:bg-red-600">删除</button>
        </div>
      </AdminModal>
    </div>
  );
}