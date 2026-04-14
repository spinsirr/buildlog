'use client'

import { BarChart3, FileText, GitFork, LayoutDashboard, Settings } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import useSWR from 'swr'
import { useAuth } from '@/components/auth-provider'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

export const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, id: 'onborda-nav-dashboard' },
  {
    href: '/posts',
    label: 'Posts',
    icon: FileText,
    id: 'onborda-nav-posts',
    badge: 'drafts' as const,
  },
  { href: '/repos', label: 'Repos', icon: GitFork, id: 'onborda-nav-repos' },
  { href: '/usage', label: 'Usage', icon: BarChart3, id: 'onborda-nav-usage' },
  { href: '/settings', label: 'Settings', icon: Settings, id: 'onborda-nav-settings' },
]

const supabase = createClient()

async function fetchDraftCount(_key: string, userId: string) {
  const { count } = await supabase
    .from('posts')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'draft')
  return count ?? 0
}

export function SidebarNav() {
  const pathname = usePathname()
  const { userId } = useAuth()
  const { data: draftCount } = useSWR(
    userId ? ['draft-count', userId] : null,
    ([key, uid]) => fetchDraftCount(key, uid),
    { dedupingInterval: 30000, keepPreviousData: true }
  )

  return (
    <nav aria-label="Dashboard" className="flex-1 px-3 py-4 space-y-1">
      {navItems.map((item) => (
        <Link
          key={item.href}
          id={item.id}
          href={item.href}
          aria-current={pathname === item.href ? 'page' : undefined}
          className={cn(
            'flex items-center gap-3 px-3 py-2 rounded-none text-sm transition-colors border-l-2',
            pathname === item.href
              ? 'text-zinc-50 bg-zinc-800/50 border-neo-accent'
              : 'text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800/50 border-transparent'
          )}
        >
          <item.icon className="h-4 w-4" />
          {item.label}
          {'badge' in item && item.badge === 'drafts' && draftCount != null && draftCount > 0 && (
            <span className="ml-auto text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded-none bg-neo-accent/10 text-neo-accent font-mono-ui">
              {draftCount}
            </span>
          )}
        </Link>
      ))}
    </nav>
  )
}
