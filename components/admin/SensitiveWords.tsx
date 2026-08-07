'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAppStore } from '@/lib/store'
import { apiFetch, formatDateTime } from '@/lib/utils'
import { Shield, Plus, Trash2, RefreshCw, Search, AlertCircle } from 'lucide-react'

interface SensitiveWord {
  id: string
  word: string
  createdAt: number
  createdBy: string | null
}

export default function SensitiveWords() {
  const { showToast } = useAppStore()
  const [words, setWords] = useState<SensitiveWord[]>([])
  const [loading, setLoading] = useState(false)
  const [input, setInput] = useState('')
  const [search, setSearch] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [delLoading, setDelLoading] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiFetch('/api/admin/sensitive-words')
      if (res.success) setWords(res.data || [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleAdd = async () => {
    const raw = input.trim()
    if (!raw) return showToast('请输入敏感词', 'error')
    // 支持换行/逗号/空格分隔批量添加
    const parts = raw.split(/[\n,，\s]+/).map(s => s.trim()).filter(Boolean)
    if (parts.length === 0) return showToast('请输入敏感词', 'error')

    setSubmitting(true)
    const res = await apiFetch('/api/admin/sensitive-words', {
      method: 'POST',
      body: JSON.stringify({ words: parts }),
    })
    if (res.success && res.data) {
      const { added, duplicated } = res.data
      if (added.length > 0) {
        showToast(`已添加 ${added.length} 个敏感词${duplicated.length > 0 ? `，${duplicated.length} 个已存在` : ''}`, 'success')
      } else if (duplicated.length > 0) {
        showToast(`全部 ${duplicated.length} 个词已存在`, 'info')
      }
      setInput('')
      load()
    } else {
      showToast(res.error || '添加失败', 'error')
    }
    setSubmitting(false)
  }

  const handleDelete = async (id: string, word: string) => {
    if (!confirm(`确定删除敏感词「${word}」？`)) return
    setDelLoading(id)
    const res = await apiFetch(`/api/admin/sensitive-words/${id}`, { method: 'DELETE' })
    if (res.success) {
      showToast('已删除', 'success')
      setWords(prev => prev.filter(w => w.id !== id))
    } else {
      showToast(res.error || '删除失败', 'error')
    }
    setDelLoading(null)
  }

  const filtered = words.filter(w => !search || w.word.toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="space-y-4">
      {/* 添加表单 */}
      <div className="card p-4">
        <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
          <Shield size={16} className="text-purple-500" />
          添加敏感词
        </h3>
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="输入敏感词，支持换行、逗号、空格批量添加..."
            className="input min-h-[80px] resize-none flex-1"
            maxLength={500}
          />
          <button
            onClick={handleAdd}
            disabled={submitting || !input.trim()}
            className="btn-primary px-4 flex items-center gap-1 self-start disabled:opacity-50"
          >
            <Plus size={16} />
            {submitting ? '添加中' : '添加'}
          </button>
        </div>
        <div className="text-xs text-slate-400 mt-2 flex items-center gap-1">
          <AlertCircle size={11} />
          敏感词会在用户发言时自动替换为 ***，立即生效（30 秒内缓存刷新）
        </div>
      </div>

      {/* 列表 */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-3 gap-2">
          <h3 className="font-bold text-slate-800 flex items-center gap-2">
            <Shield size={16} className="text-garden-500" />
            敏感词库
            <span className="chip bg-slate-100 text-slate-500 text-[10px]">{words.length} 个</span>
          </h3>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 px-2 py-1 bg-slate-50 rounded-lg">
              <Search size={12} className="text-slate-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="搜索..."
                className="text-xs bg-transparent outline-none w-24"
              />
            </div>
            <button
              onClick={load}
              disabled={loading}
              className="p-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-500 disabled:opacity-50"
              title="刷新"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-sm">
            <Shield size={32} className="mx-auto mb-2 text-slate-300" />
            {search ? '未找到匹配的敏感词' : '暂无敏感词，请添加'}
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {filtered.map(w => (
              <div
                key={w.id}
                className="group flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-50 border border-red-100 hover:bg-red-100 transition-colors"
              >
                <span className="text-sm text-red-700 font-medium">{w.word}</span>
                <button
                  onClick={() => handleDelete(w.id, w.word)}
                  disabled={delLoading === w.id}
                  className="text-red-300 hover:text-red-600 transition-colors disabled:opacity-50"
                  title="删除"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        {filtered.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-400">
            最近添加: {formatDateTime(filtered[0].createdAt)}
          </div>
        )}
      </div>
    </div>
  )
}
