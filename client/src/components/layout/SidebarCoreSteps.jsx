import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  CORE_SIDEBAR_STEPS,
  getCoreStepIndex,
  isChildActive,
  isDesignPath,
  resolveCoreStepId,
} from '../../constants/sidebarCoreSteps'

function StepDot({ state }) {
  const styles = {
    active: 'bg-curi-gradient border-transparent shadow-clay-sm scale-110',
    complete: 'bg-curi-green border-curi-green',
    upcoming: 'bg-theme-surface border-theme-muted/30',
  }
  return (
    <div
      className={`w-2.5 h-2.5 rounded-full border-2 flex-shrink-0 transition-all duration-200 z-10 ${styles[state]}`}
      aria-hidden
    />
  )
}

function StepConnector({ complete }) {
  return (
    <div
      className={`w-0.5 flex-1 min-h-3 my-0.5 rounded-full transition-colors duration-200 ${
        complete ? 'bg-curi-green/70' : 'bg-theme-border/70'
      }`}
      aria-hidden
    />
  )
}

export default function SidebarCoreSteps() {
  const location = useLocation()
  const navigate = useNavigate()
  const activeId = resolveCoreStepId(location.pathname)
  const activeIndex = activeId ? getCoreStepIndex(activeId) : -1

  const dotState = (index) => {
    if (index === activeIndex) return 'active'
    if (activeIndex >= 0 && index < activeIndex) return 'complete'
    return 'upcoming'
  }

  return (
    <div className="py-1">
      <div className="text-xs font-bold text-theme-muted/30 tracking-widest uppercase px-1 pb-2">
        CORE
      </div>

      <div className="space-y-0">
        {CORE_SIDEBAR_STEPS.map((step, index) => {
          const isLast = index === CORE_SIDEBAR_STEPS.length - 1
          const groupActive = step.id === activeId
            || (step.id === 'design' && isDesignPath(location.pathname))
          const state = dotState(index)

          return (
            <div key={step.id} className="flex gap-2.5 min-h-0">
              <div className="flex flex-col items-center w-3 flex-shrink-0 pt-2.5">
                <StepDot state={state} />
                {!isLast && <StepConnector complete={index < activeIndex} />}
              </div>

              <div className="flex-1 min-w-0 pb-1">
                <button
                  type="button"
                  onClick={() => navigate(step.path)}
                  className={`sidebar-link w-full py-2 ${groupActive && !step.children ? 'active' : ''} ${
                    groupActive && step.children ? 'text-theme-text' : ''
                  }`}
                >
                  <span className="flex-1 text-left">{step.label}</span>
                  {step.badge && (
                    <span className="badge bg-curi-blue/15 text-curi-blue text-[10px] px-1.5 py-0">
                      {step.badge}
                    </span>
                  )}
                </button>

                {step.children && (
                  <div className="ml-1 pl-2 border-l border-theme-border/50 space-y-0.5 mb-1">
                    {step.children.map((child) => {
                      const childActive = isChildActive(child, location.pathname, location.search)
                      return (
                        <NavLink
                          key={child.path}
                          to={child.path}
                          className={`sidebar-sublink block text-left ${childActive ? 'active' : ''}`}
                        >
                          {child.label}
                        </NavLink>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
