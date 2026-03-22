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
