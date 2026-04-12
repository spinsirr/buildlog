'use client'

import { X } from 'lucide-react'
import type { CardComponentProps } from 'onborda'
import { useOnborda } from 'onborda'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'

export function OnbordaCard({
  step,
  currentStep,
  totalSteps,
  nextStep,
  prevStep,
  arrow,
}: CardComponentProps) {
  const { closeOnborda } = useOnborda()

  return (
    <Card className="border-zinc-700 bg-zinc-900 w-96 rounded-xl shadow-2xl">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between w-full">
          <div>
            <CardTitle className="text-sm font-semibold text-zinc-50">
              {step.icon} {step.title}
            </CardTitle>
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
      </CardHeader>
      <CardContent className="text-sm text-zinc-400 pb-3">{step.content}</CardContent>
      <CardFooter className="pt-0">
        <div className="flex justify-between w-full gap-2">
          {currentStep !== 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => prevStep()}
              className="text-zinc-400 hover:text-zinc-50 h-7 text-xs"
            >
              Back
            </Button>
          )}
          <div className="ml-auto">
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
      </CardFooter>
      <span className="text-zinc-900">{arrow}</span>
    </Card>
  )
}
