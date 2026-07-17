import { useState } from 'react';
import { Navigate, Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  Settings as SettingsIcon,
  LogOut,
  ArrowLeft,
  Beaker,
  Users,
  Store,
  Home,
  BarChart3,
  Megaphone,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { isAdminLoggedIn, clearAdminLogin } from '@/lib/admin-projects';
import AdminModal from '@/components/admin/AdminModal';

const SIDEBAR_ITEMS = [
  { key: 'analytics', label: '数据统计', icon: BarChart3, path: '/admin/analytics' },
  { key: 'projects', label: '项目管理', icon: Package, path: '/admin/projects' },
  { key: 'materials', label: '材料管理', icon: Beaker, path: '/admin/materials' },
  { key: 'market', label: '市场管理', icon: Store, path: '/admin/market' },
  { key: 'announcement', label: '公告管理', icon: Megaphone, path: '/admin/announcement' },
  { key: 'accounts', label: '账号管理', icon: Users, path: '/admin/accounts' },
  { key: 'settings', label: '管理员设置', icon: SettingsIcon, path: '/admin/settings' },
];

const APP_VERSION = 'v0.1.0';

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  const isLoggedIn = isAdminLoggedIn();
  if (!isLoggedIn) {
    return <Navigate to="/admin/login" replace />;
  }

  const handleConfirmLogout = () => {
    clearAdminLogin();
    setLogoutConfirmOpen(false);
    navigate('/admin/login');
  };

  return (
    <div className="flex h-screen bg-[#1E1E1E] text-white">
      {/* 侧边栏 - md 及以上显示 */}
      <aside className="hidden w-64 shrink-0 border-r border-[#3A3A3A] bg-[#2C2C2C] md:flex md:flex-col">
        <div className="flex items-center gap-3 border-b border-[#3A3A3A] px-5 py-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#7C3AED]/20 text-[#A78BFA]">
            <LayoutDashboard className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-semibold">管理后台</div>
            <div className="text-[10px] text-[#888888]">EVE 造船成本</div>
          </div>
        </div>
        <nav className="flex-1 space-y-0.5 px-2 py-4">
          {SIDEBAR_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.path);
            return (
              <button
                key={item.key}
                onClick={() => navigate(item.path)}
                className={cn(
                  'group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-200',
                  'border-l-2',
                  isActive
                    ? 'border-l-[#A78BFA] bg-[#7C3AED]/15 text-[#A78BFA]'
                    : 'border-l-transparent text-[#A0A0A0] hover:bg-[#3A3A3A]/70 hover:text-white',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
                {isActive && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#A78BFA]" />
                )}
              </button>
            );
          })}
        </nav>
        <div className="border-t border-[#3A3A3A] p-2">
          <button
            onClick={() => navigate('/')}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-[#A0A0A0] transition-colors duration-200 hover:bg-[#3A3A3A]/70 hover:text-white"
          >
            <div className="flex h-4 w-4 shrink-0 items-center justify-center">
              <ArrowLeft className="h-4 w-4" />
            </div>
            返回用户界面
          </button>
          <button
            onClick={() => setLogoutConfirmOpen(true)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-[#A0A0A0] transition-colors duration-200 hover:bg-[#EF4444]/10 hover:text-[#EF4444]"
          >
            <div className="flex h-4 w-4 shrink-0 items-center justify-center">
              <LogOut className="h-4 w-4" />
            </div>
            退出登录
          </button>
        </div>
        <div className="border-t border-[#3A3A3A] px-4 py-2 text-center text-[10px] text-[#555555] select-none">
          {APP_VERSION}
        </div>
      </aside>
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#3A3A3A] px-4 py-3 md:hidden">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/')}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#3A3A3A] bg-[#2C2C2C] text-white transition-colors hover:border-[#555555]"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <h1 className="text-base font-semibold">管理后台</h1>
          </div>
          <button
            onClick={() => setLogoutConfirmOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#3A3A3A] bg-[#2C2C2C] text-[#A0A0A0] transition-colors hover:border-[#555555] hover:text-white"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
        <div
          className={cn(
            'flex-1 overflow-y-auto',
            '[&::-webkit-scrollbar]:w-1.5',
            '[&::-webkit-scrollbar-track]:bg-transparent',
            '[&::-webkit-scrollbar-thumb]:rounded-full',
            '[&::-webkit-scrollbar-thumb]:bg-[#3A3A3A]',
            '[&::-webkit-scrollbar-thumb]:hover:bg-[#555555]',
            'pb-16 md:pb-0',
          )}
        >
          <div className="p-4 md:p-6 lg:p-8">
            <Outlet />
          </div>
        </div>
        <nav className="fixed bottom-0 left-0 right-0 z-40 flex items-stretch border-t border-[#3A3A3A] bg-[#2C2C2C]/95 backdrop-blur-sm md:hidden">
          {SIDEBAR_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.path);
            return (
              <button
                key={item.key}
                onClick={() => navigate(item.path)}
                className={cn(
                  'relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[9px] leading-tight transition-colors duration-150',
                  isActive
                    ? 'text-[#A78BFA] before:absolute before:top-0 before:left-1/4 before:right-1/4 before:h-0.5 before:rounded-full before:bg-[#A78BFA]'
                    : 'text-[#888888] active:bg-[#3A3A3A]/50',
                )}
              >
                <Icon className="h-[18px] w-[18px]" />
                <span>{item.label}</span>
              </button>
            );
          })}
          <div className="w-px self-stretch bg-[#3A3A3A] my-2" />
          <button
            onClick={() => navigate('/')}
            className="flex flex-col items-center justify-center gap-0.5 px-1.5 py-2 text-[9px] leading-tight text-[#888888] transition-colors duration-150 active:bg-[#3A3A3A]/50"
          >
            <Home className="h-[18px] w-[18px]" />
            <span>返回主页</span>
          </button>
          <button
            onClick={() => setLogoutConfirmOpen(true)}
            className="flex flex-col items-center justify-center gap-0.5 px-1.5 py-2 text-[9px] leading-tight text-[#888888] transition-colors duration-150 active:text-[#EF4444] active:bg-[#EF4444]/10"
          >
            <LogOut className="h-[18px] w-[18px]" />
            <span>退出</span>
          </button>
        </nav>
      </div>
      <AdminModal
        open={logoutConfirmOpen}
        onClose={() => setLogoutConfirmOpen(false)}
        icon={<LogOut className="h-5 w-5" />}
        iconBgClass="bg-[#EF4444]/15"
        iconColorClass="text-[#EF4444]"
        title="确定要退出登录吗？"
        description="退出后需要重新输入账号密码才能进入管理后台"
      >
        <div className="flex gap-3">
          <button
            onClick={() => setLogoutConfirmOpen(false)}
            className="flex-1 rounded-lg border border-[#444444] bg-[#1E1E1E] py-2.5 text-sm text-white transition-colors hover:bg-[#363636]"
          >
            取消
          </button>
          <button
            onClick={handleConfirmLogout}
            className="flex-1 rounded-lg bg-[#EF4444] py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#DC2626]"
          >
            确定退出
          </button>
        </div>
      </AdminModal>
    </div>
  );
}
