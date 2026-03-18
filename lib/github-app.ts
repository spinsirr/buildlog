import { createAppAuth } from '@octokit/auth-app'
import { Octokit } from '@octokit/rest'

export async function getInstallationOctokit(installationId: number): Promise<Octokit> {
  const auth = createAppAuth({
    appId: parseInt(process.env.GITHUB_APP_ID!),
    privateKey: process.env.GITHUB_APP_PRIVATE_KEY!,
    installationId,
  })
  const { token } = await auth({ type: 'installation' })
  return new Octokit({ auth: token })
}
