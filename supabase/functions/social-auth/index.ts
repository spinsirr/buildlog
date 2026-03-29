// deno-lint-ignore-file camelcase
import { requireUser } from "../_shared/auth.ts"
import { errorResponse, handleOptions, jsonResponse } from "../_shared/cors.ts"
import { base64UrlEncode, encrypt, randomBytes, rfc6749BasicAuth } from "../_shared/crypto.ts"
import { parsePathParts, safeJson } from "../_shared/http.ts"
import { getLog, setupLogger } from "../_shared/logger.ts"
import { OAUTH_PROVIDERS, type OAuthProviderConfig } from "../_shared/providers.ts"
import { checkLimit } from "../_shared/subscription.ts"
import { createServiceClient } from "../_shared/supabase.ts"

await setupLogger()
const log = getLog("social-auth")

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getEdgeFunctionBaseUrl(): string {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")
  if (!supabaseUrl) throw new Error("Missing SUPABASE_URL")
  return `${supabaseUrl}/functions/v1/social-auth`
}

function redirectResponse(url: string): Response {
  return new Response(null, { status: 302, headers: { Location: url } })
}

/** Validate return_url against allowed origins to prevent open redirect */
function sanitizeReturnUrl(url: string): string {
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

function getAllowedReturnOrigins(): Set<string> {
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

// ---------------------------------------------------------------------------
// DB-based OAuth state (cross-origin fetch can't set cookies)
// ---------------------------------------------------------------------------

async function storeOAuthState(
  userId: string,
  platform: string,
  state: string,
  codeVerifier: string,
  returnUrl: string,
): Promise<void> {
  const supabase = createServiceClient()
  await supabase
    .from("oauth_states")
    .delete()
    .eq("user_id", userId)
    .lt("expires_at", new Date().toISOString())

  const { error } = await supabase.from("oauth_states").insert({
    user_id: userId,
    platform,
    state,
    code_verifier: codeVerifier,
    return_url: returnUrl,
  })
  if (error) throw new Error(`Failed to store OAuth state: ${error.message}`)
}

async function retrieveOAuthState(
  state: string,
): Promise<{ userId: string; platform: string; codeVerifier: string; returnUrl: string } | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from("oauth_states")
    .select("user_id, platform, code_verifier, return_url, expires_at")
    .eq("state", state)
    .single()

  if (error || !data) return null
  if (new Date(data.expires_at) < new Date()) {
    await supabase.from("oauth_states").delete().eq("state", state)
    return null
  }

  // One-time use — delete after retrieval
  await supabase.from("oauth_states").delete().eq("state", state)
  return {
    userId: data.user_id,
    platform: data.platform,
    codeVerifier: data.code_verifier,
    returnUrl: data.return_url ?? "https://buildlog.ink",
  }
}

// ---------------------------------------------------------------------------
// Generic OAuth engine (data-driven by provider config)
// ---------------------------------------------------------------------------

async function oauthInitiate(
  req: Request,
  provider: OAuthProviderConfig,
  platform: string,
): Promise<Response> {
  const { user, supabase: _userClient, error } = await requireUser(req)
  if (!user) return errorResponse(error ?? "Unauthorized", 401, req)

  const limit = await checkLimit(user.id, "platforms")
  if (!limit.allowed) {
    return jsonResponse(
      {
        error:
          `Platform limit reached (${limit.count}/${limit.limit}). Upgrade to Pro for unlimited platforms.`,
        code: "plan_limit",
      },
      req,
      { status: 403 },
    )
  }

  const clientId = Deno.env.get(provider.envClientId)
  if (!clientId) return errorResponse(`${provider.name} OAuth not configured`, 500, req)

  // Read return_url from request body (frontend passes window.location.origin)
  const body = await safeJson<{ return_url?: string }>(req)
  const returnUrl = sanitizeReturnUrl(body?.return_url ?? "https://buildlog.ink")

  const state = base64UrlEncode(randomBytes(32))
  const redirectUri = `${getEdgeFunctionBaseUrl()}/${platform}/callback`

  const params: Record<string, string> = {
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: provider.scopes.join(" "),
    state,
  }

  // PKCE challenge
  let codeVerifier = ""
  if (provider.pkce) {
    const verifierBytes = randomBytes(32)
    codeVerifier = base64UrlEncode(verifierBytes)
    const challengeBytes = new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(codeVerifier)),
    )
    params.code_challenge = base64UrlEncode(challengeBytes)
    params.code_challenge_method = "S256"
  }

  await storeOAuthState(user.id, platform, state, codeVerifier, returnUrl)

  const url = `${provider.authorizationUrl}?${new URLSearchParams(params).toString()}`
  return jsonResponse({ url }, req)
}

