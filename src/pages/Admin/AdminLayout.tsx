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
  ShieldAlert,
  BarChart3,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  isAdminLoggedIn,
  clearAdminLogin,
  getCurrentAdminAccount,
  setCurrentAdminAccount,
  hasAdminPermission,
  type AdminAccount,
} from '@/lib/admin-projects';
import AdminModal from '@/components/admin/AdminModal';

const SIDEBAR_ITEMS: {
  key: string;
  label: string;
  mobileLabel: string; // 手机端缩略名（2字）
  icon: React.ElementType;
  path: string;
  permission?: keyof AdminAccount['permissions'];
}[] = [
  { key: 'projects', label: '项目管理', mobileLabel: '项目', icon: Package, path: '/admin/projects', permission: 'manage_projects' },
  { key: 'materials', label: '材料管理', mobileLabel: '材料', icon: Beaker, path: '/admin/materials', permission: 'manage_materials' },
  { key: 'market', label: '市场管理', mobileLabel: '市场', icon: Store, path: '/admin/market', permission: 'manage_market' },
  { key: 'analytics', label: '数据分析', mobileLabel: '分析', icon: BarChart3, path: '/admin/analytics' },
  { key: 'accounts', label: '账号管理', mobileLabel: '账号', icon: Users, path: '/admin/accounts', permission: 'manage_admins' },
  { key: 'settings', label: '管理员设置', mobileLabel: '设置', icon: SettingsIcon, path: '/admin/settings' },
];

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);

  // 登录态校验
  const isLoggedIn = isAdminLoggedIn();
  if (!isLoggedIn) {
    return <Navigate to="/admin/login" replace />;
  }

  const currentAccount = getCurrentAdminAccount();
  const isSuper = currentAccount?.role === 'super_admin';

  // 根据权限过滤菜单项
  const visibleItems = SIDEBAR_ITEMS.filter((item) => {
    if (isSuper) return true;
    if (!item.permission) return true; // settings 无需权限
    return hasAdminPermission(item.permission);
  });

  // 检查当前页面是否有权限访问
  const currentPage = SIDEBAR_ITEMS.find((i) => location.pathname.startsWith(i.path));
  const hasPageAccess =
    !currentPage ||
    isSuper ||
    !currentPage.permission ||
    hasAdminPermission(currentPage.permission);

  const handleConfirmLogout = () => {
    clearAdminLogin();
    setCurrentAdminAccount(null);
    setLogoutConfirmOpen(false);
    navigate('/admin/login');
  };

  return (
    <div className="flex h-screen bg-[#1E1E1E] text-white">
      {/* 侧边栏 */}
      <aside className="hidden w-56 shrink-0 border-r border-[#3A3A3A] bg-[#2C2C2C] md:flex md:flex-col">
        <div className="flex items-center gap-2 border-b border-[#3A3A3A] px-4 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#7C3AED]/20 text-[#A78BFA]">
            <LayoutDashboard className="h-4 w-4" />
          </div>
          <div>
            <div className="text-sm font-semibold">管理后台</div>
            <div className="text-[10px] text-[#888888]">EVE 造船成本</div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-2 py-3">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.path);
            return (
              <button
                key={item.key}
                onClick={() => navigate(item.path)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors',
                  isActive
                    ? 'bg-[#7C3AED]/15 text-[#A78BFA]'
                    : 'text-[#A0A0A0] hover:bg-[#3A3A3A]/50 hover:text-white',
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-[#3A3A3A] p-2 space-y-1">
          <button
            onClick={() => navigate('/')}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-[#A0A0A0] transition-colors hover:bg-[#3A3A3A]/50 hover:text-white"
          >
            <Home className="h-4 w-4" />
            返回首页
          </button>
          <button
            onClick={() => setLogoutConfirmOpen(true)}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-[#A0A0A0] transition-colors hover:bg-[#3A3A3A]/50 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            退出登录
          </button>
        </div>
      </aside>

      {/* 移动端顶部栏 + 主内容区 */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* 移动端顶部栏 */}
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

        {/* 主内容区 */}
        <div className="flex-1 overflow-y-auto md:pb-0 pb-16">
          {hasPageAccess ? (
            <Outlet />
          ) : (
            <div className="flex h-full flex-col items-center justify-center p-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#EF4444]/15">
                <ShieldAlert className="h-8 w-8 text-[#EF4444]" />
              </div>
              <h2 className="mt-4 text-lg font-semibold text-white">无权访问</h2>
              <p className="mt-2 text-sm text-[#A0A0A0]">
                当前账号没有权限访问此页面，请联系超级管理员开通权限。
              </p>
              <button
                onClick={() => navigate('/admin/projects')}
                className="mt-6 rounded-lg bg-[#7C3AED] px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-[#6D28D9]"
              >
                返回首页
              </button>
            </div>
          )}
        </div>

        {/* 移动端底部 Tab - 图标 + 缩略名（2字），字号 text-[9px] */}
        <nav className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-[#3A3A3A] bg-[#2C2C2C] md:hidden">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname.startsWith(item.path);
            return (
              <button
                key={item.key}
                onClick={() => navigate(item.path)}
                className={cn(
                  'flex flex-1 flex-col items-center gap-0.5 py-2 text-[9px] transition-colors',
                  isActive ? 'text-[#A78BFA]' : 'text-[#888888]',
                )}
              >
                <Icon className="h-5 w-5" />
                {item.mobileLabel}
              </button>
            );
          })}
        </nav>
      </div>

      {/* 退出登录确认弹窗 */}
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
