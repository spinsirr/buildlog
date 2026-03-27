'use client'

import { BarChart3, FileText, GitFork, LayoutDashboard, Settings } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

export const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, id: 'onborda-nav-dashboard' },
  { href: '/posts', label: 'Posts', icon: FileText, id: 'onborda-nav-posts' },
  { href: '/repos', label: 'Repos', icon: GitFork, id: 'onborda-nav-repos' },
  { href: '/usage', label: 'Usage', icon: BarChart3, id: 'onborda-nav-usage' },
  { href: '/settings', label: 'Settings', icon: Settings, id: 'onborda-nav-settings' },
]

export function SidebarNav() {
  const pathname = usePathname()

  return (
    <nav aria-label="Dashboard" className="flex-1 px-3 py-4 space-y-1">
      {navItems.map((item) => (
        <Link
          key={item.href}
          id={item.id}
          href={item.href}
          aria-current={pathname === item.href ? 'page' : undefined}
          className={cn(
            'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors',
            pathname === item.href
              ? 'text-zinc-50 bg-zinc-800/50'
              : 'text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800/50'
          )}
        >
          <item.icon className="h-4 w-4" />
          {item.label}
        </Link>
      ))}
    </nav>
  )
}
