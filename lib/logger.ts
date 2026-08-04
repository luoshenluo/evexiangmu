// 游戏日志系统 - 记录关键操作节点，方便排查 Bug
// 在 Cloudflare Edge 环境下使用 console.log（Workers 日志会自动收集）

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'
export type LogCategory = 'garden' | 'auth' | 'market' | 'chat' | 'season' | 'pest' | 'steal' | 'system'

interface LogEntry {
  level: LogLevel
  category: LogCategory
  message: string
  userId?: string
  data?: Record<string, any>
  timestamp: number
}

const LEVEL_PREFIX: Record<LogLevel, string> = {
  debug: '🔍',
  info: 'ℹ️',
  warn: '⚠️',
  error: '❌',
}

const CATEGORY_TAG: Record<LogCategory, string> = {
  garden: '[GARDEN]',
  auth: '[AUTH]',
  market: '[MARKET]',
  chat: '[CHAT]',
  season: '[SEASON]',
  pest: '[PEST]',
  steal: '[STEAL]',
  system: '[SYSTEM]',
}

function formatLog(entry: LogEntry): string {
  const ts = new Date(entry.timestamp).toISOString()
  const userTag = entry.userId ? ` user=${entry.userId}` : ''
  const dataStr = entry.data ? ` ${JSON.stringify(entry.data)}` : ''
  return `${LEVEL_PREFIX[entry.level]} ${ts} ${CATEGORY_TAG[entry.category]}${userTag} ${entry.message}${dataStr}`
}

export function log(
  level: LogLevel,
  category: LogCategory,
  message: string,
  data?: Record<string, any>,
  userId?: string
) {
  const entry: LogEntry = {
    level,
    category,
    message,
    data,
    userId,
    timestamp: Date.now(),
  }

  const formatted = formatLog(entry)

  switch (level) {
    case 'error':
      console.error(formatted)
      break
    case 'warn':
      console.warn(formatted)
      break
    case 'debug':
      // debug 仅在开发环境输出
      if (process.env.NODE_ENV !== 'production') {
        console.log(formatted)
      }
      break
    default:
      console.log(formatted)
  }
}

// 便捷方法
export const logger = {
  debug: (cat: LogCategory, msg: string, data?: Record<string, any>, userId?: string) =>
    log('debug', cat, msg, data, userId),
  info: (cat: LogCategory, msg: string, data?: Record<string, any>, userId?: string) =>
    log('info', cat, msg, data, userId),
  warn: (cat: LogCategory, msg: string, data?: Record<string, any>, userId?: string) =>
    log('warn', cat, msg, data, userId),
  error: (cat: LogCategory, msg: string, data?: Record<string, any>, userId?: string) =>
    log('error', cat, msg, data, userId),
}
