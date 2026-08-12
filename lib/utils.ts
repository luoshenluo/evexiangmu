// API helper
'use client'

export async function apiFetch<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<{ success: boolean; data?: T; error?: string }> {
  const token = localStorage.getItem('garden-app-storage')
  let parsedToken = ''
  if (token) {
    try {
      parsedToken = JSON.parse(token)?.state?.token || ''
    } catch {}
  }

  const res = await fetch(path, {
    headers: {
      'Content-Type': 'application/json',
      ...(parsedToken ? { Authorization: `Bearer ${parsedToken}` } : {}),
      ...(options.headers || {}),
    },
    method: options.method || 'GET',
    ...(options.body ? { body: options.body } : {}),
  })

  try {
    const data = await res.json()
    return data
  } catch {
    return { success: false, error: '服务器返回无效数据' }
  }
}

export function classNames(...classes: (string | false | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ')
}

export function formatDateTime(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** 仅显示 年-月-日 */
export function formatDateOnly(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 智能日期格式：今天→只显示时间；昨天及以前→显示完整 YYYY-MM-DD HH:mm */
export function formatChatTime(ts: number, now: number = Date.now()): string {
  const d = new Date(ts)
  const today = new Date(now)
  const isSameDay = d.getFullYear() === today.getFullYear()
    && d.getMonth() === today.getMonth()
    && d.getDate() === today.getDate()
  const pad = (n: number) => n.toString().padStart(2, '0')
  const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`
  if (isSameDay) return hm
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${hm}`
}

export function formatNumber(n: number): string {
  if (n >= 10000) return (n / 10000).toFixed(1) + '万'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return n.toString()
}