async function oauthCallback(
  req: Request,
  provider: OAuthProviderConfig,
  platform: string,
): Promise<Response> {
  const url = new URL(req.url)

  // For errors before we have state, fall back to default
  if (url.searchParams.get("error")) {
    const fallbackState = url.searchParams.get("state")
    let frontendUrl = "https://buildlog.ink"
    if (fallbackState) {
      const s = await retrieveOAuthState(fallbackState)
      if (s) frontendUrl = s.returnUrl
    }
    return redirectResponse(`${frontendUrl}/settings?error=${platform}_denied`)
  }

  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  if (!code || !state) {
    return redirectResponse(`https://buildlog.ink/settings?error=${platform}_missing_params`)
  }

  const oauthState = await retrieveOAuthState(state)
  if (!oauthState || oauthState.platform !== platform) {
    log.error("invalid oauth state: {platform}", { platform })
    return redirectResponse(`https://buildlog.ink/settings?error=${platform}_invalid_state`)
  }

  const frontendUrl = oauthState.returnUrl

  const clientId = Deno.env.get(provider.envClientId)
  const clientSecret = Deno.env.get(provider.envClientSecret)
  if (!clientId || !clientSecret) {
    return redirectResponse(`${frontendUrl}/settings?error=${platform}_config`)
  }

  // Token exchange — auth method driven by config
  const redirectUri = `${getEdgeFunctionBaseUrl()}/${platform}/callback`
  const bodyParams: Record<string, string> = {
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  }
  if (provider.pkce && oauthState.codeVerifier) {
    bodyParams.code_verifier = oauthState.codeVerifier
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
  }
  if (provider.tokenAuthMethod === "basic") {
    headers.Authorization = `Basic ${rfc6749BasicAuth(clientId, clientSecret)}`
  } else {
    bodyParams.client_id = clientId
    bodyParams.client_secret = clientSecret
  }

  const tokenRes = await fetch(provider.tokenUrl, {
    method: "POST",
    headers,
    body: new URLSearchParams(bodyParams),
  })

  if (!tokenRes.ok) {
    const body = await tokenRes.text()
    log.error("{provider} token exchange failed: {status} {body}", {
      provider: provider.name,
      status: tokenRes.status,
      body,
    })
    return redirectResponse(
      `${frontendUrl}/settings?error=${platform}_token_exchange&detail=${
        encodeURIComponent(body.slice(0, 200))
      }`,
    )
  }

  const tokenData = (await tokenRes.json()) as {
    access_token: string
    refresh_token?: string
    expires_in?: number
  }

  // Fetch user info
  const userRes = await fetch(provider.userInfoUrl, {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  })
  if (!userRes.ok) {
    log.error("{provider} user info failed: {status}", {
      provider: provider.name,
      status: userRes.status,
    })
    return redirectResponse(`${frontendUrl}/settings?error=${platform}_user_fetch`)
  }

  const userData = (await userRes.json()) as Record<string, unknown>
  const { id: platformUserId, username: platformUsername } = provider.extractUser(userData)

  // Upsert connection
  const supabase = createServiceClient()
  const encryptedAccessToken = await encrypt(tokenData.access_token)
  const expiresAt = tokenData.expires_in
    ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
    : null

  const upsertData: Record<string, unknown> = {
    user_id: oauthState.userId,
    platform,
    access_token: encryptedAccessToken,
    expires_at: expiresAt,
    platform_user_id: platformUserId,
    platform_username: platformUsername,
    last_refresh_at: null,
    refresh_failures: 0,
  }

  // Preserve existing refresh_token if new response doesn't include one (Nango pattern)
  if (tokenData.refresh_token) {
    upsertData.refresh_token = await encrypt(tokenData.refresh_token)
  } else {
    const { data: existing } = await supabase
      .from("platform_connections")
      .select("refresh_token")
      .eq("user_id", oauthState.userId)
      .eq("platform", platform)
      .single()
    if (existing?.refresh_token) {
      upsertData.refresh_token = existing.refresh_token
    }
  }

  const { error: upsertError } = await supabase
    .from("platform_connections")
    .upsert(upsertData, { onConflict: "user_id,platform" })

  if (upsertError) {
    log.error("{provider} upsert failed: {error}", {
      provider: provider.name,
      error: upsertError.message,
    })
    return redirectResponse(`${frontendUrl}/settings?error=${platform}_save`)
  }

  return redirectResponse(`${frontendUrl}/settings?connected=${platform}`)
}

