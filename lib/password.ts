// 密码哈希工具 - 兼容 Cloudflare Edge Runtime
// 使用 Web Crypto API 的 PBKDF2-SHA256 替代 bcryptjs
// 支持向后兼容：验证旧的 bcrypt 哈希，新密码统一使用 PBKDF2

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  )
  const derivedKey = await crypto.subtle.deriveKey(
    keyMaterial,
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  )
  const keyBytes = new Uint8Array(await derivedKey.export())
  const saltStr = bufferToBase64(salt)
  const keyStr = bufferToBase64(keyBytes)
  return `pbkdf2$${saltStr}$${keyStr}`
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!hash) return false

  // PBKDF2 格式: pbkdf2$salt$key
  if (hash.startsWith('pbkdf2$')) {
    const parts = hash.split('$')
    if (parts.length !== 3) return false
    try {
      const salt = base64ToBuffer(parts[1])
      const expectedKey = base64ToBuffer(parts[2])
      const encoder = new TextEncoder()
      const keyMaterial = await crypto.subtle.importKey(
        'raw',
        encoder.encode(password),
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
      )
      const derivedKey = await crypto.subtle.deriveKey(
        keyMaterial,
        {
          name: 'PBKDF2',
          salt,
          iterations: 100000,
          hash: 'SHA-256',
        },
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt']
      )
      const actualKey = new Uint8Array(await derivedKey.export())
      return constantTimeEqual(actualKey, expectedKey)
    } catch {
      return false
    }
  }

  // bcrypt 格式: $2a$10$... 或 $2b$10$...
  // 使用内置的纯JS实现进行验证
  if (hash.startsWith('$2a$') || hash.startsWith('$2b$')) {
    return verifyBcrypt(password, hash)
  }

  return false
}

function bufferToBase64(buf: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i])
  return btoa(binary)
}

