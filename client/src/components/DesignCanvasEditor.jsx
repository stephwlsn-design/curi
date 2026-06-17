import { useState, useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react'
import { X, Save, LayoutTemplate, Plus, Trash2, Volume2, Play, Mic, Upload, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { API } from '../context/AuthContext'
import DesignCanvasRenderer from './DesignCanvasRenderer'
import { BUILTIN_TEMPLATES } from '../constants/designTemplates'
import PexelsMediaPanel from './PexelsMediaPanel'
import TalkingCharacterStudio from './TalkingCharacterStudio'
import { applyPexelsPhotoToCanvas } from '../utils/pexelsCanvas'
import { applyCharacterToCanvas, applyTalkingCharacterToCanvas, ANIMATED_CHARACTERS } from '../utils/characterCanvas'
import { applyAudioToCanvas, removeAudioFromCanvas, getCanvasAudioUrl } from '../utils/audioCanvas'
import {
  designToCanvas, applyTemplateToCanvas, canvasToDesignFields, syncCanvasTextFromDesign,
  getElementBounds, canResizeElement, applyResizePatch,
  RESIZE_HANDLES, resizeHandleCursor, resizeHandleStyle,
} from '../utils/designCanvas'
import { isDraftDesign } from '../utils/localDesign'
import { CANVAS_FONTS, FONT_WEIGHTS, fontFamilyToId, resolveCanvasFont } from '../constants/canvasFonts'

export default forwardRef(function DesignCanvasEditor({
  design,
  workspaceId,
  onClose,
  onSaved,
  userTemplates = [],
  embedded = false,
  hideAssetSidebar = false,
  hideClose = false,
  onOpenCharactersPanel,
  onNext,
  nextLabel = 'Next',
  showNext = false,
}, ref) {
  const containerRef = useRef(null)
  const canvasFocusRef = useRef(null)
  const [scale, setScale] = useState(0.45)
  const [canvas, setCanvas] = useState(() => {
    const base = design.canvasLayout || designToCanvas(design)
    return syncCanvasTextFromDesign(base, design)
  })
  const [selectedId, setSelectedId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [showSaveTemplate, setShowSaveTemplate] = useState(false)
  const [sidebarTab, setSidebarTab] = useState('templates')
  const dragRef = useRef(null)
  const resizeRef = useRef(null)

  const HANDLE_PX = 10

  const selected = canvas.elements.find(e => e.id === selectedId)

  useEffect(() => {
    const fit = () => {
      if (!containerRef.current) return
      const { clientWidth, clientHeight } = containerRef.current
      const s = Math.min((clientWidth - 32) / canvas.width, (clientHeight - 32) / canvas.height, 0.55)
      setScale(Math.max(0.25, s))
    }
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [canvas.width, canvas.height])

  const updateElement = useCallback((id, patch) => {
    setCanvas(prev => ({
      ...prev,
      elements: prev.elements.map(el => el.id === id ? { ...el, ...patch } : el),
    }))
  }, [])

  const onPointerDown = (e, elId) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    canvasFocusRef.current?.focus({ preventScroll: true })
    setSelectedId(elId)
    const el = canvas.elements.find(x => x.id === elId)
    if (!el) return
    const bounds = getElementBounds(el)

    dragRef.current = {
      elId,
      startX: e.clientX,
      startY: e.clientY,
      origX: el.x,
      origY: el.y,
      maxX: canvas.width - bounds.width,
      maxY: canvas.height - bounds.height,
    }

    const onMove = (ev) => {
      if (!dragRef.current) return
      const dx = (ev.clientX - dragRef.current.startX) / scale
      const dy = (ev.clientY - dragRef.current.startY) / scale
      updateElement(dragRef.current.elId, {
        x: Math.round(Math.max(0, Math.min(dragRef.current.maxX, dragRef.current.origX + dx))),
        y: Math.round(Math.max(0, Math.min(dragRef.current.maxY, dragRef.current.origY + dy))),
      })
    }

    const onUp = () => {
      dragRef.current = null
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const onResizePointerDown = (e, elId, handle) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    setSelectedId(elId)
    const el = canvas.elements.find(x => x.id === elId)
    if (!el) return
    const bounds = getElementBounds(el)

    resizeRef.current = {
      elId,
      handle,
      startX: e.clientX,
      startY: e.clientY,
      orig: {
        x: el.x,
        y: el.y,
        width: bounds.width,
        height: bounds.height,
      },
    }

    const onMove = (ev) => {
      if (!resizeRef.current) return
      const dx = (ev.clientX - resizeRef.current.startX) / scale
      const dy = (ev.clientY - resizeRef.current.startY) / scale
      const target = canvas.elements.find(x => x.id === resizeRef.current.elId)
      if (!target) return
      const patch = applyResizePatch(
        target,
        resizeRef.current.handle,
        resizeRef.current.orig,
        dx,
        dy,
        canvas.width,
        canvas.height,
      )
      updateElement(resizeRef.current.elId, patch)
    }

    const onUp = () => {
      resizeRef.current = null
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const applyTemplate = (templateId, customLayout) => {
    if (customLayout) {
      setCanvas(prev => applyTemplateToCanvas(prev, null, customLayout.placements || customLayout))
      toast.success(`Applied template: ${customLayout.name}`)
      return
    }
    setCanvas(prev => applyTemplateToCanvas(prev, templateId))
    toast.success('Template applied')
  }

  const saveDesign = async () => {
    const fields = canvasToDesignFields(canvas)
    const draft = isDraftDesign(design)

    if (draft) {
      setSaving(true)
      try {
        const { data } = await API.post('/design/save', {
          workspaceId,
          canvasLayout: canvas,
          ...fields,
          name: design.name,
          layout: design.layout,
        })
        const saved = {
          ...(data.design || {}),
          _id: data.design?._id,
          canvasLayout: canvas,
          _local: false,
        }
        onSaved?.(saved)
        toast.success('Design saved')
      } catch (err) {
        toast.error(err.response?.data?.error || 'Save failed')
      } finally {
        setSaving(false)
      }
      return
    }

    if (!design._id) {
      onSaved?.({ ...design, ...fields, canvasLayout: canvas })
      toast.success('Canvas updated')
      onClose?.()
      return
    }
    setSaving(true)
    try {
      const { data } = await API.patch(`/design/${design._id}`, {
        workspaceId,
        canvasLayout: canvas,
        ...fields,
      })
      const updated = { ...(data.design.metadata || data.design || {}), _id: data.design._id || design._id, canvasLayout: canvas }
      onSaved?.(updated)
      toast.success('Design saved')
      onClose?.()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const saveAsTemplate = async () => {
    if (!templateName.trim()) return toast.error('Enter a template name')
    try {
      await API.post('/design/templates', {
        workspaceId,
        name: templateName.trim(),
        dimensionId: design.dimensions?.id || '1080x1080',
        canvasLayout: {
          width: canvas.width,
          height: canvas.height,
          templateId: canvas.templateId,
          background: canvas.background,
          placements: Object.fromEntries(
            canvas.elements.map(el => [el.id, {
              x: el.x / canvas.width,
              y: el.y / canvas.height,
              width: el.width / canvas.width,
              fontSize: el.fontSize,
              align: el.align,
            }])
          ),
        },
        thumbnailColors: canvas.background?.colors,
      })
      toast.success('Template saved')
      setShowSaveTemplate(false)
      setTemplateName('')
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not save template')
    }
  }

  const addTextLayer = () => {
    const id = `text-${Date.now()}`
    setCanvas(prev => ({
      ...prev,
      elements: [...prev.elements, {
        id,
        type: 'text',
        text: 'New text',
        x: 80,
        y: 200,
        width: 400,
        fontSize: 28,
        fontWeight: 600,
        fontFamily: resolveCanvasFont('poppins'),
        color: '#ffffff',
        align: 'left',
        visible: true,
      }],
    }))
    setSelectedId(id)
  }

  const deleteSelected = useCallback(() => {
    if (!selectedId || ['headline', 'subheadline', 'cta', 'badge'].includes(selectedId)) {
      return toast.error('Core layers cannot be removed')
    }
    setCanvas(prev => ({
      ...prev,
      elements: prev.elements.filter(e => e.id !== selectedId),
    }))
    setSelectedId(null)
  }, [selectedId])

  const getSpeakableLayerContext = useCallback(() => {
    if (!selected) return null
    if (!['character', 'talking-character', 'image'].includes(selected.type)) return null
    const imageUrl = selected.url || selected.posterUrl || selected.previewUrl
    if (!imageUrl) return null
    return {
      character: selected.characterId
        ? ANIMATED_CHARACTERS.find((c) => c.id === selected.characterId) || null
        : null,
      imageUrl,
      script: selected.script || '',
    }
  }, [selected])

  const isFormField = (target) => {
    if (!target) return false
    const tag = target.tagName
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable
  }

  useEffect(() => {
    const onKeyDown = (e) => {
      if (isFormField(e.target)) return

      if (e.key === 'Escape') {
        if (selectedId) {
          e.preventDefault()
          setSelectedId(null)
        }
        return
      }

      if (!selectedId) return

      const el = canvas.elements.find((item) => item.id === selectedId)
      if (!el) return

      const bounds = getElementBounds(el)
      const step = e.shiftKey ? 10 : 1

      if (e.key === 'ArrowLeft') {
        e.preventDefault()
        updateElement(selectedId, { x: Math.max(0, el.x - step) })
        return
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        updateElement(selectedId, { x: Math.min(canvas.width - bounds.width, el.x + step) })
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        updateElement(selectedId, { y: Math.max(0, el.y - step) })
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        updateElement(selectedId, { y: Math.min(canvas.height - bounds.height, el.y + step) })
        return
      }

      if ((e.key === 'Delete' || e.key === 'Backspace') && !['headline', 'subheadline', 'cta', 'badge'].includes(selectedId)) {
        e.preventDefault()
        setCanvas((prev) => ({
          ...prev,
          elements: prev.elements.filter((item) => item.id !== selectedId),
        }))
        setSelectedId(null)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedId, canvas.elements, canvas.width, canvas.height, updateElement])

  const applyPexelsPhoto = (item, useAs = 'background') => {
    setCanvas((prev) => applyPexelsPhotoToCanvas(prev, item.url, useAs))
    toast.success(useAs === 'background' ? 'Background updated' : 'Photo layer added')
  }

  const applyPexelsVideo = (item) => {
    setCanvas((prev) => ({
      ...prev,
      background: {
        type: 'video',
        url: item.url,
        poster: item.thumbnailUrl,
        overlay: 'rgba(0,0,0,0.25)',
      },
    }))
    toast.success('Video background applied')
  }

  const applyCharacter = (character) => {
    setCanvas((prev) => applyCharacterToCanvas(prev, character))
    toast.success(`Added ${character.name}`)
  }

  const applyTalkingCharacter = (payload) => {
    setCanvas((prev) => applyTalkingCharacterToCanvas(prev, payload))
    toast.success(`Added talking character: ${payload.name}`)
  }

  const applyTalkToSelected = (payload) => {
    if (!selectedId) return
    const el = canvas.elements.find((e) => e.id === selectedId)
    if (!el) return
    updateElement(selectedId, {
      type: 'talking-character',
      characterId: payload.characterId || el.characterId || null,
      url: payload.imageUrl,
      posterUrl: payload.imageUrl,
      previewUrl: payload.imageUrl,
      videoUrl: payload.videoUrl || null,
      audioDataUrl: payload.audioDataUrl || null,
      name: payload.name || el.name || 'Talking Character',
      script: payload.script || '',
      language: payload.language || 'en',
      tonality: payload.tonality || 'friendly',
      gender: payload.gender || 'female',
      speakTrigger: payload.speakTrigger || Date.now(),
      animated: false,
    })
    toast.success('Character updated with voice & video')
  }

  const selectedCharacter = selected?.characterId
    ? ANIMATED_CHARACTERS.find((c) => c.id === selected.characterId) || null
    : null

  const isSpeakableLayer = selected?.type === 'character'
    || selected?.type === 'talking-character'
    || selected?.type === 'image'

  const selectedLayerImageUrl = selected
    ? (selected.url || selected.posterUrl || selected.previewUrl || null)
    : null

  const applyAudio = (audio) => {
    setCanvas((prev) => applyAudioToCanvas(prev, audio))
    toast.success(`Audio added: ${audio.name}`)
  }

  const removeAudio = () => {
    setCanvas((prev) => removeAudioFromCanvas(prev))
    toast.success('Audio removed')
  }

  useImperativeHandle(ref, () => ({
    applyTemplate,
    applyPexelsPhoto,
    applyPexelsVideo,
    applyCharacter,
    applyTalkingCharacter,
    applyAudio,
    addTextLayer,
    saveDesign,
    getCanvas: () => canvas,
    applyFontStyle: (fontId, target = 'headline') => {
      const family = resolveCanvasFont(fontId)
      setCanvas((prev) => ({
        ...prev,
        elements: prev.elements.map((el) => {
          if (target === 'all' && ['text', 'button', 'badge'].includes(el.type)) {
            return { ...el, fontFamily: family }
          }
          if (el.id === target) return { ...el, fontFamily: family }
          return el
        }),
      }))
      toast.success(`Applied ${CANVAS_FONTS.find((f) => f.id === fontId)?.label || 'font'}`)
    },
  }))

  const rootClass = embedded
    ? 'flex flex-col h-full min-h-0 bg-theme-bg'
    : 'fixed inset-0 z-50 bg-theme-bg/95 backdrop-blur-sm flex flex-col'

  return (
    <div className={rootClass}>
      <div className={`flex items-center justify-between px-4 py-3 border-b border-theme-border bg-theme-bg ${embedded ? 'flex-shrink-0' : ''}`}>
        <div>
          <h2 className="text-base font-bold text-theme-text">{embedded ? design.name || 'Your Design' : 'Canvas Editor'}</h2>
          <p className="text-xs text-theme-muted/50">{canvas.width}×{canvas.height}</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setShowSaveTemplate(v => !v)} className="btn-secondary text-sm flex items-center gap-1.5">
            <LayoutTemplate size={16} /> Save as Template
          </button>
          <button type="button" onClick={saveDesign} disabled={saving} className="btn-primary text-sm flex items-center gap-1.5">
            <Save size={16} /> {saving ? 'Saving...' : 'Save Design'}
          </button>
          {showNext && onNext && (
            <button type="button" onClick={onNext} className="btn-secondary text-sm flex items-center gap-1.5 border-curi-pink/40 text-curi-pink hover:bg-curi-pink/10">
              {nextLabel} <ChevronRight size={16} />
            </button>
          )}
          {!hideClose && onClose && (
            <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-theme-subtle/10">
              <X size={20} />
            </button>
          )}
        </div>
      </div>

      {showSaveTemplate && (
        <div className="px-6 py-3 border-b border-theme-border bg-curi-pink/5 flex gap-2 items-center">
          <input
            className="input text-sm flex-1 max-w-xs"
            placeholder="Template name"
            value={templateName}
            onChange={e => setTemplateName(e.target.value)}
          />
          <button type="button" onClick={saveAsTemplate} className="btn-primary text-sm">Save Template</button>
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        {!hideAssetSidebar && (
        <div className="w-72 border-r border-theme-border flex flex-col flex-shrink-0 min-h-0">
          <div className="flex border-b border-theme-border p-1 gap-1 flex-shrink-0">
            {['templates', 'pexels'].map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setSidebarTab(tab)}
                className={`flex-1 py-2 rounded-lg text-xs font-bold capitalize ${
                  sidebarTab === tab ? 'bg-curi-pink/15 text-curi-pink' : 'text-theme-muted/50 hover:bg-theme-subtle/5'
                }`}
              >
                {tab === 'pexels' ? 'Stock Media' : 'Templates'}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto p-4 min-h-0">
          {sidebarTab === 'pexels' ? (
            <PexelsMediaPanel
              workspaceId={workspaceId}
              compact
              embedded
              onPhotoSelect={(item, useAs) => {
                setCanvas((prev) => applyPexelsPhotoToCanvas(prev, item.url, useAs))
                toast.success(useAs === 'background' ? 'Background updated' : 'Photo layer added')
              }}
              onVideoSelect={(item) => {
                setCanvas((prev) => ({
                  ...prev,
                  background: {
                    type: 'video',
                    url: item.url,
                    poster: item.thumbnailUrl,
                    overlay: 'rgba(0,0,0,0.25)',
                  },
                }))
                toast.success('Video background applied')
              }}
            />
          ) : (
          <div className="space-y-4">
          <div className="text-xs font-semibold text-theme-muted/40 uppercase tracking-wider">Templates</div>
          <div className="space-y-2">
            {BUILTIN_TEMPLATES.map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => applyTemplate(t.id)}
                className={`w-full text-left p-2.5 rounded-xl border transition-all text-xs ${
                  canvas.templateId === t.id ? 'border-curi-pink bg-curi-pink/10' : 'border-theme-border hover:border-curi-pink/30'
                }`}
              >
                <div className="font-bold text-theme-text">{t.name}</div>
                <div className="text-theme-muted/40 mt-0.5">{t.description}</div>
              </button>
            ))}
          </div>
          {userTemplates.length > 0 && (
            <>
              <div className="text-xs font-semibold text-theme-muted/40 uppercase tracking-wider pt-2">Your Templates</div>
              <div className="space-y-2">
                {userTemplates.map(t => (
                  <button
                    key={t._id}
                    type="button"
                    onClick={() => applyTemplate(null, {
                      name: t.name,
                      placements: t.canvasLayout?.placements,
                    })}
                    className="w-full text-left p-2.5 rounded-xl border border-theme-border hover:border-curi-blue/30 text-xs"
                  >
                    <div className="font-bold text-theme-text">{t.name}</div>
                  </button>
                ))}
              </div>
            </>
          )}
          </div>
          )}
          </div>
        </div>
        )}

        {/* Canvas area */}
        <div ref={containerRef} className="flex-1 flex items-center justify-center p-6 bg-theme-subtle/5 overflow-auto">
          <div className="relative shadow-2xl rounded-lg overflow-hidden ring-1 ring-black/10">
            <div
              ref={canvasFocusRef}
              tabIndex={0}
              className="relative outline-none focus-visible:ring-2 focus-visible:ring-curi-pink/40 rounded-lg"
              onPointerDown={(e) => {
                canvasFocusRef.current?.focus({ preventScroll: true })
                if (e.target === e.currentTarget) setSelectedId(null)
              }}
            >
              <DesignCanvasRenderer
                canvas={canvas}
                scale={scale}
                selectedId={null}
                onSelect={setSelectedId}
                interactive
              />
              {canvas.elements.filter(e => e.visible !== false && e.id !== selectedId).map(el => {
                const bounds = getElementBounds(el)
                return (
                  <div
                    key={`hit-${el.id}`}
                    className="absolute"
                    style={{
                      left: el.x * scale,
                      top: el.y * scale,
                      width: Math.max(bounds.width * scale, 24),
                      height: Math.max(bounds.height * scale, 24),
                      cursor: 'pointer',
                      zIndex: 10,
                    }}
                    onPointerDown={e => onPointerDown(e, el.id)}
                  />
                )
              })}
              {selected && canResizeElement(selected) && (() => {
                const bounds = getElementBounds(selected)
                return (
                  <div
                    className="absolute"
                    style={{
                      left: selected.x * scale,
                      top: selected.y * scale,
                      width: bounds.width * scale,
                      height: bounds.height * scale,
                      zIndex: 20,
                    }}
                  >
                    {isSpeakableLayer && (
                      <div
                        className="absolute left-1/2 -translate-x-1/2 flex gap-1.5 z-40 pointer-events-auto"
                        style={{ top: -40 }}
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            onOpenCharactersPanel?.('talk', getSpeakableLayerContext())
                          }}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-curi-blue text-white text-[10px] font-bold shadow-clay-sm hover:opacity-90"
                        >
                          <Mic size={12} /> Make speak
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            onOpenCharactersPanel?.('upload', getSpeakableLayerContext())
                          }}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-theme-surface border border-theme-border text-theme-text text-[10px] font-bold shadow-clay-sm hover:border-curi-pink/40"
                        >
                          <Upload size={12} /> Upload photo
                        </button>
                      </div>
                    )}
                    <div
                      className="absolute inset-0 border-2 border-curi-pink shadow-[0_0_0_1px_rgba(255,107,157,0.25)] pointer-events-none"
                    />
                    <div
                      className="absolute inset-0 cursor-move"
                      style={{ margin: HANDLE_PX }}
                      onPointerDown={e => onPointerDown(e, selected.id)}
                    />
                    {RESIZE_HANDLES.map((handle) => (
                      <div
                        key={handle}
                        role="presentation"
                        className="absolute bg-white border-2 border-curi-pink rounded-sm shadow-sm hover:bg-curi-pink/10 z-30"
                        style={{
                          ...resizeHandleStyle(handle, HANDLE_PX),
                          cursor: resizeHandleCursor(handle),
                        }}
                        onPointerDown={e => onResizePointerDown(e, selected.id, handle)}
                      />
                    ))}
                  </div>
                )
              })()}
              {selected && !canResizeElement(selected) && (
                <div
                  className="absolute border-2 border-curi-pink border-dashed pointer-events-none"
                  style={{
                    left: selected.x * scale,
                    top: selected.y * scale,
                    width: getElementBounds(selected).width * scale,
                    height: getElementBounds(selected).height * scale,
                    zIndex: 20,
                  }}
                />
              )}
            </div>
          </div>
        </div>

        {/* Properties panel */}
        <div className={`${isSpeakableLayer ? 'w-80' : 'w-64'} border-l border-theme-border p-4 overflow-y-auto flex-shrink-0 space-y-4 transition-all`}>
          <div className="text-xs font-semibold text-theme-muted/40 uppercase tracking-wider">Layers</div>
          <div className="space-y-1">
            {canvas.elements.map(el => (
              <button
                key={el.id}
                type="button"
                onClick={() => setSelectedId(el.id)}
                className={`w-full text-left px-2 py-1.5 rounded-lg text-xs font-medium capitalize ${
                  selectedId === el.id ? 'bg-curi-pink/15 text-curi-pink' : 'hover:bg-theme-subtle/5 text-theme-muted/60'
                }`}
              >
                {el.id}
              </button>
            ))}
          </div>

          {canvas.audio && (
            <div className="pt-2 border-t border-theme-border space-y-2">
              <div className="text-xs font-semibold text-theme-muted/40 uppercase tracking-wider">Audio</div>
              <div className="card p-2 space-y-2">
                <div className="flex items-center gap-2 text-xs">
                  <Volume2 size={14} className="text-curi-green flex-shrink-0" />
                  <span className="font-medium text-theme-text truncate flex-1">{canvas.audio.name}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const src = getCanvasAudioUrl(canvas.audio)
                      if (src) new Audio(src).play()
                    }}
                    className="btn-secondary flex-1 text-[10px] py-1 flex items-center justify-center gap-1"
                  >
                    <Play size={12} /> Play
                  </button>
                  <button
                    type="button"
                    onClick={removeAudio}
                    className="btn-secondary text-[10px] py-1 px-2 text-red-500"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
                {canvas.audio.script && (
                  <p className="text-[10px] text-theme-muted/50 line-clamp-2">{canvas.audio.script}</p>
                )}
              </div>
            </div>
          )}

          <button type="button" onClick={addTextLayer} className="btn-secondary w-full text-xs flex items-center justify-center gap-1">
            <Plus size={14} /> Add Text
          </button>

          {selected && (
            <div className="space-y-3 pt-2 border-t border-theme-border">
              <div className="text-xs font-semibold text-theme-muted/40 uppercase tracking-wider">Properties</div>
              {(selected.type === 'text' || selected.type === 'button' || selected.type === 'badge') && (
                <div>
                  <label className="text-[10px] text-theme-muted/40 font-bold uppercase">Text</label>
                  <textarea
                    className="input text-sm mt-1 h-16 resize-none"
                    value={selected.text}
                    onChange={e => updateElement(selected.id, { text: e.target.value })}
                  />
                </div>
              )}
              <div>
                <label className="text-[10px] text-theme-muted/40 font-bold uppercase">X / Y</label>
                <div className="flex gap-2 mt-1">
                  <input type="number" className="input text-sm" value={selected.x}
                    onChange={e => updateElement(selected.id, { x: Number(e.target.value) })} />
                  <input type="number" className="input text-sm" value={selected.y}
                    onChange={e => updateElement(selected.id, { y: Number(e.target.value) })} />
                </div>
              </div>
              {canResizeElement(selected) && (
                <div>
                  <label className="text-[10px] text-theme-muted/40 font-bold uppercase">Width / Height</label>
                  <div className="flex gap-2 mt-1">
                    <input
                      type="number"
                      className="input text-sm"
                      value={getElementBounds(selected).width}
                      onChange={e => updateElement(selected.id, { width: Number(e.target.value) })}
                    />
                    <input
                      type="number"
                      className="input text-sm"
                      value={getElementBounds(selected).height}
                      onChange={e => updateElement(selected.id, { height: Number(e.target.value) })}
                    />
                  </div>
                  <p className="text-[10px] text-theme-muted/45 mt-1">Drag corner or edge handles on canvas to resize</p>
                </div>
              )}
              {(selected.type === 'text' || selected.type === 'badge') && (
                <>
                  <div>
                    <label className="text-[10px] text-theme-muted/40 font-bold uppercase">Font Style</label>
                    <select
                      className="input text-sm mt-1"
                      value={fontFamilyToId(selected.fontFamily)}
                      onChange={(e) => updateElement(selected.id, { fontFamily: resolveCanvasFont(e.target.value) })}
                    >
                      {CANVAS_FONTS.map((font) => (
                        <option key={font.id} value={font.id}>{font.label} — {font.category}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-theme-muted/40 font-bold uppercase">Font Weight</label>
                    <select
                      className="input text-sm mt-1"
                      value={selected.fontWeight || 600}
                      onChange={(e) => updateElement(selected.id, { fontWeight: Number(e.target.value) })}
                    >
                      {FONT_WEIGHTS.map((w) => (
                        <option key={w.value} value={w.value}>{w.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-theme-muted/40 font-bold uppercase">Font Size</label>
                    <input type="number" className="input text-sm mt-1" value={selected.fontSize}
                      onChange={e => updateElement(selected.id, { fontSize: Number(e.target.value) })} />
                  </div>
                  <div>
                    <label className="text-[10px] text-theme-muted/40 font-bold uppercase">Color</label>
                    <input type="color" className="w-full h-9 mt-1 rounded-lg cursor-pointer"
                      value={selected.color?.startsWith('#') ? selected.color : '#ffffff'}
                      onChange={e => updateElement(selected.id, { color: e.target.value })} />
                  </div>
                  {selected.type === 'text' && (
                    <div>
                      <label className="text-[10px] text-theme-muted/40 font-bold uppercase">Align</label>
                      <select className="input text-sm mt-1" value={selected.align || 'left'}
                        onChange={e => updateElement(selected.id, { align: e.target.value })}>
                        <option value="left">Left</option>
                        <option value="center">Center</option>
                        <option value="right">Right</option>
                      </select>
                    </div>
                  )}
                </>
              )}
              {selected.type === 'button' && (
                <>
                  <div>
                    <label className="text-[10px] text-theme-muted/40 font-bold uppercase">Font Style</label>
                    <select
                      className="input text-sm mt-1"
                      value={fontFamilyToId(selected.fontFamily)}
                      onChange={(e) => updateElement(selected.id, { fontFamily: resolveCanvasFont(e.target.value) })}
                    >
                      {CANVAS_FONTS.map((font) => (
                        <option key={font.id} value={font.id}>{font.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-theme-muted/40 font-bold uppercase">Button Color</label>
                  <input type="color" className="w-full h-9 mt-1 rounded-lg cursor-pointer"
                    value={selected.bgColor || '#ffffff'}
                    onChange={e => updateElement(selected.id, { bgColor: e.target.value })} />
                  </div>
                </>
              )}
              {!['headline', 'subheadline', 'cta', 'badge'].includes(selected.id) && (
                <button type="button" onClick={deleteSelected} className="text-xs text-red-400 flex items-center gap-1 hover:underline">
                  <Trash2 size={12} /> Delete layer
                </button>
              )}

              {isSpeakableLayer && selectedLayerImageUrl && (
                <div className="space-y-2 pt-2 border-t border-theme-border">
                  <div className="text-xs font-semibold text-theme-muted/40 uppercase tracking-wider flex items-center gap-1.5">
                    <Mic size={12} className="text-curi-blue" />
                    Make character speak
                  </div>
                  <p className="text-[10px] text-theme-muted/50 leading-snug">
                    Write a script, generate voice, create a talking video — or upload a real portrait.
                  </p>
                  <TalkingCharacterStudio
                    workspaceId={workspaceId}
                    initialCharacter={selectedCharacter}
                    initialImageUrl={selectedLayerImageUrl}
                    initialScript={selected.script || ''}
                    applyLabel={selected.type === 'talking-character' ? 'Update voice & video' : 'Apply to this character'}
                    onAddToCanvas={applyTalkToSelected}
                  />
                </div>
              )}
            </div>
          )}

          <div className="pt-2 border-t border-theme-border space-y-2">
            <div className="text-xs font-semibold text-theme-muted/40 uppercase tracking-wider">Background</div>
            {canvas.background?.type === 'image' || canvas.background?.type === 'video' ? (
              <p className="text-[10px] text-theme-muted/50">
                {canvas.background.type === 'video' ? 'Stock video' : 'Stock photo'} background — adjust overlay below
              </p>
            ) : null}
            {canvas.background?.type !== 'image' && canvas.background?.type !== 'video' && (
            <div className="flex gap-2">
              <input type="color" className="w-full h-9 rounded-lg cursor-pointer"
                value={canvas.background?.colors?.[0] || '#FF6B9D'}
                onChange={e => setCanvas(prev => ({
                  ...prev,
                  background: { ...prev.background, colors: [e.target.value, prev.background?.colors?.[1] || e.target.value] },
                }))} />
              <input type="color" className="w-full h-9 rounded-lg cursor-pointer"
                value={canvas.background?.colors?.[1] || '#4DA8EE'}
                onChange={e => setCanvas(prev => ({
                  ...prev,
                  background: { ...prev.background, colors: [prev.background?.colors?.[0] || '#FF6B9D', e.target.value] },
                }))} />
            </div>
            )}
            {(canvas.background?.type === 'image' || canvas.background?.type === 'video') && (
              <div>
                <label className="text-[10px] text-theme-muted/40 font-bold uppercase">Overlay darkness</label>
                <input
                  type="range"
                  min="0"
                  max="80"
                  className="w-full mt-1"
                  value={Math.round(parseFloat(String(canvas.background?.overlay || 'rgba(0,0,0,0.38)').match(/[\d.]+$/)?.[0] || 0.38) * 100)}
                  onChange={(e) => {
                    const opacity = Number(e.target.value) / 100
                    setCanvas((prev) => ({
                      ...prev,
                      background: { ...prev.background, overlay: `rgba(0,0,0,${opacity})` },
                    }))
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
})
