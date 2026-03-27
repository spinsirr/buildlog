import { type OAuthProviderConfig, getValidToken } from "./oauth-refresh.ts"

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
    throw new Error(`Twitter API error: ${res.status} ${body}`)
  }

  const payload = (await res.json()) as { data: { id: string } }
  const username = (connection.platform_username as string) ?? "i"

  return {
    tweetId: payload.data.id,
    tweetUrl: `https://x.com/${username}/status/${payload.data.id}`,
  }
}
