const AES_ALGORITHM = "AES-GCM"
const IV_LENGTH = 12
const TAG_LENGTH = 16
const HMAC_ALGORITHM = "HMAC"

function requiredEnv(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Missing required environment variable: ${name}`)
  return value
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()

export function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return bytes
}

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

export function fromHex(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error("Invalid hex length")
  }

  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < out.length; i++) {
    out[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

export function utf8ToBytes(value: string): Uint8Array {
  return encoder.encode(value)
}

export function bytesToUtf8(value: Uint8Array): string {
  return decoder.decode(value)
}

export function bytesToBase64(value: Uint8Array): string {
  let binary = ""
  for (let i = 0; i < value.length; i++) binary += String.fromCharCode(value[i])
  return btoa(binary)
}

export function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value)
  const out = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i)
  return out
}

export function base64UrlEncode(value: Uint8Array): string {
  return bytesToBase64(value)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "")
}

export function toBase64Utf8(value: string): string {
  return bytesToBase64(utf8ToBytes(value))
}

function getAesKey(): Promise<CryptoKey> {
  const keyHex = requiredEnv("TOKEN_ENCRYPTION_KEY")
  if (keyHex.length !== 64) {
    throw new Error("TOKEN_ENCRYPTION_KEY must be a 64-char hex string (32 bytes)")
  }

  return crypto.subtle.importKey("raw", fromHex(keyHex), AES_ALGORITHM, false, [
    "encrypt",
    "decrypt",
  ])
}

/** Encrypt plaintext -> "iv:ciphertext:tag" (hex, Next.js compatible) */
export async function encrypt(plaintext: string): Promise<string> {
  const key = await getAesKey()
  const iv = randomBytes(IV_LENGTH)

  const encryptedWithTag = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: AES_ALGORITHM, iv, tagLength: TAG_LENGTH * 8 },
      key,
      utf8ToBytes(plaintext),
    ),
  )

  const ciphertext = encryptedWithTag.slice(0, encryptedWithTag.length - TAG_LENGTH)
  const tag = encryptedWithTag.slice(encryptedWithTag.length - TAG_LENGTH)

  return `${toHex(iv)}:${toHex(ciphertext)}:${toHex(tag)}`
}

/** Decrypt "iv:ciphertext:tag" (hex, Next.js compatible) */
export async function decrypt(blob: string): Promise<string> {
  const parts = blob.split(":")
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted token format")
  }

  const [ivHex, encHex, tagHex] = parts
  const iv = fromHex(ivHex)
  const ciphertext = fromHex(encHex)
  const tag = fromHex(tagHex)

  const combined = new Uint8Array(ciphertext.length + tag.length)
  combined.set(ciphertext, 0)
  combined.set(tag, ciphertext.length)

  const key = await getAesKey()
  const decrypted = await crypto.subtle.decrypt(
    { name: AES_ALGORITHM, iv, tagLength: TAG_LENGTH * 8 },
    key,
    combined,
  )

  return bytesToUtf8(new Uint8Array(decrypted))
}

export async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    utf8ToBytes(secret),
    { name: HMAC_ALGORITHM, hash: "SHA-256" },
    false,
    ["sign"],
  )

  const signature = await crypto.subtle.sign(HMAC_ALGORITHM, key, utf8ToBytes(payload))
  return toHex(new Uint8Array(signature))
}

export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false

  let out = 0
  for (let i = 0; i < a.length; i++) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }

  return out === 0
}
