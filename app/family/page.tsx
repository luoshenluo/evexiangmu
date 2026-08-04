'use client'

import { useState } from 'react'
import { useAppStore } from '@/lib/store'
import { apiFetch, classNames, formatNumber } from '@/lib/utils'
import { Users, Plus, Shield, Trophy, LogOut, Coins, LogIn, Search, X, Crown } from 'lucide-react'

export default function FamilyPage() {
  const { user, updateUser, showToast } = useAppStore()
  const [showCreate, setShowCreate] = useState(false)
  const [showJoin, setShowJoin] = useState(false)
  const [searchName, setSearchName] = useState('')
  const [formName, setFormName] = useState('')
  const [formAnnouncement, setFormAnnouncement] = useState('')
  const [loading, setLoading] = useState(false)
  const [family, setFamily] = useState<any>(null)

  const create = async () => {
    if (!formName.trim()) return showToast('请输入家族名称', 'error')
    if (!user || user.coins < 1000) return showToast('创建家族需要 1000 金币', 'error')
    setLoading(true)
    try {
      const res = await apiFetch('/api/family/create', {
        method: 'POST',
        body: JSON.stringify({ name: formName, announcement: formAnnouncement })
      })
      if (res.success) {
        if (res.data?.user) updateUser(res.data.user)
        if (res.data?.family) setFamily(res.data.family)
        showToast('🎉 家族创建成功！', 'success')
        setShowCreate(false)
      } else {
        showToast(res.error || '创建失败', 'error')
      }
    } finally { setLoading(false) }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 pt-4 pb-8">
      {/* 顶部 */}
      <div className="card p-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center shadow-md shadow-blue-200">
            <Users size={24} className="text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-slate-800">家族</h1>
            <p className="text-xs text-slate-500">和伙伴们一起经营花园</p>
          </div>
          {!user?.familyId && (
            <div className="flex gap-2">
              <button
                onClick={() => setShowJoin(true)}
                className="btn-secondary py-2 px-3 text-xs"
              >
                <LogIn size={14} /> 加入
              </button>
              <button
                onClick={() => setShowCreate(true)}
                className="btn-primary py-2 px-3 text-xs flex items-center gap-1"
              >
                <Plus size={14} /> 创建
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 无家族状态 */}
      {!user?.familyId && (
        <div className="card p-10 text-center">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center">
            <Users size={40} className="text-blue-500" />
          </div>
          <h2 className="text-lg font-bold text-slate-800 mb-1">还没有加入家族</h2>
          <p className="text-sm text-slate-500 mb-5">
            创建家族需要 1000 金币，或申请加入其他家族
          </p>
          <div className="flex justify-center gap-3">
            <button onClick={() => setShowJoin(true)} className="btn-secondary">
              加入家族
            </button>
            <button onClick={() => setShowCreate(true)} className="btn-primary">
              创建家族 (1000💰)
            </button>
          </div>

          {/* 家族好处 */}
          <div className="grid grid-cols-3 gap-3 mt-10">
            {[
              { icon: <Shield size={24} />, title: '专属频道', desc: '内部聊天' },
              { icon: <Trophy size={24} />, title: '家族任务', desc: '丰厚奖励' },
              { icon: <Crown size={24} />, title: '升级扩容', desc: '最多500人' },
            ].map((item, idx) => (
              <div key={idx} className="p-3 rounded-xl bg-slate-50">
                <div className="text-garden-500 mb-2 flex justify-center">{item.icon}</div>
                <div className="text-sm font-bold text-slate-700">{item.title}</div>
                <div className="text-[11px] text-slate-500">{item.desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 已有家族（简化版占位） */}
      {user?.familyId && (
        <div className="card p-6 text-center">
          <div className="text-6xl mb-3">👨‍👩‍👧‍👦</div>
          <h2 className="font-bold text-lg mb-1">我的家族</h2>
          <p className="text-sm text-slate-500">家族功能正在完善中</p>
          <button
            onClick={async () => {
              const res = await apiFetch('/api/family/leave', { method: 'POST' })
              if (res.success) {
                if (res.data?.user) updateUser(res.data.user)
                showToast('已退出家族', 'info')
              }
            }}
            className="btn-danger mt-4 text-xs py-1.5 px-3"
          >
            <LogOut size={14} /> 退出家族
          </button>
        </div>
      )}

      {/* 创建弹窗 */}
      {showCreate && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowCreate(false)}
        >
          <div
            className="card w-full max-w-md p-5 slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg text-slate-800">创建家族</h2>
              <button onClick={() => setShowCreate(false)} className="p-2 hover:bg-slate-100 rounded-xl">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-700">家族名称（唯一）</label>
                <input
                  className="input"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  maxLength={10}
                  placeholder="请输入家族名称"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-700">家族公告</label>
                <textarea
                  className="input min-h-[80px] resize-none"
                  value={formAnnouncement}
                  onChange={(e) => setFormAnnouncement(e.target.value)}
                  maxLength={100}
                  placeholder="家族介绍..."
                />
              </div>
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-700 flex items-center justify-between">
                <span>创建费用</span>
                <span className="font-bold flex items-center gap-1"><Coins size={14} /> 1000</span>
              </div>
              <button
                onClick={create}
                disabled={loading}
                className="btn-primary w-full py-2.5"
              >
                {loading ? '创建中...' : '创建家族'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 加入弹窗 */}
      {showJoin && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowJoin(false)}
        >
          <div
            className="card w-full max-w-md p-5 slide-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-lg text-slate-800">加入家族</h2>
              <button onClick={() => setShowJoin(false)} className="p-2 hover:bg-slate-100 rounded-xl">
                <X size={18} />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1 text-slate-700">搜索家族名称</label>
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    className="input pl-10"
                    value={searchName}
                    onChange={(e) => setSearchName(e.target.value)}
                    placeholder="输入家族名称"
                  />
                </div>
              </div>
              <div className="text-center py-8 text-sm text-slate-400">
                搜索功能开发中...
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
