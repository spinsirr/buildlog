'use client'

import { ErrorState } from '@/components/error-state'

export default function UsageError({
  error: _error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <ErrorState message="Something went wrong loading usage data." retry={reset} />
}
