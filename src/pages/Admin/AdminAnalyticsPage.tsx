import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import {
  Users,
  Eye,
  UserCheck,
  TrendingUp,
  RefreshCw,
  Monitor,
  Globe,
  Clock,
  Loader2,
} from 'lucide-react';
import {
  getOnlineCount,
  getOnlineVisitors,
  getTodayStats,
  getDailyAnalytics,
  getTodayPageDistribution,
  getTodayHourlyDistribution,
  getTotalStats,
  type OnlineVisitor,
} from '@/lib/admin-projects';

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub?: string;
  color: string;
  bgColor: string;
}

function StatCard({ icon, label, value, sub, color, bgColor }: StatCardProps) {
  return (
    <div className="rounded-xl border border-[#2C2C2C] bg-[#1a1a1a] p-3 md:p-4 transition-colors hover:bg-[#222]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] md:text-xs text-[#888]">{label}</p>
          <p className="mt-1 text-xl md:text-2xl font-bold text-white tabular-nums" style={{ color }}>
            {value}
          </p>
          {sub && <p className="mt-1 text-[10px] md:text-[11px] text-[#666] truncate">{sub}</p>}
        </div>
        <div
          className="flex h-8 w-8 md:h-10 md:w-10 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: bgColor }}
        >
          <span style={{ color }}>{icon}</span>
        </div>
      </div>
    </div>
  );
}

