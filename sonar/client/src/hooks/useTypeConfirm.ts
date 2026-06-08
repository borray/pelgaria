import { useEffect, useState } from 'react'
import type { ChangeEvent } from 'react'

export function useTypeConfirm(expected: string, active: boolean) {
  const [value, setValue] = useState('')

  useEffect(() => {
    if (!active) setValue('')
  }, [active])

  return {
    confirmed: expected.length > 0 && value.trim() === expected.trim(),
    value,
    onChange: (e: ChangeEvent<HTMLInputElement>) => setValue(e.target.value),
  }
}
