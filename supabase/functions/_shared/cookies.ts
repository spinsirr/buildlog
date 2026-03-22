export function getCookie(req: Request, name: string): string | null {
  const cookieHeader = req.headers.get('cookie')
  if (!cookieHeader) return null

  const parts = cookieHeader.split(';')
  for (const part of parts) {
    const [rawName, ...rest] = part.trim().split('=')
    if (rawName === name) {
      return decodeURIComponent(rest.join('='))
    }
  }

  return null
}

interface SetCookieOptions {
  httpOnly?: boolean
  secure?: boolean
  sameSite?: 'Strict' | 'Lax' | 'None'
  maxAge?: number
  path?: string
}

export function buildSetCookie(
  name: string,
  value: string,
  options: SetCookieOptions = {}
): string {
  const attrs = [`${name}=${encodeURIComponent(value)}`]

  if (options.maxAge !== undefined) attrs.push(`Max-Age=${options.maxAge}`)
  attrs.push(`Path=${options.path ?? '/'}`)
  if (options.httpOnly ?? true) attrs.push('HttpOnly')
  if (options.secure ?? true) attrs.push('Secure')
  attrs.push(`SameSite=${options.sameSite ?? 'Lax'}`)

  return attrs.join('; ')
}

export function buildClearCookie(name: string, path = '/'): string {
  return `${name}=; Max-Age=0; Path=${path}; HttpOnly; Secure; SameSite=Lax`
}
