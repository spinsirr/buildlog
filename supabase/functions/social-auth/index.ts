import { getUserFromJwt, requireUser } from "../_shared/auth.ts"
import { buildClearCookie, buildSetCookie, getCookie } from "../_shared/cookies.ts"
import { errorResponse, getCorsHeaders, handleOptions, jsonResponse } from "../_shared/cors.ts"
import { base64UrlEncode, encrypt, randomBytes, toBase64Utf8 } from "../_shared/crypto.ts"
import { parsePathParts, safeJson } from "../_shared/http.ts"
import { checkRateLimit } from "../_shared/rate-limit.ts"
import { checkLimit } from "../_shared/subscription.ts"
import { createServiceClient } from "../_shared/supabase.ts"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getFrontendUrl(): string {
  return Deno.env.get("FRONTEND_URL") ?? Deno.env.get("APP_URL") ?? "http://localhost:3000"
}

function getEdgeFunctionBaseUrl(): string {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  if (!supabaseUrl) throw new Error("Missing SUPABASE_URL")
  return `${supabaseUrl}/functions/v1/social-auth`
}

/** Build a redirect Response with optional Set-Cookie headers. */
function redirectResponse(url: string, cookies: string[] = []): Response {
  const headers = new Headers({ Location: url })
  for (const cookie of cookies) {
    headers.append("Set-Cookie", cookie)
  }
  return new Response(null, { status: 302, headers })
}

/** Cookie options shared by all OAuth state cookies. */
const OAUTH_COOKIE_OPTS = {
  httpOnly: true,
  secure: true,
  sameSite: "Lax" as const,
  maxAge: 600, // 10 minutes
  path: "/",
}

// ---------------------------------------------------------------------------
// Twitter OAuth (PKCE)
// ---------------------------------------------------------------------------

async function twitterInitiate(req: Request): Promise<Response> {
  // 1. Require authenticated user
  const { user, error } = await requireUser(req)
  if (!user) return errorResponse(error ?? "Unauthorized", 401, req)

  // 2. Check platform limit
  const limit = await checkLimit(user.id, "platforms")
  if (!limit.allowed) {
    return errorResponse(
      `Platform limit reached (${limit.count}/${limit.limit}). Upgrade to Pro for unlimited platforms.`,
      403,
      req,
    )
  }

  // 3. Generate PKCE code_verifier and code_challenge
  const verifierBytes = randomBytes(32)
  const codeVerifier = base64UrlEncode(verifierBytes)
  const challengeBytes = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(codeVerifier)),
  )
  const codeChallenge = base64UrlEncode(challengeBytes)

  // 4. Generate random state
  const state = base64UrlEncode(randomBytes(32))

  // 5. Extract the user's access token to store in a cookie for the callback
  const authHeader = req.headers.get("authorization") ?? ""
  const accessToken = authHeader.replace(/^bearer\s+/i, "")

  // 6. Build cookies
  const cookies = [
    buildSetCookie("twitter_code_verifier", codeVerifier, OAUTH_COOKIE_OPTS),
    buildSetCookie("twitter_oauth_state", state, OAUTH_COOKIE_OPTS),
    buildSetCookie("oauth_return_token", accessToken, OAUTH_COOKIE_OPTS),
  ]

  // 7. Build Twitter OAuth URL
  const clientId = Deno.env.get("TWITTER_CLIENT_ID")
  if (!clientId) return errorResponse("Twitter OAuth not configured", 500, req)

  const redirectUri = `${getEdgeFunctionBaseUrl()}/twitter/callback`

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "tweet.read tweet.write users.read offline.access",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  })

  const url = `https://twitter.com/i/oauth2/authorize?${params.toString()}`

  // 8. Return the URL with cookies set
  const body = JSON.stringify({ url })
  const headers = new Headers({
    "Content-Type": "application/json",
    ...getCorsHeaders(req),
  })
  for (const cookie of cookies) {
    headers.append("Set-Cookie", cookie)
  }

  return new Response(body, { status: 200, headers })
}

