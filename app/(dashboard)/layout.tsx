import { AuthGuard } from '@/components/auth-guard'
import { DesktopSidebar } from '@/components/desktop-sidebar'
import { MobileSidebar } from '@/components/mobile-sidebar'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="min-h-screen bg-zinc-950 md:flex">
        <MobileSidebar />
        <DesktopSidebar />
        <div className="flex-1 md:ml-60">
          <main className="max-w-5xl mx-auto px-4 py-6 md:px-8 md:py-8">{children}</main>
        </div>
      </div>
    </AuthGuard>
  )
}
