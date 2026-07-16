import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Settings as SettingsIcon,
  Lock,
  Save,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { getAdminPassword, setAdminPassword, clearAdminLogin } from '@/lib/admin-projects';
import AdminModal from '@/components/admin/AdminModal';

export default function AdminSettingsPage() {
  const navigate = useNavigate();
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPassword || !newPassword || !confirmPassword) {
      toast.error('请填写完整信息');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('两次输入的新密码不一致');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('密码长度至少6位');
      return;
    }

    setSaving(true);
    try {
      const current = await getAdminPassword();
      if (oldPassword !== current) {
        toast.error('原密码错误');
        setSaving(false);
        return;
      }
      await setAdminPassword(newPassword);
      setSaving(false);
      setSuccessOpen(true);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      toast.error('保存失败，请重试');
      setSaving(false);
    }
  };

  const handleGoLogin = () => {
    clearAdminLogin();
    navigate('/admin/login');
  };

  return (
    <div className="p-4 md:p-6 pb-20">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-white">管理员设置</h2>
        <p className="mt-0.5 text-sm text-[#A0A0A0]">修改管理员密码和系统配置</p>
      </div>

      <div className="max-w-md space-y-5">
        {/* 修改密码 */}
        <div className="rounded-xl border border-[#3A3A3A] bg-[#2C2C2C] p-4 space-y-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#7C3AED]/15 text-[#A78BFA]">
              <Lock className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-semibold text-white">修改管理员密码</h3>
          </div>

          <form onSubmit={handleChangePassword} className="space-y-3">
            <div>
              <label className="text-xs text-[#A0A0A0] mb-1 block">原密码</label>
              <input
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="请输入原密码"
                className="w-full rounded-md border border-[#444444] bg-[#1E1E1E] px-3 py-2 text-sm text-white placeholder-[#666666] outline-none transition-all focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/30"
              />
            </div>
            <div>
              <label className="text-xs text-[#A0A0A0] mb-1 block">新密码</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="请输入新密码（至少6位）"
                className="w-full rounded-md border border-[#444444] bg-[#1E1E1E] px-3 py-2 text-sm text-white placeholder-[#666666] outline-none transition-all focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/30"
              />
            </div>
            <div>
              <label className="text-xs text-[#A0A0A0] mb-1 block">确认新密码</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="再次输入新密码"
                className="w-full rounded-md border border-[#444444] bg-[#1E1E1E] px-3 py-2 text-sm text-white placeholder-[#666666] outline-none transition-all focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/30"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#7C3AED] py-2.5 text-sm font-medium text-white shadow-[0_2px_8px_rgba(124_58_237_0.3)] transition-all hover:bg-[#6D28D9] active:scale-[0.98] disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? '保存中...' : '保存密码'}
            </button>
          </form>
        </div>

        {/* 系统信息 */}
        <div className="rounded-xl border border-[#3A3A3A] bg-[#2C2C2C] p-4 space-y-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#06B6D4]/15 text-[#06B6D4]">
              <SettingsIcon className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-semibold text-white">系统信息</h3>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-[#A0A0A0]">版本</span>
              <span className="text-white">v1.0.0 (测试版)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#A0A0A0]">数据存储</span>
              <span className="text-white">云端同步 (Supabase) + 本地缓存</span>
            </div>
          </div>
        </div>
      </div>

      {/* 修改密码成功弹窗 */}
      <AdminModal
        open={successOpen}
        onClose={handleGoLogin}
        icon={<Check className="h-6 w-6" />}
        iconBgClass="bg-[#22C55E]/15"
        iconColorClass="text-[#22C55E]"
        title="密码修改成功"
        description="请使用新密码重新登录"
      >
        <button
          onClick={handleGoLogin}
          className="w-full rounded-lg bg-[#7C3AED] py-2.5 text-sm font-medium text-white transition-all hover:bg-[#6D28D9] active:scale-[0.98]"
        >
          确定
        </button>
      </AdminModal>
    </div>
  );
}
