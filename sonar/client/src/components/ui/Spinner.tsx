
interface SpinnerProps {
  size?: number
  color?: string
}

export function Spinner({ size = 24, color = '#14715A' }: SpinnerProps) {
  return (
    <div
      style={{
        width: size,
        height: size,
        border: `2px solid ${color}33`,
        borderTop: `2px solid ${color}`,
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }}
    />
  )
}

// Inject keyframes once
if (typeof document !== 'undefined') {
  const styleId = 'sonar-spinner-keyframes'
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style')
    style.id = styleId
    style.textContent = `@keyframes spin { to { transform: rotate(360deg); } }`
    document.head.appendChild(style)
  }
}
