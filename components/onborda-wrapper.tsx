'use client'

import { Onborda, OnbordaProvider } from 'onborda'
import { OnbordaCard } from '@/components/onborda-card'
import { tours } from '@/lib/onborda-steps'

export function OnbordaWrapper({ children }: { children: React.ReactNode }) {
  return (
    <OnbordaProvider>
      <Onborda
        steps={tours}
        cardComponent={OnbordaCard}
        shadowRgb="0,0,0"
        shadowOpacity="0.7"
      >
        {children}
      </Onborda>
    </OnbordaProvider>
  )
}
