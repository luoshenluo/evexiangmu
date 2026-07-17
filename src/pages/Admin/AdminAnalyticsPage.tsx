import { useState, useEffect, useCallback } from 'react';
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

const REFRESH_INTERVAL = 30000;

export default function AdminAnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 在线数据
  const [onlineCount, setOnlineCount] = useState<number>(0);
  const [onlineVisitors, setOnlineVisitors] = useState<OnlineVisitor[]>([]);

  // 今日统计
  const [todayStats, setTodayStats] = useState<{ pageViews: number; uniqueVisitors: number } | null>(null);

  // 每日趋势
  const [dailyAnalytics, setDailyAnalytics] = useState<{ date: string; pageViews: number; uniqueVisitors: number }[]>([]);

  // 今日页面分布
  const [pageDistribution, setPageDistribution] = useState<{ page: string; count: number }[]>([]);

  // 今日小时分布
  const [hourlyDistribution, setHourlyDistribution] = useState<number[]>(Array(24).fill(0));

  // 总统计
  const [totalStats, setTotalStats] = useState<{ totalPageViews: number; totalVisitors: number } | null>(null);

  const loadData = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      else setLoading(true);
      setError(null);

      const [oc, ov, ts, da, pd, hd, totals] = await Promise.all([
        getOnlineCount(),
        getOnlineVisitors(),
        getTodayStats(),
        getDailyAnalytics(30),
        getTodayPageDistribution(),
        getTodayHourlyDistribution(),
        getTotalStats(),
      ]);

      setOnlineCount(oc);
      setOnlineVisitors(ov || []);
      setTodayStats(ts);
      setDailyAnalytics(da || []);
      setPageDistribution(pd || []);
      setHourlyDistribution(hd || Array(24).fill(0));
      setTotalStats(totals);
    } catch (err) {
      console.error('[AdminAnalyticsPage] load error:', err);
      setError('部分数据加载失败，请检查Supabase连接');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const timer = setInterval(() => loadData(true), REFRESH_INTERVAL);
    return () => clearInterval(timer);
  }, [loadData]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#7C3AED] mr-2" />
        <span className="text-[#A0A0A0]">加载统计数据...</span>
      </div>
    );
  }

  // 今日PV趋势配置
  const dailyOption = {
    tooltip: { trigger: 'axis' as const, backgroundColor: '#2C2C2C', borderColor: '#3A3A3A', textStyle: { color: '#E0E0E0' } },
    legend: { data: ['访问量(PV)', '访客数(UV)'], textStyle: { color: '#A0A0A0' } },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'category' as const, data: dailyAnalytics.map(d => d.date.slice(5)), axisLabel: { color: '#888' }, axisLine: { lineStyle: { color: '#3A3A3A' } } },
    yAxis: { type: 'value' as const, splitLine: { lineStyle: { color: '#2C2C2C' } }, axisLabel: { color: '#888' } },
    series: [
      { name: '访问量(PV)', type: 'line', smooth: true, data: dailyAnalytics.map(d => d.pageViews), lineStyle: { color: '#7C3AED' }, itemStyle: { color: '#7C3AED' }, areaStyle: { color: 'rgba(124,58,237,0.1)' } },
      { name: '访客数(UV)', type: 'line', smooth: true, data: dailyAnalytics.map(d => d.uniqueVisitors), lineStyle: { color: '#22C55E' }, itemStyle: { color: '#22C55E' }, areaStyle: { color: 'rgba(34,197,94,0.1)' } },
    ],
  };

  // 页面分布配置
  const pageOption = {
    tooltip: { trigger: 'item' as const, backgroundColor: '#2C2C2C', borderColor: '#3A3A3A', textStyle: { color: '#E0E0E0' } },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      avoidLabelOverlap: false,
      itemStyle: { borderRadius: 6, borderColor: '#1E1E1E', borderWidth: 2 },
      label: { color: '#A0A0A0' },
      emphasis: { label: { show: true, fontSize: 14, fontWeight: 'bold' } },
      data: pageDistribution.map(p => ({ value: p.count, name: p.page })),
    }],
  };

  // 小时分布配置
  const hourlyOption = {
    tooltip: { trigger: 'axis' as const, backgroundColor: '#2C2C2C', borderColor: '#3A3A3A', textStyle: { color: '#E0E0E0' } },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'category' as const, data: Array.from({length: 24}, (_, i) => i + '时'), axisLabel: { color: '#888' }, axisLine: { lineStyle: { color: '#3A3A3A' } } },
    yAxis: { type: 'value' as const, splitLine: { lineStyle: { color: '#2C2C2C' } }, axisLabel: { color: '#888' } },
    series: [{
      type: 'bar',
      data: hourlyDistribution,
      itemStyle: { color: '#7C3AED', borderRadius: [4,4,0,0] },
    }],
  };

  return (
    <div className="space-y-4 md:space-y-6">
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg md:text-2xl font-bold text-white">数据统计</h2>
          <p className="text-xs md:text-sm text-[#A0A0A0] mt-0.5">网站访问统计与用户分析</p>
        </div>
        <button
          onClick={() => loadData(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 rounded-lg bg-[#2C2C2C] px-3 py-2 text-sm text-[#A0A0A0] hover:bg-[#3A3A3A] transition-colors disabled:opacity-50"
        >
          <RefreshCw className={"h-4 w-4 " + (refreshing ? 'animate-spin' : '')} />
          刷新
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/30 px-4 py-3 text-sm text-yellow-400">
          {error}
        </div>
      )}

      {/* 统计概览卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <div className="rounded-xl border border-[#3A3A3A] bg-[#2C2C2C] p-3 md:p-4">
          <div className="flex items-center gap-2 text-[#22C55E] mb-2">
            <UserCheck className="h-4 w-4" />
            <span className="text-xs md:text-sm">当前在线</span>
          </div>
          <div className="text-2xl md:text-3xl font-bold text-white">{onlineCount}</div>
        </div>
        <div className="rounded-xl border border-[#3A3A3A] bg-[#2C2C2C] p-3 md:p-4">
          <div className="flex items-center gap-2 text-[#3B82F6] mb-2">
            <Eye className="h-4 w-4" />
            <span className="text-xs md:text-sm">今日PV</span>
          </div>
          <div className="text-2xl md:text-3xl font-bold text-white">{todayStats?.pageViews || 0}</div>
        </div>
        <div className="rounded-xl border border-[#3A3A3A] bg-[#2C2C2C] p-3 md:p-4">
          <div className="flex items-center gap-2 text-[#A78BFA] mb-2">
            <Users className="h-4 w-4" />
            <span className="text-xs md:text-sm">今日UV</span>
          </div>
          <div className="text-2xl md:text-3xl font-bold text-white">{todayStats?.uniqueVisitors || 0}</div>
        </div>
        <div className="rounded-xl border border-[#3A3A3A] bg-[#2C2C2C] p-3 md:p-4">
          <div className="flex items-center gap-2 text-[#F59E0B] mb-2">
            <TrendingUp className="h-4 w-4" />
            <span className="text-xs md:text-sm">累计PV</span>
          </div>
          <div className="text-2xl md:text-3xl font-bold text-white">{totalStats?.totalPageViews || 0}</div>
        </div>
      </div>

      {/* PV趋势图 */}
      <div className="rounded-xl border border-[#3A3A3A] bg-[#2C2C2C] p-3 md:p-4">
        <h3 className="text-sm md:text-base font-medium text-white mb-4">近30日访问趋势</h3>
        <ReactECharts option={dailyOption} style={{ height: '300px' }} />
      </div>

      {/* 饼图 + 小时图双栏 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
        <div className="rounded-xl border border-[#3A3A3A] bg-[#2C2C2C] p-3 md:p-4">
          <h3 className="text-sm md:text-base font-medium text-white mb-4">今日页面分布</h3>
          <ReactECharts option={pageOption} style={{ height: '280px' }} />
        </div>
        <div className="rounded-xl border border-[#3A3A3A] bg-[#2C2C2C] p-3 md:p-4">
          <h3 className="text-sm md:text-base font-medium text-white mb-4">今日小时分布</h3>
          <ReactECharts option={hourlyOption} style={{ height: '280px' }} />
        </div>
      </div>

      {/* 在线访客列表 */}
      {onlineVisitors.length > 0 && (
        <div className="rounded-xl border border-[#3A3A3A] bg-[#2C2C2C] p-3 md:p-4">
          <h3 className="text-sm md:text-base font-medium text-white mb-3">在线访客 ({onlineVisitors.length})</h3>
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {onlineVisitors.map((v, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg bg-[#1E1E1E] px-3 py-2">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-[#22C55E]" />
                  <span className="text-sm text-[#E0E0E0]">{v.page || '未知页面'}</span>
                </div>
                <span className="text-xs text-[#888]">{v.ip || v.visitor_id?.slice(0, 8) || '未知'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
