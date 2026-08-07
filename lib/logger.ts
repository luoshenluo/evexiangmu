export type LogLevel = 'debug' | 'info' | 'warn' | 'error'
export type LogCategory = 'garden' | 'auth' | 'market' | 'chat' | 'season' | 'pest' | 'steal' | 'system' | 'tasks'

interface LogEntry { level: LogLevel; category: LogCategory; message: string; userId?: string; data?: Record<string,any>; timestamp: number }

const LEVEL_PREFIX: Record<LogLevel,string> = { debug:'🔍', info:'ℹ️', warn:'⚠️', error:'❌' }
const CATEGORY_TAG: Record<LogCategory,string> = { garden:'[GARDEN]', auth:'[AUTH]', market:'[MARKET]', chat:'[CHAT]', season:'[SEASON]', pest:'[PEST]', steal:'[STEAL]', system:'[SYSTEM]', tasks:'[TASKS]' }

function formatLog(e: LogEntry): string {
  const ts = new Date(e.timestamp).toISOString()
  return `${LEVEL_PREFIX[e.level]} ${ts} ${CATEGORY_TAG[e.category]}${e.userId?` user=${e.userId}`:''} ${e.message}${e.data?` ${JSON.stringify(e.data)}`:''}`
}

export function log(level: LogLevel, category: LogCategory, message: string, data?: Record<string,any>, userId?: string) {
  const entry: LogEntry = { level, category, message, data, userId, timestamp: Date.now() }
  const f = formatLog(entry)
  switch(level) {
    case 'error': console.error(f); break
    case 'warn':  console.warn(f);  break
    case 'debug': if (process.env.NODE_ENV !== 'production') console.log(f); break
    default:      console.log(f);
  }
}

export const logger = {
  debug: (c: LogCategory, m: string, d?: Record<string,any>, u?: string) => log('debug', c, m, d, u),
  info:  (c: LogCategory, m: string, d?: Record<string,any>, u?: string) => log('info',  c, m, d, u),
  warn:  (c: LogCategory, m: string, d?: Record<string,any>, u?: string) => log('warn',  c, m, d, u),
  error: (c: LogCategory, m: string, d?: Record<string,any>, u?: string) => log('error', c, m, d, u),
}
