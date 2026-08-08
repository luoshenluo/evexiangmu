'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAppStore } from '@/lib/store'
import { apiFetch, formatDateTime } from '@/lib/utils'
import { Settings, Save, RefreshCw, AlertCircle } from 'lucide-react'

interface ChatSettings {
  maxMessagesPerMinute: number
  maxMessageLength: number
  minMessageIntervalMs: number
  enabled: boolean
  updatedAt: number
}

export default function ChatSettingsPanel() {
  const { showToast } = useAppStore()
  const [settings, setSettings] = useState<ChatSettings | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  // 本地编辑态
  const [maxPerMin, setMaxPerMin] = useState(5)
  const [maxLen, setMaxLen] = useState(200)
  const [minInterval, setMinInterval] = useState(2000)
  const [enabled, setEnabled] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiFetch('/api/admin/chat/settings')
      if (res.success && res.data) {
        setSettings(res.data)
        setMaxPerMin(res.data.maxMessagesPerMinute)
        setMaxLen(res.data.maxMessageLength)
        setMinInterval(res.data.minMessageIntervalMs)
        setEnabled(res.data.enabled)
      }
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleSave = async () => {
    setSaving(true)
    const res = await apiFetch('/api/admin/chat/settings', {
      method: 'POST',
      body: JSON.stringify({
        maxMessagesPerMinute: maxPerMin,
        maxMessageLength: maxLen,
        minMessageIntervalMs: minInterval,
        enabled,
      }),
    })
    if (res.success) {
      showToast('保存成功', 'success')
      if (res.data) setSettings(res.data)
    } else {
      showToast(res.error || '保存失败', 'error')
    }
    setSaving(false)
  }

  const dirty =
    !settings ||
    (settings.maxMessagesPerMinute !== maxPerMin ||
      settings.maxMessageLength !== maxLen ||
      settings.minMessageIntervalMs !== minInterval ||
      settings.enabled !== enabled)

  return (
    <div className="card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-slate-800 flex items-center gap-2">
          <Settings size={18} className="text-garden-500" />
          聊天频率限制
        </h3>
        <button
          onClick={load}
          disabled={loading}
          className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-500 disabled:opacity-50"
          title="重新加载"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* 开关 */}
      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl mb-4">
        <div>
          <div className="text-sm font-medium text-slate-800">启用频率限制</div>
          <div className="text-xs text-slate-500">关闭后所有用户发言不受限制（不推荐）</div>
        </div>
        <button
          onClick={() => setEnabled(!enabled)}
          className={`relative w-12 h-6 rounded-full transition-colors ${enabled ? 'bg-garden-500' : 'bg-slate-300'}`}
        >
          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-6' : 'translate-x-0.5'}`} />
        </button>
      </div>

      <div className="space-y-4 max-w-md">
        <div>
          <label className="block text-sm font-medium mb-1 text-slate-700">
            每分钟最多发言条数
            <span className="ml-2 text-xs font-normal text-slate-400">（1-60）</span>
          </label>
          <input
            type="number"
            min={1}
            max={60}
            value={maxPerMin}
            onChange={e => setMaxPerMin(Math.max(1, Math.min(60, parseInt(e.target.value) || 5)))}
            className="input"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1 text-slate-700">
            单条消息最大长度
            <span className="ml-2 text-xs font-normal text-slate-400">（10-1000 字）</span>
          </label>
          <input
            type="number"
            min={10}
            max={1000}
            value={maxLen}
            onChange={e => setMaxLen(Math.max(10, Math.min(1000, parseInt(e.target.value) || 200)))}
            className="input"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1 text-slate-700">
            最小发言间隔（毫秒）
            <span className="ml-2 text-xs font-normal text-slate-400">（0-60000，建议 1500-3000）</span>
          </label>
          <input
            type="number"
            min={0}
            max={60000}
            step={500}
            value={minInterval}
            onChange={e => setMinInterval(Math.max(0, Math.min(60000, parseInt(e.target.value) || 2000)))}
            className="input"
          />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving || !dirty}
          className="btn-primary flex items-center gap-1 disabled:opacity-50"
        >
          <Save size={16} />
          {saving ? '保存中...' : '保存设置'}
        </button>
        {settings && (
          <span className="text-xs text-slate-400">
            上次更新: {formatDateTime(settings.updatedAt)}
          </span>
        )}
      </div>

      <div className="mt-4 p-3 bg-amber-50 rounded-xl text-xs text-amber-700 flex items-start gap-2">
        <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
        <div>
          <div className="font-medium mb-1">说明</div>
          频率限制在服务端强制执行，绕过客户端限制。Edge Runtime 重启后内存计数会清空（属正常行为，不影响体验）。
        </div>
      </div>
    </div>
  )
}
