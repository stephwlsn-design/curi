import { createContext, useContext, useRef, useCallback, useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { API, useAuth } from './AuthContext'
import { useCoreWorkflow } from './CoreWorkflowContext'
import { getStepByPath } from '../constants/coreWorkflow'
import toast from 'react-hot-toast'

const DraftContext = createContext(null)

export const DraftProvider = ({ children }) => {
  const { workspaceId } = useAuth()
  const { workflow, patch, setContent } = useCoreWorkflow()
  const location = useLocation()
  const navigate = useNavigate()
  const modulesRef = useRef({})
  const [activeDraftId, setActiveDraftId] = useState(null)
  const [saving, setSaving] = useState(false)

  const registerModule = useCallback((moduleId, handlers) => {
    modulesRef.current[moduleId] = handlers
    return () => {
      if (modulesRef.current[moduleId] === handlers) {
        delete modulesRef.current[moduleId]
      }
    }
  }, [])

  const collectModules = useCallback(() => {
    const modules = {}
    Object.entries(modulesRef.current).forEach(([id, h]) => {
      try {
        if (h?.getState) modules[id] = h.getState()
      } catch { /* skip */ }
    })
    return modules
  }, [])

  const saveDraft = useCallback(async (title) => {
    if (!workspaceId) return toast.error('Workspace not loaded')
    setSaving(true)
    try {
      const step = getStepByPath(location.pathname)
      const { data } = await API.post('/drafts/save', {
        workspaceId,
        draftId: activeDraftId,
        title,
        currentStep: step?.id || 'discover',
        currentPath: location.pathname,
        coreWorkflow: workflow,
        modules: collectModules(),
      })
      setActiveDraftId(data.draft._id)
      toast.success('All progress saved as draft')
      return data.draft
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not save draft')
      return null
    } finally {
      setSaving(false)
    }
  }, [workspaceId, activeDraftId, location.pathname, workflow, collectModules])

  const restoreDraft = useCallback(async (draft) => {
    if (!draft) return
    setActiveDraftId(draft._id)

    if (draft.coreWorkflow) {
      patch(draft.coreWorkflow)
      if (draft.coreWorkflow.contentId || draft.coreWorkflow.contentText) {
        setContent({
          contentId: draft.coreWorkflow.contentId,
          contentText: draft.coreWorkflow.contentText || '',
          topic: draft.coreWorkflow.topic || '',
          saved: draft.coreWorkflow.createSaved ?? false,
        })
      }
    }

    const mods = draft.modules || {}
    const applyRestore = () => {
      Object.entries(modulesRef.current).forEach(([id, h]) => {
        if (mods[id] && h?.restoreState) {
          try { h.restoreState(mods[id]) } catch { /* skip */ }
        }
      })
    }

    applyRestore()
    navigate(draft.currentPath || '/discover')
    setTimeout(applyRestore, 400)
    toast.success(`Resumed: ${draft.title}`)
  }, [patch, setContent, navigate])

  const loadDraftById = useCallback(async (id) => {
    try {
      const { data } = await API.get(`/drafts/${id}`)
      await restoreDraft(data.draft)
      return data.draft
    } catch {
      toast.error('Could not load draft')
      return null
    }
  }, [restoreDraft])

  const clearActiveDraft = useCallback(() => setActiveDraftId(null), [])

  return (
    <DraftContext.Provider value={{
      registerModule,
      saveDraft,
      restoreDraft,
      loadDraftById,
      activeDraftId,
      saving,
      clearActiveDraft,
    }}>
      {children}
    </DraftContext.Provider>
  )
}

export const useDraft = () => {
  const ctx = useContext(DraftContext)
  if (!ctx) throw new Error('useDraft must be used within DraftProvider')
  return ctx
}

export const useDraftModule = (moduleId, getState, restoreState) => {
  const { registerModule } = useDraft()
  const getRef = useRef(getState)
  const restoreRef = useRef(restoreState)
  getRef.current = getState
  restoreRef.current = restoreState

  useEffect(() => {
    return registerModule(moduleId, {
      getState: () => getRef.current?.(),
      restoreState: (s) => restoreRef.current?.(s),
    })
  }, [moduleId, registerModule])
}
