// 内存版简单速率限制（兼容 Edge Runtime）
// 注意：Cloudflare 多 isolate 下各 isolate 独立计数，非精确限流，
// 主要用于拦截脚本化攻击（登录暴破/批量注册），不依赖任何外部存储。

const buckets = new Map<string, { count: number; resetAt: number }>()

export interface RateLimitResult {
  allowed: boolean
  retryAfterMs: number
}

export function checkRateLimit(key: string, max: number, windowMs: number, now = Date.now()): RateLimitResult {
  // 桶数量过大时清理过期桶，防止内存无限增长
  if (buckets.size > 10000) {
    for (const [k, b] of buckets) {
      if (b.resetAt <= now) buckets.delete(k)
    }
  }
  const b = buckets.get(key)
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, retryAfterMs: 0 }
  }
  if (b.count >= max) {
    return { allowed: false, retryAfterMs: b.resetAt - now }
  }
  b.count += 1
  return { allowed: true, retryAfterMs: 0 }
}

export function resetRateLimit(key: string): void {
  buckets.delete(key)
}

// 获取客户端 IP（Cloudflare 场景优先 x-forwarded-for）
export function getClientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim() || 'unknown'
  return req.headers.get('cf-connecting-ip') || 'unknown'
}