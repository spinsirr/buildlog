'use client'

import { ErrorState } from '@/components/error-state'

export default function SettingsError({
  error: _error, // eslint-disable-line @typescript-eslint/no-unused-vars -- required by Next.js error boundary
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return <ErrorState message="Something went wrong loading settings." retry={reset} />
}
