import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { loginUser, setCurrentUser, getCurrentUser } from '@/lib/user-service';

export default function UserLogin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      toast.error('请输入用户名和密码');
      return;
    }

    setLoading(true);
    try {
      const result = loginUser(username, password);
      if (result.success) {
        // 保存会话
        setCurrentUser({ username, password: '', createdAt: new Date().toISOString() });
        toast.success('登录成功');
        // 跳转回首页或个人中心
        const currentUser = getCurrentUser();
        if (currentUser) {
          navigate('/user/profile', { replace: true });
        } else {
          navigate('/', { replace: true });
        }
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error('登录失败，请稍后重试');
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
          <LogIn className="h-7 w-7 text-[#A78BFA]" />
        </div>
        <div className="text-center">
          <h1 className="text-xl font-bold text-white">登录</h1>
          <p className="mt-1 text-sm text-[#888888]">欢迎回来</p>
        </div>
      </div>

      {/* 登录表单 */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-xs text-[#888888] mb-1.5 block">用户名</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="请输入用户名（汉字）"
            disabled={loading}
            className="w-full rounded-lg border border-[#3A3A3A] bg-[#1E1E1E] px-4 py-3 text-sm text-white placeholder-[#666666] outline-none transition-all focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/30 disabled:opacity-50"
          />
          {username.length > 0 && !/^[\u4e00-\u9fa5]+$/.test(username) && (
            <p className="mt-1 text-xs text-red-400">用户名只允许汉字</p>
          )}
        </div>

        <div>
          <label className="text-xs text-[#888888] mb-1.5 block">密码</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
              disabled={loading}
              className="w-full rounded-lg border border-[#3A3A3A] bg-[#1E1E1E] px-4 py-3 pr-11 text-sm text-white placeholder-[#666666] outline-none transition-all focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/30 disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#666666] hover:text-[#A0A0A0]"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !username || !password}
          className="w-full rounded-lg bg-[#7C3AED] py-3 text-sm font-medium text-white shadow-[0_2px_8px_rgba(124_58_237_0.3)] transition-all hover:bg-[#6D28D9] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? '登录中...' : '登录'}
        </button>
      </form>

      {/* 底部链接 */}
      <div className="flex items-center justify-center gap-4 text-xs">
        <button
          onClick={() => navigate('/user/register')}
          className="text-[#A78BFA] hover:text-[#C4B5FD] transition-colors"
        >
          注册账号
        </button>
        <span className="text-[#3A3A3A]">|</span>
        <button
          onClick={() => navigate('/user/forgot-password')}
          className="text-[#666666] hover:text-[#A0A0A0] transition-colors"
        >
          忘记密码
        </button>
      </div>
    </div>
  );
}