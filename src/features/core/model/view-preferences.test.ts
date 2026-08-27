import { describe, expect, it } from 'vitest'
import {
  readViewPreference,
  viewPreferenceKey,
  writeViewPreference,
} from './view-preferences'

function createMemoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  }
}

describe('entity view preferences', () => {
  it('uses table when no preference has been saved', () => {
    const storage = createMemoryStorage()

    expect(
      readViewPreference(storage, 'activities', ['table', 'cards', 'kanban'])
    ).toBe('table')
  })

  it('persists a valid preference for one module', () => {
    const storage = createMemoryStorage()

    writeViewPreference(storage, 'activities', 'cards')

    expect(storage.getItem(viewPreferenceKey('activities'))).toBe('cards')
    expect(
      readViewPreference(storage, 'activities', ['table', 'cards', 'kanban'])
    ).toBe('cards')
  })

  it('falls back to table when a module does not allow the saved mode', () => {
    const storage = createMemoryStorage({
      [viewPreferenceKey('partners')]: 'kanban',
    })

    expect(readViewPreference(storage, 'partners', ['table', 'cards'])).toBe(
      'table'
    )
  })
})
