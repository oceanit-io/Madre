// HMAC-SHA256 em JS puro (sync, sem dependências) — necessário porque o
// middleware do Next roda no EDGE runtime, que não expõe `node:crypto`
// síncrono. Usado SÓ pra assinar/verificar o cookie de sessão admin.
//
// Correção: testado contra node:crypto (ver scripts/test-hmac) — bate em
// vetores RFC 4231 e em strings arbitrárias. Não é hot-path (1x por request).

/* eslint-disable no-bitwise */

const K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]

function rotr(n: number, x: number): number { return (x >>> n) | (x << (32 - n)) }

// SHA-256 de um array de bytes -> array de 32 bytes.
function sha256Bytes(bytes: number[]): number[] {
  const h = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]
  const l = bytes.length
  const withOne = bytes.slice()
  withOne.push(0x80)
  while (withOne.length % 64 !== 56) withOne.push(0)
  // comprimento em bits, big-endian 64 bits (suportamos até 2^32 bits, suficiente)
  const bitLenHi = Math.floor((l * 8) / 0x100000000)
  const bitLenLo = (l * 8) >>> 0
  withOne.push((bitLenHi >>> 24) & 0xff, (bitLenHi >>> 16) & 0xff, (bitLenHi >>> 8) & 0xff, bitLenHi & 0xff)
  withOne.push((bitLenLo >>> 24) & 0xff, (bitLenLo >>> 16) & 0xff, (bitLenLo >>> 8) & 0xff, bitLenLo & 0xff)

  const w = new Array(64)
  for (let i = 0; i < withOne.length; i += 64) {
    for (let t = 0; t < 16; t++) {
      w[t] = (withOne[i + t * 4] << 24) | (withOne[i + t * 4 + 1] << 16) | (withOne[i + t * 4 + 2] << 8) | (withOne[i + t * 4 + 3])
    }
    for (let t = 16; t < 64; t++) {
      const s0 = rotr(7, w[t - 15]) ^ rotr(18, w[t - 15]) ^ (w[t - 15] >>> 3)
      const s1 = rotr(17, w[t - 2]) ^ rotr(19, w[t - 2]) ^ (w[t - 2] >>> 10)
      w[t] = (w[t - 16] + s0 + w[t - 7] + s1) | 0
    }
    let [a, b, c, d, e, f, g, hh] = h
    for (let t = 0; t < 64; t++) {
      const S1 = rotr(6, e) ^ rotr(11, e) ^ rotr(25, e)
      const ch = (e & f) ^ (~e & g)
      const temp1 = (hh + S1 + ch + K[t] + w[t]) | 0
      const S0 = rotr(2, a) ^ rotr(13, a) ^ rotr(22, a)
      const maj = (a & b) ^ (a & c) ^ (b & c)
      const temp2 = (S0 + maj) | 0
      hh = g; g = f; f = e; e = (d + temp1) | 0; d = c; c = b; b = a; a = (temp1 + temp2) | 0
    }
    h[0] = (h[0] + a) | 0; h[1] = (h[1] + b) | 0; h[2] = (h[2] + c) | 0; h[3] = (h[3] + d) | 0
    h[4] = (h[4] + e) | 0; h[5] = (h[5] + f) | 0; h[6] = (h[6] + g) | 0; h[7] = (h[7] + hh) | 0
  }
  const out: number[] = []
  for (let i = 0; i < 8; i++) out.push((h[i] >>> 24) & 0xff, (h[i] >>> 16) & 0xff, (h[i] >>> 8) & 0xff, h[i] & 0xff)
  return out
}

function utf8Bytes(str: string): number[] {
  const out: number[] = []
  for (let i = 0; i < str.length; i++) {
    let c = str.charCodeAt(i)
    if (c < 0x80) out.push(c)
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f))
    else if (c >= 0xd800 && c <= 0xdbff) {
      const c2 = str.charCodeAt(++i)
      c = 0x10000 + ((c & 0x3ff) << 10) + (c2 & 0x3ff)
      out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 0x3f), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f))
    } else out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f))
  }
  return out
}

function toHex(bytes: number[]): string {
  return bytes.map(b => b.toString(16).padStart(2, '0')).join('')
}

/** HMAC-SHA256(key, msg) em hex. */
export function hmacSha256Hex(key: string, msg: string): string {
  let keyBytes = utf8Bytes(key)
  if (keyBytes.length > 64) keyBytes = sha256Bytes(keyBytes)
  while (keyBytes.length < 64) keyBytes.push(0)
  const oKey = keyBytes.map(b => b ^ 0x5c)
  const iKey = keyBytes.map(b => b ^ 0x36)
  const inner = sha256Bytes(iKey.concat(utf8Bytes(msg)))
  return toHex(sha256Bytes(oKey.concat(inner)))
}

/** Compara duas strings hex em tempo ~constante (evita timing attack). */
export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}
