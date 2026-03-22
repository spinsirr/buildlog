'use client'

import { FileText, GitFork, LayoutDashboard, LogOut, Menu, Settings } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { NotificationBell } from '@/components/notification-bell'
import { StreakCounter } from '@/components/streak-counter'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Separator } from '@/components/ui/separator'
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/lib/types'

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/posts', label: 'Posts', icon: FileText },
  { href: '/repos', label: 'Repos', icon: GitFork },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export function MobileSidebar({ profile }: { profile: Profile }) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="md:hidden flex items-center h-14 px-4 border-b border-zinc-800/50 bg-zinc-950 sticky top-0 z-40">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          render={
            <button
              type="button"
              className="p-2 -ml-2 text-zinc-400 hover:text-zinc-50 transition-colors"
            />
          }
        >
          <Menu className="h-5 w-5" />
        </SheetTrigger>
        <SheetContent side="left" className="w-60 bg-zinc-950 border-zinc-800 p-0">
          {/* Logo */}
          <div className="h-14 flex items-center px-5 border-b border-zinc-800/50">
            <Link
              href="/dashboard"
              onClick={() => setOpen(false)}
              className="font-semibold text-lg tracking-tight text-zinc-50"
            >
              Build<span className="text-purple-400">Log</span>
            </Link>
          </div>

          {/* Nav */}
          <nav className="flex-1 px-3 py-4 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  pathname === item.href
                    ? 'text-zinc-50 bg-zinc-800/50'
                    : 'text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800/50'
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Streak */}
          <StreakCounter />

          <Separator className="bg-zinc-800/50" />

          {/* User */}
          <div className="px-3 py-3">
            <div className="flex items-center gap-3 px-3 py-2">
              <Avatar className="h-7 w-7">
                <AvatarImage src={profile.github_avatar_url ?? undefined} />
                <AvatarFallback className="bg-zinc-800 text-zinc-400 text-xs">
                  {profile.github_username?.[0]?.toUpperCase() ?? 'U'}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm text-zinc-400 truncate flex-1">
                {profile.github_username ?? 'User'}
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
        </SheetContent>
      </Sheet>

      {/* Mobile header logo */}
      <Link
        href="/dashboard"
        className="font-semibold text-lg tracking-tight text-zinc-50 ml-2 flex-1"
      >
        Build<span className="text-purple-400">Log</span>
      </Link>
      <NotificationBell />
    </div>
  )
}
