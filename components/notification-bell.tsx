'use client'

import { Bell } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import useSWR from 'swr'
import { createClient } from '@/lib/supabase/client'
import type { Notification } from '@/lib/types'
import { cn, timeAgo } from '@/lib/utils'

async function fetchNotifications() {
  const supabase = createClient()
  const { data } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20)
  const notifications = (data ?? []) as Notification[]
  const unreadCount = notifications.filter((n) => !n.read).length
  return { notifications, unreadCount }
}

const NotificationItem = memo(function NotificationItem({
  notification,
  onSelect,
}: {
  notification: Notification
  onSelect: (n: Notification) => void
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={() => onSelect(notification)}
      className={cn(
        'w-full text-left px-3 py-2.5 border-b border-zinc-800/50 hover:bg-zinc-800/50 transition-colors',
        !notification.read && 'bg-zinc-800/50'
      )}
    >
      <div className="flex items-start gap-2">
        {!notification.read && (
          <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-zinc-400 shrink-0" />
        )}
        <div className={cn('flex-1', notification.read && 'ml-3.5')}>
          <p className="text-xs text-zinc-300 leading-relaxed">{notification.message}</p>
          <p className="text-[10px] text-zinc-500 mt-0.5">{timeAgo(notification.created_at)}</p>
        </div>
      </div>
    </button>
  )
})

export function NotificationBell() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [open, setOpen] = useState(false)
  const bellRef = useRef<HTMLButtonElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const { data, mutate } = useSWR<{
    notifications: Notification[]
    unreadCount: number
  }>('notifications', fetchNotifications, {
    refreshInterval: 60000,
    refreshWhenHidden: false,
    refreshWhenOffline: false,
  })

  const unreadCount = data?.unreadCount ?? 0
  const notifications = data?.notifications ?? []

  // Focus management: move focus into dropdown on open, return to bell on close
  const previousOpenRef = useRef(false)
  useEffect(() => {
    if (open && !previousOpenRef.current) {
      // Dropdown just opened — focus first focusable item
      requestAnimationFrame(() => {
        const container = dropdownRef.current
        if (!container) return
        const firstItem = container.querySelector<HTMLElement>('[role="menuitem"], a, button')
        firstItem?.focus()
      })
    } else if (!open && previousOpenRef.current) {
      // Dropdown just closed — return focus to bell button
      bellRef.current?.focus()
    }
    previousOpenRef.current = open
  }, [open])

  // Keyboard handling: Escape to close, Tab focus trap
  useEffect(() => {
    if (!open) return

    function handleKeyDown(e: KeyboardEvent) {
      const container = dropdownRef.current
      if (!container) return

      if (e.key === 'Escape') {
        e.preventDefault()
        setOpen(false)
        return
      }

      if (e.key === 'Tab') {
        const focusableEls = container.querySelectorAll<HTMLElement>('[role="menuitem"], a, button')
        if (focusableEls.length === 0) return

        const firstEl = focusableEls[0]
        const lastEl = focusableEls[focusableEls.length - 1]

        if (e.shiftKey) {
          // Shift+Tab on first element → wrap to last
          if (document.activeElement === firstEl) {
            e.preventDefault()
            lastEl.focus()
          }
        } else {
          // Tab on last element → wrap to first
          if (document.activeElement === lastEl) {
            e.preventDefault()
            firstEl.focus()
          }
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open])

  const markAllRead = useCallback(async () => {
    await supabase.from('notifications').update({ read: true }).eq('read', false)
    mutate()
  }, [supabase, mutate])

  const markRead = useCallback(
    async (id: string) => {
      await supabase.from('notifications').update({ read: true }).eq('id', id)
      mutate()
    },
    [supabase, mutate]
  )

  const handleSelectNotification = useCallback(
    (n: Notification) => {
      if (!n.read) markRead(n.id)
      if (n.link) router.push(n.link)
      setOpen(false)
    },
    [markRead, router]
  )

  return (
    <div className="relative">
      <button
        ref={bellRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative min-h-[44px] min-w-[44px] flex items-center justify-center rounded-md text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800/50 transition-colors"
        aria-label="Notifications"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span
            className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-zinc-400"
            aria-hidden="true"
          />
        )}
      </button>

      {/* Screen reader announcement for notification count changes */}
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {unreadCount > 0
          ? `${unreadCount} unread notification${unreadCount === 1 ? '' : 's'}`
          : 'No unread notifications'}
      </span>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden="true" />

          {/* Dropdown */}
          <div
            ref={dropdownRef}
            role="menu"
            aria-label="Notifications"
            className="absolute left-0 top-full mt-1 w-72 z-50 rounded-lg border border-zinc-800 bg-zinc-900 shadow-xl sm:left-auto sm:right-0"
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
              <span className="text-xs font-medium text-zinc-300">
                Notifications
                {unreadCount > 0 && <span className="ml-1.5 text-zinc-400">({unreadCount})</span>}
              </span>
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={markAllRead}
                  className="text-[10px] text-zinc-400 hover:text-zinc-300 transition-colors"
                >
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-64 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="px-3 py-6 text-center">
                  <p className="text-xs text-zinc-500">No notifications yet</p>
                </div>
              ) : (
                notifications.map((n) => (
                  <NotificationItem
                    key={n.id}
                    notification={n}
                    onSelect={handleSelectNotification}
                  />
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
