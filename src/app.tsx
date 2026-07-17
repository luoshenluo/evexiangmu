import { lazy, Suspense, Component, type ReactNode } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import AnalyticsTracker from '@/components/AnalyticsTracker';

const HomePage = lazy(() => import('@/pages/HomePage/HomePage'));
const MarketPage = lazy(() => import('@/pages/MarketPage/MarketPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage/NotFoundPage'));
const AdminLoginPage = lazy(() => import('@/pages/Admin/AdminLoginPage'));
const AdminLayout = lazy(() => import('@/pages/Admin/AdminLayout'));
const AdminProjectsPage = lazy(() => import('@/pages/Admin/AdminProjectsPage'));
const AdminProjectEditPage = lazy(() => import('@/pages/Admin/AdminProjectEditPage'));
const AdminSettingsPage = lazy(() => import('@/pages/Admin/AdminSettingsPage'));
const AdminMaterialsPage = lazy(() => import('@/pages/Admin/AdminMaterialsPage'));
const AdminAccountsPage = lazy(() => import('@/pages/Admin/AdminAccountsPage'));
const AdminMarketPage = lazy(() => import('@/pages/Admin/AdminMarketPage'));
const AdminAnalyticsPage = lazy(() => import('@/pages/Admin/AdminAnalyticsPage'));
const AdminAnnouncementPage = lazy(() => import('@/pages/Admin/AdminAnnouncementPage'));

function PageLoader() {
  return (
    <div className="flex h-64 items-center justify-center">
      <div className="text-[#888] flex items-center gap-2">
        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        加载中...
      </div>
    </div>
  );
}

interface ErrorBoundaryState { hasError: boolean; error: Error | null; }
class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] 组件崩溃:', error, info.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
          <div className="text-4xl">⚠️</div>
          <h2 className="text-lg font-semibold text-white">页面渲染出错</h2>
          <p className="max-w-md text-sm text-[#A0A0A0]">{this.state.error?.message || '发生了未知错误'}</p>
          <button onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }} className="rounded-lg bg-[#7C3AED] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#6D28D9]">重新加载页面</button>
        </div>
      );
    }
    return this.props.children;
  }
}

function RedirectToProjects() {
  return <Navigate to="/admin/projects" replace />;
}
function RedirectToSettings() {
  return <Navigate to="/admin/settings" replace />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <AnalyticsTracker />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="market" element={<MarketPage />} />
          </Route>
          <Route path="/admin/login" element={<AdminLoginPage />} />
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
          <Route path="/projects" element={<RedirectToProjects />} />
          <Route path="/settings" element={<RedirectToSettings />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}