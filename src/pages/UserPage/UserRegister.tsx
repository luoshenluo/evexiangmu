import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { UserPlus, Eye, EyeOff, User, Lock, ShieldCheck, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { registerUser, setCurrentUser, validateUsername, getSecurityQuestions } from '@/lib/user-service';

export default function UserRegister() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [securityQuestion, setSecurityQuestion] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const questions = getSecurityQuestions();
  const usernameValid = validateUsername(username);
  const passwordMatch = confirmPassword === '' || password === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!usernameValid.valid) { toast.error(usernameValid.message); return; }
    if (password.length < 6) { toast.error('密码至少 6 位'); return; }
    if (password !== confirmPassword) { toast.error('两次密码输入不一致'); return; }
    if (!securityQuestion) { toast.error('请选择密保问题'); return; }
    if (!securityAnswer) { toast.error('请输入密保答案'); return; }

    setLoading(true);
    try {
      const result = await registerUser(username, password, securityQuestion, securityAnswer);
      if (result.success) {
        setCurrentUser({ username, password: '', createdAt: new Date().toISOString() });
        toast.success('注册成功，已自动登录');
        navigate('/', { replace: true });
      } else {
        toast.error(result.message);
      }
    } catch { toast.error('注册失败，请稍后重试'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#0D0D0D] flex items-center justify-center p-4">
      <div className="w-full max-w-[460px]">
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#7C3AED]/15 border border-[#7C3AED]/30">
            <UserPlus className="h-8 w-8 text-[#A78BFA]" />
          </div>
          <h1 className="text-2xl font-bold text-white">注册账号</h1>
          <p className="text-sm text-[#888888]">创建账号以同步云端数据</p>
        </div>

        <div className="rounded-2xl border border-[#3A3A3A] bg-[#1E1E1E] p-6 md:p-8 shadow-[0_8px_32px_rgba(0_0_0_0.3)]">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* 用户名 */}
            <div>
              <label className="block text-xs text-[#888888] mb-1.5">用户名</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#666666]" />
                <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} maxLength={6}
                  placeholder="仅限汉字，最多6个字" disabled={loading}
                  className="w-full rounded-xl border border-[#3A3A3A] bg-[#2C2C2C] py-3 pl-10 pr-14 text-sm text-white placeholder-[#666666] outline-none transition-all focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-[#666666]">{username.length}/6</span>
              </div>
              {username && (
                <p className={`mt-1 text-[11px] ${usernameValid.valid ? 'text-[#22C55E]' : 'text-red-400'}`}>
                  {usernameValid.valid ? '✓ 用户名可用' : usernameValid.message}
                </p>
              )}
            </div>

            {/* 密码 */}
            <div>
              <label className="block text-xs text-[#888888] mb-1.5">密码</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#666666]" />
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)}
                  placeholder="至少 6 位" disabled={loading}
                  className="w-full rounded-xl border border-[#3A3A3A] bg-[#2C2C2C] py-3 pl-10 pr-11 text-sm text-white placeholder-[#666666] outline-none transition-all focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#666666] hover:text-[#A0A0A0]">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* 确认密码 */}
            <div>
              <label className="block text-xs text-[#888888] mb-1.5">确认密码</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#666666]" />
                <input type={showConfirm ? 'text' : 'password'} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="再次输入密码" disabled={loading}
                  className="w-full rounded-xl border border-[#3A3A3A] bg-[#2C2C2C] py-3 pl-10 pr-11 text-sm text-white placeholder-[#666666] outline-none transition-all focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20"
                />
                <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#666666] hover:text-[#A0A0A0]">
                  {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {confirmPassword && !passwordMatch && (
                <p className="mt-1 text-[11px] text-red-400">两次密码输入不一致</p>
              )}
            </div>

            {/* 密保问题 */}
            <div>
              <label className="block text-xs text-[#888888] mb-1.5">密保问题</label>
              <div className="relative">
                <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#666666]" />
                <select value={securityQuestion} onChange={(e) => setSecurityQuestion(e.target.value)} disabled={loading}
                  className="w-full appearance-none rounded-xl border border-[#3A3A3A] bg-[#2C2C2C] py-3 pl-10 pr-10 text-sm text-white outline-none transition-all focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20"
                >
                  <option value="">请选择密保问题</option>
                  {questions.map((q) => <option key={q} value={q}>{q}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#666666] pointer-events-none" />
              </div>
            </div>

            {/* 密保答案 */}
            <div>
              <label className="block text-xs text-[#888888] mb-1.5">密保答案</label>
              <div className="relative">
                <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#666666]" />
                <input type="text" value={securityAnswer} onChange={(e) => setSecurityAnswer(e.target.value)}
                  placeholder="请牢记密保答案，用于找回密码" disabled={loading}
                  className="w-full rounded-xl border border-[#3A3A3A] bg-[#2C2C2C] py-3 pl-10 pr-4 text-sm text-white placeholder-[#666666] outline-none transition-all focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20"
                />
              </div>
            </div>

            <button type="submit" disabled={loading || !username || !password || !confirmPassword || !securityQuestion || !securityAnswer}
              className="w-full rounded-xl bg-[#7C3AED] py-3 text-sm font-semibold text-white shadow-[0_4px_16px_rgba(124_58_237_0.35)] transition-all hover:bg-[#6D28D9] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '注册中...' : '注册'}
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-[#A0A0A0]">
            已有账号？<Link to="/user/login" className="text-[#A78BFA] hover:text-[#C4B5FD] transition-colors ml-1">去登录</Link>
          </div>
        </div>

        <div className="mt-6 text-center">
          <button onClick={() => navigate('/')} className="text-xs text-[#666666] hover:text-[#A0A0A0] transition-colors">← 返回首页</button>
        </div>
      </div>
    </div>
  );
}
