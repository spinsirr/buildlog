import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'
import type { Post, Repo } from '@/lib/types'

const supabase = createClient()

async function getUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

// --- Dashboard ---

async function fetchDashboardData() {
  const user = await getUser()
  if (!user) return null

  const [{ data: repos }, { data: posts }, { count: connectionsCount }, { data: streakPosts }] =
    await Promise.all([
      supabase.from('connected_repos').select('*').eq('user_id', user.id),
      supabase
        .from('posts')
        .select('*, connected_repos(full_name)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('platform_connections')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id),
      supabase
        .from('posts')
        .select('created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100),
    ])

  return {
    repos: repos ?? [],
    posts: (posts ?? []) as Post[],
    connectionsCount: connectionsCount ?? 0,
    streakPosts: (streakPosts as { created_at: string }[]) ?? [],
  }
}

export function useDashboardData() {
  return useSWR('dashboard-data', fetchDashboardData, {
    revalidateOnFocus: false,
    dedupingInterval: 10000,
  })
}

// --- Posts ---

async function fetchPostsData() {
  const user = await getUser()
  if (!user) return null

  const [{ data: posts }, { data: connectionRows }, { data: profile }] = await Promise.all([
    supabase
      .from('posts')
      .select('*, connected_repos(full_name)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),
    supabase.from('platform_connections').select('platform').eq('user_id', user.id),
    supabase.from('profiles').select('x_premium').eq('id', user.id).single(),
  ])

  return {
    posts: posts ?? [],
    connectedPlatforms: (connectionRows ?? []).map((r: { platform: string }) => r.platform),
    xPremium: profile?.x_premium ?? false,
  }
}

export function usePostsData() {
  return useSWR('posts-data', fetchPostsData, {
    revalidateOnFocus: false,
    dedupingInterval: 10000,
  })
}

// --- Repos ---

async function fetchReposData() {
  const user = await getUser()
  if (!user) return null

  const { data, error } = await supabase.functions.invoke('github-app', {
    body: { action: 'list-repos' },
  })

  if (error) {
    console.error('[repos] fetch error:', error)
    return { repos: [] as Repo[], needsInstall: true }
  }

  const result = data as { repos?: Repo[]; needsInstall?: boolean } | null
  return {
    repos: result?.repos ?? [],
    needsInstall: result?.needsInstall ?? false,
  }
}

export function useReposData() {
  return useSWR('repos-data', fetchReposData, {
    revalidateOnFocus: false,
    dedupingInterval: 30000,
  })
}

// --- Settings ---

async function fetchSettingsData() {
  const user = await getUser()
  if (!user) return null

  const [{ data: rows }, { data: profileData }, { data: sub }] = await Promise.all([
    supabase
      .from('platform_connections')
      .select('platform, platform_username')
      .eq('user_id', user.id),
    supabase
      .from('profiles')
      .select(
        'tone, auto_publish, email_notifications, publish_delay_minutes, github_username, x_premium'
      )
      .eq('id', user.id)
      .single(),
    supabase.from('subscriptions').select('status').eq('user_id', user.id).maybeSingle(),
  ])

  const connections = ['twitter', 'linkedin', 'bluesky'].map((platform) => {
    const row = rows?.find(
      (r: { platform: string; platform_username: string | null }) => r.platform === platform
    )
    return { platform, platform_username: row?.platform_username ?? null, connected: !!row }
  })

  const profile = {
    tone: profileData?.tone ?? 'casual',
    auto_publish: profileData?.auto_publish ?? false,
    email_notifications: profileData?.email_notifications ?? true,
    publish_delay_minutes: profileData?.publish_delay_minutes ?? 0,
    x_premium: profileData?.x_premium ?? false,
  }

  return {
    connections,
    profile,
    plan: (sub?.status === 'active' ? 'pro' : 'free') as 'pro' | 'free',
    githubUsername: profileData?.github_username ?? null,
  }
}

export function useSettingsData() {
  return useSWR('settings-data', fetchSettingsData, {
    revalidateOnFocus: false,
    dedupingInterval: 10000,
  })
}

// --- Usage ---

async function fetchUsageData() {
  const user = await getUser()
  if (!user) return null

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('status')
    .eq('user_id', user.id)
    .maybeSingle()

  const plan = (sub?.status === 'active' ? 'pro' : 'free') as 'pro' | 'free'

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const [{ data: allPosts }, { count: repoCount }, { count: platformCount }] = await Promise.all([
    supabase
      .from('posts')
      .select('status, source_type, platforms, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(500),
    supabase
      .from('connected_repos')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('is_active', true),
    supabase
      .from('platform_connections')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id),
  ])

  return {
    plan,
    posts: (allPosts ?? []) as {
      status: string
      source_type: string
      platforms: string[] | null
      created_at: string
    }[],
    repoCount: repoCount ?? 0,
    platformCount: platformCount ?? 0,
    monthStart,
  }
}

export function useUsageData() {
  return useSWR('usage-data', fetchUsageData, {
    revalidateOnFocus: false,
    dedupingInterval: 10000,
  })
}
