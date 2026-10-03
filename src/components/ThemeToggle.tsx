import { useTheme } from '../lib/theme'
import { MoonIcon, SunIcon } from './icons'

// Sun/moon switch. Colours come from the caller so it can sit on the hero
// image (white) as well as on regular surfaces.
export default function ThemeToggle({ className = '' }: { className?: string }) {
  const { theme, toggle } = useTheme()
  const dark = theme === 'dark'
  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label="Dark mode"
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={toggle}
      className={`rounded-full p-2.5 transition-colors ${className}`}
    >
      {dark ? <SunIcon /> : <MoonIcon />}
    </button>
  )
}
