import { useState } from 'react'

export function useSessionView(key: string, initialValue: string) {
  const [value, setValue] = useState(() => {
    try {
      return sessionStorage.getItem(`vcm-view:${key}`) ?? initialValue
    } catch {
      return initialValue
    }
  })
  return [
    value,
    (next: string) => {
      setValue(next)
      try {
        sessionStorage.setItem(`vcm-view:${key}`, next)
      } catch {
        /* The view remains usable without persistence. */
      }
    },
  ] as const
}
