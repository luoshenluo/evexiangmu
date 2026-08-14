'use client'

import { useState, useMemo } from 'react'
import { X, Sprout, Leaf } from 'lucide-react'
import { apiFetch, classNames } from '@/lib/utils'
import { useAppStore } from '@/lib/store'
import { useRouter } from 'next/navigation'
import { validateUsername, validatePassword, validateNickname, countPasswordCategories } from '@/lib/password'

interface Props {
  onClose?: () => void
  onSuccess?: () => void
  onGuestEnter?: () => void
}

export default function LoginModal({ onClose, onSuccess, onGuestEnter }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [nickname, setNickname] = useState('')
  const [loading, setLoading] = useState(false)
  const [serverMsg, setServerMsg] = useState<{ type: 'error' | 'info'; text: string } | null>(null)
  const { login, showToast } = useAppStore()
  const router = useRouter()

  // 密码强度（注册模式显示）：长度不足为不合格，按命中的字符类别数分级
  const passwordStrength = useMemo(() => {
    if (!password) return { level: 0, label: '', color: '', width: 0, ok: false }
    if (password.length < 8 || password.length > 16) {
      return { level: 0, label: '密码需为8-16位字母/数字/符号（不含中文）', color: 'bg-red-400', width: 100, ok: false }
    }
    const c = countPasswordCategories(password)
    const labels = ['', '弱', '中', '强', '极强']
    const colors = ['', 'bg-red-500', 'bg-amber-500', 'bg-green-500', 'bg-emerald-500']
    return { level: c, label: labels[c], color: colors[c], width: (c / 4) * 100, ok: c >= 2 }
  }, [password])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setServerMsg(null)
    if (!username.trim() || !password.trim()) {
      setServerMsg({ type: 'error', text: '请填写完整信息' })
      return
    }
    if (mode === 'register' && !nickname.trim()) {
      setServerMsg({ type: 'error', text: '请填写昵称' })
      return
    }
    // 客户端同步校验（与后端 lib/password.ts 一致）
    if (mode === 'register') {
      const nCheck = validateUsername(username.trim())
      if (!nCheck.ok) { setServerMsg({ type: 'error', text: nCheck.message || '' }); return }
      const pCheck = validatePassword(password)
      if (!pCheck.ok) { setServerMsg({ type: 'error', text: pCheck.message || '' }); return }
      const nickCheck = validateNickname(nickname.trim())
      if (!nickCheck.ok) { setServerMsg({ type: 'error', text: nickCheck.message || '' }); return }
    }
    setLoading(true)
    try {
      const res = await apiFetch(mode === 'login' ? '/api/auth/login' : '/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(mode === 'login'
          ? { username, password }
          : { username, password, nickname }
        ),
      })
      if (res.success && res.data) {
        login(res.data.user, res.data.token)
        showToast(mode === 'login' ? '登录成功！欢迎回来 🌱' : '注册成功！欢迎加入花园 🌸', 'success')
        onSuccess?.()
        router.push('/garden')
      } else {
        setServerMsg({ type: 'error', text: res.error || '操作失败，请检查网络后重试' })
      }
    } catch (e: any) {
      setServerMsg({ type: 'error', text: e?.message || '网络请求失败，无法连接服务器' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="card w-full max-w-md p-6 relative slide-up">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
          >
            <X size={20} />
          </button>
        )}

        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-garden-400 to-garden-600 flex items-center justify-center shadow-lg shadow-garden-200">
            <Sprout size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center justify-center gap-2">
            <Leaf size={22} className="text-garden-500" />
            花园 Garden
          </h1>
          <p className="text-sm text-slate-500 mt-1">种植 · 交易 · 社交 · 成长</p>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-2 gap-2 mb-5 p-1 bg-garden-50 rounded-xl">
          {(['login', 'register'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={classNames(
                'py-2 px-4 rounded-lg text-sm font-medium transition-all',
                mode === m
                  ? 'bg-white text-garden-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              )}
            >
              {m === 'login' ? '登录' : '注册'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">账号</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="请输入账号"
              className="input"
              autoFocus
            />
            {mode === 'register' && (
              <p className={classNames('text-xs mt-1', username && !validateUsername(username.trim()).ok ? 'text-red-500' : 'text-slate-400')}>
                3-18位字母和数字
              </p>
            )}
          </div>
          {mode === 'register' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">昵称</label>
              <input
                type="text"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="给自己起个好听的昵称吧"
                className="input"
              />
              <p className={classNames('text-xs mt-1', nickname && !validateNickname(nickname.trim()).ok ? 'text-red-500' : 'text-slate-400')}>
                最多12个字符或8个汉字（当前 {nickname.length}/12）
              </p>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
              className="input"
            />
            {mode === 'register' && password && (
              <div className="mt-1.5">
                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className={classNames('h-full rounded-full transition-all duration-300', passwordStrength.color)}
                    style={{ width: `${passwordStrength.width}%` }}
                  />
                </div>
                <p className={classNames('text-xs mt-1', passwordStrength.level > 0 ? (passwordStrength.ok ? 'text-emerald-600' : 'text-red-500') : 'text-red-500')}>
                  {passwordStrength.level > 0
                    ? `密码强度：${passwordStrength.label}${passwordStrength.ok ? '' : '（需至少两类字符）'}`
                    : passwordStrength.label}
                </p>
              </div>
            )}
          </div>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-2.5 mt-2"
          >
            {loading ? '处理中...' : mode === 'login' ? '登 录' : '注 册'}
          </button>
        </form>

        {/* 服务器返回的错误/提示，显示在表单下方，比 Toast 更可见 */}
        {serverMsg && (
          <div
            className={
              'mt-3 p-3 rounded-xl text-sm border flex items-start gap-2 ' +
              (serverMsg.type === 'error'
                ? 'bg-red-50 border-red-200 text-red-700'
                : 'bg-blue-50 border-blue-200 text-blue-700')
            }
          >
            <span className="mt-0.5">{serverMsg.type === 'error' ? '⚠️' : 'ℹ️'}</span>
            <div className="flex-1 whitespace-pre-wrap break-all">{serverMsg.text}</div>
            <button
              onClick={() => setServerMsg(null)}
              className="text-xs opacity-60 hover:opacity-100"
              aria-label="关闭"
            >
              ✕
            </button>
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-slate-100 space-y-2">
          {/* 游客模式：不调 API，直接以游客身份浏览 */}
          <button
            onClick={() => onGuestEnter?.()}
            disabled={loading}
            className="btn-primary w-full text-sm"
          >
            👤 游客模式（仅浏览）
          </button>
        </div>
      </div>
    </div>
  )
}
