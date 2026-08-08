'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useAppStore } from '@/lib/store'
import { apiFetch, classNames, formatNumber } from '@/lib/utils'
import LoginModal from '@/components/LoginModal'
import { Sparkles, Gift, Coins, Flower, PlayCircle, ChevronLeft, Trophy, Zap, RefreshCw, Dices } from 'lucide-react'
import { WHEEL_REWARDS } from '@/lib/game-data'
const WHEEL_REWARDS_LOCAL = WHEEL_REWARDS

type GameTab = 'wheel' | 'dice'

// 颜色数组（奖励扇区颜色）
const SECTOR_COLORS = [
  '#fef3c7', '#ecfdf5', '#dbeafe', '#fce7f3',
  '#ede9fe', '#e0f2fe', '#fee2e2', '#fff7ed',
]

export default function MiniGamesPage() {
  const { user, showToast, updateUser } = useAppStore()
  const [showLogin, setShowLogin] = useState(false)
  const [gameTab, setGameTab] = useState<GameTab>('wheel')
  const [petals, setPetals] = useState((user as any)?.petalCoins || 0)
  const [spinning, setSpinning] = useState(false)
  const [spinTimes, setSpinTimes] = useState<1 | 5 | 10>(1)
  const [rotation, setRotation] = useState(0)   // 当前指针相对角度
  const [history, setHistory] = useState<{ index: number; at: number; time: number; coins: number; petals: number }[]>([])
  const [lastBatch, setLastBatch] = useState<{ results: number[]; totalCoins: number; totalPetals: number } | null>(null)
  // 猜大小
  const [diceBetType, setDiceBetType] = useState<'small' | 'big' | 'middle' | 'exact'>('middle')
  const [diceBetAmount, setDiceBetAmount] = useState(1)
  const [diceTarget, setDiceTarget] = useState<number>(7)
  const [diceAnimating, setDiceAnimating] = useState(false)
  const [lastDiceResult, setLastDiceResult] = useState<{ dice: number[]; sum: number; won: boolean; netPetals: number; netCoins: number } | null>(null)
  const canvasRef = useRef<HTMLDivElement>(null)

  useEffect(() => { if (user?.id) { (async () => { const r = await apiFetch('/api/user/wheel'); if (r.success) setPetals(r.data.petalCoins) })() } }, [user?.id])

  // 奖励与扇区数对齐到 REWARDS 数量
  const N = WHEEL_REWARDS.length
  const anglePer = 360 / N
  const radius = 150

  // 生成扇区 path
  const sectors = useMemo(() => {
    const cx = radius, cy = radius
    return WHEEL_REWARDS.map((_, i) => {
      const a0 = (i * anglePer - 90) * Math.PI / 180
      const a1 = ((i + 1) * anglePer - 90) * Math.PI / 180
      const x0 = cx + radius * Math.cos(a0), y0 = cy + radius * Math.sin(a0)
      const x1 = cx + radius * Math.cos(a1), y1 = cy + radius * Math.sin(a1)
      const large = anglePer > 180 ? 1 : 0
      return `M ${cx} ${cy} L ${x0} ${y0} A ${radius} ${radius} 0 ${large} 1 ${x1} ${y1} Z`
    })
  }, [N, anglePer, radius])

  const spin = async () => {
    if (!user) return
    if (spinning) return
    if (petals < spinTimes) { showToast(`花瓣不足，需要 ${spinTimes} 花瓣`, 'error'); return }

    setSpinning(true)
    try {
      const r = await apiFetch('/api/user/wheel', {
        method: 'POST',
        body: JSON.stringify({ times: spinTimes }),
      })
      if (!r.success) { showToast(r.error || '抽奖失败', 'error'); setSpinning(false); return }
      const { results, totalCoins, totalPetals, user: updated } = r.data
      if (updated) updateUser(updated)
      setPetals(updated?.petalCoins || petals - spinTimes + totalPetals)
      setLastBatch({ results, totalCoins, totalPetals })

      // 动画：最终停在最后一个结果
      const lastIdx = results[results.length - 1]
      // 指针在顶部；为了让第 i 格中心对准顶部，旋转角度 = 360*K - (i*anglePer + anglePer/2)
      const targetAngle = 360 * 5 - (lastIdx * anglePer + anglePer / 2)
      const base = rotation % 360
      const next = rotation + (360 - base) + targetAngle
      setRotation(next)

      // 记录历史
      const now = Date.now()
      const hist: { index: number; at: number; time: number; coins: number; petals: number }[] = results.map((idx: number, i: number) => ({
        index: idx,
        at: now + i,
        time: now + i,
        coins: WHEEL_REWARDS[idx].coins,
        petals: WHEEL_REWARDS[idx].petals || 0,
      }))
      setHistory(h => [...hist.reverse(), ...h].slice(0, 12))

      // 3.5s 后显示结果
      setTimeout(() => {
        setSpinning(false)
        showToast(`抽奖完成：${totalCoins > 0 ? `+${formatNumber(totalCoins)} 金币` : ''}${totalPetals > 0 ? ` +${totalPetals} 花瓣` : ''}`, 'success')
      }, 3500)
    } catch (e: any) {
      setSpinning(false)
      showToast(e.message || '出错了', 'error')
    }
  }

  const playDice = async () => {
    if (!user) return
    if (diceAnimating) return
    if (petals < diceBetAmount) { showToast(`花瓣不足，需要 ${diceBetAmount} 花瓣`, 'error'); return }
    setDiceAnimating(true)
    try {
      const r = await apiFetch('/api/minigame/dice', {
        method: 'POST',
        body: JSON.stringify({
          betType: diceBetType,
          betAmount: diceBetAmount,
          target: diceBetType === 'exact' ? diceTarget : undefined,
        }),
      })
      if (!r.success) { showToast(r.error || '下注失败', 'error'); setDiceAnimating(false); return }
      const { user: updated, dice, sum, won, netPetals, netCoins } = r.data
      if (updated) {
        updateUser(updated)
        setPetals(updated.petalCoins)
      }
      setLastDiceResult({ dice, sum, won, netPetals, netCoins })
      showToast(won ? `🎉 骰子 ${dice[0]}+${dice[1]}=${sum}，命中！` : `骰子 ${dice[0]}+${dice[1]}=${sum}，继续加油`, won ? 'success' : 'error')
    } catch (e: any) {
      showToast(e.message || '出错了', 'error')
    } finally {
      setDiceAnimating(false)
    }
  }

  const DiceFace = ({ v }: { v: number }) => {
    const dots: Record<number, string[]> = {
      1: ['c'],
      2: ['tl', 'br'],
      3: ['tl', 'c', 'br'],
      4: ['tl', 'tr', 'bl', 'br'],
      5: ['tl', 'tr', 'c', 'bl', 'br'],
      6: ['tl', 'tr', 'ml', 'mr', 'bl', 'br'],
    }
    const positions: Record<string, string> = {
      tl: 'top-1 left-1', tr: 'top-1 right-1',
      ml: 'top-1/2 -translate-y-1/2 left-1', mr: 'top-1/2 -translate-y-1/2 right-1',
      c: 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
      bl: 'bottom-1 left-1', br: 'bottom-1 right-1',
    }
    return (
      <div className={classNames(
        'w-16 h-16 rounded-xl bg-white shadow relative border border-slate-200 flex-shrink-0',
        diceAnimating && 'animate-pulse'
      )}>
        {(dots[v] || []).map(p => (
          <span key={p} className={classNames('absolute w-2.5 h-2.5 rounded-full bg-slate-800', positions[p])} />
        ))}
      </div>
    )
  }

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 pt-10 pb-8 text-center">
        <div className="card p-10">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-fuchsia-400 to-purple-600 flex items-center justify-center shadow-md">
            <Gift size={40} className="text-white" />
          </div>
          <h2 className="font-bold text-lg mb-1 text-slate-800">请先登录</h2>
          <p className="text-sm text-slate-500 mb-5">登录后即可参与小游戏，消耗花瓣赢金币</p>
          <button onClick={() => setShowLogin(true)} className="btn-primary">登录 / 注册</button>
        </div>
        {showLogin && <LoginModal onClose={() => setShowLogin(false)} onSuccess={() => setShowLogin(false)} />}
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 pt-4 pb-10">
      <div className="card p-4 mb-4 overflow-hidden relative bg-gradient-to-br from-fuchsia-500 via-purple-600 to-indigo-600 text-white shadow-lg">
        <div className="absolute -top-16 -right-10 w-48 h-48 rounded-full bg-white/10" />
        <div className="absolute -bottom-24 -left-8 w-48 h-48 rounded-full bg-white/5" />
        <div className="relative flex items-center gap-3">
          <button onClick={() => typeof window !== 'undefined' && window.history.back()} className="p-2 hover:bg-white/10 rounded-xl"><ChevronLeft size={20} /></button>
          <div className="w-12 h-12 rounded-xl bg-white/20 backdrop-blur flex items-center justify-center shadow-sm">
            <Zap size={24} />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold">小游戏中心</h1>
            <div className="text-xs opacity-80 flex items-center gap-2">
              <Flower size={12} /> 花瓣: <b className="text-base">{petals}</b>
              <span className="mx-1 opacity-50">|</span>
              <Coins size={12} /> 金币: <b>{formatNumber(user.coins)}</b>
            </div>
          </div>
        </div>
      </div>

      {/* 游戏选择 */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        {([
          { k: 'wheel', label: '幸运转盘', icon: Sparkles },
          { k: 'dice', label: '猜大小', icon: Dices },
        ] as const).map(g => {
          const Icon = g.icon
          const active = gameTab === g.k
          return (
            <button key={g.k} onClick={() => setGameTab(g.k)}
              className={classNames(
                'card p-3 flex items-center gap-2 transition',
                active ? 'ring-2 ring-fuchsia-300 bg-fuchsia-50/60' : 'hover:bg-slate-50'
              )}>
              <Icon size={18} className={active ? 'text-fuchsia-600' : 'text-slate-400'} />
              <span className={classNames('font-bold text-sm', active ? 'text-slate-800' : 'text-slate-500')}>{g.label}</span>
            </button>
          )
        })}
      </div>

      {gameTab === 'wheel' && (
      <>
      {/* 转盘 */}
      <div className="card p-5 mb-4">
        <h3 className="font-bold text-slate-800 mb-1 flex items-center gap-2">
          <Sparkles size={16} className="text-fuchsia-500" /> 幸运大转盘
        </h3>
        <div className="text-xs text-slate-500 mb-4">每次抽奖消耗 1 花瓣，大奖高达 2000 金币～</div>
        <div className="flex justify-center relative select-none" ref={canvasRef} style={{ touchAction: 'none' }}>
          {/* 外圈装饰 */}
          <div className="absolute -inset-3 rounded-full bg-gradient-to-br from-amber-300 via-orange-400 to-rose-500 shadow-xl opacity-80" />
          <div className="relative" style={{ width: radius * 2, height: radius * 2 }}>
            {/* 指针（固定在顶部） */}
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20">
              <div className="w-0 h-0 border-l-[10px] border-r-[10px] border-t-[18px] border-l-transparent border-r-transparent border-t-red-600 drop-shadow-lg" />
              <div className="w-3 h-3 rounded-full bg-red-600 -mt-1 mx-auto shadow-inner" />
            </div>
            {/* 转盘主体 */}
            <svg
              viewBox={`0 0 ${radius * 2} ${radius * 2}`}
              width="100%" height="100%"
              style={{ transition: spinning ? 'transform 3.5s cubic-bezier(0.17, 0.67, 0.18, 1)' : 'none', transform: `rotate(${rotation}deg)` }}
              className="relative z-10"
            >
              <defs>
                <filter id="wheel-shadow"><feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity="0.15" /></filter>
              </defs>
              <g filter="url(#wheel-shadow)">
                {sectors.map((d, i) => (
                  <path key={i} d={d} fill={SECTOR_COLORS[i % SECTOR_COLORS.length]} stroke="#fff" strokeWidth="2" />
                ))}
                {/* 奖励文字 */}
                {WHEEL_REWARDS.map((r, i) => {
                  const a = (i * anglePer + anglePer / 2 - 90) * Math.PI / 180
                  const tx = radius + (radius * 0.6) * Math.cos(a)
                  const ty = radius + (radius * 0.6) * Math.sin(a)
                  const rot = i * anglePer + anglePer / 2
                  const short = r.label.length > 8 ? r.label.slice(0, 8) : r.label
                  return (
                    <text key={r.key}
                      x={tx} y={ty}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      transform={`rotate(${rot} ${tx} ${ty})`}
                      fontSize={r.coins >= 5000 ? 14 : 12}
                      fontWeight={r.coins >= 5000 ? 800 : 600}
                      fill={r.coins >= 5000 ? '#b91c1c' : r.key === 'nothing' ? '#94a3b8' : '#334155'}>
                      {short}
                    </text>
                  )
                })}
                {/* 中心装饰圆圈 */}
                <circle cx={radius} cy={radius} r={26} fill="#fff" stroke="#e5e7eb" strokeWidth="3" />
              </g>
            </svg>
            {/* 中心按钮 */}
            <button
              onClick={spin}
              disabled={spinning || petals < spinTimes}
              className={classNames(
                'absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full font-bold shadow-lg transition-all active:scale-95 z-30',
                'w-[52px] h-[52px] text-xs leading-tight',
                spinning || petals < spinTimes
                  ? 'bg-slate-300 text-slate-600 cursor-not-allowed'
                  : 'bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 text-white hover:shadow-orange-200 hover:shadow-xl'
              )}
              style={{ boxShadow: '0 6px 18px rgba(251,146,60,0.35)' }}
            >
              {spinning ? <RefreshCw size={18} className="animate-spin mx-auto" /> : (
                <>
                  <PlayCircle size={14} className="mx-auto mb-0.5" />
                  GO!
                </>
              )}
            </button>
          </div>
        </div>

        {/* 连抽设置 */}
        <div className="mt-5 grid grid-cols-3 gap-2">
          {([1, 5, 10] as const).map(n => (
            <button key={n}
              onClick={() => setSpinTimes(n)}
              disabled={spinning}
              className={classNames(
                'py-2 rounded-xl text-sm font-medium border transition',
                spinTimes === n
                  ? 'bg-gradient-to-r from-fuchsia-500 to-purple-600 border-transparent text-white shadow-md'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50'
              )}>
              {n === 1 ? '单抽' : `${n} 连抽`}
              <div className="text-[10px] opacity-80 mt-0.5">{n} 花瓣{n > 1 ? ` · 优惠 ${n - 1 >= 4 ? '高暴击' : ''}` : ''}</div>
            </button>
          ))}
        </div>
        <button onClick={spin} disabled={spinning || petals < spinTimes} className="btn-primary w-full py-3 mt-3 font-bold disabled:opacity-50 text-base">
          {spinning ? '转动中...' : petals < spinTimes ? `花瓣不足（需要 ${spinTimes}）` : `立即抽奖（消耗 ${spinTimes} 花瓣）`}
        </button>
      </div>

      {/* 结果汇总 */}
      {lastBatch && (
        <div className="card p-4 mb-4 bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200">
          <div className="text-xs text-emerald-700 mb-1 flex items-center gap-1"><Trophy size={12} /> 本次奖励</div>
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-1 text-amber-600 font-bold text-base"><Coins size={16} /> +{formatNumber(lastBatch.totalCoins)}</div>
            {lastBatch.totalPetals > 0 && <div className="flex items-center gap-1 text-pink-600 font-bold text-base"><Flower size={16} /> +{lastBatch.totalPetals}</div>}
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {lastBatch.results.map((idx, i) => (
              <div key={i} className="px-2 py-1 rounded-lg bg-white/80 border border-emerald-200 text-[10px] text-slate-700">
                {WHEEL_REWARDS[idx].label}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 历史记录 */}
      <div className="card p-4">
        <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
          <Gift size={16} className="text-purple-500" /> 最近抽奖记录
        </h3>
        {history.length === 0 && (
          <div className="text-center text-slate-400 text-sm py-8">还没有抽奖记录，快来试试手气吧～</div>
        )}
        <div className="space-y-1.5">
          {history.map((h, i) => (
            <div key={`${h.at}-${i}`} className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
              <div className="text-sm text-slate-700 flex items-center gap-2">
                <span className={classNames('w-6 h-6 rounded-lg flex items-center justify-center text-xs',
                  WHEEL_REWARDS[h.index].coins >= 5000 ? 'bg-red-100 text-red-600'
                    : WHEEL_REWARDS[h.index].coins >= 1000 ? 'bg-amber-100 text-amber-600'
                    : WHEEL_REWARDS[h.index].key === 'nothing' ? 'bg-slate-200 text-slate-500'
                    : 'bg-emerald-100 text-emerald-700')}>
                  {WHEEL_REWARDS[h.index].coins >= 5000 ? '🏆' : WHEEL_REWARDS[h.index].key === 'nothing' ? '·' : '✓'}
                </span>
                {WHEEL_REWARDS[h.index].label}
              </div>
              <div className="text-xs text-slate-400 flex gap-2">
                {h.coins > 0 && <span className="text-amber-600 font-medium">+{formatNumber(h.coins)}</span>}
                {h.petals > 0 && <span className="text-pink-600 font-medium">🌸+{h.petals}</span>}
                <span>{new Date(h.time).toLocaleTimeString()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      </>
      )}

      {gameTab === 'dice' && (
        <div className="space-y-4">
          <div className="card p-5">
            <h3 className="font-bold text-slate-800 mb-1 flex items-center gap-2">
              <Dices size={16} className="text-indigo-500" /> 猜大小
            </h3>
            <div className="text-xs text-slate-500 mb-4">两颗骰子之和，猜中可赢取多倍花瓣 + 金币</div>

            <div className="grid grid-cols-4 gap-2 mb-4">
              {([
                { k: 'small', label: '小 (2-6)', payout: '×2' },
                { k: 'big', label: '大 (8-12)', payout: '×2' },
                { k: 'middle', label: '7', payout: '×5' },
                { k: 'exact', label: '精确7', payout: '×20' },
              ] as const).map(o => {
                const active = diceBetType === o.k
                return (
                  <button key={o.k} onClick={() => setDiceBetType(o.k as any)}
                    className={classNames(
                      'p-2 rounded-xl text-xs font-medium border',
                      active ? 'bg-indigo-500 text-white border-indigo-500 shadow' : 'bg-white border-slate-200 text-slate-600'
                    )}>
                    <div>{o.label}</div>
                    <div className="text-[10px] opacity-80">{o.payout}</div>
                  </button>
                )
              })}
            </div>

            {diceBetType === 'exact' && (
              <div className="mb-3 flex items-center gap-2">
                <span className="text-xs text-slate-600">精确点数：</span>
                {[2,3,4,5,6,7,8,9,10,11,12].map(n => (
                  <button key={n} onClick={() => setDiceTarget(n)}
                    className={classNames(
                      'w-8 h-8 rounded-lg text-xs font-bold',
                      diceTarget === n ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-600'
                    )}>{n}</button>
                ))}
              </div>
            )}

            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs text-slate-600">下注：</span>
              {[1, 5, 10, 20, 50].map(n => (
                <button key={n} onClick={() => setDiceBetAmount(n)}
                  className={classNames(
                    'px-3 py-1 rounded-lg text-xs font-bold',
                    diceBetAmount === n ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-700'
                  )}>{n} 花瓣</button>
              ))}
            </div>

            <div className="flex gap-3 mb-4">
              <div className="w-20 h-20 rounded-xl bg-slate-100 border-2 border-dashed border-slate-300 flex items-center justify-center text-xs text-slate-400">
                等待...
              </div>
              <div className="text-4xl font-bold text-slate-700 self-center">=</div>
              <div className="w-20 h-20 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white flex items-center justify-center text-2xl font-bold shadow">
                {lastDiceResult ? lastDiceResult.sum : '?'}
              </div>
            </div>
            {lastDiceResult && (
              <div className="flex gap-2 mb-4">
                <DiceFace v={lastDiceResult.dice[0]} />
                <DiceFace v={lastDiceResult.dice[1]} />
                <div className={classNames(
                  'ml-auto px-3 py-1.5 rounded-xl text-sm font-bold',
                  lastDiceResult.won ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                )}>
                  {lastDiceResult.won ? `🎉 命中！+${lastDiceResult.netPetals}花瓣 +${lastDiceResult.netCoins}金币` : `未中 -${diceBetAmount}花瓣`}
                </div>
              </div>
            )}

            <button onClick={playDice} disabled={diceAnimating || petals < diceBetAmount}
              className={classNames(
                'w-full py-3 rounded-xl font-bold text-base transition-all shadow-lg',
                diceAnimating || petals < diceBetAmount
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:shadow-xl active:scale-[0.98]'
              )}>
              {diceAnimating ? '骰子旋转中...' : `掷骰子（下注 ${diceBetAmount} 花瓣）`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
