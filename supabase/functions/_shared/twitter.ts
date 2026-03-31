/* eslint-disable vercel-ai-security/no-hardcoded-api-keys -- config object with env var names, not secrets */
import { getValidToken, type OAuthProviderConfig } from "./oauth-refresh.ts"

const twitterConfig: OAuthProviderConfig = {
  platform: "twitter",
  tokenUrl: "https://api.twitter.com/2/oauth2/token",
  authMethod: "basic",
  clientIdEnv: "TWITTER_CLIENT_ID",
  clientSecretEnv: "TWITTER_CLIENT_SECRET",
}

export async function publishToTwitter(
  userId: string,
  text: string,
): Promise<{ tweetId: string; tweetUrl: string }> {
  const { accessToken, connection } = await getValidToken(twitterConfig, userId)

  const res = await fetch("https://api.twitter.com/2/tweets", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
  })

  if (!res.ok) {
    const body = await res.text()
    let message = `Twitter API error (${res.status})`
    try {
      const err = JSON.parse(body)
      if (err.title === "CreditsDepleted") {
        message =
          "Twitter API credits exhausted — upgrade your X API plan or wait for credits to reset"
      } else if (err.detail) {
        message = err.detail
      } else if (err.title) {
        message = err.title
      }
    } catch {
      // non-JSON body, use generic message
    }
    throw new Error(message)
  }

  const payload = (await res.json()) as { data: { id: string } }
  const username = (connection.platform_username as string) ?? "i"

  return {
    tweetId: payload.data.id,
    tweetUrl: `https://x.com/${username}/status/${payload.data.id}`,
  }
}
