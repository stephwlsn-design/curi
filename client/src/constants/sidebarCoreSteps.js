export const CORE_SIDEBAR_STEPS = [
  { id: 'discover', path: '/discover', label: 'Curi Discover' },
  { id: 'create', path: '/create', label: 'Curi Create' },
  {
    id: 'design',
    path: '/design/studio',
    label: 'Curi Design',
    children: [
      { path: '/design/templates', label: 'Templates' },
      { path: '/design/canvas', label: 'Canvas' },
    ],
  },
  { id: 'video', path: '/video', label: 'Curi Video' },
  { id: 'mail', path: '/mail', label: 'Curi Mail' },
  { id: 'launch', path: '/launch', label: 'Curi Launch' },
  { id: 'autonomous', path: '/autonomous', label: 'Autonomous Engine', badge: 'NEW' },
  { id: 'approvals', path: '/approvals', label: 'Approvals' },
]

export const isDesignPath = (pathname) =>
  pathname === '/design' || pathname.startsWith('/design/')

export const resolveCoreStepId = (pathname) => {
  if (pathname.startsWith('/discover')) return 'discover'
  if (pathname.startsWith('/create')) return 'create'
  if (isDesignPath(pathname)) return 'design'
  if (pathname.startsWith('/video')) return 'video'
  if (pathname.startsWith('/mail')) return 'mail'
  if (pathname.startsWith('/launch')) return 'launch'
  if (pathname.startsWith('/autonomous')) return 'autonomous'
  if (pathname.startsWith('/approvals')) return 'approvals'
  return null
}

export const getCoreStepIndex = (stepId) =>
  CORE_SIDEBAR_STEPS.findIndex((s) => s.id === stepId)

const isTemplatesActive = (pathname, search) =>
  pathname.startsWith('/design/templates')
  || (pathname.startsWith('/design/studio') && new URLSearchParams(search).get('panel') === 'templates')

export const isChildActive = (child, pathname, search) => {
  if (child.path === '/design/templates') return isTemplatesActive(pathname, search)
  if (child.path === '/design/canvas') {
    return pathname.startsWith('/design/canvas')
      || (pathname.startsWith('/design/studio') && !isTemplatesActive(pathname, search))
  }
  return pathname.startsWith(child.path)
}
