import { useState, useEffect } from 'react'
import { API, useAuth } from '../context/AuthContext'
import toast from 'react-hot-toast'
import { BUILTIN_TEMPLATES } from '../constants/designTemplates'
import { getGraphicTemplate } from '../utils/graphicCanvas'

export function useDesignCreation({ prompt = '' } = {}) {
  const { workspaceId, fetchMe } = useAuth()
  const [dimensionId, setDimensionId] = useState('1080x1080')
  const [userTemplates, setUserTemplates] = useState([])
  const [templateLoading, setTemplateLoading] = useState(false)
  const [selectedTemplateId, setSelectedTemplateId] = useState(null)

  useEffect(() => {
    if (!workspaceId) return
    API.get(`/design/templates?workspaceId=${workspaceId}`)
      .then(r => setUserTemplates(r.data.templates || []))
      .catch(() => {})
  }, [workspaceId])

  const startFromTemplate = async (templateId, customTemplate, graphicTemplate) => {
    const graphic = graphicTemplate || getGraphicTemplate(templateId)
    const builtin = !graphic ? BUILTIN_TEMPLATES.find(t => t.id === templateId) : graphic
    if (builtin?.recommendedDimension) setDimensionId(builtin.recommendedDimension)
    const sample = builtin?.sampleCopy
    const headline = prompt.split('\n')[0]?.slice(0, 80) || sample?.headline || 'Your Headline'
    const subheadline = prompt.slice(0, 120) || sample?.subheadline || ''
    const cta = sample?.cta || 'Learn More'
    const badge = sample?.badge || ''

    setTemplateLoading(true)
    try {
      const { data } = await API.post('/design/from-template', {
        workspaceId,
        templateId: customTemplate ? undefined : templateId,
        templatePlacements: customTemplate?.canvasLayout?.placements || customTemplate?.placements,
        headline,
        subheadline,
        cta,
        badge,
        dimensionId: builtin?.recommendedDimension || dimensionId,
      })
      setSelectedTemplateId(templateId || customTemplate?._id)
      fetchMe?.()
      return data.design
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not create from template')
      return null
    } finally {
      setTemplateLoading(false)
    }
  }

  const createFromPexelsPhoto = async (item, useAs = 'background') => {
    const headline = prompt.split('\n')[0]?.slice(0, 80) || 'Your Headline'
    const subheadline = prompt.slice(0, 120) || ''
    setTemplateLoading(true)
    try {
      const { data } = await API.post('/design/from-media', {
        workspaceId,
        mediaType: 'photo',
        pexelsId: item.id,
        url: item.url,
        thumbnailUrl: item.thumbnailUrl,
        photographer: item.photographer,
        photographerUrl: item.photographerUrl,
        useAs,
        dimensionId,
        headline,
        subheadline,
        cta: 'Learn More',
      })
      fetchMe?.()
      return data.design
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not add photo')
      return null
    } finally {
      setTemplateLoading(false)
    }
  }

  const createFromPexelsVideo = async (item) => {
    const headline = prompt.split('\n')[0]?.slice(0, 80) || 'Video Design'
    setTemplateLoading(true)
    try {
      const { data } = await API.post('/design/from-media', {
        workspaceId,
        mediaType: 'video',
        pexelsId: item.id,
        url: item.url,
        thumbnailUrl: item.thumbnailUrl,
        photographer: item.photographer,
        photographerUrl: item.photographerUrl,
        dimensionId,
        headline,
        duration: item.duration,
      })
      fetchMe?.()
      return data.design
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not add video')
      return null
    } finally {
      setTemplateLoading(false)
    }
  }

  const startBlankCanvas = () => startFromTemplate('centered-hero')

  return {
    workspaceId,
    dimensionId,
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
