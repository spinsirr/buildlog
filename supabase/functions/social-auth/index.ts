import { createServiceClient } from "../_shared/supabase.ts"
import { handleOptions, jsonResponse, errorResponse } from "../_shared/cors.ts"
import { requireUser } from "../_shared/auth.ts"
import { checkLimit } from "../_shared/subscription.ts"
import { encrypt } from "../_shared/crypto.ts"
import { safeJson, getOrigin } from "../_shared/http.ts"
import { randomBytes, base64UrlEncode, toBase64Utf8 } from "../_shared/crypto.ts"
import { buildSetCookie, buildClearCookie, getCookie } from "../_shared/cookies.ts"

Deno.serve(async (req) => {
  const opts = handleOptions(req)
  if (opts) return opts

  const url = new URL(req.url)
  const pathParts = url.pathname.split("/").filter(Boolean)
  // Expected paths: .../social-auth/<platform> or .../social-auth/<platform>/callback
  const fnIdx = pathParts.indexOf("social-auth")
  const platform = pathParts[fnIdx + 1] ?? ""
  const isCallback = pathParts[fnIdx + 2] === "callback"

  if (!["twitter", "linkedin", "bluesky"].includes(platform)) {
    return errorResponse("Invalid platform", 400, req)
  }

  if (platform === "bluesky") {
    return handleBluesky(req)
  }

  if (isCallback) {
    if (platform === "twitter") return handleTwitterCallback(req)
    if (platform === "linkedin") return handleLinkedInCallback(req)
  }

  // Initiate OAuth flow
  if (req.method !== "POST") {
    return errorResponse("Method not allowed", 405, req)
  }

  if (platform === "twitter") return handleTwitterInitiate(req)
  if (platform === "linkedin") return handleLinkedInInitiate(req)

  return errorResponse("Invalid platform", 400, req)
})

// ─── Twitter OAuth ─────────────────────────────────────────────

async function handleTwitterInitiate(req: Request): Promise<Response> {
  const { user, error: authError } = await requireUser(req)
  if (!user) return errorResponse(authError!, 401, req)

  const supabase = createServiceClient()
  const { allowed, limit } = await checkLimit(user.id, "platforms", supabase)
  if (!allowed) {
    return errorResponse(
      `Platform limit reached (${limit}). Upgrade to Pro to connect more platforms.`,
      403,
      req,
    )
  }

  const clientId = Deno.env.get("TWITTER_CLIENT_ID")
  if (!clientId) return errorResponse("Twitter not configured", 503, req)

  const frontendUrl = Deno.env.get("FRONTEND_URL") ?? getOrigin(req)
  const functionUrl = Deno.env.get("SUPABASE_URL")
    ? `${Deno.env.get("SUPABASE_URL")}/functions/v1/social-auth/twitter/callback`
    : `${new URL(req.url).origin}/social-auth/twitter/callback`

  // PKCE
  const codeVerifier = base64UrlEncode(randomBytes(32))
  const codeVerifierBytes = new TextEncoder().encode(codeVerifier)
  const hashBuffer = await crypto.subtle.digest("SHA-256", codeVerifierBytes)
  const codeChallenge = base64UrlEncode(new Uint8Array(hashBuffer))
  const state = base64UrlEncode(randomBytes(16))

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: functionUrl,
    scope: "tweet.read tweet.write users.read offline.access",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  })

  const headers = new Headers()
  headers.append(
    "Set-Cookie",
    buildSetCookie("twitter_code_verifier", codeVerifier, { maxAge: 600 }),
  )
  headers.append(
    "Set-Cookie",
    buildSetCookie("twitter_oauth_state", state, { maxAge: 600 }),
  )
  headers.append(
    "Set-Cookie",
    buildSetCookie("twitter_auth_user", user.id, { maxAge: 600 }),
  )

  const authUrl = `https://twitter.com/i/oauth2/authorize?${params}`

  return jsonResponse({ url: authUrl }, { headers }, req)
}