async function twitterCallback(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const frontendUrl = getFrontendUrl()

  // 1. Handle error from Twitter (user denied access)
  const errorParam = url.searchParams.get("error")
  if (errorParam) {
    return redirectResponse(`${frontendUrl}/settings?error=twitter_denied`)
  }

  // 2. Get code and state from query params
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")

  if (!code || !state) {
    return redirectResponse(`${frontendUrl}/settings?error=twitter_missing_params`)
  }

  // 3. Validate state against cookie
  const storedState = getCookie(req, "twitter_oauth_state")
  if (!storedState || storedState !== state) {
    return redirectResponse(`${frontendUrl}/settings?error=twitter_invalid_state`)
  }

  // 4. Get code_verifier from cookie
  const codeVerifier = getCookie(req, "twitter_code_verifier")
  if (!codeVerifier) {
    return redirectResponse(`${frontendUrl}/settings?error=twitter_missing_verifier`)
  }

  // 5. Get user from stored JWT cookie
  const returnToken = getCookie(req, "oauth_return_token")
  if (!returnToken) {
    return redirectResponse(`${frontendUrl}/settings?error=twitter_auth_expired`)
  }

  const user = await getUserFromJwt(returnToken)
  if (!user) {
    return redirectResponse(`${frontendUrl}/settings?error=twitter_auth_invalid`)
  }

  // 6. Clear all OAuth cookies
  const clearCookies = [
    buildClearCookie("twitter_code_verifier"),
    buildClearCookie("twitter_oauth_state"),
    buildClearCookie("oauth_return_token"),
  ]

  // 7. Exchange code for tokens
  const clientId = Deno.env.get("TWITTER_CLIENT_ID")
  const clientSecret = Deno.env.get("TWITTER_CLIENT_SECRET")

  if (!clientId || !clientSecret) {
    return redirectResponse(`${frontendUrl}/settings?error=twitter_config`, clearCookies)
  }

  const redirectUri = `${getEdgeFunctionBaseUrl()}/twitter/callback`

  const tokenRes = await fetch("https://api.twitter.com/2/oauth2/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${toBase64Utf8(`${clientId}:${clientSecret}`)}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    }),
  })

  if (!tokenRes.ok) {
    console.error("[social-auth] Twitter token exchange failed:", tokenRes.status)
    return redirectResponse(`${frontendUrl}/settings?error=twitter_token_exchange`, clearCookies)
  }

  const tokenData = (await tokenRes.json()) as {
    access_token: string
    refresh_token?: string
    expires_in?: number
    token_type: string
  }

  // 8. Fetch user info
  const userRes = await fetch(
    "https://api.twitter.com/2/users/me?user.fields=username,name,profile_image_url",
    {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    },
  )

  if (!userRes.ok) {
    console.error("[social-auth] Twitter user info fetch failed:", userRes.status)
    return redirectResponse(`${frontendUrl}/settings?error=twitter_user_fetch`, clearCookies)
  }

  const userData = (await userRes.json()) as {
    data: { id: string; username: string; name: string }
  }

  // 9. Upsert platform_connection with encrypted tokens
  const supabase = createServiceClient()

  const encryptedAccessToken = await encrypt(tokenData.access_token)
  const encryptedRefreshToken = tokenData.refresh_token
    ? await encrypt(tokenData.refresh_token)
    : null

  const expiresAt = tokenData.expires_in
    ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
    : null

  const { error: upsertError } = await supabase.from("platform_connections").upsert(
    {
      user_id: user.id,
      platform: "twitter",
      access_token: encryptedAccessToken,
      refresh_token: encryptedRefreshToken,
      expires_at: expiresAt,
      platform_user_id: userData.data.id,
      platform_username: userData.data.username,
    },
    { onConflict: "user_id,platform" },
  )

  if (upsertError) {
    console.error("[social-auth] Twitter upsert failed:", upsertError.message)
    return redirectResponse(`${frontendUrl}/settings?error=twitter_save`, clearCookies)
  }

  // 10. Redirect to frontend
  return redirectResponse(`${frontendUrl}/settings?connected=twitter`, clearCookies)
}

// ---------------------------------------------------------------------------
// LinkedIn OAuth
// ---------------------------------------------------------------------------