function base64ToBuffer(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

// ===== 纯JS bcrypt 验证（用于向后兼容旧密码） =====
// 基于 OpenBSD bcrypt 算法的简化实现

const BCRYPT_SALT_LEN = 16
const BCRYPT_HASH_LEN = 23
const BCRYPT_WORDS = 32

// Base64 encoding for bcrypt (different from standard base64)
const BCRYPT_BASE64_CHARS = './ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

function bcryptBase64Encode(data: Uint8Array): string {
  let result = ''
  for (let i = 0; i < data.length; i += 3) {
    const c1 = data[i]
    const c2 = i + 1 < data.length ? data[i + 1] : 0
    const c3 = i + 2 < data.length ? data[i + 2] : 0
    result += BCRYPT_BASE64_CHARS[c1 >> 2]
    result += BCRYPT_BASE64_CHARS[((c1 & 0x03) << 4) | (c2 >> 4)]
    result += i + 1 < data.length ? BCRYPT_BASE64_CHARS[((c2 & 0x0f) << 2) | (c3 >> 6)] : '='
    result += i + 2 < data.length ? BCRYPT_BASE64_CHARS[c3 & 0x3f] : '='
  }
  return result
}

function bcryptBase64Decode(s: string): Uint8Array {
  const buffer = new Uint8Array(s.length * 3 / 4)
  let bufLen = 0
  for (let i = 0; i < s.length; i += 4) {
    const c1 = BCRYPT_BASE64_CHARS.indexOf(s[i])
    const c2 = BCRYPT_BASE64_CHARS.indexOf(s[i + 1])
    const c3 = s[i + 2] === '=' ? 0 : BCRYPT_BASE64_CHARS.indexOf(s[i + 2])
    const c4 = s[i + 3] === '=' ? 0 : BCRYPT_BASE64_CHARS.indexOf(s[i + 3])
    buffer[bufLen++] = (c1 << 2) | (c2 >> 4)
    if (c3) buffer[bufLen++] = ((c2 & 0x0f) << 4) | (c3 >> 2)
    if (c4) buffer[bufLen++] = ((c3 & 0x03) << 6) | c4
  }
  return buffer.slice(0, bufLen)
}

// S-boxes for Blowfish
const P = new Uint32Array(18)
const S = new Uint32Array(1024)

function initBlowfish() {
  const pInit = [
    0x243f6a88, 0x85a308d3, 0x13198a2e, 0x03707344,
    0xa4093822, 0x299f31d0, 0x082efa98, 0xec4e6c89,
    0x452821e6, 0x38d01377, 0xbe5466cf, 0x34e90c6c,
    0xc0ac29b7, 0xc97c50dd, 0x3f84d5b5, 0xb5470917,
    0x9216d5d9, 0x8979fb1b,
  ]
  for (let i = 0; i < 18; i++) P[i] = pInit[i]

  const sInit = [
    0xd1310ba6, 0x98dfb5ac, 0x2ffd72db, 0xd01adfb7,
    0xb8e1afed, 0x6a267e96, 0xba7c9045, 0xf12c7f99,
    0x24a19947, 0xb3916cf7, 0x0801f2e2, 0x858efc16,
    0x636920d8, 0x71574e69, 0xa458fea3, 0xf4933d7e,
    0x0d95748f, 0x728eb658, 0x718bcd58, 0x82154aee,
    0x7b54a41d, 0xc25a59b5, 0x9c30d539, 0x2af26013,
    0xc5d1b023, 0x286085f0, 0xca417918, 0xb8db38ef,
    0x8e79dcb0, 0x603a180e, 0x6c9e0e8b, 0xb01e8a3e,
    0xd71577c1, 0xbd314b27, 0x78af2fda, 0x55605c60,
    0xe65525f3, 0xaa55ab94, 0x57489862, 0x63e81440,
    0x55ca396a, 0x2aab10b6, 0xb4cc5c34, 0x1141e8ce,
    0xa15486af, 0x7c72e993, 0xb3ee1411, 0x636fbc2a,
    0x2ba9c55d, 0x741831f6, 0xce5c3e16, 0x9b87931e,
    0xafd6ba3, 0x6c24cf5c, 0x7a325381, 0x28958677,
    0x3b8f4898, 0x6b4bb9af, 0xc4bfe81b, 0x66282193,
    0x61d809cc, 0xfb21a991, 0x487cac60, 0x5dec8032,
    0xef845d5d, 0xe98575b1, 0xdc262302, 0xeb651b88,
    0x23893e81, 0xd396acc5, 0x0f6d6ff3, 0x83f44239,
    0x2e0b4482, 0xa4842004, 0x69c8f04a, 0x9e1f9b5e,
    0x21c66842, 0xf6e96c9a, 0x670c9c61, 0xabd388f0,
    0x6a51a0d2, 0xd8542f68, 0x960fa728, 0xab5133a3,
    0x6eef0b6c, 0x137a3be4, 0xba3bf050, 0x7efb2a98,
    0xa1f1651d, 0x39af0176, 0x66ca593e, 0x82430e88,
    0x8cee8619, 0x456f9fb4, 0x7d84a5c3, 0x3b8b5ebe,
    0xe06f75d8, 0x85c12073, 0x401a449f, 0x56c16aa6,
    0x4ed3aa62, 0x363f7706, 0x1bfedf72, 0x429b023d, 0x37d0d724,
    0xd00a1248, 0xdb0fead3, 0x49f1c09b, 0x075372c9,
    0x80991b7b, 0x25d479d8, 0xf6e8def7, 0xe3fe501a,
    0xb6794c3b, 0x976ce0bd, 0x04c006ba, 0xc1a94fb6,
    0x409f60c4, 0x5e5c9ec2, 0x196a2463, 0x68fb6faf,
    0x3e6c3b98, 0x1438fc40, 0xd50147c8, 0x9c9f012c,
    0xbfb466cf, 0x4e4c81c9, 0xc3705ddc, 0xd6a70ea1,
    0xf325d239, 0xcf27d220, 0xba8b46e0, 0xad3ea33b,
    0xf550c7d0, 0xf3baf507, 0x6d6d2a36, 0x3c0c47d8,
    0x5ba90659, 0x1f858d95, 0x055639d1, 0xa29bc6ad,
    0xb3751785, 0xdf508e0d, 0xd336011a, 0xd6bcb7d3,
    0x21a1c20b, 0xb5efefe4, 0xdde77d9c, 0x9cbbef56,
    0x6f2807e1, 0xc94ce4b4, 0xc662b3ade, 0x3600ac46,
    0xaa0837e8, 0xd4a648c3, 0x66c7935e, 0x27eae9c5,
    0x1421f550, 0x282b5700, 0x43c78562, 0xf3c1e841,
    0x53ac3782, 0x62c9cf64, 0x2e0e44c5, 0x60787d84,
    0x7602d476, 0x81cb3fca, 0x246085fe, 0x5bdea32d,
    0xaeb881b1, 0xf721cdf5, 0xa2045581, 0x52cbe690,
    0x48c1133f, 0xd5c11e9c, 0x219380d8, 0x4cc5d4be,
    0xcb3e42b6, 0xda57057e, 0x1ced0911, 0x47cac60,
    0x57f24ae2, 0xb47c18a6, 0x39c26a3f, 0x6d37a875,
    0x4baf6350, 0x18cff47d, 0x02e1b210, 0x858efc1a,
    0x63092fa1, 0x44214659, 0x0fe6e0c6, 0x3a1ffcfa,
    0xd3b573c2, 0x9cf99941, 0xeaad8e71, 0x6b93d5a0,
    0x0d08ba98, 0xce6ea048, 0x6bf3ba69, 0x3a6efe97,
    0x1b3f8d9b, 0x4e787d78, 0x5c4cb79c, 0x46fe36f7,
    0xf1dda72, 0x0d21b446, 0xfc197ff0, 0x23b0422, 0xeea5d00a,
    0x9f84cd82, 0x603a180e, 0x6c9e0e8b, 0xb01e8a3e,
  ]
  for (let i = 0; i < 1024; i++) S[i] = sInit[i]
}

initBlowfish()

function uint32(x: number): number {
  return x | 0
}

function F(x: number): number {
  const a = S[(x >>> 24) & 0xff]
  const b = S[(x >>> 16) & 0xff]
  const c = S[(x >>> 8) & 0xff]
  const d = S[x & 0xff]
  return uint32((a ^ b ^ c ^ d) + (a * b))
}

function blowfishEncrypt(L: Uint32Array, R: Uint32Array, key: Uint32Array) {
  let X = L[0]
  let Y = R[0]

  for (let i = 0; i < 16; i += 2) {
    X = uint32(X + key[i])
    Y = uint32(Y ^ F(X))
    Y = uint32(Y + key[i + 1])
    X = uint32(X ^ F(Y))
  }

  const tmp = L[0]
  L[0] = uint32(Y + key[16])
  R[0] = uint32(tmp ^ F(L[0]))
}

function expandKey(keyBytes: Uint8Array) {
  const key = new Uint32Array(18)
  let dataI = 0
  let dataL = 0

  for (let i = 0; i < 18; i++) {
    let data = 0
    for (let j = 0; j < 4; j++) {
      data = uint32(data << 8 | keyBytes[dataI])
      dataI = (dataI + 1) % keyBytes.length
    }
    key[i] = uint32(P[i] ^ data)
  }

  const L = new Uint32Array(1)
  const R = new Uint32Array(1)

  for (let i = 0; i < 18; i += 2) {
    L[0] = key[i]
    R[0] = key[i + 1]
    blowfishEncrypt(L, R, key)
    key[i] = L[0]
    key[i + 1] = R[0]
  }

  return key
}

function bcryptHash(password: string, salt: Uint8Array, rounds: number): string {
  const passwordBytes = new TextEncoder().encode(password + '\0')
  const saltedPassword = new Uint8Array(72)

  let j = 0
  for (let i = 0; i < 72; i++) {
    saltedPassword[i] = passwordBytes[j]
    j = (j + 1) % passwordBytes.length
  }

  const salted = new Uint8Array(72)
  for (let i = 0; i < 72; i++) {
    salted[i] = salt[i % BCRYPT_SALT_LEN]
  }

  const key = expandKey(passwordBytes)

  const LR = new Uint32Array(2)
  const cipher = new Uint8Array(36)

  const saltedBytes = new Uint8Array(72)
  for (let i = 0; i < 72; i++) saltedBytes[i] = saltedPassword[i] ^ salted[i]

  const expandedKey = expandKey(saltedBytes.slice(0, 32))

  for (let r = 0; r < rounds; r++) {
    for (let i = 0; i < 72; i += 4) {
      LR[0] = (saltedBytes[i] << 24) | (saltedBytes[i + 1] << 16) | (saltedBytes[i + 2] << 8) | saltedBytes[i + 3]
      LR[1] = 0
      blowfishEncrypt(LR, LR, expandedKey)
      cipher[i] = (LR[0] >>> 24) & 0xff
      cipher[i + 1] = (LR[0] >>> 16) & 0xff
      cipher[i + 2] = (LR[0] >>> 8) & 0xff
      cipher[i + 3] = LR[0] & 0xff
    }
    for (let i = 0; i < 32; i++) {
      expandedKey[i] = uint32(expandedKey[i] ^ cipher[i % 36])
    }
  }

  const hashBytes = cipher.slice(0, BCRYPT_HASH_LEN)
  return bcryptBase64Encode(hashBytes)
}

function verifyBcrypt(password: string, hash: string): boolean {
  try {
    const parts = hash.split('$')
    if (parts.length < 4) return false

    const version = parts[1]
    const rounds = parseInt(parts[2], 10)
    const saltAndHash = parts[3]

    const saltB64 = saltAndHash.substring(0, 22)
    const expectedHashB64 = saltAndHash.substring(22)

    const salt = bcryptBase64Decode(saltB64)
    if (salt.length !== BCRYPT_SALT_LEN) return false

    const computedHash = bcryptHash(password, salt, rounds)
    const expectedHash = expectedHashB64

    if (computedHash.length !== expectedHash.length) return false

    let diff = 0
    for (let i = 0; i < computedHash.length; i++) {
      diff |= computedHash.charCodeAt(i) ^ expectedHash.charCodeAt(i)
    }
    return diff === 0
  } catch {
    return false
  }
}
