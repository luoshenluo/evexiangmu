import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { User, LogOut, Eye, EyeOff, Lock, ShieldCheck, ArrowLeft, Cloud, CloudOff, Check } from 'lucide-react';
import { toast } from 'sonner';
import { getCurrentUser, clearCurrentUser, changePassword } from '@/lib/user-service';

export default function UserProfile() {
  const navigate = useNavigate();
  const user = getCurrentUser();

  const [oldPassword, setOldPassword] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!user) {
    return (
      <div className="min-h-screen bg-[#0D0D0D] flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <User className="h-12 w-12 text-[#666666] mx-auto" />
          <p className="text-sm text-[#A0A0A0]">未登录，请先登录</p>
          <Link to="/user/login" className="inline-block rounded-xl bg-[#7C3AED] px-6 py-2.5 text-sm font-medium text-white transition-all hover:bg-[#6D28D9]">去登录</Link>
        </div>
      </div>
    );
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPassword || !securityAnswer || !newPassword) { toast.error('请填写完整信息'); return; }
    if (newPassword.length < 6) { toast.error('新密码至少 6 位'); return; }
    if (newPassword !== confirmPassword) { toast.error('两次密码输入不一致'); return; }

    setLoading(true);
    try {
      const result = await changePassword(user.username, oldPassword, securityAnswer, newPassword);
      if (result.success) {
        toast.success('密码修改成功');
        setOldPassword(''); setSecurityAnswer(''); setNewPassword(''); setConfirmPassword('');
      } else {
        toast.error(result.message);
      }
    } catch { toast.error('修改失败，请稍后重试'); }
    finally { setLoading(false); }
  };

  const handleLogout = () => {
    clearCurrentUser();
    toast.success('已退出登录');
    navigate('/', { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#0D0D0D] p-4 md:p-8">
      <div className="mx-auto max-w-3xl">
        {/* 顶部导航 */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate('/')} className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#2C2C2C] border border-[#3A3A3A] text-white hover:border-[#555555]">
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="text-lg font-semibold text-white">个人中心</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-4">
          {/* 左侧：用户信息 */}
          <div className="space-y-4">
            {/* 头像卡片 */}
            <div className="rounded-2xl border border-[#3A3A3A] bg-[#1E1E1E] p-6 text-center">
              <div className="flex h-20 w-20 mx-auto items-center justify-center rounded-full bg-[#7C3AED]/15 border-2 border-[#7C3AED]/30">
                <span className="text-2xl font-bold text-[#A78BFA]">{user.username.slice(0, 2)}</span>
              </div>
              <h2 className="mt-3 text-lg font-bold text-white">{user.username}</h2>
              <p className="mt-1 text-xs text-[#888888]">注册时间：{new Date(user.createdAt).toLocaleDateString('zh-CN')}</p>
            </div>

            {/* 云端状态 */}
            <div className="rounded-2xl border border-[#3A3A3A] bg-[#1E1E1E] p-4">
              <div className="flex items-center gap-2 mb-2">
                <Cloud className="h-4 w-4 text-[#22C55E]" />
                <span className="text-xs font-medium text-white">云端同步</span>
                <Check className="h-3.5 w-3.5 text-[#22C55E] ml-auto" />
              </div>
              <p className="text-[11px] text-[#888888]">登录状态下自动同步材料数据与计算参数</p>
            </div>

            {/* 退出登录 */}
            <button onClick={handleLogout}
              className="w-full flex items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 py-3 text-sm font-medium text-red-400 transition-all hover:bg-red-500/20 active:scale-[0.98]">
              <LogOut className="h-4 w-4" />
              退出登录
            </button>
          </div>

          {/* 右侧：修改密码 */}
          <div className="rounded-2xl border border-[#3A3A3A] bg-[#1E1E1E] p-6 md:p-8">
            <div className="flex items-center gap-2 mb-6">
              <Lock className="h-4 w-4 text-[#A78BFA]" />
              <h3 className="text-base font-semibold text-white">修改密码</h3>
              <span className="text-[10px] text-[#888888] bg-[#3A3A3A] px-2 py-0.5 rounded-md ml-2">需密保验证</span>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-5">
              {/* 旧密码 */}
              <div>
                <label className="block text-xs text-[#888888] mb-1.5">旧密码</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#666666]" />
                  <input type={showOld ? 'text' : 'password'} value={oldPassword} onChange={(e) => setOldPassword(e.target.value)}
                    placeholder="请输入当前密码" disabled={loading}
                    className="w-full rounded-xl border border-[#3A3A3A] bg-[#2C2C2C] py-3 pl-10 pr-11 text-sm text-white placeholder-[#666666] outline-none transition-all focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20"
                  />
                  <button type="button" onClick={() => setShowOld(!showOld)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#666666] hover:text-[#A0A0A0]">
                    {showOld ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* 密保答案 */}
              <div>
                <label className="block text-xs text-[#888888] mb-1.5">密保答案</label>
                <div className="relative">
                  <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#666666]" />
                  <input type="text" value={securityAnswer} onChange={(e) => setSecurityAnswer(e.target.value)}
                    placeholder="请输入注册时设置的密保答案" disabled={loading}
                    className="w-full rounded-xl border border-[#3A3A3A] bg-[#2C2C2C] py-3 pl-10 pr-4 text-sm text-white placeholder-[#666666] outline-none transition-all focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20"
                  />
                </div>
              </div>

              {/* 新密码 */}
              <div>
                <label className="block text-xs text-[#888888] mb-1.5">新密码</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#666666]" />
                  <input type={showNew ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="至少 6 位" disabled={loading}
                    className="w-full rounded-xl border border-[#3A3A3A] bg-[#2C2C2C] py-3 pl-10 pr-11 text-sm text-white placeholder-[#666666] outline-none transition-all focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20"
                  />
                  <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#666666] hover:text-[#A0A0A0]">
                    {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* 确认新密码 */}
              <div>
                <label className="block text-xs text-[#888888] mb-1.5">确认新密码</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#666666]" />
                  <input type={showConfirm ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="再次输入新密码" disabled={loading}
                    className="w-full rounded-xl border border-[#3A3A3A] bg-[#2C2C2C] py-3 pl-10 pr-11 text-sm text-white placeholder-[#666666] outline-none transition-all focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20"
                  />
                  <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#666666] hover:text-[#A0A0A0]">
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="mt-1 text-[11px] text-red-400">两次密码输入不一致</p>
                )}
              </div>

              <button type="submit" disabled={loading || !oldPassword || !securityAnswer || !newPassword || !confirmPassword || newPassword !== confirmPassword}
                className="w-full rounded-xl bg-[#7C3AED] py-3 text-sm font-semibold text-white shadow-[0_4px_16px_rgba(124_58_237_0.35)] transition-all hover:bg-[#6D28D9] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '修改中...' : '确认修改'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
