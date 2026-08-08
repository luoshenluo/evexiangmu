'use client'

import { useState, useEffect } from 'react'
import { useAppStore } from '@/lib/store'
import { apiFetch, classNames } from '@/lib/utils'
import { Palette, Moon, Sun, Leaf, Sunset, Waves, Sparkles, Flower2, Trees, MapPin, Check, ChevronLeft, Paintbrush } from 'lucide-react'
import LoginModal from '@/components/LoginModal'

type Theme = 'light' | 'dark' | 'garden' | 'sunset' | 'ocean'

const THEMES: { k: Theme; name: string; icon: any; preview: string; desc: string }[] = [
  { k: 'light', name: '日间清新', icon: Sun, preview: 'from-slate-50 to-white text-slate-800', desc: '明亮舒适' },
  { k: 'dark', name: '夜间模式', icon: Moon, preview: 'from-slate-800 to-slate-900 text-slate-100', desc: '护眼模式' },
  { k: 'garden', name: '花园翠绿', icon: Leaf, preview: 'from-green-50 to-emerald-50 text-emerald-900', desc: '自然花园风' },
  { k: 'sunset', name: '暮光橙霞', icon: Sunset, preview: 'from-orange-50 to-rose-50 text-orange-900', desc: '温暖夕阳' },
  { k: 'ocean', name: '海洋深蓝', icon: Waves, preview: 'from-sky-50 to-blue-50 text-blue-900', desc: '静谧海边' },
]

const GARDEN_BGS: { k: string; name: string; preview: string; emoji: string; price?: number }[] = [
  { k: 'default', name: '原始花园', preview: 'bg-gradient-to-br from-green-400 via-emerald-400 to-teal-500', emoji: '🌿' },
  { k: 'green', name: '绿野仙踪', preview: 'bg-gradient-to-br from-emerald-300 via-green-400 to-lime-400', emoji: '🌳' },
  { k: 'purple', name: '薰衣草田', preview: 'bg-gradient-to-br from-purple-300 via-violet-400 to-fuchsia-400', emoji: '💜' },
  { k: 'blue', name: '湛蓝湖畔', preview: 'bg-gradient-to-br from-sky-300 via-cyan-400 to-blue-500', emoji: '💧' },
  { k: 'sunset', name: '金色黄昏', preview: 'bg-gradient-to-br from-amber-300 via-orange-400 to-rose-400', emoji: '🌇' },
  { k: 'sakura', name: '樱花漫舞', preview: 'bg-gradient-to-br from-pink-200 via-rose-300 to-pink-400', emoji: '🌸' },
  { k: 'autumn', name: '枫叶秋语', preview: 'bg-gradient-to-br from-amber-400 via-orange-500 to-red-500', emoji: '🍁' },
  { k: 'night', name: '星空夜幕', preview: 'bg-gradient-to-br from-slate-700 via-indigo-800 to-slate-900', emoji: '🌌' },
  { k: 'ocean', name: '海底世界', preview: 'bg-gradient-to-br from-cyan-400 via-blue-500 to-indigo-600', emoji: '🐚' },
]

