import { createContext, useContext, useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'curi_core_workflow'

const defaultState = {
  contentId: null,
  contentText: '',
  topic: '',
  discoverComplete: false,
  createSaved: false,
}

const loadState = () => {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? { ...defaultState, ...JSON.parse(raw) } : { ...defaultState }
  } catch {
    return { ...defaultState }
  }
}

const CoreWorkflowContext = createContext(null)

export const CoreWorkflowProvider = ({ children }) => {
  const [workflow, setWorkflow] = useState(loadState)

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(workflow))
  }, [workflow])

  const patch = useCallback((updates) => {
    setWorkflow(prev => ({ ...prev, ...updates }))
  }, [])

  const setContent = useCallback(({ contentId, contentText, topic, saved = true }) => {
    patch({
      contentId: contentId ?? null,
      contentText: contentText ?? '',
      topic: topic ?? '',
      createSaved: saved,
    })
  }, [patch])

  const markDiscoverComplete = useCallback(() => {
    patch({ discoverComplete: true })
  }, [patch])

  const resetWorkflow = useCallback(() => {
    setWorkflow({ ...defaultState })
    sessionStorage.removeItem(STORAGE_KEY)
  }, [])

  return (
    <CoreWorkflowContext.Provider value={{ workflow, patch, setContent, markDiscoverComplete, resetWorkflow }}>
      {children}
    </CoreWorkflowContext.Provider>
  )
}

export const useCoreWorkflow = () => {
  const ctx = useContext(CoreWorkflowContext)
  if (!ctx) throw new Error('useCoreWorkflow must be used within CoreWorkflowProvider')
  return ctx
}
