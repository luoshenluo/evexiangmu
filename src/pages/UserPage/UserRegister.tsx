import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { registerUser, validateUsername, setCurrentUser } from '@/lib/user-service';

export default function UserRegister() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  // 用户名实时验证结果
  const usernameValidation = username ? validateUsername(username) : null;

  const handleUsernameChange = (value: string) => {
    // 只允许输入汉字
    const chineseOnly = value.replace(/[^\u4e00-\u9fa5]/g, '');
    if (chineseOnly.length <= 6) {
      setUsername(chineseOnly);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!username) {
      toast.error('请输入用户名');
      return;
    }
    if (usernameValidation && !usernameValidation.valid) {
      toast.error(usernameValidation.message);
      return;
    }
    if (!password) {
      toast.error('请输入密码');
      return;
    }
    if (password.length < 6) {
      toast.error('密码至少 6 位');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('两次密码输入不一致');
      return;
    }

    setLoading(true);
    try {
      const result = registerUser(username, password);
      if (result.success) {
        // 注册成功后自动登录
        setCurrentUser({ username, password, createdAt: new Date().toISOString() });
        toast.success('注册成功');
        // 跳转到个人中心
        navigate('/user/profile', { replace: true });
      } else {
        toast.error(result.message);
      }
    } catch {
      toast.error('注册失败，请稍后重试');
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
          <UserPlus className="h-7 w-7 text-[#A78BFA]" />
        </div>
        <div className="text-center">
          <h1 className="text-xl font-bold text-white">注册</h1>
          <p className="mt-1 text-sm text-[#888888]">创建新账号</p>
        </div>
      </div>

      {/* 注册表单 */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 用户名 */}
        <div>
          <label className="text-xs text-[#888888] mb-1.5 block">用户名</label>
          <div className="relative">
            <input
              type="text"
              value={username}
              onChange={(e) => handleUsernameChange(e.target.value)}
              placeholder="请输入汉字用户名"
              disabled={loading}
              maxLength={6}
              className="w-full rounded-lg border border-[#3A3A3A] bg-[#1E1E1E] px-4 py-3 pr-14 text-sm text-white placeholder-[#666666] outline-none transition-all focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/30 disabled:opacity-50"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#666666]">
              {username.length}/6
            </span>
          </div>
          {usernameValidation && (
            <p className={`mt-1 text-xs ${usernameValidation.valid ? 'text-green-400' : 'text-red-400'}`}>
              {usernameValidation.message || '用户名格式正确'}
            </p>
          )}
        </div>

        {/* 密码 */}
        <div>
          <label className="text-xs text-[#888888] mb-1.5 block">密码</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码（至少 6 位）"
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

        {/* 确认密码 */}
        <div>
          <label className="text-xs text-[#888888] mb-1.5 block">确认密码</label>
          <div className="relative">
            <input
              type={showConfirmPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="请再次输入密码"
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
          {confirmPassword && password !== confirmPassword && (
            <p className="mt-1 text-xs text-red-400">两次密码输入不一致</p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading || !username || !password || !confirmPassword}
          className="w-full rounded-lg bg-[#7C3AED] py-3 text-sm font-medium text-white shadow-[0_2px_8px_rgba(124_58_237_0.3)] transition-all hover:bg-[#6D28D9] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? '注册中...' : '注册'}
        </button>
      </form>

      {/* 底部链接 */}
      <div className="text-center">
        <button
          onClick={() => navigate('/user/login')}
          className="text-xs text-[#A78BFA] hover:text-[#C4B5FD] transition-colors"
        >
          已有账号？去登录
        </button>
      </div>
    </div>
  );
}