// ---------------------------------------------------------------------------
// Bluesky (credential-based, not OAuth — handled separately)
// ---------------------------------------------------------------------------

async function blueskyConnect(req: Request): Promise<Response> {
  const { user, supabase: _userClient, error } = await requireUser(req)
  if (!user) return errorResponse(error ?? "Unauthorized", 401, req)

  const limit = await checkLimit(user.id, "platforms")
  if (!limit.allowed) {
    return jsonResponse(
      {
        error:
          `Platform limit reached (${limit.count}/${limit.limit}). Upgrade to Pro for unlimited platforms.`,
        code: "plan_limit",
      },
      req,
      { status: 403 },
    )
  }

  const body = await safeJson<{ handle?: string; appPassword?: string }>(req)
  if (!body?.handle || !body?.appPassword) {
    return errorResponse("Missing handle or appPassword", 400, req)
  }

  const sessionRes = await fetch("https://bsky.social/xrpc/com.atproto.server.createSession", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: body.handle, password: body.appPassword }),
  })

  if (!sessionRes.ok) {
    if (sessionRes.status === 401) {
      return errorResponse(
        "Invalid Bluesky credentials. Check your handle and app password.",
        401,
        req,
      )
    }
    return errorResponse("Failed to validate Bluesky credentials", 400, req)
  }

  const sessionData = (await sessionRes.json()) as { did: string; handle: string }
  const supabase = createServiceClient()
  const encryptedAppPassword = await encrypt(body.appPassword)

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
    return errorResponse("Failed to save Bluesky connection", 500, req)
  }

  return jsonResponse({ ok: true, username: sessionData.handle }, req)
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  const optRes = handleOptions(req)
  if (optRes) return optRes

  const parts = parsePathParts(req, "social-auth")
  const platform = parts[0]
  const action = parts[1]
  const method = req.method

  try {
    // Credential-based platforms (not OAuth)
    if (platform === "bluesky" && method === "POST" && !action) {
      return await blueskyConnect(req)
    }
    // Generic OAuth — look up provider config
    const provider = OAUTH_PROVIDERS[platform]
    if (!provider) return errorResponse("Unknown platform", 404, req)

    if (method === "POST" && !action) {
      return await oauthInitiate(req, provider, platform)
    }
    if (method === "GET" && action === "callback") {
      return await oauthCallback(req, provider, platform)
    }

    return errorResponse("Not found", 404, req)
  } catch (err) {
    log.error("unhandled error: {error}", {
      error: err instanceof Error ? err.message : String(err),
    })
    return errorResponse("Internal server error", 500, req)
  }
})
