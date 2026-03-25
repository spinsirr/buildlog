import { AuthProvider } from '@/components/auth-provider'
import { DashboardShell } from '@/components/dashboard-shell'
import { OnbordaWrapper } from '@/components/onborda-wrapper'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <OnbordaWrapper>
        <DashboardShell>{children}</DashboardShell>
      </OnbordaWrapper>
    </AuthProvider>
  )
}
