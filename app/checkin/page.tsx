'use client'

import { useState, useEffect } from 'react'
import { useAppStore } from '@/lib/store'
import { apiFetch, classNames, formatNumber } from '@/lib/utils'
import LoginModal from '@/components/LoginModal'
import { Calendar, Coins, Flower, Flame, Sparkles, Gift, Check, Star, Crown, Trophy, ChevronLeft } from 'lucide-react'

interface DayItem {
  day: number; coins: number; petals: number; label: string; claimed: boolean; today: boolean;
}
interface CheckInResp {
  checkedInToday: boolean; checkInStreak: number; broken: boolean; lastCheckInAt: number; preview: DayItem[]; petalCoins: number;
}

// 成就定义
const ACHIEVEMENT_DEFS: Record<string, { name: string; desc: string; icon: string }> = {
  checkin_1day:     { name: '初次签到',   desc: '完成第一次每日签到',     icon: '✨' },
  checkin_7day:     { name: '周常达人',   desc: '累计签到7天',            icon: '🔥' },
  checkin_30day:    { name: '勤奋园丁',   desc: '累计签到30天',           icon: '🌳' },
  checkin_100day:   { name: '百日守护',   desc: '累计签到100天',          icon: '💎' },
  flowers_50:       { name: '初入花海',   desc: '累计收获50朵花',          icon: '🌷' },
  flowers_500:      { name: '花园大师',   desc: '累计收获500朵花',         icon: '🌹' },
  friends_5:        { name: '社交达人',   desc: '好友数量达到5位',         icon: '🤝' },
  coins_100k:       { name: '金币富翁',   desc: '累计金币达到10万',        icon: '💰' },
  family_joined:    { name: '家族成员',   desc: '加入任意家族',            icon: '👨‍👩‍👧‍👦' },
  market_trade_10:  { name: '初涉商贾',   desc: '市场成功交易10次',        icon: '🧺' },
}