async function handleTwitterCallback(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  const error = url.searchParams.get("error")

  const frontendUrl = Deno.env.get("FRONTEND_URL") ?? getOrigin(req)

  if (error) {
    return Response.redirect(`${frontendUrl}/settings?error=twitter_denied`, 302)
  }

  const storedState = getCookie(req, "twitter_oauth_state")
  const codeVerifier = getCookie(req, "twitter_code_verifier")
  const userId = getCookie(req, "twitter_auth_user")

  if (!code || !state || !storedState || state !== storedState || !codeVerifier || !userId) {
    return Response.redirect(`${frontendUrl}/settings?error=twitter_invalid_state`, 302)
  }

  const clientId = Deno.env.get("TWITTER_CLIENT_ID")!
  const clientSecret = Deno.env.get("TWITTER_CLIENT_SECRET")!

  const functionUrl = Deno.env.get("SUPABASE_URL")
    ? `${Deno.env.get("SUPABASE_URL")}/functions/v1/social-auth/twitter/callback`
    : `${url.origin}/social-auth/twitter/callback`

  // Exchange code for tokens
  const tokenRes = await fetch("https://api.twitter.com/2/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${toBase64Utf8(`${clientId}:${clientSecret}`)}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: functionUrl,
      code_verifier: codeVerifier,
    }),
  })

  if (!tokenRes.ok) {
    console.error("Twitter token exchange failed:", await tokenRes.text())
    return Response.redirect(`${frontendUrl}/settings?error=twitter_token_failed`, 302)
  }

  const tokens = await tokenRes.json()

  // Fetch user info
  const userRes = await fetch(
    "https://api.twitter.com/2/users/me?user.fields=username,name,profile_image_url",
    { headers: { Authorization: `Bearer ${tokens.access_token}` } },
  )
  const { data: twitterUser } = await userRes.json()

  const supabase = createServiceClient()
  const expiresAt = tokens.expires_in
    ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    : null

  await supabase.from("platform_connections").upsert(
    {
      user_id: userId,
      platform: "twitter",
      access_token: await encrypt(tokens.access_token),
      refresh_token: tokens.refresh_token ? await encrypt(tokens.refresh_token) : null,
      platform_user_id: twitterUser?.id ?? null,
      platform_username: twitterUser?.username ?? null,
      expires_at: expiresAt,
    },
    { onConflict: "user_id,platform" },
  )

  const headers = new Headers({ Location: `${frontendUrl}/settings?connected=twitter` })
  headers.append("Set-Cookie", buildClearCookie("twitter_code_verifier"))
  headers.append("Set-Cookie", buildClearCookie("twitter_oauth_state"))
  headers.append("Set-Cookie", buildClearCookie("twitter_auth_user"))

  return new Response(null, { status: 302, headers })
}

// ─── LinkedIn OAuth ────────────────────────────────────────────

async function handleLinkedInInitiate(req: Request): Promise<Response> {
  const { user, error: authError } = await requireUser(req)
  if (!user) return errorResponse(authError!, 401, req)

  const supabase = createServiceClient()
  const { allowed, limit } = await checkLimit(user.id, "platforms", supabase)
  if (!allowed) {
    return errorResponse(
      `Platform limit reached (${limit}). Upgrade to Pro to connect more platforms.`,
      403,
      req,
    )
  }

  const clientId = Deno.env.get("LINKEDIN_CLIENT_ID")
  if (!clientId) return errorResponse("LinkedIn not configured", 503, req)

  const frontendUrl = Deno.env.get("FRONTEND_URL") ?? getOrigin(req)
  const functionUrl = Deno.env.get("SUPABASE_URL")
    ? `${Deno.env.get("SUPABASE_URL")}/functions/v1/social-auth/linkedin/callback`
    : `${new URL(req.url).origin}/social-auth/linkedin/callback`

  const state = base64UrlEncode(randomBytes(16))

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: functionUrl,
    state,
    scope: "openid profile w_member_social",
  })

  const headers = new Headers()
  headers.append(
    "Set-Cookie",
    buildSetCookie("linkedin_oauth_state", state, { maxAge: 600 }),
  )
  headers.append(
    "Set-Cookie",
    buildSetCookie("linkedin_auth_user", user.id, { maxAge: 600 }),
  )

  const authUrl = `https://www.linkedin.com/oauth/v2/authorization?${params}`

  return jsonResponse({ url: authUrl }, { headers }, req)
}

