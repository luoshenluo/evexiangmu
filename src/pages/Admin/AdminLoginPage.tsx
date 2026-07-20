import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { verifyAdminLogin, verifyAdminPassword, setAdminLoggedIn, setCurrentAdminAccount, type AdminAccount } from '@/lib/admin-projects';
import AdminModal from '@/components/admin/AdminModal';

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 5 * 60 * 1000;

interface LoginAttempt { count: number; lastAttempt: number; }

function getAttempts(): LoginAttempt {
  try { const raw = localStorage.getItem('eve_login_attempts'); return raw ? JSON.parse(raw) : { count: 0, lastAttempt: 0 }; } catch { return { count: 0, lastAttempt: 0 }; }
}
function saveAttempts(attempt: LoginAttempt): void { try { localStorage.setItem('eve_login_attempts', JSON.stringify(attempt)); } catch { /* ignore */ } }
function isLocked(): boolean {
  const attempts = getAttempts();
  if (attempts.count >= MAX_ATTEMPTS) {
    const elapsed = Date.now() - attempts.lastAttempt;
    if (elapsed < LOCKOUT_MS) return true;
    saveAttempts({ count: 0, lastAttempt: 0 });
  }
  return false;
}
function recordFailedAttempt(): void { const attempts = getAttempts(); saveAttempts({ count: attempts.count + 1, lastAttempt: Date.now() }); }
function clearAttempts(): void { try { localStorage.removeItem('eve_login_attempts'); } catch { /* ignore */ } }

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [successOpen, setSuccessOpen] = useState(false);
  const [locked, setLocked] = useState(isLocked);

  useEffect(() => {
    if (!locked) return;
    const timer = setInterval(() => { if (!isLocked()) setLocked(false); }, 5000);
    return () => clearInterval(timer);
  }, [locked]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (locked) { toast.error('登录失败次数过多，请 5 分钟后重试'); return; }
    if (!username || !password) { toast.error('请输入用户名和密码'); return; }
    setLoading(true);
    try {
      const account = await verifyAdminLogin(username, password);
      if (account) {
        const acc: AdminAccount = { id: account.id, username: account.username, password_hash: '', role: account.role, permissions: account.permissions, created_at: account.created_at, updated_at: account.updated_at };
        setAdminLoggedIn(acc);
        setCurrentAdminAccount(acc);
        clearAttempts();
        setSuccessOpen(true);
        return;
      }
      if (await verifyAdminPassword(password)) {
        const acc: AdminAccount = { id: 'default_admin', username, password_hash: '', role: 'super_admin', permissions: { manage_projects: true, manage_materials: true, manage_market: true, manage_admins: true }, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
        setAdminLoggedIn(acc);
        setCurrentAdminAccount(acc);
        clearAttempts();
        setSuccessOpen(true);
        return;
      }
      recordFailedAttempt();
      toast.error('用户名或密码错误');
    } catch { recordFailedAttempt(); toast.error('登录失败'); } finally { setLoading(false); }
  };

  const handleGoHome = () => { setSuccessOpen(false); navigate('/admin/projects'); };

  return (
    <div className="min-h-screen bg-[#0D0D0D] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#7C3AED]/15 border border-[#7C3AED]/30"><Shield className="h-7 w-7 text-[#A78BFA]" /></div>
          <div className="text-center"><h1 className="text-xl font-bold text-white">管理后台</h1><p className="mt-1 text-sm text-[#888888]">EVE 舰船建造计算器</p></div>
        </div>
        {locked && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400 text-center">登录失败次数过多，请 5 分钟后重试</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs text-[#888888] mb-1.5 block">用户名</label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="请输入用户名" disabled={locked || loading} className="w-full rounded-lg border border-[#3A3A3A] bg-[#1E1E1E] px-4 py-3 text-sm text-white placeholder-[#666666] outline-none transition-all focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/30 disabled:opacity-50" />
          </div>
          <div>
            <label className="text-xs text-[#888888] mb-1.5 block">密码</label>
            <div className="relative">
              <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="请输入密码" disabled={locked || loading} className="w-full rounded-lg border border-[#3A3A3A] bg-[#1E1E1E] px-4 py-3 pr-11 text-sm text-white placeholder-[#666666] outline-none transition-all focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/30 disabled:opacity-50" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#666666] hover:text-[#A0A0A0]">{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button>
            </div>
          </div>
          <button type="submit" disabled={locked || loading || !username || !password} className="w-full rounded-lg bg-[#7C3AED] py-3 text-sm font-medium text-white shadow-[0_2px_8px_rgba(124_58_237_0.3)] transition-all hover:bg-[#6D28D9] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? '登录中...' : '登录'}
          </button>
        </form>
        <div className="text-center"><button onClick={() => navigate('/')} className="text-xs text-[#666666] hover:text-[#A0A0A0] transition-colors">返回首页</button></div>
      </div>
      <AdminModal open={successOpen} onClose={handleGoHome} icon={<Shield className="h-6 w-6" />} iconBgClass="bg-[#7C3AED]/15" iconColorClass="text-[#A78BFA]" title="登录成功" description="欢迎回到管理后台">
        <button onClick={handleGoHome} className="w-full rounded-lg bg-[#7C3AED] py-2.5 text-sm font-medium text-white transition-all hover:bg-[#6D28D9] active:scale-[0.98]">进入后台</button>
      </AdminModal>
    </div>
  );
}