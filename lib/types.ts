export type Post = {
  id: string
  content: string
  status: string
  source_type: string
  platforms: string[] | null
  created_at: string
  source_data: Record<string, unknown> | null
  connected_repos: { full_name: string } | null
  platform_post_url: string | null
  published_at: string | null
}

export type Profile = {
  github_username: string | null
  github_avatar_url: string | null
}

export type ProfileSettings = {
  tone: string
  auto_publish: boolean
  email_notifications: boolean
}

export type Connection = {
  platform: string
  platform_username: string | null
  connected: boolean
}

export type Notification = {
  id: string
  message: string
  link: string | null
  read: boolean
  created_at: string
}

export type Repo = {
  id: number
  full_name: string
  private: boolean
  description: string | null
  connected: boolean
}
