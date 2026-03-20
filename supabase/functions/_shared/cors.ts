const DEFAULT_ALLOWED_HEADERS = [
  "authorization",
  "x-client-info",
  "apikey",
  "content-type",
  "stripe-signature",
  "x-hub-signature-256",
  "x-github-event",
  "x-github-delivery",
  "content-length",
].join(", ")

export function getCorsHeaders(req?: Request): HeadersInit {
  const requestOrigin = req?.headers.get("origin")
  const configuredOrigin = Deno.env.get("CORS_ORIGIN")

  return {
    "Access-Control-Allow-Origin": configuredOrigin ?? requestOrigin ?? "*",
    "Access-Control-Allow-Headers": DEFAULT_ALLOWED_HEADERS,
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "Access-Control-Max-Age": "86400",
  }
}

export function withCors(res: Response, req?: Request): Response {
  const headers = new Headers(res.headers)
  const cors = getCorsHeaders(req)
  Object.entries(cors).forEach(([key, value]) => {
    headers.set(key, value)
  })

  return new Response(res.body, {
    status: res.status,
    statusText: res.statusText,
    headers,
  })
}

export function jsonResponse(
  body: unknown,
  init: ResponseInit = {},
  req?: Request,
): Response {
  const headers = new Headers(init.headers)
  headers.set("content-type", "application/json")

  return withCors(
    new Response(JSON.stringify(body), {
      ...init,
      headers,
    }),
    req,
  )
}

export function errorResponse(
  message: string,
  status = 400,
  req?: Request,
  details?: unknown,
): Response {
  return jsonResponse(
    {
      error: message,
      ...(details === undefined ? {} : { details }),
    },
    { status },
    req,
  )
}

export function handleOptions(req: Request): Response | null {
  if (req.method !== "OPTIONS") return null
  return withCors(new Response("ok", { status: 200 }), req)
}
