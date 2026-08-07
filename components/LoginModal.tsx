'use client'

import { useState } from 'react'
import { X, Sprout, Leaf } from 'lucide-react'
import { apiFetch, classNames } from '@/lib/utils'
import { useAppStore } from '@/lib/store'
import { useRouter } from 'next/navigation'

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

  const handleDemoLogin = async () => {
    setServerMsg(null)
    setLoading(true)
    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: 'demo', password: '123456' })
      })
      if (res.success && res.data) {
        login(res.data.user, res.data.token)
        showToast('已使用演示账号登录', 'success')
        onSuccess?.()
        router.push('/garden')
      } else {
        setServerMsg({ type: 'error', text: res.error || '演示账号登录失败，请联系管理员' })
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
          {/* 体验账号登录：保留原 demo 登录逻辑 */}
          <button
            onClick={handleDemoLogin}
            disabled={loading}
            className="btn-secondary w-full text-sm"
          >
            🎮 体验账号登录 (demo/123456)
          </button>
        </div>
      </div>
    </div>
  )
}
