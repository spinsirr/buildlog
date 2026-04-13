/* eslint-disable vercel-ai-security/no-hardcoded-api-keys -- config object with env var names, not secrets */
import { getValidToken, type OAuthProviderConfig } from "./oauth-refresh.ts"

const linkedinConfig: OAuthProviderConfig = {
  platform: "linkedin",
  tokenUrl: "https://www.linkedin.com/oauth/v2/accessToken",
  authMethod: "body",
  clientIdEnv: "LINKEDIN_CLIENT_ID",
  clientSecretEnv: "LINKEDIN_CLIENT_SECRET",
}

export async function publishToLinkedIn(
  userId: string,
  text: string,
): Promise<{ postId: string; postUrl: string }> {
  const { accessToken, connection } = await getValidToken(
    linkedinConfig,
    userId,
  )

  const linkedinUserId = connection.platform_user_id as string
  if (!linkedinUserId) {
    throw new Error(
      "LinkedIn user ID not found. Please reconnect in Settings.",
    )
  }

  const res = await fetch("https://api.linkedin.com/v2/posts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
      "LinkedIn-Version": "202401",
    },
    body: JSON.stringify({
      author: `urn:li:person:${linkedinUserId}`,
      commentary: text,
      visibility: "PUBLIC",
      distribution: {
        feedDistribution: "MAIN_FEED",
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      lifecycleState: "PUBLISHED",
      isReshareDisabledByAuthor: false,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`LinkedIn API error: ${res.status} ${body}`)
  }

  const postUrn = res.headers.get("x-restli-id") ?? ""
  const activityId = postUrn.split(":").pop() ?? postUrn

  return {
    postId: postUrn,
    postUrl: `https://www.linkedin.com/feed/update/${
      postUrn.includes(":") ? postUrn : `urn:li:share:${activityId}`
    }`,
  }
}
