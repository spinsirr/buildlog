/* eslint-disable vercel-ai-security/no-hardcoded-api-keys */
/**
 * Data-driven OAuth provider configuration (inspired by Nango).
 * Adding a new OAuth platform = adding an entry here. No code changes needed.
 * Values here are OAuth endpoint URLs and env var names, not actual secrets.
 */

export interface OAuthProviderConfig {
  /** Display name */
  name: string
  /** OAuth authorization URL */
  authorizationUrl: string
  /** Token exchange URL */
  tokenUrl: string
  /** User info endpoint */
  userInfoUrl: string
  /** Required scopes */
  scopes: string[]
  /** How to send client credentials in token exchange */
  tokenAuthMethod: "basic" | "body"
  /** Whether this provider supports PKCE */
  pkce: boolean
  /** Extract user ID and username from userinfo response */
  extractUser: (data: Record<string, unknown>) => { id: string; username: string }
  /** Env var names for client credentials */
  envClientId: string
  envClientSecret: string
}

export const OAUTH_PROVIDERS: Record<string, OAuthProviderConfig> = {
  twitter: {
    name: "Twitter",
    authorizationUrl: "https://twitter.com/i/oauth2/authorize",
    tokenUrl: "https://api.twitter.com/2/oauth2/token",
    userInfoUrl: "https://api.twitter.com/2/users/me?user.fields=username,name,profile_image_url",
    scopes: ["tweet.read", "tweet.write", "users.read", "offline.access"],
    tokenAuthMethod: "basic",
    pkce: true,
    extractUser: (data) => {
      const user = (data as { data: { id: string; username: string } }).data
      return { id: user.id, username: user.username }
    },
    envClientId: "TWITTER_CLIENT_ID",
    envClientSecret: "TWITTER_CLIENT_SECRET",
  },

  linkedin: {
    name: "LinkedIn",
    authorizationUrl: "https://www.linkedin.com/oauth/v2/authorization",
    tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
    userInfoUrl: "https://api.linkedin.com/v2/userinfo",
    scopes: ["openid", "profile", "email", "w_member_social"],
    tokenAuthMethod: "basic",
    pkce: true,
    extractUser: (data) => {
      const d = data as { sub: string; name?: string; email?: string }
      return { id: d.sub, username: d.name ?? d.email ?? d.sub }
    },
    envClientId: "LINKEDIN_CLIENT_ID",
    envClientSecret: "LINKEDIN_CLIENT_SECRET",
  },
}

/**
 * Non-OAuth platforms (credential-based like Bluesky) are handled separately.
 * This config only covers standard OAuth 2.0 flows.
 */
