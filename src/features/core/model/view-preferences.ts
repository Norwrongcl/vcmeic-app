import { useCallback, useState } from 'react'

export type EntityViewMode = 'table' | 'cards' | 'kanban'

type ViewStorage = Pick<Storage, 'getItem' | 'setItem'>

const fallbackStorage: ViewStorage = {
  getItem: () => null,
  setItem: () => undefined,
}

function defaultStorage(): ViewStorage {
  return typeof window === 'undefined' ? fallbackStorage : window.localStorage
}

export function viewPreferenceKey(module: string) {
  return `vcmeic-view-${module}`
}

export function readViewPreference(
  storage: ViewStorage,
  module: string,
  allowedModes: readonly EntityViewMode[]
): EntityViewMode {
  const saved = storage.getItem(
    viewPreferenceKey(module)
  ) as EntityViewMode | null
  return saved && allowedModes.includes(saved) ? saved : 'table'
}

export function writeViewPreference(
  storage: ViewStorage,
  module: string,
  mode: EntityViewMode
) {
  storage.setItem(viewPreferenceKey(module), mode)
}

export function useEntityViewPreference(
  module: string,
  allowedModes: readonly EntityViewMode[]
) {
  const [mode, setModeState] = useState<EntityViewMode>(() =>
    readViewPreference(defaultStorage(), module, allowedModes)
  )

  const setMode = useCallback(
    (nextMode: EntityViewMode) => {
      if (!allowedModes.includes(nextMode)) return
      writeViewPreference(defaultStorage(), module, nextMode)
      setModeState(nextMode)
    },
    [allowedModes, module]
  )

  return [mode, setMode] as const
}
