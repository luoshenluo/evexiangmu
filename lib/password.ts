// 密码与昵称校验规则（前后端共享，改动需前后端保持一致）

export interface ValidationResult {
  ok: boolean
  message?: string
}

// 密码规则：8-16 位，仅允许 ASCII 可见字符（不含中文/空格），
// 数字、大写字母、小写字母、特殊符号四类中至少包含两类。

// 统计密码命中的字符类别数（0-4）
export function countPasswordCategories(pwd: string): number {
  let n = 0
  if (/[a-z]/.test(pwd)) n++
  if (/[A-Z]/.test(pwd)) n++
  if (/[0-9]/.test(pwd)) n++
  if (/[^a-zA-Z0-9]/.test(pwd)) n++
  return n
}

export function validatePassword(pwd: string): ValidationResult {
  if (!/^[\x21-\x7e]{8,16}$/.test(pwd)) {
    return { ok: false, message: '密码需为8-16位字母/数字/符号（不含中文）' }
  }
  if (countPasswordCategories(pwd) < 2) {
    return { ok: false, message: '密码需包含数字、大写字母、小写字母、符号中至少两类' }
  }
  return { ok: true }
}

// 昵称规则：总字符数不超过 12，且汉字个数不超过 8
export function countHanzi(s: string): number {
  const m = s.match(/[\u4e00-\u9fa5]/g)
  return m ? m.length : 0
}

export function validateNickname(nick: string): ValidationResult {
  if (nick.length < 1) return { ok: false, message: '请输入昵称' }
  if (nick.length > 12) return { ok: false, message: '昵称最多12个字符' }
  if (countHanzi(nick) > 8) return { ok: false, message: '昵称最多8个汉字' }
  return { ok: true }
}