export default function CheckInPage() {
  const { user, showToast, updateUser } = useAppStore()
  const [showLogin, setShowLogin] = useState(false)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<CheckInResp | null>(null)
  const [todayTab, setTodayTab] = useState<'checkin' | 'achievement'>('checkin')
  const [lastReward, setLastReward] = useState<{ coins: number; petals: number; label: string; newlyUnlocked: string[] } | null>(null)

  const load = async () => {
    const r = await apiFetch('/api/user/checkin')
    if (r.success) setData(r.data)
  }

  useEffect(() => { if (user?.id) load() }, [user?.id])

  const checkIn = async () => {
    if (!user) return
    setLoading(true)
    try {
      const r = await apiFetch('/api/user/checkin', { method: 'POST' })
      if (r.success) {
        showToast('签到成功！', 'success')
        if (r.data.user) updateUser(r.data.user)
        setLastReward({ ...r.data.reward, newlyUnlocked: r.data.newlyUnlocked || [] })
        await load()
      } else {
        showToast(r.error || '签到失败', 'error')
      }
    } finally { setLoading(false) }
  }

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 pt-10 text-center" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 100px)' }}>
        <div className="card p-10">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-amber-300 to-orange-500 flex items-center justify-center shadow-md">
            <Calendar size={40} className="text-white" />
          </div>
          <h2 className="font-bold text-lg mb-1 text-slate-800">请先登录</h2>
          <p className="text-sm text-slate-500 mb-5">登录后即可领取每日签到奖励</p>
          <button onClick={() => setShowLogin(true)} className="btn-primary">登录 / 注册</button>
        </div>
        {showLogin && <LoginModal onClose={() => setShowLogin(false)} onSuccess={() => setShowLogin(false)} />}
      </div>
    )
  }

  const achievements = (user as any).achievements || {}
  const unlockCount = Object.keys(ACHIEVEMENT_DEFS).map(k => !!achievements[k]).filter(Boolean).length
  const totalCount = Object.keys(ACHIEVEMENT_DEFS).length

  return (
    <div className="max-w-2xl mx-auto px-4 pt-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 100px)' }}>
      {/* 头部 */}
      <div className="card p-4 mb-4 overflow-hidden relative bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 text-white shadow-lg">
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-white/10" />
        <div className="absolute -bottom-20 -left-6 w-40 h-40 rounded-full bg-white/5" />
        <div className="relative flex items-center gap-3">
          <button onClick={() => typeof window !== 'undefined' && window.history.back()} className="p-2 hover:bg-white/10 rounded-xl">
            <ChevronLeft size={20} />
          </button>
          <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center shadow-sm">
            <Calendar size={24} />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold">每日签到</h1>
            <div className="text-xs opacity-80 flex items-center gap-2">
              <Flame size={12} /> 连续签到 <b className="text-base">{data?.checkInStreak || 0}</b> 天
              <span className="mx-1 opacity-50">|</span>
              <Flower size={12} /> 花瓣: <b>{data?.petalCoins ?? (user as any).petalCoins ?? 0}</b>
            </div>
          </div>
        </div>
      </div>

      {/* Tab */}
      <div className="grid grid-cols-2 gap-1.5 p-1.5 bg-slate-100 rounded-xl mb-4">
        <button onClick={() => setTodayTab('checkin')} className={classNames('py-2 rounded-lg text-sm font-medium transition', todayTab === 'checkin' ? 'bg-white shadow-sm text-orange-600' : 'text-slate-500')}>
          <Calendar size={14} className="inline mr-1" /> 每日签到
        </button>
        <button onClick={() => setTodayTab('achievement')} className={classNames('py-2 rounded-lg text-sm font-medium transition', todayTab === 'achievement' ? 'bg-white shadow-sm text-purple-600' : 'text-slate-500')}>
          <Trophy size={14} className="inline mr-1" /> 成就中心 {unlockCount}/{totalCount}
        </button>
      </div>

      {todayTab === 'checkin' && (
        <>
          {/* 7天奖励 */}
          <div className="card p-4 mb-4">
            <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
              <Gift size={16} className="text-amber-500" /> 七日签到奖励
            </h3>
            <div className="grid grid-cols-7 gap-1.5">
              {data?.preview?.map((d, i) => {
                const isToday = d.today && !data.checkedInToday
                const claimed = d.claimed || (d.today && data.checkedInToday)
                return (
                  <div key={i} className={classNames(
                    'rounded-xl p-2 text-center relative transition-all',
                    claimed ? 'bg-gradient-to-br from-green-50 to-emerald-50 border border-emerald-200'
                            : isToday ? 'bg-gradient-to-br from-amber-100 to-orange-100 border-2 border-orange-400 shadow-md scale-[1.03]'
                            : 'bg-slate-50 border border-slate-200'
                  )}>
                    {claimed && <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shadow"><Check size={11} /></div>}
                    <div className="text-[10px] text-slate-500 mb-0.5">第{d.day}天</div>
                    <div className="text-lg mb-1">{i === 6 ? '💎' : i === 5 ? '🏆' : i === 3 ? '🌟' : i === 2 ? '⭐' : '🎁'}</div>
                    <div className="text-[10px] font-bold text-amber-600 leading-tight">{formatNumber(d.coins)}</div>
                    {d.petals > 0 && <div className="text-[9px] text-pink-600 leading-tight">🌸{d.petals}</div>}
                  </div>
                )
              })}
            </div>
          </div>

          {/* 领取按钮 */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-sm text-slate-500">今日状态</div>
                <div className="font-bold text-slate-800">
                  {data?.checkedInToday ? '✅ 今天已签到' : '⏰ 等待签到中'}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-500">连续签到</div>
                <div className="text-lg font-bold text-orange-600 flex items-center gap-1 justify-end">
                  <Flame size={16} className="text-orange-500" />
                  {data?.checkInStreak || 0} 天
                </div>
              </div>
            </div>
            <button onClick={checkIn}
              disabled={data?.checkedInToday || loading}
              className={classNames(
                'w-full py-3.5 rounded-xl font-bold text-base transition-all shadow-lg',
                data?.checkedInToday
                  ? 'bg-slate-100 text-slate-500 cursor-not-allowed'
                  : 'bg-gradient-to-r from-amber-400 via-orange-500 to-rose-500 text-white hover:shadow-orange-200 hover:shadow-xl disabled:opacity-70 active:scale-[0.98]'
              )}>
              {loading ? '处理中...' : data?.checkedInToday ? '明日可再领' : '立即签到领奖励'}
            </button>
            <div className="mt-3 text-[11px] text-slate-500 flex items-start gap-1.5">
              <Sparkles size={11} className="text-amber-500 mt-0.5 flex-shrink-0" />
              <div>
                说明：连续签到满7天可获得 <b>150金币 + 5花瓣</b> 大奖励，漏签则连续天数归零。
              </div>
            </div>
          </div>

          {lastReward && (
            <div className="mt-4 card p-4 bg-gradient-to-br from-green-50 to-emerald-50 border border-emerald-200">
              <div className="text-xs text-emerald-700 mb-1 flex items-center gap-1"><Star size={12} /> 签到成功</div>
              <div className="font-bold text-slate-800 mb-1">{lastReward.label} 奖励</div>
              <div className="flex gap-3 text-sm">
                <div className="flex items-center gap-1 text-amber-600 font-medium"><Coins size={14} /> +{formatNumber(lastReward.coins)}</div>
                {lastReward.petals > 0 && <div className="flex items-center gap-1 text-pink-600 font-medium"><Flower size={14} /> +{lastReward.petals} 花瓣</div>}
              </div>
              {lastReward.newlyUnlocked && lastReward.newlyUnlocked.length > 0 && (
                <div className="mt-3 p-2.5 bg-white/60 rounded-lg border border-amber-200">
                  <div className="text-[11px] text-amber-700 mb-1 flex items-center gap-1"><Crown size={12} /> 解锁新成就！</div>
                  {lastReward.newlyUnlocked.map(k => {
                    const def = ACHIEVEMENT_DEFS[k]
                    if (!def) return null
                    return <div key={k} className="text-xs text-slate-700">🏆 <b>{def.name}</b> - {def.desc}</div>
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {todayTab === 'achievement' && (
        <div className="card p-4">
          <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
            <Trophy size={16} className="text-purple-500" /> 成就墙
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(ACHIEVEMENT_DEFS).map(([k, def]) => {
              const unlocked = !!achievements[k]
              return (
                <div key={k} className={classNames(
                  'p-3 rounded-xl border transition-all relative overflow-hidden',
                  unlocked ? 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200 shadow-sm'
                          : 'bg-slate-50 border-slate-200 opacity-80'
                )}>
                  <div className={classNames('w-10 h-10 rounded-lg flex items-center justify-center text-xl mb-1.5', unlocked ? 'bg-amber-100' : 'bg-slate-200 grayscale')}>
                    {def.icon}
                  </div>
                  <div className={classNames('font-bold text-sm', unlocked ? 'text-amber-700' : 'text-slate-500')}>
                    {def.name}
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5 leading-tight">{def.desc}</div>
                  {unlocked && achievements[k]?.unlockedAt && (
                    <div className="text-[10px] text-emerald-600 mt-1.5 flex items-center gap-1">
                      <Check size={10} /> {new Date(achievements[k].unlockedAt).toLocaleDateString()} 解锁
                    </div>
                  )}
                  {!unlocked && <div className="absolute top-2 right-2 text-slate-300"><Crown size={12} /></div>}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