export default function SettingsPage() {
  const { user, updateUser, showToast, setTheme: storeSetTheme, setGardenBg: storeSetGardenBg } = useAppStore()
  const [showLogin, setShowLogin] = useState(false)
  const [theme, setTheme] = useState<Theme>((user?.theme as Theme) || 'light')
  const [gardenBg, setGardenBg] = useState(user?.gardenBg || 'default')
  const [title, setTitle] = useState(user?.title || '')
  const [saveLoading, setSaveLoading] = useState(false)
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // 读取已有的设置
  useEffect(() => {
    if (!user) return
    ;(async () => {
      const r = await apiFetch('/api/user/settings')
      if (r.success && r.data) {
        setTheme(r.data.theme || 'light')
        setGardenBg(r.data.gardenBg || 'default')
        setTitle(r.data.title || '')
      }
    })()
  }, [user?.id])

  // 立即应用主题到 store 与 html 根
  useEffect(() => {
    // 应用到 documentElement
    const html = document.documentElement
    html.dataset.theme = theme
    if (theme === 'dark') {
      html.classList.add('dark')
    } else {
      html.classList.remove('dark')
    }
    storeSetTheme(theme)
    storeSetGardenBg(gardenBg)
  }, [theme, gardenBg])

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 pt-10 text-center" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 100px)' }}>
        <div className="card p-10">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-indigo-100 flex items-center justify-center">
            <Palette size={40} className="text-indigo-500" />
          </div>
          <h2 className="font-bold text-lg mb-1 text-slate-800">请先登录</h2>
          <p className="text-sm text-slate-500 mb-5">登录后设置主题和花园皮肤</p>
          <button onClick={() => setShowLogin(true)} className="btn-primary">登录 / 注册</button>
        </div>
        {showLogin && <LoginModal onClose={() => setShowLogin(false)} onSuccess={() => setShowLogin(false)} />}
      </div>
    )
  }

  const save = async () => {
    setSaveLoading(true); setMsg(null)
    try {
      const res = await apiFetch('/api/user/settings', {
        method: 'POST',
        body: JSON.stringify({ theme, gardenBg, title }),
      })
      if (res.success) {
        showToast('已保存设置', 'success')
        if (res.data) updateUser(res.data)
        setMsg({ type: 'success', text: '所有设置已保存' })
        setTimeout(() => setMsg(null), 3000)
      } else {
        showToast(res.error || '保存失败', 'error')
        setMsg({ type: 'error', text: res.error || '保存失败' })
      }
    } finally { setSaveLoading(false) }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 pt-4" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 100px)' }}>
      {/* 顶部 */}
      <div className="card p-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-400 to-purple-600 flex items-center justify-center shadow-md shadow-indigo-200">
            <Palette size={24} className="text-white" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-slate-800">外观与设置</h1>
            <p className="text-xs text-slate-500">定制你的专属主题与花园皮肤</p>
          </div>
          <button onClick={() => typeof window !== 'undefined' && window.history.back()} className="p-2 hover:bg-slate-100 rounded-xl" title="返回">
            <ChevronLeft size={20} className="text-slate-500" />
          </button>
        </div>
        {msg && (
          <div className={classNames(
            'mt-3 p-2.5 rounded-xl text-xs flex items-center gap-1.5',
            msg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
          )}>
            <Check size={14} /> {msg.text}
          </div>
        )}
      </div>

      {/* 全局主题 */}
      <div className="card p-5 mb-4">
        <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
          <Paintbrush size={16} className="text-indigo-500" /> 界面主题
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {THEMES.map(t => {
            const Icon = t.icon
            const active = theme === t.k
            return (
              <button key={t.k}
                onClick={() => setTheme(t.k)}
                className={classNames(
                  'p-3 rounded-2xl border transition-all text-left',
                  active ? 'border-indigo-500 ring-2 ring-indigo-200 shadow-md' : 'border-slate-200 hover:border-slate-300'
                )}
              >
                <div className={classNames('w-full h-16 rounded-xl bg-gradient-to-br flex items-center justify-center mb-2', t.preview)}>
                  <Icon size={24} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-sm text-slate-800">{t.name}</div>
                    <div className="text-[11px] text-slate-500">{t.desc}</div>
                  </div>
                  {active && <div className="w-5 h-5 rounded-full bg-indigo-500 text-white flex items-center justify-center"><Check size={12} /></div>}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* 花园背景 */}
      <div className="card p-5 mb-4">
        <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
          <Flower2 size={16} className="text-emerald-500" /> 花园背景皮肤
        </h3>
        <div className="grid grid-cols-3 gap-2">
          {GARDEN_BGS.map(b => {
            const active = gardenBg === b.k
            return (
              <button key={b.k}
                onClick={() => setGardenBg(b.k)}
                className={classNames(
                  'p-2 rounded-xl border transition-all',
                  active ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-slate-200 hover:border-slate-300'
                )}
              >
                <div className={classNames('w-full aspect-[4/3] rounded-lg flex items-center justify-center text-3xl mb-2 shadow-inner', b.preview)}>
                  {b.emoji}
                </div>
                <div className="flex items-center justify-between px-0.5">
                  <span className="text-xs font-medium text-slate-700 truncate">{b.name}</span>
                  {active && <Check size={12} className="text-indigo-500" />}
                </div>
              </button>
            )
          })}
        </div>
        <div className="mt-3 p-3 rounded-xl bg-slate-50 text-[11px] text-slate-500 flex items-start gap-2">
          <Sparkles size={12} className="text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            预览：你的花园在游玩界面会使用所选背景样式。皮肤永久免费开放给所有玩家～
          </div>
        </div>
      </div>

      {/* 称号 */}
      <div className="card p-5 mb-4">
        <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
          <MapPin size={16} className="text-amber-500" /> 个人称号
        </h3>
        <div>
          <label className="block text-sm font-medium mb-1 text-slate-600 text-xs">从已解锁称号中选择（通过成就/CDK/活动获得）</label>
          {(() => {
            const owned = ((user as any)?.titles || []) as string[]
            const OPTIONS = [
              { k: '', name: '（不显示称号）' },
              { k: 'newbie', name: '🌱 种花新人' },
              { k: 'green_hand', name: '🌿 园艺新秀' },
              { k: 'expert', name: '🌻 种花专家' },
              { k: 'master', name: '🌹 花园大师' },
              { k: 'legend', name: '👑 传奇园丁' },
              { k: 'first_blood', name: '⚔️ 首战告捷' },
              { k: 'wealthy', name: '💰 小富即安' },
              { k: 'philanthropist', name: '🎁 慷慨之心' },
              { k: 'checkin_dragon', name: '🐉 签到达人' },
            ]
            const granted = owned.length > 0 ? owned : ['newbie']
            const list = OPTIONS.filter(o => o.k === '' || granted.includes(o.k))
            return (
              <div className="space-y-2">
                <select
                  className="input w-full"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                >
                  {list.map(o => (
                    <option key={o.k} value={o.k}>{o.name}</option>
                  ))}
                </select>
                {owned.length === 0 && (
                  <div className="text-[11px] text-amber-600">
                    通过成就、活动或 CDK 解锁更多称号（例如连续签到/收获花朵/消费金币等）
                  </div>
                )}
              </div>
            )
          })()}
          <div className="mt-2 text-xs text-slate-500">
            效果预览：<span className="chip bg-amber-100 text-amber-700">{title ? (user as any)?.titles?.includes(title) ? title : '（未解锁）' : '（无称号）'}</span>
          </div>
        </div>
      </div>

      {/* 保存 */}
      <div className="sticky bottom-4">
        <div className="card p-3 shadow-lg">
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-slate-500">
              全部修改完成后点击保存
            </div>
            <button onClick={save} disabled={saveLoading}
              className="btn-primary py-2.5 px-6 disabled:opacity-60">
              {saveLoading ? '保存中...' : '保存所有设置'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
