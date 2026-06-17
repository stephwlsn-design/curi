import { useState, useEffect } from 'react'
import { API, useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import {
  buildLocalDesign,
  applyLocalPexelsPhoto,
  applyLocalPexelsVideo,
} from '../utils/localDesign'

export function useDesignCreation({ prompt = '', brandColors } = {}) {
  const { workspaceId } = useAuth()
  const [userTemplates, setUserTemplates] = useState([])
  const [templateLoading, setTemplateLoading] = useState(false)
  const [selectedTemplateId, setSelectedTemplateId] = useState(null)

  useEffect(() => {
    if (!workspaceId) return
    API.get(`/design/templates?workspaceId=${workspaceId}`)
      .then(r => setUserTemplates(r.data.templates || []))
      .catch(() => {})
  }, [workspaceId])

  const startFromTemplate = async (templateId, customTemplate) => {
    setTemplateLoading(true)
    try {
      const design = buildLocalDesign({
        templateId,
        customTemplate,
        brandColors,
        prompt,
      })
      if (!design) {
        toast.error('Template not found')
        return null
      }
      setSelectedTemplateId(templateId || customTemplate?._id)
      return design
    } finally {
      setTemplateLoading(false)
    }
  }

  const createFromPexelsPhoto = async (item, useAs = 'background', existingDesign = null) => {
    setTemplateLoading(true)
    try {
      const base = existingDesign || buildLocalDesign({ brandColors, prompt })
      if (!base) return null
      return applyLocalPexelsPhoto(base, item, useAs)
    } finally {
      setTemplateLoading(false)
    }
  }

  const createFromPexelsVideo = async (item, existingDesign = null) => {
    setTemplateLoading(true)
    try {
      const base = existingDesign || buildLocalDesign({ brandColors, prompt })
      if (!base) return null
      return applyLocalPexelsVideo(base, item)
    } finally {
      setTemplateLoading(false)
    }
  }

  const startBlankCanvas = () => startFromTemplate('centered-hero')

  return {
    workspaceId,
    userTemplates,
    templateLoading,
    selectedTemplateId,
    setSelectedTemplateId,
    startFromTemplate,
    startBlankCanvas,
    createFromPexelsPhoto,
    createFromPexelsVideo,
  }
}
