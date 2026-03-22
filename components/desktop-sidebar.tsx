'use client'

import { LogOut } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { NotificationBell } from '@/components/notification-bell'
import { SidebarNav } from '@/components/sidebar-nav'
import { StreakCounter } from '@/components/streak-counter'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { useProfile } from '@/lib/hooks/use-profile'
import { createClient } from '@/lib/supabase/client'

export function DesktopSidebar() {
  const router = useRouter()
  const { data: profile } = useProfile()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <aside className="hidden md:flex w-60 border-r border-zinc-800/50 flex-col fixed inset-y-0 left-0 bg-zinc-950 z-30 [view-transition-name:sidebar]">
      {/* Logo + Notifications */}
      <div className="h-14 flex items-center justify-between px-5 border-b border-zinc-800/50">
        <Link href="/dashboard" className="font-semibold text-lg tracking-tight text-zinc-50">
          Build<span className="text-purple-400">Log</span>
        </Link>
        <NotificationBell />
      </div>

      {/* Navigation */}
      <SidebarNav />

      {/* Streak counter */}
      <StreakCounter />

      <Separator className="bg-zinc-800/50" />

      {/* User */}
      <div className="px-3 py-3">
        <div className="flex items-center gap-3 px-3 py-2">
          <Avatar className="h-7 w-7">
            <AvatarImage src={profile?.github_avatar_url ?? undefined} />
            <AvatarFallback className="bg-zinc-800 text-zinc-400 text-xs">
              {profile?.github_username?.[0]?.toUpperCase() ?? 'U'}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm text-zinc-400 truncate flex-1">
            {profile?.github_username ?? 'User'}
          </span>
          <button
            type="button"
            onClick={handleLogout}
            className="text-zinc-500 hover:text-zinc-300 transition-colors"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
