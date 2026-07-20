import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { KeyRound, Eye, EyeOff, User, ShieldCheck, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { resetPassword, getUserSecurityQuestion } from '@/lib/user-service';

export default function UserForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState<'username' | 'question' | 'reset'>('username');
  const [username, setUsername] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleCheckUsername = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username) { toast.error('请输入用户名'); return; }
    setLoading(true);
    try {
      const q = await getUserSecurityQuestion(username);
      if (q) { setQuestion(q); setStep('question'); }
      else { toast.error('该用户名不存在或未设置密保'); }
    } catch { toast.error('查询失败，请稍后重试'); }
    finally { setLoading(false); }
  };

  const handleCheckAnswer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!answer) { toast.error('请输入密保答案'); return; }
    setStep('reset');
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword) { toast.error('请输入新密码'); return; }
    if (newPassword.length < 6) { toast.error('新密码至少 6 位'); return; }
    if (newPassword !== confirmPassword) { toast.error('两次密码输入不一致'); return; }

    setLoading(true);
    try {
      const result = await resetPassword(username, answer, newPassword);
      if (result.success) {
        toast.success('密码重置成功，请使用新密码登录');
        navigate('/user/login', { replace: true });
      } else {
        toast.error(result.message);
      }
    } catch { toast.error('重置失败，请稍后重试'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-[#0D0D0D] flex items-center justify-center p-4">
      <div className="w-full max-w-[420px]">
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#7C3AED]/15 border border-[#7C3AED]/30">
            <KeyRound className="h-8 w-8 text-[#A78BFA]" />
          </div>
          <h1 className="text-2xl font-bold text-white">忘记密码</h1>
          <p className="text-sm text-[#888888]">通过密保问题重置密码</p>
        </div>

        <div className="rounded-2xl border border-[#3A3A3A] bg-[#1E1E1E] p-6 md:p-8 shadow-[0_8px_32px_rgba(0_0_0_0.3)]">
          {/* 步骤指示器 */}
          <div className="flex items-center justify-center gap-2 mb-6">
            {['username', 'question', 'reset'].map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold transition-colors
                  ${step === s ? 'bg-[#7C3AED] text-white' : step === 'reset' && s === 'username' || step === 'reset' && s === 'question' ? 'bg-[#7C3AED]/30 text-[#A78BFA]' : 'bg-[#3A3A3A] text-[#888888]'}`}>
                  {i + 1}
                </div>
                {i < 2 && <div className={`h-0.5 w-6 rounded-full ${step !== 'username' && (s === 'username' || step === 'reset') ? 'bg-[#7C3AED]/50' : 'bg-[#3A3A3A]'}`} />}
              </div>
            ))}
          </div>

          {/* 步骤1：输入用户名 */}
          {step === 'username' && (
            <form onSubmit={handleCheckUsername} className="space-y-5">
              <div>
                <label className="block text-xs text-[#888888] mb-1.5">用户名</label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#666666]" />
                  <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} maxLength={6}
                    placeholder="请输入您的用户名" disabled={loading}
                    className="w-full rounded-xl border border-[#3A3A3A] bg-[#2C2C2C] py-3 pl-10 pr-4 text-sm text-white placeholder-[#666666] outline-none transition-all focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20"
                  />
                </div>
              </div>
              <button type="submit" disabled={loading || !username}
                className="w-full rounded-xl bg-[#7C3AED] py-3 text-sm font-semibold text-white shadow-[0_4px_16px_rgba(124_58_237_0.35)] transition-all hover:bg-[#6D28D9] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '查询中...' : '下一步'}
              </button>
            </form>
          )}

          {/* 步骤2：回答密保 */}
          {step === 'question' && (
            <form onSubmit={handleCheckAnswer} className="space-y-5">
              <div className="rounded-xl bg-[#7C3AED]/10 border border-[#7C3AED]/30 p-4">
                <p className="text-xs text-[#888888] mb-1">密保问题</p>
                <p className="text-sm font-medium text-[#A78BFA]">{question}</p>
              </div>
              <div>
                <label className="block text-xs text-[#888888] mb-1.5">密保答案</label>
                <div className="relative">
                  <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#666666]" />
                  <input type="text" value={answer} onChange={(e) => setAnswer(e.target.value)}
                    placeholder="请输入密保答案" disabled={loading}
                    className="w-full rounded-xl border border-[#3A3A3A] bg-[#2C2C2C] py-3 pl-10 pr-4 text-sm text-white placeholder-[#666666] outline-none transition-all focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/20"
                  />
                </div>
              </div>
              <div className="flex gap-3">
                <button type="button" onClick={() => setStep('username')}
                  className="flex-1 rounded-xl border border-[#3A3A3A] bg-[#2C2C2C] py-3 text-sm text-[#A0A0A0] transition-colors hover:bg-[#3A3A3A]">上一步</button>
                <button type="submit" disabled={loading || !answer}
                  className="flex-1 rounded-xl bg-[#7C3AED] py-3 text-sm font-semibold text-white shadow-[0_4px_16px_rgba(124_58_237_0.35)] transition-all hover:bg-[#6D28D9] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                >下一步</button>
              </div>
            </form>
          )}

          {/* 步骤3：重置密码 */}
          {step === 'reset' && (
            <form onSubmit={handleReset} className="space-y-5">
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
              <div className="flex gap-3">
                <button type="button" onClick={() => setStep('question')}
                  className="flex-1 rounded-xl border border-[#3A3A3A] bg-[#2C2C2C] py-3 text-sm text-[#A0A0A0] transition-colors hover:bg-[#3A3A3A]">上一步</button>
                <button type="submit" disabled={loading || !newPassword || !confirmPassword || newPassword !== confirmPassword}
                  className="flex-1 rounded-xl bg-[#7C3AED] py-3 text-sm font-semibold text-white shadow-[0_4px_16px_rgba(124_58_237_0.35)] transition-all hover:bg-[#6D28D9] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                >重置密码</button>
              </div>
            </form>
          )}

          <div className="mt-6 text-center text-xs">
            <Link to="/user/login" className="text-[#A78BFA] hover:text-[#C4B5FD] transition-colors">返回登录</Link>
          </div>
        </div>

        <div className="mt-6 text-center">
          <button onClick={() => navigate('/')} className="text-xs text-[#666666] hover:text-[#A0A0A0] transition-colors">← 返回首页</button>
        </div>
      </div>
    </div>
  );
}
