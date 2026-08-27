import { beforeEach, describe, expect, it } from 'vitest'
import { createEventsStore, EVENTS_STORAGE_KEY } from './events-store'
import {
  getEventDeletionImpact,
  getEventFinancials,
  getTasksForEvent,
} from './selectors'

function createMemoryStorage() {
  const values = new Map<string, string>()

  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  }
}

describe('events store', () => {
  let nextId = 0

  beforeEach(() => {
    nextId = 0
  })

  const idFactory = () => `generated-${++nextId}`

  it('calculates event totals and exposes over-budget execution', () => {
    const store = createEventsStore({
      storage: createMemoryStorage(),
      idFactory,
      initialData: { events: {}, tasks: {}, budgetItems: {}, expenses: {} },
    })

    const eventId = store.getState().addEvent({
      name: 'Encuentro territorial',
      description: '',
      status: 'planned',
      startsAt: '2026-09-10T09:00',
      endsAt: '2026-09-10T18:00',
      location: 'Valparaíso',
      owner: 'Ana Pérez',
    })
    const venueId = store.getState().addBudgetItem({
      eventId,
      name: 'Espacio',
      plannedAmount: 100_000,
    })
    store.getState().addBudgetItem({
      eventId,
      name: 'Difusión',
      plannedAmount: 50_000,
    })
    store.getState().addExpense({
      eventId,
      budgetItemId: venueId,
      concept: 'Arriendo',
      date: '2026-09-01',
      amount: 120_000,
      supplier: 'Centro Cultural',
      reference: 'OC-20',
    })

    expect(getEventFinancials(store.getState(), eventId)).toEqual({
      planned: 150_000,
      spent: 120_000,
      available: 30_000,
      executionPercentage: 80,
      isOverBudget: false,
      items: [
        {
          budgetItemId: venueId,
          planned: 100_000,
          spent: 120_000,
          available: -20_000,
          executionPercentage: 120,
          isOverBudget: true,
        },
        {
          budgetItemId: 'generated-3',
          planned: 50_000,
          spent: 0,
          available: 50_000,
          executionPercentage: 0,
          isOverBudget: false,
        },
      ],
    })
  })

  it('blocks deletion of a budget item while it has expenses', () => {
    const store = createEventsStore({
      storage: createMemoryStorage(),
      idFactory,
    })
    const eventId = Object.keys(store.getState().events)[0]
    const budgetItemId = Object.values(store.getState().budgetItems).find(
      (item) => item.eventId === eventId
    )!.id

    expect(store.getState().deleteBudgetItem(budgetItemId)).toBe(false)
    expect(store.getState().budgetItems[budgetItemId]).toBeDefined()
  })

  it('deletes an event and all of its related records', () => {
    const store = createEventsStore({
      storage: createMemoryStorage(),
      idFactory,
    })
    const eventId = Object.keys(store.getState().events)[0]
    const impact = getEventDeletionImpact(store.getState(), eventId)

    expect(impact).toEqual({ tasks: 2, budgetItems: 3, expenses: 2 })
    expect(store.getState().deleteEvent(eventId)).toEqual(impact)
    expect(store.getState().events[eventId]).toBeUndefined()
    expect(getTasksForEvent(store.getState(), eventId)).toEqual([])
    expect(
      Object.values(store.getState().budgetItems).some(
        (item) => item.eventId === eventId
      )
    ).toBe(false)
    expect(
      Object.values(store.getState().expenses).some(
        (expense) => expense.eventId === eventId
      )
    ).toBe(false)
  })

  it('keeps event tasks in the same collection used by the global task list', () => {
    const store = createEventsStore({
      storage: createMemoryStorage(),
      idFactory,
    })
    const eventId = Object.keys(store.getState().events)[0]
    const taskId = store.getState().addTask({
      eventId,
      title: 'Confirmar relatoría',
      description: '',
      assignee: 'Luis Soto',
      dueDate: '2026-09-08',
      priority: 'high',
      status: 'todo',
    })

    store.getState().updateTask(taskId, { status: 'done' })

    expect(store.getState().tasks[taskId].status).toBe('done')
    expect(getTasksForEvent(store.getState(), eventId)).toContainEqual(
      expect.objectContaining({ id: taskId, status: 'done' })
    )
  })

  it('persists changes and hydrates them in a new store instance', () => {
    const storage = createMemoryStorage()
    const first = createEventsStore({ storage, idFactory })
    const eventId = first.getState().addEvent({
      name: 'Feria de innovación',
      description: 'Evento anual',
      status: 'draft',
      startsAt: '2026-11-03T09:00',
      endsAt: '2026-11-03T17:00',
      location: 'Quillota',
      owner: 'María Díaz',
    })

    const second = createEventsStore({ storage, idFactory })

    expect(second.getState().events[eventId].name).toBe('Feria de innovación')
    expect(second.getState().storageWarning).toBe(false)
  })

  it('falls back to demo data and flags malformed local storage', () => {
    const storage = createMemoryStorage()
    storage.setItem(EVENTS_STORAGE_KEY, '{not-json')

    const store = createEventsStore({ storage, idFactory })

    expect(Object.keys(store.getState().events).length).toBeGreaterThan(0)
    expect(store.getState().storageWarning).toBe(true)
    expect(storage.getItem(EVENTS_STORAGE_KEY)).toBeNull()
  })

  it('falls back safely when the persisted schema version is unsupported', () => {
    const storage = createMemoryStorage()
    storage.setItem(
      EVENTS_STORAGE_KEY,
      JSON.stringify({ version: 99, data: { events: {} } })
    )

    const store = createEventsStore({ storage, idFactory })

    expect(Object.keys(store.getState().events).length).toBeGreaterThan(0)
    expect(store.getState().storageWarning).toBe(true)
  })
})
