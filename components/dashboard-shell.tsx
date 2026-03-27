'use client'

import { motion } from 'framer-motion'
import { useAuth } from '@/components/auth-provider'
import { DesktopSidebar } from '@/components/desktop-sidebar'
import { MobileSidebar } from '@/components/mobile-sidebar'

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth()

  if (loading || !session) {
    return (
      <div className="min-h-screen bg-zinc-950" aria-busy="true">
        <span className="sr-only">Loading...</span>
      </div>
    )
  }

  return (
    <motion.div
      className="min-h-screen bg-zinc-950 md:flex"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
    >
      <MobileSidebar />
      <DesktopSidebar />
      <div className="flex-1 md:ml-60">
        <main className="max-w-5xl mx-auto px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </motion.div>
  )
}
