import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import HomePage from '@/pages/HomePage/HomePage';
import MarketPage from '@/pages/MarketPage/MarketPage';
import NotFoundPage from '@/pages/NotFoundPage/NotFoundPage';
import AdminLoginPage from '@/pages/Admin/AdminLoginPage';
import AdminLayout from '@/pages/Admin/AdminLayout';
import AdminProjectsPage from '@/pages/Admin/AdminProjectsPage';
import AdminProjectEditPage from '@/pages/Admin/AdminProjectEditPage';
import AdminSettingsPage from '@/pages/Admin/AdminSettingsPage';
import AdminMaterialsPage from '@/pages/Admin/AdminMaterialsPage';
import AdminAccountsPage from '@/pages/Admin/AdminAccountsPage';
import AdminMarketPage from '@/pages/Admin/AdminMarketPage';
import AdminAnalyticsPage from '@/pages/Admin/AdminAnalyticsPage';
import AdminAnnouncementPage from '@/pages/Admin/AdminAnnouncementPage';

// 根路径快捷重定向（兼容直接访问 /projects /settings）
function RedirectToProjects() {
  return <Navigate to="/admin/projects" replace />;
}
function RedirectToSettings() {
  return <Navigate to="/admin/settings" replace />;
}

export default function App() {
  return (
    <Routes>
      {/* 主应用 */}
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="market" element={<MarketPage />} />
      </Route>

      {/* 管理后台 - 登录页（独立，无侧边栏） */}
      <Route path="/admin/login" element={<AdminLoginPage />} />

      {/* 管理后台 - 受保护路由（带侧边栏） */}
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<Navigate to="/admin/projects" replace />} />
        <Route path="projects" element={<AdminProjectsPage />} />
        <Route path="projects/:id" element={<AdminProjectEditPage />} />
        <Route path="materials" element={<AdminMaterialsPage />} />
        <Route path="accounts" element={<AdminAccountsPage />} />
        <Route path="market" element={<AdminMarketPage />} />
        <Route path="analytics" element={<AdminAnalyticsPage />} />
        <Route path="announcement" element={<AdminAnnouncementPage />} />
        <Route path="settings" element={<AdminSettingsPage />} />
      </Route>

      {/* 根路径快捷重定向（兼容直接访问 /projects /settings） */}
      <Route path="/projects" element={<RedirectToProjects />} />
      <Route path="/settings" element={<RedirectToSettings />} />

      {/* 404 */}
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
