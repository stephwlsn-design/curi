import { motion } from 'framer-motion'
import { Sun, Moon } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'

export default function ThemeToggle({ className = '' }) {
  const { isDark, toggleTheme } = useTheme()

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      className={`relative w-[3.25rem] h-8 rounded-full border transition-colors duration-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-curi-pink/50 ${
        isDark
          ? 'bg-curi-navy-card border-curi-navy-border'
          : 'bg-curi-pink-soft/50 border-curi-pink/25'
      } ${className}`}
    >
      <span className="absolute inset-0 flex items-center justify-between px-2 pointer-events-none text-theme-muted/50">
        <Sun className="w-3 h-3" />
        <Moon className="w-3 h-3" />
      </span>
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 500, damping: 32 }}
        className={`absolute top-1 w-6 h-6 rounded-full shadow-clay-sm ${
          isDark
            ? 'left-[calc(100%-1.75rem)] bg-gradient-to-br from-curi-pink to-curi-blue'
            : 'left-1 bg-curi-yellow'
        }`}
      />
    </button>
  )
}
