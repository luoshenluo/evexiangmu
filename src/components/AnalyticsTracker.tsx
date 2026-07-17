import { useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { sendHeartbeat, removeOnlineVisitor, recordPageView } from '@/lib/admin-projects';

const VISITOR_KEY = 'eve_visitor_id';
const HEARTBEAT_INTERVAL = 30_000; // 30 秒
const MAX_PV_PER_MINUTE = 30; // 防刷：每分钟最多 30 次 PV

/** 生成或恢复访客 ID（简单 fingerprint：随机 + 持久化） */
function getVisitorId(): string {
  try {
    let id = localStorage.getItem(VISITOR_KEY);
    if (!id) {
      id = `v_${Date.now()}_${Math.random().toString(36).slice(2, 10)}_${navigator.userAgent.slice(0, 20).replace(/\W/g, '')}`;
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

/** 限流检查 */
function checkRateLimit(): boolean {
  try {
    const key = 'eve_pv_limit';
    const raw = localStorage.getItem(key);
    const now = Date.now();
    let records: number[] = raw ? JSON.parse(raw) : [];
    // 保留最近 1 分钟的记录
    records = records.filter((t) => now - t < 60_000);
    if (records.length >= MAX_PV_PER_MINUTE) return false;
    records.push(now);
    localStorage.setItem(key, JSON.stringify(records));
    return true;
  } catch {
    return true;
  }
}

export default function AnalyticsTracker() {
  const location = useLocation();
  const visitorIdRef = useRef(getVisitorId());
  const lastRecordedPathRef = useRef('');
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const visibleRef = useRef(true);

  const doHeartbeat = useCallback(() => {
    if (!visibleRef.current) return;
    const page = getPageName(location.pathname);
    sendHeartbeat(visitorIdRef.current, page, navigator.userAgent);
  }, [location.pathname]);

  // 记录 PV + 启动心跳
  useEffect(() => {
    const visitorId = visitorIdRef.current;
    const path = location.pathname;

    if (path !== lastRecordedPathRef.current) {
      lastRecordedPathRef.current = path;
      if (checkRateLimit()) {
        const pageName = getPageName(path);
        recordPageView(visitorId, pageName);
        sendHeartbeat(visitorId, pageName, navigator.userAgent);
      }
    }

    if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
    heartbeatTimerRef.current = setInterval(doHeartbeat, HEARTBEAT_INTERVAL);

    return () => {
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
    };
  }, [location.pathname, doHeartbeat]);

  // 页面可见性变化：暂停/恢复心跳
  useEffect(() => {
    const handleVisibility = () => {
      visibleRef.current = !document.hidden;
      if (!document.hidden) {
        doHeartbeat();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [doHeartbeat]);

  // 页面关闭时移除在线记录
  useEffect(() => {
    const handleUnload = () => {
      removeOnlineVisitor(visitorIdRef.current);
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, []);

  return null;
}