function OnlineList({ visitors }: { visitors: OnlineVisitor[] }) {
  if (visitors.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-[#666]">
        <Users className="mb-2 h-8 w-8" />
        <span className="text-sm">暂无在线访客</span>
      </div>
    );
  }

  const formatTime = (iso: string) => {
    if (!iso) return '--:--:--';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '--:--:--';
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`;
  };

  const parseUA = (ua: string) => {
    if (!ua) return 'Unknown';
    if (ua.includes('iPhone')) return 'iPhone';
    if (ua.includes('iPad')) return 'iPad';
    if (ua.includes('Android')) return 'Android';
    if (ua.includes('Mac')) return 'Mac';
    if (ua.includes('Windows')) return 'Windows';
    if (ua.includes('Linux')) return 'Linux';
    return 'Unknown';
  };

  return (
    <div className="space-y-2">
      {visitors.map((v) => (
        <div
          key={v.visitor_id}
          className="flex items-center justify-between rounded-lg border border-[#2C2C2C]/60 bg-[#1a1a1a] px-3 py-2.5"
        >
          <div className="flex items-center gap-3 min-w-0">
            <Monitor className="h-4 w-4 shrink-0 text-[#7C3AED]" />
            <div className="min-w-0">
              <p className="truncate text-sm text-white">{v.page ?? '未知页面'}</p>
              <p className="text-[11px] text-[#666]">
                <Globe className="mr-0.5 inline h-3 w-3" />
                {parseUA(v.user_agent)}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1 text-[11px] text-[#888]">
            <Clock className="h-3 w-3" />
            {formatTime(v.last_heartbeat)}
          </div>
        </div>
      ))}
    </div>
  );
}

/** 从 Promise.allSettled 结果中安全取值 */
function settledValue<T>(r: PromiseSettledResult<T>, fallback: T): T {
  return r.status === 'fulfilled' ? r.value : fallback;
}

export default function AdminAnalyticsPage() {
  const [onlineCount, setOnlineCount] = useState(0);
  const [todayPv, setTodayPv] = useState(0);
  const [todayUv, setTodayUv] = useState(0);
  const [totalPv, setTotalPv] = useState(0);
  const [totalDays, setTotalDays] = useState(0);
  const [avgDailyPv, setAvgDailyPv] = useState(0);

  const [dailyData, setDailyData] = useState<{ date: string; page_views: number; unique_visitors: number }[]>([]);
  const [hourlyData, setHourlyData] = useState<{ hour: number; pv: number }[]>([]);
  const [pageDist, setPageDist] = useState<{ page: string; count: number }[]>([]);
  const [onlineVisitors, setOnlineVisitors] = useState<OnlineVisitor[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const loadingRef = useRef(false);

  // 响应式：检测是否手机端
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const chartH = isMobile ? 200 : 280;
  const smallChartH = isMobile ? 180 : 260;

  const loadAllData = useCallback(async (showRefresh = false) => {
    if (document.hidden) return;
    if (loadingRef.current) return; // 防止并发请求
    loadingRef.current = true;
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const results = await Promise.allSettled([
        getOnlineCount(),
        getTodayStats(),
        getTotalStats(),
        getDailyAnalytics(30),
        getTodayHourlyDistribution(),
        getTodayPageDistribution(),
        getOnlineVisitors(),
      ]);

      const errors = results
        .map((r, i) => (r.status === 'rejected' ? `[${i}] ${r.reason}` : null))
        .filter(Boolean);
      if (errors.length === results.length) {
        setError('所有数据加载失败，请检查 Supabase 连接');
      } else if (errors.length > 0) {
        console.warn('[AdminAnalyticsPage] 部分请求失败:', errors);
      }

      setOnlineCount(settledValue(results[0], 0));
      const today = settledValue(results[1], { pageViews: 0, uniqueVisitors: 0 });
      setTodayPv(today.pageViews);
      setTodayUv(today.uniqueVisitors);
      const total = settledValue(results[2], { totalPv: 0, totalDays: 0, avgDailyPv: 0 });
      setTotalPv(total.totalPv);
      setTotalDays(total.totalDays);
      setAvgDailyPv(total.avgDailyPv);
      setDailyData(settledValue(results[3], []));
      setHourlyData(settledValue(results[4], []));
      setPageDist(settledValue(results[5], []));
      setOnlineVisitors(settledValue(results[6], []));
    } catch (err) {
      console.error('[AdminAnalyticsPage] loadAllData error:', err);
      setError('数据加载异常');
    } finally {
      setLoading(false);
      setRefreshing(false);
      loadingRef.current = false;
    }
  }, []);

  useEffect(() => {
    loadAllData();

    // 页面可见时启动定时刷新，不可见时暂停
    const startTimer = () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => loadAllData(), 30_000);
    };
    const stopTimer = () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };

    const handleVisibility = () => {
      if (document.hidden) {
        stopTimer();
      } else {
        loadAllData();
        startTimer();
      }
    };

    startTimer();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      stopTimer();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [loadAllData]);

  const trendOption = useMemo(() => {
    return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis' as const,
      backgroundColor: '#2C2C2C',
      borderColor: '#3A3A3A',
      textStyle: { color: '#fff', fontSize: 11 },
      confine: true,
    },
    legend: {
      data: ['页面浏览量', '独立访客'],
      top: 0,
      right: 0,
      textStyle: { color: '#888', fontSize: 10 },
      icon: 'roundRect' as const,
      itemWidth: 10,
      itemHeight: 2,
    },
    grid: { left: isMobile ? 32 : 40, right: isMobile ? 8 : 16, top: 28, bottom: isMobile ? 20 : 24 },
    xAxis: {
      type: 'category' as const,
      data: dailyData.map((d) => {
        const dt = new Date(d.date + 'T00:00:00');
        return `${dt.getMonth() + 1}/${dt.getDate()}`;
      }),
      axisLine: { lineStyle: { color: '#2C2C2C' } },
      axisLabel: { color: '#666', fontSize: 9, interval: isMobile ? 4 : 0 },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value' as const,
      splitLine: { lineStyle: { color: '#2C2C2C', type: 'dashed' as const } },
      axisLabel: { color: '#666', fontSize: 9 },
    },
    series: [
      {
        name: '页面浏览量',
        type: 'line',
        data: dailyData.map((d) => d.page_views),
        smooth: true,
        symbol: 'none',
        lineStyle: { color: '#7C3AED', width: 2 },
        areaStyle: {
          color: {
            type: 'linear' as const,
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(124,58,237,0.25)' },
              { offset: 1, color: 'rgba(124,58,237,0)' },
            ],
          },
        },
      },
      {
        name: '独立访客',
        type: 'line',
        data: dailyData.map((d) => d.unique_visitors),
        smooth: true,
        symbol: 'none',
        lineStyle: { color: '#22d3ee', width: 2 },
        areaStyle: {
          color: {
            type: 'linear' as const,
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(34,211,238,0.2)' },
              { offset: 1, color: 'rgba(34,211,238,0)' },
            ],
          },
        },
      },
    ],
    };
  }, [dailyData, isMobile]);

  const hourlyOption = useMemo(() => {
    return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis' as const,
      backgroundColor: '#2C2C2C',
      borderColor: '#3A3A3A',
      textStyle: { color: '#fff', fontSize: 11 },
      confine: true,
      formatter: (params: Array<{ name: string; value: number }>) => {
        const p = params[0];
        return `${p.name}:00<br/>访问量: <b>${p.value}</b>`;
      },
    },
    grid: { left: isMobile ? 28 : 36, right: isMobile ? 8 : 12, top: 12, bottom: isMobile ? 20 : 24 },
    xAxis: {
      type: 'category' as const,
      data: hourlyData.map((h) => `${h.hour}:00`),
      axisLine: { lineStyle: { color: '#2C2C2C' } },
      axisLabel: {
        color: '#666',
        fontSize: 9,
        interval: isMobile ? 3 : 2,
      },
      axisTick: { show: false },
    },
    yAxis: {
      type: 'value' as const,
      splitLine: { lineStyle: { color: '#2C2C2C', type: 'dashed' as const } },
      axisLabel: { color: '#666', fontSize: 9 },
    },
    series: [
      {
        type: 'bar',
        data: hourlyData.map((h) => h.pv),
        itemStyle: {
          color: {
            type: 'linear' as const,
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: '#7C3AED' },
              { offset: 1, color: 'rgba(124,58,237,0.3)' },
            ],
          },
          borderRadius: [3, 3, 0, 0],
        },
        barMaxWidth: isMobile ? 10 : 16,
      },
    ],
    };
  }, [hourlyData, isMobile]);

  const pageDistOption = useMemo(() => {
    return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item' as const,
      backgroundColor: '#2C2C2C',
      borderColor: '#3A3A3A',
      textStyle: { color: '#fff', fontSize: 11 },
      confine: true,
      formatter: '{b}: {c} ({d}%)',
    },
    series: [
      {
        type: 'pie',
        radius: isMobile ? ['40%', '65%'] : ['45%', '70%'],
        center: ['50%', '55%'],
        avoidLabelOverlap: true,
        label: {
          color: '#aaa',
          fontSize: isMobile ? 9 : 11,
          formatter: isMobile ? '{d}%' : '{b}\n{d}%',
        },
        labelLine: {
          length: isMobile ? 8 : 15,
          length2: isMobile ? 5 : 10,
          lineStyle: { color: '#555' },
        },
        data: pageDist.map((p) => ({
          name: p.page,
          value: p.count,
        })),
        color: ['#7C3AED', '#22d3ee', '#fbbf24', '#34d399', '#f472b6', '#fb923c', '#a78bfa', '#38bdf8'],
        itemStyle: { borderColor: '#1a1a1a', borderWidth: 2 },
      },
    ],
  };
  }, [pageDist, isMobile]);

  // ========== NoDataPlaceholder 提取到模块顶层（见文件末尾） ==========

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-[#888] flex items-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          加载中...
        </div>
      </div>
    );
  }

  // NoDataPlaceholder 已提取到模块顶层

  return (
    <div className="space-y-4 p-4 md:p-6 pb-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">数据分析</h2>
          <p className="text-xs text-[#888] mt-0.5">网站访问统计与在线数据</p>
        </div>
        <button
          onClick={() => loadAllData(true)}
          disabled={refreshing}
          className="flex items-center gap-2 self-start sm:self-auto rounded-lg border border-[#3A3A3A] bg-[#2C2C2C] px-3 py-2 text-sm text-[#ccc] transition-colors hover:bg-[#363636] disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          刷新
        </button>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          icon={<Users className="h-5 w-5" />}
          label="当前在线"
          value={onlineCount}
          sub="实时人数"
          color="#22d3ee"
          bgColor="rgba(34,211,238,0.12)"
        />
        <StatCard
          icon={<Eye className="h-5 w-5" />}
          label="今日 PV"
          value={todayPv}
          sub="页面浏览量"
          color="#7C3AED"
          bgColor="rgba(124,58,237,0.12)"
        />
        <StatCard
          icon={<UserCheck className="h-5 w-5" />}
          label="今日 UV"
          value={todayUv}
          sub="独立访客"
          color="#34d399"
          bgColor="rgba(52,211,153,0.12)"
        />
        <StatCard
          icon={<TrendingUp className="h-5 w-5" />}
          label="日均 PV"
          value={avgDailyPv}
          sub={`共 ${totalDays} 天 / 总计 ${totalPv}`}
          color="#fbbf24"
          bgColor="rgba(251,191,36,0.12)"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-[#2C2C2C] bg-[#1a1a1a] p-3 md:p-4 md:col-span-2">
          <h3 className="mb-3 text-sm font-medium text-[#ccc]">近 30 天访问趋势</h3>
          {dailyData.length > 0 ? (
            <ReactECharts
              option={trendOption}
              style={{ height: chartH }}
              opts={{ renderer: 'svg' }}
              notMerge
            />
          ) : (
            <NoDataPlaceholder h={chartH} />
          )}
        </div>

        <div className="rounded-xl border border-[#2C2C2C] bg-[#1a1a1a] p-3 md:p-4">
          <h3 className="mb-3 text-sm font-medium text-[#ccc]">今日页面分布</h3>
          {pageDist.length > 0 ? (
            <ReactECharts
              option={pageDistOption}
              style={{ height: chartH }}
              opts={{ renderer: 'svg' }}
              notMerge
            />
          ) : (
            <NoDataPlaceholder h={chartH} />
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-[#2C2C2C] bg-[#1a1a1a] p-3 md:p-4">
          <h3 className="mb-3 text-sm font-medium text-[#ccc]">今日每小时访问量</h3>
          {hourlyData.some((h) => h.pv > 0) ? (
            <ReactECharts
              option={hourlyOption}
              style={{ height: smallChartH }}
              opts={{ renderer: 'svg' }}
              notMerge
            />
          ) : (
            <NoDataPlaceholder h={smallChartH} />
          )}
        </div>

        <div className="rounded-xl border border-[#2C2C2C] bg-[#1a1a1a] p-3 md:p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-medium text-[#ccc]">在线访客</h3>
            <span className="rounded-full bg-[#22d3ee]/15 px-2 py-0.5 text-[11px] font-medium text-[#22d3ee]">
              {onlineCount} 人在线
            </span>
          </div>
          <div className="max-h-[220px] md:max-h-[260px] overflow-y-auto space-y-2 pr-1">
            <OnlineList visitors={onlineVisitors} />
          </div>
        </div>
      </div>
    </div>
  );
}

/** 模块顶层组件 — 避免每次渲染重建组件类型 */
function NoDataPlaceholder({ text = '暂无数据', h = 200 }: { text?: string; h?: number }) {
  return (
    <div className="flex items-center justify-center text-[#666] text-sm" style={{ height: h }}>
      {text}
    </div>
  );
}
