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
