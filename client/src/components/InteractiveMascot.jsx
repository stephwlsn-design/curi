import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const IDLE_MESSAGES = [
  "Hi! I'm Curi. Drop a URL and I'll build your whole brand.",
  'One link in — posts, ads, emails and videos out.',
  'Try the free Roast tool for an honest website audit.',
  '12M+ pieces of content generated. Your turn.',
  'Click me again for more tips.',
]

const CLICK_REACTIONS = [
  'Ready to launch your brand?',
  '20 posts in one click.',
  'I can extract your brand DNA from any URL.',
  'Your competitors wish they had Curi.',
]

const ORBS = [
  { color: 'bg-curi-pink', size: 'w-5 h-5', x: -80, y: -60, delay: 0 },
  { color: 'bg-curi-blue', size: 'w-4 h-4', x: 90, y: -40, delay: 0.5 },
  { color: 'bg-curi-yellow', size: 'w-6 h-6', x: -60, y: 70, delay: 1 },
  { color: 'bg-curi-pink', size: 'w-3 h-3', x: 70, y: 80, delay: 1.5 },
]

export default function InteractiveMascot({ size = 'lg', className = '' }) {
  const containerRef = useRef(null)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  const [isHovered, setIsHovered] = useState(false)
  const [isPressed, setIsPressed] = useState(false)
  const [message, setMessage] = useState(IDLE_MESSAGES[0])
  const [clickIndex, setClickIndex] = useState(0)
  const [, setIdleIndex] = useState(0)
  const [showBubble, setShowBubble] = useState(true)

  const sizeMap = {
    sm: 'w-32 h-32',
    md: 'w-48 h-48',
    lg: 'w-64 h-64',
    xl: 'w-80 h-80',
  }

  const handleMouseMove = useCallback((e) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const centerY = rect.top + rect.height / 2
    const deltaX = (e.clientX - centerX) / (rect.width / 2)
    const deltaY = (e.clientY - centerY) / (rect.height / 2)
    setTilt({
      x: Math.max(-12, Math.min(12, -deltaY * 10)),
      y: Math.max(-12, Math.min(12, deltaX * 10)),
    })
  }, [])

  const handleMouseLeave = () => {
    setIsHovered(false)
    setTilt({ x: 0, y: 0 })
  }

  const handleClick = () => {
    setMessage(CLICK_REACTIONS[clickIndex % CLICK_REACTIONS.length])
    setClickIndex(i => i + 1)
    setShowBubble(true)
  }

  useEffect(() => {
    const interval = setInterval(() => {
      if (!isHovered) {
        setIdleIndex(i => {
          const next = (i + 1) % IDLE_MESSAGES.length
          setMessage(IDLE_MESSAGES[next])
          setShowBubble(true)
          return next
        })
      }
    }, 6000)
    return () => clearInterval(interval)
  }, [isHovered])

  return (
    <div
      ref={containerRef}
      className={`relative select-none ${className}`}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      aria-label="Interactive Curi mascot — click for tips"
      onKeyDown={(e) => e.key === 'Enter' && handleClick()}
    >
      {ORBS.map((orb, i) => (
        <motion.span
          key={i}
          className={`absolute rounded-full ${orb.color} ${orb.size} shadow-clay-sm pointer-events-none`}
          style={{ left: '50%', top: '50%' }}
          animate={{
            x: orb.x + tilt.y * 1.5,
            y: orb.y + tilt.x * 1.5,
            scale: isHovered ? 1.15 : 1,
          }}
          transition={{ type: 'spring', stiffness: 120, damping: 15, delay: orb.delay * 0.1 }}
        />
      ))}

      <AnimatePresence mode="wait">
        {showBubble && (
          <motion.div
            key={message}
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            className="absolute -top-4 left-1/2 -translate-x-1/2 -translate-y-full z-20 w-56 sm:w-64"
          >
            <div className="card px-4 py-3 text-center shadow-clay relative">
              <p className="text-sm font-bold text-theme-text leading-snug">{message}</p>
              <div className="absolute left-1/2 -translate-x-1/2 -bottom-2 w-4 h-4 rotate-45 bg-theme-card border-r border-b border-theme-border" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div
        className="relative cursor-pointer"
        style={{ perspective: 800 }}
        animate={{
          rotateX: tilt.x,
          rotateY: tilt.y,
          scale: isPressed ? 0.92 : isHovered ? 1.05 : 1,
          y: isHovered ? -8 : [0, -10, 0],
        }}
        transition={
          isHovered
            ? { rotateX: { type: 'spring', stiffness: 200, damping: 20 }, rotateY: { type: 'spring', stiffness: 200, damping: 20 }, scale: { duration: 0.15 }, y: { duration: 0.15 } }
            : { rotateX: { type: 'spring', stiffness: 200, damping: 20 }, rotateY: { type: 'spring', stiffness: 200, damping: 20 }, y: { duration: 4, repeat: Infinity, ease: 'easeInOut' } }
        }
      >
        <motion.img
          src="/images/curi-mascot.png"
          alt="Curi mascot"
          className={`${sizeMap[size]} object-contain drop-shadow-clay mx-auto pointer-events-none`}
          draggable={false}
          animate={isPressed ? { rotate: [0, -3, 3, 0] } : {}}
          transition={{ duration: 0.4 }}
        />
      </motion.div>

      <p className="text-center text-sm text-theme-muted/40 mt-4 font-semibold">
        {isHovered ? 'Click me' : 'Hover and click to interact'}
      </p>
    </div>
  )
}
