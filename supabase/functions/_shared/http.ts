export function parsePathParts(req: Request, functionName: string): string[] {
  const url = new URL(req.url)
  // Try full path first (external URL), then just the function name (Edge Runtime internal URL)
  const markers = [`/functions/v1/${functionName}`, `/${functionName}`]
  for (const marker of markers) {
    const idx = url.pathname.indexOf(marker)
    if (idx !== -1) {
      const remainder = url.pathname.slice(idx + marker.length)
      return remainder.split("/").filter(Boolean)
    }
  }
  return []
}

export function getOrigin(req: Request): string {
  return (
    req.headers.get("origin") ??
      Deno.env.get("APP_URL") ??
      Deno.env.get("NEXT_PUBLIC_APP_URL") ??
      "http://localhost:3000"
  )
}

export async function safeJson<T = unknown>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T
  } catch {
    return null
  }
}

/** Validate return_url against allowed origins to prevent open redirect */
export function sanitizeReturnUrl(url: string): string {
  const fallback = "https://buildlog.ink"
  try {
    const parsed = new URL(url)
    const allowed = getAllowedReturnOrigins()
    if (allowed.has(parsed.origin)) return parsed.origin
  } catch {
    // invalid URL
  }
  return fallback
}

export function getAllowedReturnOrigins(): Set<string> {
  const origins = new Set(["https://buildlog.ink"])
  const appUrl = Deno.env.get("APP_URL")
  if (appUrl) {
    try {
      origins.add(new URL(appUrl).origin)
    } catch { /* ignore */ }
  }
  const corsOrigin = Deno.env.get("CORS_ORIGIN")
  if (corsOrigin) {
    for (const o of corsOrigin.split(",")) {
      const trimmed = o.trim()
      if (trimmed) {
        try {
          origins.add(new URL(trimmed).origin)
        } catch { /* ignore */ }
      }
    }
  }
  // Allow localhost for development
  origins.add("http://localhost:3000")
  return origins
}