async function handleLinkedInCallback(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  const error = url.searchParams.get("error")

  const frontendUrl = Deno.env.get("FRONTEND_URL") ?? getOrigin(req)

  if (error) {
    return Response.redirect(`${frontendUrl}/settings?error=linkedin_denied`, 302)
  }

  const storedState = getCookie(req, "linkedin_oauth_state")
  const userId = getCookie(req, "linkedin_auth_user")

  if (!code || !state || !storedState || state !== storedState || !userId) {
    return Response.redirect(`${frontendUrl}/settings?error=linkedin_invalid_state`, 302)
  }

  const clientId = Deno.env.get("LINKEDIN_CLIENT_ID")!
  const clientSecret = Deno.env.get("LINKEDIN_CLIENT_SECRET")!

  const functionUrl = Deno.env.get("SUPABASE_URL")
    ? `${Deno.env.get("SUPABASE_URL")}/functions/v1/social-auth/linkedin/callback`
    : `${url.origin}/social-auth/linkedin/callback`

  const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: functionUrl,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  })

  if (!tokenRes.ok) {
    console.error("LinkedIn token exchange failed:", await tokenRes.text())
    return Response.redirect(`${frontendUrl}/settings?error=linkedin_token_failed`, 302)
  }

  const tokens = await tokenRes.json()

  // Fetch user info
  const userRes = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  })
  const linkedinUser = userRes.ok ? await userRes.json() : null

  const supabase = createServiceClient()
  const expiresAt = tokens.expires_in
    ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
    : null

  await supabase.from("platform_connections").upsert(
    {
      user_id: userId,
      platform: "linkedin",
      access_token: await encrypt(tokens.access_token),
      refresh_token: tokens.refresh_token ? await encrypt(tokens.refresh_token) : null,
      platform_user_id: linkedinUser?.sub ?? null,
      platform_username: linkedinUser?.name ?? null,
      expires_at: expiresAt,
    },
    { onConflict: "user_id,platform" },
  )

  const headers = new Headers({ Location: `${frontendUrl}/settings?connected=linkedin` })
  headers.append("Set-Cookie", buildClearCookie("linkedin_oauth_state"))
  headers.append("Set-Cookie", buildClearCookie("linkedin_auth_user"))

  return new Response(null, { status: 302, headers })
}

// ─── Bluesky (app password, not OAuth) ─────────────────────────

async function handleBluesky(req: Request): Promise<Response> {
  if (req.method !== "POST") return errorResponse("Method not allowed", 405, req)

  const { user, error: authError } = await requireUser(req)
  if (!user) return errorResponse(authError!, 401, req)

  const supabase = createServiceClient()
  const { allowed, limit } = await checkLimit(user.id, "platforms", supabase)
  if (!allowed) {
    return errorResponse(
      `Platform limit reached (${limit}). Upgrade to Pro to connect more platforms.`,
      403,
      req,
    )
  }

  const body = await safeJson<{ handle?: string; appPassword?: string }>(req)
  if (!body?.handle || !body.appPassword) {
    return errorResponse("Handle and app password are required", 400, req)
  }

  // Validate credentials
  const sessionRes = await fetch("https://bsky.social/xrpc/com.atproto.server.createSession", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: body.handle, password: body.appPassword }),
  })

  if (!sessionRes.ok) {
    const err = await sessionRes.text()
    return errorResponse(`Invalid Bluesky credentials: ${err}`, 400, req)
  }

  const session = (await sessionRes.json()) as { did: string }

  const { error } = await supabase.from("platform_connections").upsert(
    {
      user_id: user.id,
      platform: "bluesky",
      access_token: await encrypt(body.appPassword),
      platform_user_id: session.did,
      platform_username: body.handle,
    },
    { onConflict: "user_id,platform" },
  )

  if (error) return errorResponse(error.message, 500, req)

  return jsonResponse({ ok: true, username: body.handle }, {}, req)
}
