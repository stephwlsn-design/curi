export const CORE_WORKFLOW_STEPS = [
  { id: 'discover', path: '/discover', label: 'Discover' },
  { id: 'create', path: '/create', label: 'Create' },
  { id: 'design', path: '/design', label: 'Design' },
  { id: 'video', path: '/video', label: 'Video', optional: true },
  { id: 'mail', path: '/mail', label: 'Mail', optional: true },
  { id: 'launch', path: '/launch', label: 'Launch' },
]

export const getStepByPath = (pathname) =>
  CORE_WORKFLOW_STEPS.find(s => pathname.startsWith(s.path))

export const getStepIndex = (id) =>
  CORE_WORKFLOW_STEPS.findIndex(s => s.id === id)

export const getNextStep = (id) => {
  const i = getStepIndex(id)
  return i >= 0 && i < CORE_WORKFLOW_STEPS.length - 1 ? CORE_WORKFLOW_STEPS[i + 1] : null
}

export const getPrevStep = (id) => {
  const i = getStepIndex(id)
  return i > 0 ? CORE_WORKFLOW_STEPS[i - 1] : null
}
