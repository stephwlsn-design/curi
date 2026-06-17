import { Check } from 'lucide-react'

export const DESIGN_STEPS = [
  { id: 1, label: 'Inspiration', description: 'Upload reference & pick format' },
  { id: 2, label: 'Template', description: 'Choose your layout' },
  { id: 3, label: 'Media', description: 'Photos & videos' },
  { id: 4, label: 'Customize', description: 'Text & elements' },
  { id: 5, label: 'Finalize', description: 'Review & save' },
]

export default function DesignStepGuide({ currentStep, onStepChange, completedSteps = [] }) {
  return (
    <div className="px-4 py-3 bg-theme-surface border-b border-theme-border">
      <div className="flex items-center gap-1 overflow-x-auto">
        {DESIGN_STEPS.map((step, index) => {
          const isActive = currentStep === step.id
          const isComplete = completedSteps.includes(step.id) || currentStep > step.id
          const isLast = index === DESIGN_STEPS.length - 1

          return (
            <div key={step.id} className="flex items-center flex-shrink-0">
              <button
                type="button"
                onClick={() => onStepChange?.(step.id)}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-xl transition-all text-left ${
                  isActive
                    ? 'bg-curi-pink/15 border border-curi-pink/30'
                    : 'hover:bg-theme-subtle/5 border border-transparent'
                }`}
              >
                <span
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                    isActive
                      ? 'bg-curi-pink text-white'
                      : isComplete
                        ? 'bg-curi-green/20 text-curi-green'
                        : 'bg-theme-subtle/10 text-theme-muted/50'
                  }`}
                >
                  {isComplete && !isActive ? <Check size={14} /> : step.id}
                </span>
                <span className="hidden sm:block min-w-0">
                  <span className={`block text-base font-bold leading-tight ${isActive ? 'text-theme-text' : 'text-theme-muted/70'}`}>
                    Step {step.id}: {step.label}
                  </span>
                  <span className="block text-sm text-theme-muted/50 leading-tight">{step.description}</span>
                </span>
              </button>
              {!isLast && (
                <div className={`w-6 h-0.5 mx-1 flex-shrink-0 ${isComplete ? 'bg-curi-green/40' : 'bg-theme-border'}`} />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
