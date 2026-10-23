import { scrypt, randomBytes, createHash, timingSafeEqual } from 'node:crypto'
const options = { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }
function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password, salt, 64, options, (e, key) =>
      e ? reject(e) : resolve(key),
    ),
  )
}
export async function hashPassword(password: string) {
  const salt = randomBytes(16)
  return (
    'scrypt$v1$' +
    salt.toString('hex') +
    '$' +
    (await derive(password, salt)).toString('hex')
  )
}
export async function verifyPassword(password: string, encoded: string) {
  const [type, version, salt, hash] = encoded.split('$')
  if (
    type !== 'scrypt' ||
    version !== 'v1' ||
    !/^[0-9a-f]{32}$/.test(salt ?? '') ||
    !/^[0-9a-f]{128}$/.test(hash ?? '')
  )
    return false
  const actual = await derive(password, Buffer.from(salt, 'hex'))
  return timingSafeEqual(actual, Buffer.from(hash, 'hex'))
}
export function hashToken(raw: string) {
  return createHash('sha256').update(raw).digest('hex')
}
export function equalTokens(a: string, b: string) {
  const aa = Buffer.from(a),
    bb = Buffer.from(b)
  return aa.length === bb.length && timingSafeEqual(aa, bb)
}
