import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, LogOut, Eye, EyeOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { clearAdminLogin, updateCurrentAccountPassword } from '@/lib/admin-projects';
import AdminModal from '@/components/admin/AdminModal';

export default function AdminSettingsPage() {
  const navigate = useNavigate();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [changing, setChanging] = useState(false);

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) { toast.error('请填写完整'); return; }
    if (newPassword.length < 6) { toast.error('新密码至少 6 位'); return; }
    if (newPassword !== confirmPassword) { toast.error('两次输入的新密码不一致'); return; }
    setChanging(true);
    try {
      const ok = await updateCurrentAccountPassword(oldPassword, newPassword);
      if (!ok) { toast.error('原密码错误'); return; }
      toast.success('密码修改成功');
      setOldPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (err) {
      console.error('[AdminSettingsPage] change password error:', err);
      toast.error('密码修改失败');
    } finally { setChanging(false); }
  };

  const handleLogout = () => {
    clearAdminLogin();
    setLogoutOpen(false);
    toast.success('已退出登录');
    navigate('/admin/login');
  };

  return (
    <div className="space-y-4 pb-8">
      <div>
        <h2 className="text-xl font-bold text-white">管理员设置</h2>
        <p className="text-xs text-[#888] mt-0.5">修改密码和账号管理</p>
      </div>
      <div className="rounded-xl border border-[#2C2C2C] bg-[#1a1a1a] p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-[#A78BFA]" />
          <h3 className="text-sm font-medium text-white">修改密码</h3>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-[#888] mb-1 block">原密码</label>
            <div className="relative">
              <input type={showOld ? 'text' : 'password'} value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} placeholder="请输入原密码" className="w-full rounded-lg border border-[#3A3A3A] bg-[#1E1E1E] px-3 py-2.5 pr-10 text-sm text-white placeholder-[#666] outline-none focus:border-[#7C3AED]" />
              <button type="button" onClick={() => setShowOld(!showOld)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#666] hover:text-[#A0A0A0]">{showOld ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
            </div>
          </div>
          <div>
            <label className="text-xs text-[#888] mb-1 block">新密码</label>
            <div className="relative">
              <input type={showNew ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="至少 6 位" className="w-full rounded-lg border border-[#3A3A3A] bg-[#1E1E1E] px-3 py-2.5 pr-10 text-sm text-white placeholder-[#666] outline-none focus:border-[#7C3AED]" />
              <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#666] hover:text-[#A0A0A0]">{showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
            </div>
          </div>
          <div>
            <label className="text-xs text-[#888] mb-1 block">确认新密码</label>
            <div className="relative">
              <input type={showConfirm ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="再次输入新密码" className="w-full rounded-lg border border-[#3A3A3A] bg-[#1E1E1E] px-3 py-2.5 pr-10 text-sm text-white placeholder-[#666] outline-none focus:border-[#7C3AED]" />
              <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#666] hover:text-[#A0A0A0]">{showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
            </div>
          </div>
          <button onClick={handleChangePassword} disabled={changing} className="w-full rounded-lg bg-[#7C3AED] py-2.5 text-sm font-medium text-white hover:bg-[#6D28D9] transition-all disabled:opacity-50 flex items-center justify-center gap-2">
            {changing && <Loader2 className="h-4 w-4 animate-spin" />}
            {changing ? '修改中...' : '修改密码'}
          </button>
        </div>
      </div>
      <div className="rounded-xl border border-[#2C2C2C] bg-[#1a1a1a] p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <LogOut className="h-4 w-4 text-red-400" />
            <div>
              <h3 className="text-sm font-medium text-white">退出登录</h3>
              <p className="text-xs text-[#666]">退出当前管理员账号</p>
            </div>
          </div>
          <button onClick={() => setLogoutOpen(true)} className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm text-red-400 hover:bg-red-500/20 transition-all">退出</button>
        </div>
      </div>
      <AdminModal open={logoutOpen} onClose={() => setLogoutOpen(false)} icon={<LogOut className="h-5 w-5 text-red-400" />} iconBgClass="bg-red-400/15" iconColorClass="text-red-400" title="确认退出" description="是否确认退出当前管理员账号？">
        <div className="flex gap-2">
          <button onClick={() => setLogoutOpen(false)} className="flex-1 rounded-lg border border-[#3A3A3A] bg-[#1E1E1E] py-2.5 text-sm text-[#888] hover:bg-[#2C2C2C]">取消</button>
          <button onClick={handleLogout} className="flex-1 rounded-lg bg-red-500 py-2.5 text-sm font-medium text-white hover:bg-red-600">确认退出</button>
        </div>
      </AdminModal>
    </div>
  );
}