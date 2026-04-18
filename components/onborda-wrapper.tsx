'use client'

import dynamic from 'next/dynamic'
import { OnbordaProvider, useOnborda } from 'onborda'
import { OnbordaCard } from '@/components/onborda-card'
import { tours } from '@/lib/onborda-steps'

// The `<Onborda>` render tree pulls in framer-motion (~180KB unminified),
// used only for an onboarding tour most users run once and never return
// to. Split it into its own chunk via next/dynamic so returning users
// don't pay for framer-motion on every dashboard navigation.
const OnbordaLazy = dynamic(() => import('onborda').then((m) => ({ default: m.Onborda })), {
  ssr: false,
  loading: () => null,
})

function OnbordaActive({ children }: { children: React.ReactNode }) {
  const { isOnbordaVisible } = useOnborda()
  // When no tour is running, render children directly — no wrapper divs,
  // no lazy chunk fetched, no MutationObservers set up.
  if (!isOnbordaVisible) return <>{children}</>
  return (
    <OnbordaLazy
      steps={tours}
      cardComponent={OnbordaCard}
      shadowRgb="0,0,0"
      shadowOpacity="0.7"
      cardTransition={{ ease: 'easeInOut', duration: 0.3 }}
    >
      {children}
    </OnbordaLazy>
  )
}

export function OnbordaWrapper({ children }: { children: React.ReactNode }) {
  return (
    <OnbordaProvider>
      <OnbordaActive>{children}</OnbordaActive>
    </OnbordaProvider>
  )
}
