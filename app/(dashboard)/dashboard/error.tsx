'use client'

import { ErrorState } from '@/components/error-state'

export default function DashboardError({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <ErrorState message="Something went wrong loading the dashboard." retry={reset} />
}