async function linkedinInitiate(req: Request): Promise<Response> {
  // 1. Require authenticated user
  const { user, error } = await requireUser(req)
  if (!user) return errorResponse(error ?? "Unauthorized", 401, req)

  // 2. Check platform limit
  const limit = await checkLimit(user.id, "platforms")
  if (!limit.allowed) {
    return errorResponse(
      `Platform limit reached (${limit.count}/${limit.limit}). Upgrade to Pro for unlimited platforms.`,
      403,
      req,
    )
  }

  // 3. Generate PKCE code_verifier and code_challenge
  const verifierBytes = randomBytes(32)
  const codeVerifier = base64UrlEncode(verifierBytes)
  const challengeBytes = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(codeVerifier)),
  )
  const codeChallenge = base64UrlEncode(challengeBytes)

  // 4. Generate random state
  const state = base64UrlEncode(randomBytes(32))

  // 5. Extract the user's access token to store in a cookie for the callback
  const authHeader = req.headers.get("authorization") ?? ""
  const accessToken = authHeader.replace(/^bearer\s+/i, "")

  // 6. Build cookies
  const cookies = [
    buildSetCookie("linkedin_code_verifier", codeVerifier, OAUTH_COOKIE_OPTS),
    buildSetCookie("linkedin_oauth_state", state, OAUTH_COOKIE_OPTS),
    buildSetCookie("oauth_return_token", accessToken, OAUTH_COOKIE_OPTS),
  ]

  // 7. Build LinkedIn OAuth URL
  const clientId = Deno.env.get("LINKEDIN_CLIENT_ID")
  if (!clientId) return errorResponse("LinkedIn OAuth not configured", 500, req)

  const redirectUri = `${getEdgeFunctionBaseUrl()}/linkedin/callback`

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "openid profile email w_member_social",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  })

  const url = `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`

  // 8. Return the URL with cookies set
  const body = JSON.stringify({ url })
  const headers = new Headers({
    "Content-Type": "application/json",
    ...getCorsHeaders(req),
  })
  for (const cookie of cookies) {
    headers.append("Set-Cookie", cookie)
  }

  return new Response(body, { status: 200, headers })
}

async function linkedinCallback(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const frontendUrl = getFrontendUrl()

  // 1. Handle error from LinkedIn (user denied access)
  const errorParam = url.searchParams.get("error")
  if (errorParam) {
    return redirectResponse(`${frontendUrl}/settings?error=linkedin_denied`)
  }

  // 2. Get code and state from query params
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")

  if (!code || !state) {
    return redirectResponse(`${frontendUrl}/settings?error=linkedin_missing_params`)
  }

  // 3. Validate state against cookie
  const storedState = getCookie(req, "linkedin_oauth_state")
  if (!storedState || storedState !== state) {
    return redirectResponse(`${frontendUrl}/settings?error=linkedin_invalid_state`)
  }

  // 4. Get code_verifier from cookie
  const codeVerifier = getCookie(req, "linkedin_code_verifier")
  if (!codeVerifier) {
    return redirectResponse(`${frontendUrl}/settings?error=linkedin_missing_verifier`)
  }

  // 5. Get user from stored JWT cookie
  const returnToken = getCookie(req, "oauth_return_token")
  if (!returnToken) {
    return redirectResponse(`${frontendUrl}/settings?error=linkedin_auth_expired`)
  }

  const user = await getUserFromJwt(returnToken)
  if (!user) {
    return redirectResponse(`${frontendUrl}/settings?error=linkedin_auth_invalid`)
  }

  // 6. Clear all OAuth cookies
  const clearCookies = [
    buildClearCookie("linkedin_code_verifier"),
    buildClearCookie("linkedin_oauth_state"),
    buildClearCookie("oauth_return_token"),
  ]

  // 7. Exchange code for tokens (HTTP Basic Auth + PKCE)
  const clientId = Deno.env.get("LINKEDIN_CLIENT_ID")
  const clientSecret = Deno.env.get("LINKEDIN_CLIENT_SECRET")

  if (!clientId || !clientSecret) {
    return redirectResponse(`${frontendUrl}/settings?error=linkedin_config`, clearCookies)
  }

  const redirectUri = `${getEdgeFunctionBaseUrl()}/linkedin/callback`

  const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${toBase64Utf8(`${clientId}:${clientSecret}`)}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    }),
  })

  if (!tokenRes.ok) {
    console.error("[social-auth] LinkedIn token exchange failed:", tokenRes.status)
    return redirectResponse(`${frontendUrl}/settings?error=linkedin_token_exchange`, clearCookies)
  }

  const tokenData = (await tokenRes.json()) as {
    access_token: string
    expires_in?: number
    refresh_token?: string
    refresh_token_expires_in?: number
  }

  // 7. Fetch user info from LinkedIn userinfo endpoint
  const userRes = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  })

  if (!userRes.ok) {
    console.error("[social-auth] LinkedIn user info fetch failed:", userRes.status)
    return redirectResponse(`${frontendUrl}/settings?error=linkedin_user_fetch`, clearCookies)
  }

  const userData = (await userRes.json()) as {
    sub: string
    name?: string
    email?: string
    picture?: string
  }

  // 8. Upsert platform_connection with encrypted tokens
  const supabase = createServiceClient()

  const encryptedAccessToken = await encrypt(tokenData.access_token)
  const encryptedRefreshToken = tokenData.refresh_token
    ? await encrypt(tokenData.refresh_token)
    : null

  const expiresAt = tokenData.expires_in
    ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
    : null

  const { error: upsertError } = await supabase.from("platform_connections").upsert(
    {
      user_id: user.id,
      platform: "linkedin",
      access_token: encryptedAccessToken,
      refresh_token: encryptedRefreshToken,
      expires_at: expiresAt,
      platform_user_id: userData.sub,
      platform_username: userData.name ?? userData.email ?? userData.sub,
    },
    { onConflict: "user_id,platform" },
  )

  if (upsertError) {
    console.error("[social-auth] LinkedIn upsert failed:", upsertError.message)
    return redirectResponse(`${frontendUrl}/settings?error=linkedin_save`, clearCookies)
  }

  // 9. Redirect to frontend
  return redirectResponse(`${frontendUrl}/settings?connected=linkedin`, clearCookies)
}

