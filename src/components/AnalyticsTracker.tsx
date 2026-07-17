import { useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { sendHeartbeat, removeOnlineVisitor, recordPageView } from '@/lib/admin-projects';

const VISITOR_KEY = 'eve_visitor_id';
const HEARTBEAT_INTERVAL = 30_000;
const MAX_PV_PER_MINUTE = 30;

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

function getPageName(path: string): string {
  if (path === '/' || path === '') return '首页';
  if (path === '/market') return '市场';
  if (path.startsWith('/admin')) return '管理后台';
  return path;
}

function checkRateLimit(): boolean {
  try {
    const key = 'eve_pv_limit';
    const raw = localStorage.getItem(key);
    const now = Date.now();
    let records: number[] = raw ? JSON.parse(raw) : [];
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

  useEffect(() => {
    const handleUnload = () => {
      removeOnlineVisitor(visitorIdRef.current);
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => window.removeEventListener('beforeunload', handleUnload);
  }, []);

  return null;
}