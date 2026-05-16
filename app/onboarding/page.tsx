import { Suspense } from 'react'
import { OnboardingFlow } from './onboarding-flow'

export const dynamic = 'force-dynamic'

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0a0f]" />}>
      <OnboardingFlow />
    </Suspense>
  )
}