// ---------------------------------------------------------------------------
// Bluesky (credential-based, no OAuth)
// ---------------------------------------------------------------------------

async function blueskyConnect(req: Request): Promise<Response> {
  // 1. Require authenticated user (Bearer token)
  const { user, error } = await requireUser(req)
  if (!user) return errorResponse(error ?? "Unauthorized", 401, req)

  // 2. Check platform limit
  const limit = await checkLimit(user.id, "platforms")
  if (!limit.allowed) {
    return errorResponse(
      `Platform limit reached (${limit.count}/${limit.limit}). Upgrade to Pro for unlimited platforms.`,
      403,
      req,
    )
  }

  // 3. Parse body
  const body = await safeJson<{ handle?: string; appPassword?: string }>(req)
  if (!body?.handle || !body?.appPassword) {
    return errorResponse("Missing handle or appPassword", 400, req)
  }

  const { handle, appPassword } = body

  // 4. Validate credentials by creating a Bluesky session
  const sessionRes = await fetch("https://bsky.social/xrpc/com.atproto.server.createSession", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      identifier: handle,
      password: appPassword,
    }),
  })

  if (!sessionRes.ok) {
    console.error("[social-auth] Bluesky session validation failed:", sessionRes.status)

    if (sessionRes.status === 401) {
      return errorResponse(
        "Invalid Bluesky credentials. Check your handle and app password.",
        401,
        req,
      )
    }

    return errorResponse("Failed to validate Bluesky credentials", 400, req)
  }

  const sessionData = (await sessionRes.json()) as {
    did: string
    handle: string
    accessJwt: string
  }

  // 5. Upsert platform_connection with encrypted app password
  const supabase = createServiceClient()

  const encryptedAppPassword = await encrypt(appPassword)

  const { error: upsertError } = await supabase.from("platform_connections").upsert(
    {
      user_id: user.id,
      platform: "bluesky",
      access_token: encryptedAppPassword,
      platform_user_id: sessionData.did,
      platform_username: sessionData.handle,
    },
    { onConflict: "user_id,platform" },
  )

  if (upsertError) {
    console.error("[social-auth] Bluesky upsert failed:", upsertError.message)
    return errorResponse("Failed to save Bluesky connection", 500, req)
  }

  // 6. Return success
  return jsonResponse({ ok: true, username: sessionData.handle }, req)
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  // Handle CORS preflight
  const optRes = handleOptions(req)
  if (optRes) return optRes

  const rl = checkRateLimit(req, { limit: 60, windowMs: 60_000, key: "social-auth" })
  if (!rl.allowed) {
    return errorResponse("Rate limit exceeded", 429, req)
  }

  const parts = parsePathParts(req, "social-auth")
  const platform = parts[0] // "twitter" | "linkedin" | "bluesky"
  const action = parts[1] // "callback" | undefined
  const method = req.method

  try {
    // ------- Twitter -------
    if (platform === "twitter" && method === "POST" && !action) {
      return await twitterInitiate(req)
    }
    if (platform === "twitter" && method === "GET" && action === "callback") {
      return await twitterCallback(req)
    }

    // ------- LinkedIn -------
    if (platform === "linkedin" && method === "POST" && !action) {
      return await linkedinInitiate(req)
    }
    if (platform === "linkedin" && method === "GET" && action === "callback") {
      return await linkedinCallback(req)
    }

    // ------- Bluesky -------
    if (platform === "bluesky" && method === "POST" && !action) {
      return await blueskyConnect(req)
    }

    // ------- Fallback -------
    return errorResponse("Not found", 404, req)
  } catch (err) {
    console.error(
      "[social-auth] Unhandled error:",
      err instanceof Error ? err.message : String(err),
      err instanceof Error ? err.stack : "",
    )
    return errorResponse("Internal server error", 500, req)
  }
})
