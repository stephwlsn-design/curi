import { useState, useEffect, useCallback } from 'react'
import { API } from '../context/AuthContext'

export function useBrandAssets(workspaceId) {
  const [designs, setDesigns] = useState([])
  const [templates, setTemplates] = useState([])
  const [content, setContent] = useState([])
  const [videos, setVideos] = useState([])
  const [drafts, setDrafts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const reload = useCallback(async () => {
    if (!workspaceId) {
      setDesigns([])
      setTemplates([])
      setContent([])
      setVideos([])
      setDrafts([])
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)
    try {
      const [designRes, templateRes, contentRes, videoRes, draftRes] = await Promise.all([
        API.get(`/design/library?workspaceId=${workspaceId}`),
        API.get(`/design/templates?workspaceId=${workspaceId}`),
        API.get(`/create/history?workspaceId=${workspaceId}&limit=50`),
        API.get(`/video/library?workspaceId=${workspaceId}`),
        API.get(`/drafts?workspaceId=${workspaceId}`),
      ])
      setDesigns(designRes.data.designs || [])
      setTemplates([
        ...(templateRes.data.builtin || []),
        ...(templateRes.data.templates || []),
      ])
      setContent(contentRes.data.content || [])
      setVideos((videoRes.data.videos || []).map((v) => ({
        ...(v.metadata?.toObject?.() ?? v.metadata ?? {}),
        _id: v._id,
        title: v.title,
        content: v.content,
        createdAt: v.createdAt,
      })))
      setDrafts(draftRes.data.drafts || [])
    } catch (err) {
      setError(err.response?.data?.error || 'Could not load brand assets')
    } finally {
      setLoading(false)
    }
  }, [workspaceId])

  useEffect(() => {
    reload()
  }, [reload])

  return {
    designs,
    templates,
    content,
    videos,
    drafts,
    loading,
    error,
    reload,
    counts: {
      designs: designs.length,
      templates: templates.length,
      content: content.length,
      videos: videos.length,
      drafts: drafts.length,
      all: designs.length + templates.length + content.length + videos.length + drafts.length,
    },
  }
}
