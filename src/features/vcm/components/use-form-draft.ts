import { useEffect, useRef, useState } from 'react'

type SavedControl = { name: string; value: string; checked?: boolean }
const prefix = 'vcm-form-draft:'
function read(key?: string): SavedControl[] | null {
  if (!key) return null
  try {
    const value: unknown = JSON.parse(
      sessionStorage.getItem(prefix + key) ?? 'null'
    )
    return Array.isArray(value) &&
      value.every(
        (v) => v && typeof v.name === 'string' && typeof v.value === 'string'
      )
      ? value
      : null
  } catch {
    return null
  }
}
function controls(form: HTMLFormElement) {
  return Array.from(form.elements).filter(
    (el): el is HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement =>
      (el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        el instanceof HTMLSelectElement) &&
      !!el.name &&
      !['file', 'password'].includes(el.type)
  )
}
export function useFormDraft(key?: string, disabled = false) {
  const ref = useRef<HTMLFormElement>(null)
  const [initial] = useState(() => (disabled ? null : read(key)))
  const [dirty, setDirty] = useState(!!initial)
  const [unavailable, setUnavailable] = useState(false)
  useEffect(() => {
    if (!initial || !ref.current || disabled) return
    for (const el of controls(ref.current)) {
      const saved = initial.find(
        (v) =>
          v.name === el.name &&
          ((el.type !== 'checkbox' && el.type !== 'radio') ||
            v.value === el.value)
      )
      if (!saved) continue
      if (
        el instanceof HTMLInputElement &&
        ['checkbox', 'radio'].includes(el.type)
      )
        el.checked = !!saved.checked
      else el.value = saved.value
    }
  }, [initial, disabled])
  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])
  function clear() {
    try {
      if (key) sessionStorage.removeItem(prefix + key)
    } catch {
      /* Saving remains available without draft storage. */
    }
    setDirty(false)
  }
  function persist() {
    if (!key || !ref.current || disabled) return
    const values = controls(ref.current).map((el) => ({
      name: el.name,
      value: el.value,
      ...(el instanceof HTMLInputElement &&
      ['checkbox', 'radio'].includes(el.type)
        ? { checked: el.checked }
        : {}),
    }))
    setDirty(true)
    try {
      sessionStorage.setItem(prefix + key, JSON.stringify(values))
      setUnavailable(false)
    } catch {
      setUnavailable(true)
    }
  }
  // Remove before the command triggers a version/remount; restore on failure.
  function suspend() {
    if (!key) return null
    try {
      const saved = sessionStorage.getItem(prefix + key)
      sessionStorage.removeItem(prefix + key)
      return saved
    } catch {
      return null
    }
  }
  function restore(raw: string | null) {
    try {
      if (key && raw) sessionStorage.setItem(prefix + key, raw)
    } catch {
      setUnavailable(true)
    }
  }
  return { ref, dirty, unavailable, persist, clear, suspend, restore }
}
