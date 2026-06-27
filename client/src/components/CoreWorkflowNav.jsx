import { useNavigate } from 'react-router-dom'
import { CORE_WORKFLOW_STEPS, getStepByPath, getNextStep, getPrevStep } from '../constants/coreWorkflow'
import SaveDraftButton from './SaveDraftButton'

export default function CoreWorkflowNav({
  stepId,
  canProceed = true,
  proceedLabel = 'Next',
  onBeforeNext,
  hideNext = false,
  nextPath,
}) {
  const navigate = useNavigate()
  const current = CORE_WORKFLOW_STEPS.find(s => s.id === stepId)
  const next = getNextStep(stepId)
  const prev = getPrevStep(stepId)
  const isOptional = current?.optional
  const destination = nextPath || next?.path

  const goTo = (path) => navigate(path)

  const handleNext = async () => {
    if (!destination) return
    if (onBeforeNext) {
      const ok = await onBeforeNext()
      if (!ok) return
    }
    navigate(destination)
  }

  return (
    <div className="mb-6 space-y-4">
      <div className="card p-4">
        <div className="text-sm font-semibold text-theme-muted/50 uppercase tracking-wider mb-3">Curi Core Workflow</div>
        <div className="flex flex-wrap items-center gap-1.5">
          {CORE_WORKFLOW_STEPS.map((step, i) => {
            const active = step.id === stepId
            const stepIndex = CORE_WORKFLOW_STEPS.findIndex(s => s.id === stepId)
            const completed = i < stepIndex
            return (
              <div key={step.id} className="flex items-center gap-1">
                {i > 0 && <span className="text-theme-muted/20 text-sm mx-0.5">›</span>}
                <button
                  type="button"
                  onClick={() => goTo(step.path)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                    active
                      ? 'bg-curi-gradient text-white shadow-clay-sm'
                      : completed
                        ? 'bg-curi-green/15 text-curi-green hover:bg-curi-green/25'
                        : 'bg-theme-subtle/5 text-theme-muted/50 hover:text-theme-text hover:bg-theme-subtle/10'
                  }`}
                >
                  {step.label}
                  {step.optional && (
                    <span className={`ml-1 font-normal ${active ? 'text-white/70' : 'text-theme-muted/40'}`}>
                      (opt)
                    </span>
                  )}
                </button>
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div>
          {prev ? (
            <button type="button" onClick={() => goTo(prev.path)} className="btn-secondary text-base py-2.5 px-5">
              ← Back
            </button>
          ) : <span />}
        </div>
        <div className="flex items-center gap-2">
          <SaveDraftButton compact />
          {isOptional && next && (
            <button type="button" onClick={() => goTo(next.path)} className="btn-secondary text-base py-2.5 px-5">
              Skip
            </button>
          )}
          {!hideNext && (next || nextPath) && (
            <button
              type="button"
              onClick={handleNext}
              disabled={!canProceed}
              className="btn-primary text-base py-2.5 px-6 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {proceedLabel} →
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export { getStepByPath }
