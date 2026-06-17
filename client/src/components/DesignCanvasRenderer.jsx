export default function DesignCanvasRenderer({ canvas, scale = 1, selectedId, onSelect, interactive = false }) {
  if (!canvas) return null

  const { width, height, background, elements, audio } = canvas
  const bgStyle = background?.type === 'gradient'
    ? { background: `linear-gradient(${background.angle || 135}deg, ${background.colors?.[0]} 0%, ${background.colors?.[1] || background.colors?.[0]} 100%)` }
    : (background?.type === 'image' || background?.type === 'video')
      ? {}
      : { background: background?.color || '#FF6B9D' }

  const sortedElements = [...elements].sort((a, b) => (a.zIndex ?? 2) - (b.zIndex ?? 2))

  const scaledW = width * scale
  const scaledH = height * scale

  return (
    <div
      className="relative overflow-hidden select-none"
      style={{ width: scaledW, height: scaledH, ...bgStyle }}
      onClick={interactive ? () => onSelect?.(null) : undefined}
    >
      {background?.type === 'image' && background.url && (
        <>
          <img
            src={background.url}
            alt=""
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            draggable={false}
          />
          {background.overlay && (
            <div className="absolute inset-0 pointer-events-none" style={{ background: background.overlay }} />
          )}
        </>
      )}
      {background?.type === 'video' && (background.poster || background.url) && (
        <>
          <img
            src={background.poster || background.url}
            alt=""
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            draggable={false}
          />
          {background.overlay && (
            <div className="absolute inset-0 pointer-events-none" style={{ background: background.overlay }} />
          )}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[1]">
            <div
              className="rounded-full bg-white/90 flex items-center justify-center shadow-lg"
              style={{ width: 56 * scale, height: 56 * scale }}
            >
              <div
                style={{
                  width: 0,
                  height: 0,
                  borderTop: `${10 * scale}px solid transparent`,
                  borderBottom: `${10 * scale}px solid transparent`,
                  borderLeft: `${16 * scale}px solid #1A2B48`,
                  marginLeft: 4 * scale,
                }}
              />
            </div>
          </div>
        </>
      )}
      {sortedElements.filter(el => el.visible !== false).map(el => {
        const isSelected = selectedId === el.id
        const base = {
          position: 'absolute',
          left: el.x * scale,
          top: el.y * scale,
          width: el.width * scale,
          cursor: interactive ? 'move' : 'default',
          outline: isSelected && !interactive ? '2px solid #FF6B9D' : 'none',
          outlineOffset: 2,
          zIndex: el.zIndex ?? 2,
        }

        if (el.type === 'image' || el.type === 'character') {
          return (
            <img
              key={el.id}
              src={el.url}
              alt={el.name || ''}
              draggable={false}
              style={{
                ...base,
                height: (el.height || el.width) * scale,
                objectFit: el.type === 'character' ? 'contain' : 'cover',
                borderRadius: (el.borderRadius || 0) * scale,
              }}
            />
          )
        }

        if (el.type === 'talking-character') {
          if (el.videoUrl) {
            return (
              <video
                key={el.id}
                src={el.videoUrl}
                poster={el.posterUrl || el.url}
                controls={interactive}
                playsInline
                loop
                muted={false}
                draggable={false}
                style={{
                  ...base,
                  height: (el.height || el.width) * scale,
                  objectFit: 'contain',
                  borderRadius: 8 * scale,
                }}
                onClick={interactive ? (e) => { e.stopPropagation(); onSelect?.(el.id) } : undefined}
              />
            )
          }
          return (
            <div
              key={el.id}
              style={{
                ...base,
                height: (el.height || el.width) * scale,
              }}
              onClick={interactive ? (e) => {
                e.stopPropagation()
                onSelect?.(el.id)
                if (el.audioDataUrl) {
                  const audio = new Audio(el.audioDataUrl)
                  audio.play().catch(() => {})
                }
              } : undefined}
            >
              <img
                src={el.url}
                alt={el.name || ''}
                draggable={false}
                className="w-full h-full object-contain"
              />
              {el.audioDataUrl && (
                <div
                  className="absolute bottom-1 right-1 rounded-full bg-curi-green/90 text-white p-1 pointer-events-none"
                  style={{ width: 20 * scale, height: 20 * scale }}
                >
                  <span style={{ fontSize: 10 * scale }}>▶</span>
                </div>
              )}
            </div>
          )
        }

        if (el.type === 'shape') {
          return (
            <div
              key={el.id}
              style={{
                ...base,
                height: (el.height || el.width) * scale,
                background: el.fill || 'rgba(255,255,255,0.15)',
                borderRadius: (el.borderRadius || 0) * scale,
                width: el.width * scale,
              }}
            />
          )
        }

        if (el.type === 'badge') {
          return (
            <div
              key={el.id}
              style={{ ...base, width: 'auto', maxWidth: el.width * scale }}
              onClick={interactive ? e => { e.stopPropagation(); onSelect?.(el.id) } : undefined}
              className="px-2 py-1 rounded-md bg-white/20 backdrop-blur-sm text-white font-bold uppercase tracking-wide"
              data-element-id={el.id}
            >
              <span style={{ fontSize: (el.fontSize || 12) * scale }}>{el.text}</span>
            </div>
          )
        }

        if (el.type === 'button') {
          return (
            <div
              key={el.id}
              style={{
                ...base,
                background: el.bgColor || '#fff',
                color: el.color || '#1A2B48',
                borderRadius: 999 * scale,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: `${8 * scale}px ${16 * scale}px`,
                width: 'auto',
                minWidth: el.width * scale,
                fontWeight: el.fontWeight || 700,
                fontSize: (el.fontSize || 14) * scale,
              }}
              onClick={interactive ? e => { e.stopPropagation(); onSelect?.(el.id) } : undefined}
              data-element-id={el.id}
            >
              {el.text}
            </div>
          )
        }

        return (
          <div
            key={el.id}
            style={{
              ...base,
              color: el.color || '#fff',
              fontSize: (el.fontSize || 24) * scale,
              fontWeight: el.fontWeight || 600,
              textAlign: el.align || 'left',
              lineHeight: 1.15,
              textShadow: '0 1px 8px rgba(0,0,0,0.2)',
            }}
            onClick={interactive ? e => { e.stopPropagation(); onSelect?.(el.id) } : undefined}
            data-element-id={el.id}
          >
            {el.text}
          </div>
        )
      })}
      {audio && (audio.url || audio.dataUrl) && (
        <div
          className="absolute bottom-2 right-2 z-20 flex items-center gap-1 px-2 py-1 rounded-full bg-black/65 text-white pointer-events-none"
          style={{ fontSize: Math.max(9, 10 * scale) }}
        >
          ♪ {audio.name}
        </div>
      )}
    </div>
  )
}
