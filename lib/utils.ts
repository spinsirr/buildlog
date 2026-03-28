import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function calculateStreak(posts: { created_at: string }[]): number {
  if (posts.length === 0) return 0
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const postDays = new Set(
    posts.map((p) => {
      const d = new Date(p.created_at)
      d.setHours(0, 0, 0, 0)
      return d.getTime()
    })
  )
  const dayMs = 86400000
  let checkDate = today.getTime()
  if (!postDays.has(checkDate)) checkDate = today.getTime() - dayMs
  let streak = 0
  while (postDays.has(checkDate)) {
    streak++
    checkDate -= dayMs
  }
  return streak
}

export function timeAgo(date: string | null): string | null {
  if (!date) return null
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

/** Returns age bucket for ADHD time anchors — helps with time blindness */
export function draftAgeBucket(date: string): 'fresh' | 'aging' | 'stale' {
  const days = Math.floor((Date.now() - new Date(date).getTime()) / 86400000)
  if (days <= 2) return 'fresh'
  if (days <= 7) return 'aging'
  return 'stale'
}

/** Explicit draft age text — combats ADHD time blindness with clear language */
export function draftAgeText(date: string): string {
  const hours = Math.floor((Date.now() - new Date(date).getTime()) / 3600000)
  if (hours < 1) return 'just created'
  if (hours < 24) return `${hours}h old`
  const days = Math.floor(hours / 24)
  if (days === 1) return '1 day old'
  if (days < 7) return `${days} days old`
  if (days < 14) return '1 week old'
  const weeks = Math.floor(days / 7)
  return `${weeks} weeks old`
}
