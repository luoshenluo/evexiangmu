import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { resetPassword } from '@/lib/user-service';

export default function UserForgotPassword() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username) {
      toast.error('请输入用户名');
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
      const result = await resetPassword(username, newPassword);
      if (result.success) {
        toast.success('密码重置成功，请使用新密码登录');
        navigate('/user/login', { replace: true });
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error('重置失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md space-y-6">
      {/* 返回 */}
      <button
        onClick={() => navigate('/user')}
        className="flex items-center gap-1 text-xs text-[#666666] hover:text-[#A0A0A0] transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        返回
      </button>

      {/* 图标和标题 */}
      <div className="flex flex-col items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#7C3AED]/15 border border-[#7C3AED]/30">
          <KeyRound className="h-7 w-7 text-[#A78BFA]" />
        </div>
        <div className="text-center">
          <h1 className="text-xl font-bold text-white">忘记密码</h1>
          <p className="mt-1 text-sm text-[#888888]">重置您的密码</p>
        </div>
      </div>

      {/* 重置表单 */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-xs text-[#888888] mb-1.5 block">用户名</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="请输入您的用户名"
            disabled={loading}
            className="w-full rounded-lg border border-[#3A3A3A] bg-[#1E1E1E] px-4 py-3 text-sm text-white placeholder-[#666666] outline-none transition-all focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/30 disabled:opacity-50"
          />
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
          disabled={loading || !username || !newPassword || !confirmNewPassword}
          className="w-full rounded-lg bg-[#7C3AED] py-3 text-sm font-medium text-white shadow-[0_2px_8px_rgba(124_58_237_0.3)] transition-all hover:bg-[#6D28D9] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? '重置中...' : '重置密码'}
        </button>
      </form>

      {/* 底部链接 */}
      <div className="text-center">
        <button
          onClick={() => navigate('/user/login')}
          className="text-xs text-[#A78BFA] hover:text-[#C4B5FD] transition-colors"
        >
          返回登录
        </button>
      </div>
    </div>
  );
}