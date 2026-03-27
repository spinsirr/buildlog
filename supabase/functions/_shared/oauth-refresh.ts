// Shared OAuth token refresh + retrieval for all platforms.
// Each platform provides a config object; this module handles
// expiration checks, token refresh, encrypted storage, and failure tracking.

import { decrypt, encrypt, toBase64Utf8 } from "./crypto.ts"
import { createServiceClient } from "./supabase.ts"

export interface OAuthProviderConfig {
  platform: string
  tokenUrl: string
  // "basic" = Authorization header (Twitter), "body" = POST body params (LinkedIn)
  authMethod: "basic" | "body"
  clientIdEnv: string
  clientSecretEnv: string
}

// 5-minute buffer before expiration triggers a refresh
const EXPIRY_BUFFER_MS = 5 * 60 * 1000

function getCredentials(config: OAuthProviderConfig): {
  clientId: string
  clientSecret: string
} {
  const clientId = Deno.env.get(config.clientIdEnv)
  const clientSecret = Deno.env.get(config.clientSecretEnv)
  if (!clientId || !clientSecret) {
    throw new Error(`Missing ${config.platform} OAuth configuration`)
  }
  return { clientId, clientSecret }
}

// Exchange a refresh token for a new access token and persist it.
async function refreshAccessToken(
  config: OAuthProviderConfig,
  userId: string,
  refreshToken: string,
): Promise<string> {
  const { clientId, clientSecret } = getCredentials(config)

  const bodyParams: Record<string, string> = {
    "grant_type": "refresh_token",
    "refresh_token": refreshToken,
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
  }

  if (config.authMethod === "basic") {
    headers.Authorization = `Basic ${toBase64Utf8(`${clientId}:${clientSecret}`)}`
  } else {
    bodyParams.client_id = clientId
    bodyParams.client_secret = clientSecret
  }

  const res = await fetch(config.tokenUrl, {
    method: "POST",
    headers,
    body: new URLSearchParams(bodyParams),
  })

  if (!res.ok) {
    const body = await res.text()
    // Best-effort failure tracking
    const supabase = createServiceClient()
    await supabase
      .rpc("increment_refresh_failures", {
        p_user_id: userId,
        p_platform: config.platform,
      })
      .then(() => {}, () => {})
    throw new Error(`${config.platform} token refresh failed: ${body}`)
  }

  const data = (await res.json()) as {
    access_token: string
    refresh_token?: string
    expires_in?: number
  }

  // Preserve existing refresh_token if the provider doesn't return a new one
  const supabase = createServiceClient()
  await supabase
    .from("platform_connections")
    .update({
      access_token: await encrypt(data.access_token),
      refresh_token: await encrypt(data.refresh_token ?? refreshToken),
      expires_at: data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000).toISOString()
        : null,
      last_refresh_at: new Date().toISOString(),
      refresh_failures: 0,
    })
    .eq("user_id", userId)
    .eq("platform", config.platform)

  return data.access_token
}

// Retrieve a valid (non-expired) access token, refreshing if needed.
// Returns the raw connection row alongside the token so callers can
// read platform-specific fields (e.g. platform_user_id, platform_username).
export async function getValidToken(
  config: OAuthProviderConfig,
  userId: string,
): Promise<{
  accessToken: string
  connection: Record<string, unknown>
}> {
  const supabase = createServiceClient()
  const { data: conn } = await supabase
    .from("platform_connections")
    .select("*")
    .eq("user_id", userId)
    .eq("platform", config.platform)
    .single()

  if (!conn) throw new Error(`${config.platform} not connected`)

  const expiresAt = conn.expires_at ? new Date(conn.expires_at as string).getTime() : null

  // Token expired (or about to) — try refreshing
  if (expiresAt && Date.now() > expiresAt - EXPIRY_BUFFER_MS) {
    if (conn.refresh_token) {
      const newToken = await refreshAccessToken(
        config,
        userId,
        await decrypt(conn.refresh_token as string),
      )
      return { accessToken: newToken, connection: conn as Record<string, unknown> }
    }
    throw new Error(
      `${config.platform} token expired. Please reconnect in Settings.`,
    )
  }

  return {
    accessToken: await decrypt(conn.access_token as string),
    connection: conn as Record<string, unknown>,
  }
}
