import { useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { sendHeartbeat, removeOnlineVisitor, recordPageView } from '@/lib/admin-projects';

const VISITOR_KEY = 'eve_visitor_id';
const HEARTBEAT_INTERVAL = 30_000; // 30 秒

/** 生成或恢复访客 ID */
function getVisitorId(): string {
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = `v_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(VISITOR_KEY, id);
    }
    return id;
  } catch {
    return `v_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
}

/** 获取页面路径的中文名 */
function getPageName(path: string): string {
  if (path === '/' || path === '') return '首页';
  if (path === '/market') return '市场';
  if (path.startsWith('/admin')) return '管理后台';
  return path;
}

export default function AnalyticsTracker() {
  const location = useLocation();
  const visitorIdRef = useRef(getVisitorId());
  const lastRecordedPathRef = useRef('');
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const doHeartbeat = useCallback(() => {
    const page = getPageName(location.pathname);
    sendHeartbeat(visitorIdRef.current, page, navigator.userAgent);
  }, [location.pathname]);

  // 记录 PV + 启动心跳
  useEffect(() => {
    const visitorId = visitorIdRef.current;
    const path = location.pathname;

    // 避免重复记录同一页面（如仅 hash 变化）
    if (path !== lastRecordedPathRef.current) {
      lastRecordedPathRef.current = path;
      const pageName = getPageName(path);
      recordPageView(visitorId, pageName);
      sendHeartbeat(visitorId, pageName, navigator.userAgent);
    }

    // 清除旧的心跳定时器
    if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);

    // 启动心跳
    heartbeatTimerRef.current = setInterval(doHeartbeat, HEARTBEAT_INTERVAL);

    return () => {
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
    };
  }, [location.pathname, doHeartbeat]);

  // 页面关闭时移除在线记录
  useEffect(() => {
    const handleUnload = () => {
      removeOnlineVisitor(visitorIdRef.current);
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, []);

  // 组件不渲染任何 UI
  return null;
}