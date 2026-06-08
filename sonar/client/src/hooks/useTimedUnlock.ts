import { useEffect, useRef, useState } from 'react'

export function useTimedUnlock(active: boolean, delay = 4) {
  const [secondsLeft, setSecondsLeft] = useState(delay)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    if (!active) {
      setSecondsLeft(delay)
      return
    }
    setSecondsLeft(delay)
    intervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [active, delay])

  return { unlocked: secondsLeft === 0, secondsLeft }
}
