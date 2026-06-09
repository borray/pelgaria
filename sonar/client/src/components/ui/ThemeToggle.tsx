import { IconMoon, IconSun } from '@tabler/icons-react'
import { useThemeStore } from '../../store/theme'

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const theme = useThemeStore((state) => state.theme)
  const toggleTheme = useThemeStore((state) => state.toggleTheme)
  const dark = theme === 'dark'

  return (
    <button
      type="button"
      className={`theme-toggle${compact ? ' is-compact' : ''}`}
      onClick={toggleTheme}
      title={dark ? 'Включить светлую тему' : 'Включить тёмную тему'}
      aria-label={dark ? 'Включить светлую тему' : 'Включить тёмную тему'}
    >
      {dark ? <IconSun size={16} /> : <IconMoon size={16} />}
      {!compact && <span>{dark ? 'Светлая тема' : 'Тёмная тема'}</span>}
    </button>
  )
}
