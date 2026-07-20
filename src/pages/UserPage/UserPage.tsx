import { useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { User } from 'lucide-react';
import { getCurrentUser } from '@/lib/user-service';

export default function UserPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const currentUser = getCurrentUser();

  useEffect(() => {
    // 如果已登录且当前在 /user 根路径，跳转到个人中心
    if (currentUser && location.pathname === '/user') {
      navigate('/user/profile', { replace: true });
    }
  }, [currentUser, location.pathname, navigate]);

  const isRoot = location.pathname === '/user';

  return (
    <div className="min-h-screen bg-[#0D0D0D] flex flex-col items-center justify-center p-4">
      {isRoot && (
        <div className="w-full max-w-md space-y-6">
          {/* 图标和标题 */}
          <div className="flex flex-col items-center gap-3">
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#7C3AED]/15 border border-[#7C3AED]/30">
              <User className="h-7 w-7 text-[#A78BFA]" />
            </div>
            <div className="text-center">
              <h1 className="text-xl font-bold text-white">用户中心</h1>
              <p className="mt-1 text-sm text-[#888888]">EVE 舰船建造计算器</p>
            </div>
          </div>

          {/* 导航卡片 */}
          <div className="space-y-3">
            <button
              onClick={() => navigate('/user/login')}
              className="w-full rounded-xl border border-[#3A3A3A] bg-[#2C2C2C] p-4 text-left transition-all hover:border-[#7C3AED]/50 hover:bg-[#333333] active:scale-[0.98]"
            >
              <span className="text-sm font-medium text-white">登录</span>
              <p className="mt-1 text-xs text-[#888888]">已有账号？直接登录</p>
            </button>
            <button
              onClick={() => navigate('/user/register')}
              className="w-full rounded-xl border border-[#3A3A3A] bg-[#2C2C2C] p-4 text-left transition-all hover:border-[#7C3AED]/50 hover:bg-[#333333] active:scale-[0.98]"
            >
              <span className="text-sm font-medium text-white">注册</span>
              <p className="mt-1 text-xs text-[#888888]">创建新账号</p>
            </button>
            <button
              onClick={() => navigate('/user/forgot-password')}
              className="w-full rounded-xl border border-[#3A3A3A] bg-[#2C2C2C] p-4 text-left transition-all hover:border-[#7C3AED]/50 hover:bg-[#333333] active:scale-[0.98]"
            >
              <span className="text-sm font-medium text-white">忘记密码</span>
              <p className="mt-1 text-xs text-[#888888]">重置密码</p>
            </button>
          </div>

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
      )}
      {/* 子路由内容 */}
      <Outlet />
    </div>
  );
}