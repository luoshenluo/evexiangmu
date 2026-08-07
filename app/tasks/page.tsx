'use client'

import { useState, useEffect } from 'react'
import { useAppStore } from '@/lib/store'
import { apiFetch, classNames, formatNumber } from '@/lib/utils'
import { ClipboardList, CheckCircle2, Circle, Gift, Calendar, CalendarDays, Award } from 'lucide-react'
import type { Task } from '@/lib/types'

type Tab = 'daily' | 'weekly' | 'monthly'

export default function TasksPage() {
  const { user, updateUser, showToast, isGuest } = useAppStore()
  const [tab, setTab] = useState<Tab>('daily')
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState<string | null>(null)

  const refresh = async () => {
    const res = await apiFetch('/api/tasks')
    if (res.success && res.data) {
      setTasks(res.data)
    }
  }

  // 游客不拉取任务
  useEffect(() => { if (!isGuest) refresh() }, [isGuest])

  const claim = async (taskId: string) => {
    setLoading(taskId)
    try {
      const res = await apiFetch('/api/tasks', {
        method: 'POST',
        body: JSON.stringify({ taskId })
      })
      if (res.success) {
        if (res.data?.user) updateUser(res.data.user)
        showToast(res.data?.message || `🎉 领取奖励成功！`, 'success')
        refresh()
      } else {
        showToast(res.error || '领取失败', 'error')
      }
    } finally {
      setLoading(null)
    }
  }

  const filteredTasks = tasks.filter(t => t.type === tab)

  const tabInfo = {
    daily: { label: '每日任务', icon: Calendar, tip: '每天 00:00 刷新' },
    weekly: { label: '每周任务', icon: CalendarDays, tip: '每周一 00:00 刷新' },
    monthly: { label: '每月任务', icon: Award, tip: '每月 1 日 00:00 刷新' },
  }

  const totalProgress = filteredTasks.length
    ? Math.round(filteredTasks.reduce((s, t) => s + Math.min(t.progress / t.target, 1), 0) / filteredTasks.length * 100)
    : 0

  // 游客模式：任务列表为空，提示登录后查看
  if (isGuest) {
    return (
      <div className="max-w-2xl mx-auto px-4 pt-4 pb-8">
        <div className="card p-4 mb-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center shadow-md shadow-orange-200">
            <ClipboardList size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-800">任务中心</h1>
            <p className="text-xs text-slate-500 mt-0.5">完成任务获取丰厚奖励</p>
          </div>
        </div>
        <div className="card p-8 text-center text-slate-400 text-sm">
          <ClipboardList size={40} className="mx-auto mb-2 text-slate-300" />
          登录后查看任务
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 pt-4 pb-8">
      {/* 顶部 */}
      <div className="card p-4 mb-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-garden-200/50 rounded-full -translate-y-16 translate-x-16" />
        <div className="relative flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center shadow-md shadow-orange-200">
            <ClipboardList size={24} className="text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-slate-800">任务中心</h1>
            <p className="text-xs text-slate-500 mt-0.5">完成任务获取丰厚奖励</p>
          </div>
          <div className="text-right">
            <div className="text-xs text-slate-500">完成度</div>
            <div className="text-lg font-bold text-garden-600">{totalProgress}%</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {(Object.keys(tabInfo) as Tab[]).map(key => {
          const info = tabInfo[key]
          const Icon = info.icon
          const active = tab === key
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={classNames(
                'card p-3 text-left transition-all',
                active ? 'ring-2 ring-garden-400 border-garden-300 bg-garden-50/50' : ''
              )}
            >
              <Icon size={20} className={active ? 'text-garden-600' : 'text-slate-400'} />
              <div className={classNames('font-bold mt-1 text-sm', active ? 'text-slate-800' : 'text-slate-600')}>
                {info.label}
              </div>
              <div className="text-[10px] text-slate-400">{info.tip}</div>
            </button>
          )
        })}
      </div>

      {/* 任务列表 */}
      {filteredTasks.length === 0 ? (
        <div className="card p-8 text-center text-slate-400 text-sm">
          <ClipboardList size={40} className="mx-auto mb-2 text-slate-300" />
          暂无任务
        </div>
      ) : (
        <div className="space-y-3">
          {filteredTasks.map(task => {
            const percent = Math.min(task.progress / task.target * 100, 100)
            return (
              <div key={task.id} className="card p-4">
                <div className="flex items-start gap-3">
                  <div className={classNames(
                    'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
                    task.claimed ? 'bg-garden-100' : task.completed ? 'bg-amber-100' : 'bg-slate-100'
                  )}>
                    {task.claimed ? (
                      <CheckCircle2 size={22} className="text-garden-500" />
                    ) : (
                      <Circle size={22} className={task.completed ? 'text-amber-500' : 'text-slate-400'} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-bold text-slate-800 text-sm">{task.title}</h3>
                      {task.claimed && (
                        <span className="chip bg-garden-100 text-garden-700 text-[10px]">已领取</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">{task.description}</p>

                    {/* 进度条 */}
                    <div className="mt-2 flex items-center gap-2">
                      <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                        <div
                          className={classNames(
                            'h-full rounded-full transition-all',
                            task.completed
                              ? 'bg-gradient-to-r from-amber-400 to-orange-500'
                              : 'bg-gradient-to-r from-garden-400 to-garden-500'
                          )}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <span className="text-xs font-bold text-slate-700 whitespace-nowrap min-w-[54px] text-right">
                        {Math.min(task.progress, task.target)} / {task.target}
                      </span>
                    </div>

                    {/* 奖励 */}
                    <div className="flex items-center justify-between mt-2.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        {task.rewards.coins && (
                          <span className="chip bg-amber-100 text-amber-700 text-[10px]">
                            💰 {formatNumber(task.rewards.coins)} 金币
                          </span>
                        )}
                        {task.rewards.items?.map((item, idx) => (
                          <span key={idx} className="chip bg-purple-100 text-purple-700 text-[10px]">
                            🎁 道具x{item.quantity}
                          </span>
                        ))}
                      </div>
                      <button
                        onClick={() => claim(task.id)}
                        disabled={task.claimed || !task.completed || loading === task.id}
                        className={classNames(
                          'px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-all',
                          task.claimed
                            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                            : task.completed
                              ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:shadow-md animate-pulse active:scale-95'
                              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                        )}
                      >
                        <Gift size={14} />
                        {task.claimed ? '已领取' : task.completed ? '领取' : '进行中'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
