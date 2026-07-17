import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Lock, ArrowLeft, Check, X } from 'lucide-react';
import { verifyAdminPassword, setAdminLoggedIn } from '@/lib/admin-projects';
import AdminModal from '@/components/admin/AdminModal';

const ADMIN_USERNAME = 'admin';

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // 弹窗状态
  const [successOpen, setSuccessOpen] = useState(false);
  const [errorOpen, setErrorOpen] = useState(false);

  // 登录成功：1.5秒后跳转
  useEffect(() => {
    if (!successOpen) return;
    const timer = setTimeout(() => {
      navigate('/admin/projects');
    }, 1500);
    return () => clearTimeout(timer);
  }, [successOpen, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setErrorOpen(true);
      return;
    }
    setLoading(true);
    try {
      if (username === ADMIN_USERNAME && await verifyAdminPassword(password)) {
        setAdminLoggedIn(true);
        setSuccessOpen(true);
      } else {
        setErrorOpen(true);
      }
    } catch {
      setErrorOpen(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col bg-[#1E1E1E] text-white">
      {/* 响应式背景装饰 */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-[#7C3AED]/[0.04] blur-[100px]" />
        <div className="absolute -bottom-40 -left-40 h-[400px] w-[400px] rounded-full bg-[#7C3AED]/[0.03] blur-[80px]" />
        <div className="absolute top-1/3 left-1/2 h-[300px] w-[300px] -translate-x-1/2 rounded-full bg-[#7C3AED]/[0.02] blur-[60px] hidden md:block" />
        {/* 桌面端额外的装饰 */}
        <div className="absolute top-1/4 right-1/4 h-2 w-2 rounded-full bg-[#A78BFA]/20 hidden lg:block" />
        <div className="absolute bottom-1/3 left-1/5 h-3 w-3 rounded-full bg-[#7C3AED]/15 hidden lg:block" />
      </div>

      {/* 顶部返回栏 */}
      <div className="relative z-10 flex items-center gap-2 border-b border-[#3A3A3A] px-4 py-3">
        <button
          onClick={() => navigate('/')}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#3A3A3A] bg-[#2C2C2C] text-white transition-colors hover:border-[#555555]"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-base font-semibold">管理后台</h1>
      </div>

      {/* 登录卡片 */}
      <div className="relative z-10 flex flex-1 items-center justify-center px-4 sm:px-6">
        <div className="w-full max-w-sm min-w-0">
          <div className="mb-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#7C3AED]/15 text-[#A78BFA]">
              <Shield className="h-8 w-8" />
            </div>
            <h2 className="text-xl font-bold text-white">管理员登录</h2>
            <p className="mt-1 text-sm text-[#A0A0A0]">请输入管理员账号密码</p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="space-y-4 rounded-xl border border-[#3A3A3A] bg-[#2C2C2C] p-5 shadow-[0_2px_8px_rgba(0_0_0_0.2)] sm:p-6 sm:shadow-[0_4px_16px_rgba(0_0_0_0.25)]"
          >
            <div>
              <label className="mb-1.5 block text-xs text-[#A0A0A0]">账号</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="请输入账号"
                className="w-full rounded-md border border-[#444444] bg-[#1E1E1E] px-3 py-2.5 text-sm text-white placeholder-[#666666] outline-none transition-all focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/30"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs text-[#A0A0A0]">密码</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#666666]" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="请输入密码"
                  className="w-full rounded-md border border-[#444444] bg-[#1E1E1E] pl-9 pr-3 py-2.5 text-sm text-white placeholder-[#666666] outline-none transition-all focus:border-[#7C3AED] focus:ring-2 focus:ring-[#7C3AED]/30"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-[#7C3AED] py-2.5 text-sm font-medium text-white shadow-[0_2px_8px_rgba(124_58_237_0.3)] transition-all hover:bg-[#6D28D9] active:scale-[0.98] disabled:opacity-50"
            >
              {loading ? '登录中...' : '登录'}
            </button>
          </form>
        </div>
      </div>

      {/* 登录成功弹窗 */}
      <AdminModal
        open={successOpen}
        icon={<Check className="h-6 w-6" />}
        iconBgClass="bg-[#22C55E]/15"
        iconColorClass="text-[#22C55E]"
        title="登录成功"
        description="正在进入管理后台..."
      />

      {/* 密码错误弹窗 */}
      <AdminModal
        open={errorOpen}
        onClose={() => setErrorOpen(false)}
        icon={<X className="h-6 w-6" />}
        iconBgClass="bg-[#EF4444]/15"
        iconColorClass="text-[#EF4444]"
        title="账号或密码错误"
        description="请检查账号密码后重试"
      >
        <button
          onClick={() => setErrorOpen(false)}
          className="w-full rounded-lg bg-[#7C3AED] py-2.5 text-sm font-medium text-white transition-all hover:bg-[#6D28D9] active:scale-[0.98]"
        >
          确定
        </button>
      </AdminModal>
    </div>
  );
}
