import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Shield, Eye, EyeOff, LogOut, Cloud, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { getCurrentUser, setCurrentUser, clearCurrentUser, changePassword } from '@/lib/user-service';

export default function UserProfile() {
  const navigate = useNavigate();
  const currentUser = getCurrentUser();

  // 修改密码表单
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');

  useEffect(() => {
    // 未登录则跳转到登录页
    if (!currentUser) {
      toast.error('请先登录');
      navigate('/user/login', { replace: true });
      return;
    }
    // 模拟检查云端备份状态
    const timer = setTimeout(() => {
      // 随机模拟连接状态
      setCloudStatus(Math.random() > 0.3 ? 'connected' : 'disconnected');
    }, 1000);
    return () => clearTimeout(timer);
  }, [currentUser, navigate]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentUser) return;

    if (!oldPassword) {
      toast.error('请输入旧密码');
      return;
    }
    if (!newPassword) {
      toast.error('请输入新密码');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('新密码至少 6 位');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      toast.error('两次密码输入不一致');
      return;
    }

    setLoading(true);
    try {
      const result = changePassword(currentUser.username, oldPassword, newPassword);
      if (result.success) {
        // 更新会话中的密码
        setCurrentUser({ ...currentUser, password: newPassword });
        toast.success('密码修改成功');
        setOldPassword('');
        setNewPassword('');
        setConfirmNewPassword('');
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error('修改失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    clearCurrentUser();
    toast.success('已退出登录');
    navigate('/', { replace: true });
  };

  // 未登录状态不渲染内容
  if (!currentUser) {
    return null;
  }

  return (
    <div className="w-full max-w-md space-y-6">
      {/* 用户信息卡片 */}
      <div className="rounded-xl border border-[#3A3A3A] bg-[#2C2C2C] p-6">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#7C3AED]/15 border-2 border-[#7C3AED]/30">
            <User className="h-8 w-8 text-[#A78BFA]" />
          </div>
          <div className="text-center">
            <h2 className="text-lg font-bold text-white">{currentUser.username}</h2>
            <p className="mt-1 text-xs text-[#888888]">
              注册时间：{currentUser.createdAt ? new Date(currentUser.createdAt).toLocaleDateString('zh-CN') : '未知'}
            </p>
          </div>
        </div>
      </div>

      {/* 云端备份状态 */}
      <div className="rounded-xl border border-[#3A3A3A] bg-[#2C2C2C] p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cloud className="h-4 w-4 text-[#888888]" />
            <span className="text-sm text-white">云端备份</span>
          </div>
          <div className="flex items-center gap-1.5">
            {cloudStatus === 'checking' && (
              <>
                <div className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse" />
                <span className="text-xs text-[#888888]">检测中...</span>
              </>
            )}
            {cloudStatus === 'connected' && (
              <>
                <CheckCircle2 className="h-4 w-4 text-green-400" />
                <span className="text-xs text-green-400">已连接</span>
              </>
            )}
            {cloudStatus === 'disconnected' && (
              <>
                <XCircle className="h-4 w-4 text-red-400" />
                <span className="text-xs text-red-400">未连接</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 修改密码 */}
      <div className="rounded-xl border border-[#3A3A3A] bg-[#2C2C2C] p-5">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-4 w-4 text-[#A78BFA]" />
          <h3 className="text-sm font-medium text-white">修改密码</h3>
        </div>

        <form onSubmit={handleChangePassword} className="space-y-3">
          <div>
            <label className="text-xs text-[#888888] mb-1.5 block">旧密码</label>
            <div className="relative">
              <input
                type={showOldPassword ? 'text' : 'password'}
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="请输入旧密码"
                disabled={loading}
                className="w-full rounded-lg border border-[#3A3A3A] bg-[#1E1E1E] px-4 py-3 pr-11 text-sm text-white placeholder-[#666666] outline-none transition-all focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/30 disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowOldPassword(!showOldPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#666666] hover:text-[#A0A0A0]"
              >
                {showOldPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs text-[#888888] mb-1.5 block">新密码</label>
            <div className="relative">
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="请输入新密码（至少 6 位）"
                disabled={loading}
                className="w-full rounded-lg border border-[#3A3A3A] bg-[#1E1E1E] px-4 py-3 pr-11 text-sm text-white placeholder-[#666666] outline-none transition-all focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/30 disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#666666] hover:text-[#A0A0A0]"
              >
                {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs text-[#888888] mb-1.5 block">确认新密码</label>
            <div className="relative">
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                placeholder="请再次输入新密码"
                disabled={loading}
                className="w-full rounded-lg border border-[#3A3A3A] bg-[#1E1E1E] px-4 py-3 pr-11 text-sm text-white placeholder-[#666666] outline-none transition-all focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/30 disabled:opacity-50"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#666666] hover:text-[#A0A0A0]"
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {confirmNewPassword && newPassword !== confirmNewPassword && (
              <p className="mt-1 text-xs text-red-400">两次密码输入不一致</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !oldPassword || !newPassword || !confirmNewPassword}
            className="w-full rounded-lg bg-[#7C3AED] py-2.5 text-sm font-medium text-white shadow-[0_2px_8px_rgba(124_58_237_0.3)] transition-all hover:bg-[#6D28D9] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? '修改中...' : '确认修改'}
          </button>
        </form>
      </div>

      {/* 退出登录 */}
      <button
        onClick={handleLogout}
        className="w-full rounded-xl border border-red-500/30 bg-red-500/5 py-3 text-sm font-medium text-red-400 transition-all hover:bg-red-500/10 active:scale-[0.98] flex items-center justify-center gap-2"
      >
        <LogOut className="h-4 w-4" />
        退出登录
      </button>

      {/* 返回首页 */}
      <div className="text-center">
        <button
          onClick={() => navigate('/')}
          className="text-xs text-[#666666] hover:text-[#A0A0A0] transition-colors"
        >
          返回首页
        </button>
      </div>
    </div>
  );
}