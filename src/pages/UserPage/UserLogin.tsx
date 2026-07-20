import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LogIn, Eye, EyeOff, User, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { loginUser, setCurrentUser } from '@/lib/user-service';

export default function UserLogin() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) { toast.error('请输入用户名和密码'); return; }
    setLoading(true);
    try {
      const result = await loginUser(username, password);
      if (result.success) {
        setCurrentUser({ username, password: '', createdAt: new Date().toISOString() });
        toast.success('登录成功');
        navigate('/', { replace: true });
      } else {
        toast.error(result.message);
      }
    } catch { toast.error('登录失败，请稍后重试'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#0D0D0D] flex items-center justify-center p-4">
      <div className="w-full max-w-[420px]">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#7C3AED]/15 border border-[#7C3AED]/30">
            <LogIn className="h-8 w-8 text-[#A78BFA]" />
          </div>
          <h1 className="text-2xl font-bold text-white">用户登录</h1>
          <p className="text-sm text-[#888888]">登录后可同步云端数据</p>
        </div>

        {/* 表单卡片 */}
        <div className="rounded-2xl border border-[#3A3A3A] bg-[#1E1E1E] p-6 md:p-8 shadow-[0_8px_32px_rgba(0_0_0_0.3)]">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* 用户名 */}
            <div>
              <label className="block text-xs text-[#888888] mb-1.5">用户名</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#666666]" />
                <input
                  type="text" value={username} onChange={(e) => setUsername(e.target.value)} maxLength={6}
                  placeholder="请输入汉字用户名" disabled={loading}
                  className="w-full rounded-xl border border-[#3A3A3A] bg-[#2C2C2C] py-3 pl-10 pr-4 text-sm text-white placeholder-[#666666] outline-none transition-all focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20"
                />
              </div>
            </div>

            {/* 密码 */}
            <div>
              <label className="block text-xs text-[#888888] mb-1.5">密码</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#666666]" />
                <input
                  type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="请输入密码" disabled={loading}
                  className="w-full rounded-xl border border-[#3A3A3A] bg-[#2C2C2C] py-3 pl-10 pr-11 text-sm text-white placeholder-[#666666] outline-none transition-all focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#666666] hover:text-[#A0A0A0]">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading || !username || !password}
              className="w-full rounded-xl bg-[#7C3AED] py-3 text-sm font-semibold text-white shadow-[0_4px_16px_rgba(124_58_237_0.35)] transition-all hover:bg-[#6D28D9] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '登录中...' : '登录'}
            </button>
          </form>

          {/* 底部链接 */}
          <div className="mt-6 flex items-center justify-between text-xs">
            <Link to="/user/forgot-password" className="text-[#A78BFA] hover:text-[#C4B5FD] transition-colors">忘记密码？</Link>
            <Link to="/user/register" className="text-[#A0A0A0] hover:text-white transition-colors">注册账号</Link>
          </div>
        </div>

        <div className="mt-6 text-center">
          <button onClick={() => navigate('/')} className="text-xs text-[#666666] hover:text-[#A0A0A0] transition-colors">← 返回首页</button>
        </div>
      </div>
    </div>
  );
}
