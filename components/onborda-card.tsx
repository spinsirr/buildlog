'use client'

import { X } from 'lucide-react'
import type { CardComponentProps } from 'onborda'
import { useOnborda } from 'onborda'
import { Button } from '@/components/ui/button'

function CardInner({
  step,
  currentStep,
  totalSteps,
  nextStep,
  prevStep,
}: Pick<CardComponentProps, 'step' | 'currentStep' | 'totalSteps' | 'nextStep' | 'prevStep'>) {
  const { closeOnborda } = useOnborda()

  return (
    <div className="border border-zinc-700 bg-zinc-900 w-72 rounded-xl shadow-2xl p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-semibold text-zinc-50">
            {step.icon} {step.title}
          </p>
          <span className="text-[11px] text-zinc-500">
            {currentStep + 1} of {totalSteps}
          </span>
        </div>
        <button
          type="button"
          aria-label="Close tour"
          onClick={() => closeOnborda()}
          className="text-zinc-500 hover:text-zinc-300 transition-colors -mt-1 -mr-1"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <p className="text-sm text-zinc-400">{step.content}</p>

      <div className="flex justify-between items-center">
        {currentStep !== 0 ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => prevStep()}
            className="text-zinc-400 hover:text-zinc-50 h-7 text-xs"
          >
            Back
          </Button>
        ) : (
          <div />
        )}
        {currentStep + 1 !== totalSteps ? (
          <Button
            size="sm"
            onClick={() => nextStep()}
            className="bg-purple-600 hover:bg-purple-500 text-white h-7 text-xs"
          >
            Next
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={() => closeOnborda()}
            className="bg-purple-600 hover:bg-purple-500 text-white h-7 text-xs"
          >
            Get started
          </Button>
        )}
      </div>
    </div>
  )
}

export function OnbordaCard({
  step,
  currentStep,
  totalSteps,
  nextStep,
  prevStep,
  arrow,
}: CardComponentProps) {
  // Step 0: centered overlay, no arrow
  // onborda wraps card in an absolute-positioned framer-motion div,
  // so we use fixed + !important to break out of that positioning
  if (currentStep === 0) {
    return (
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 9999,
        }}
      >
        <CardInner
          step={step}
          currentStep={currentStep}
          totalSteps={totalSteps}
          nextStep={nextStep}
          prevStep={prevStep}
        />
      </div>
    )
  }

  // Other steps: positioned by onborda relative to target
  return (
    <>
      <CardInner
        step={step}
        currentStep={currentStep}
        totalSteps={totalSteps}
        nextStep={nextStep}
        prevStep={prevStep}
      />
      <span className="text-zinc-900">{arrow}</span>
    </>
  )
}
