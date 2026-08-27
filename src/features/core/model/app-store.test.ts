import { beforeEach, describe, expect, it } from 'vitest'
import { APP_STORAGE_KEY, createAppStore, type StorageLike } from './app-store'
import { DEMO_APP_DATA, EMPTY_APP_DATA } from './seed'

function createMemoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial))

  const storage: StorageLike & { value: (key: string) => string | null } = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
    value: (key) => values.get(key) ?? null,
  }

  return storage
}

const validActivityInput = {
  name: 'Taller territorial',
  description: 'Trabajo comunitario ejecutado.',
  startsAt: '2026-08-01T09:00',
  endsAt: '2026-08-01T13:00',
  location: 'Valparaíso',
  vcmLine: 'community-services' as const,
  responsibleContactId: 'contact-1',
  partnerIds: [],
  participantCount: 32,
  results: 'Se acordó una nueva mesa de trabajo.',
  evidences: [
    { name: 'Lista de asistencia', url: 'https://example.org/lista' },
  ],
}

describe('central app store', () => {
  let nextId = 0
  const idFactory = () => `generated-${++nextId}`
  const nowFactory = () => '2026-08-08T12:00:00.000Z'

  beforeEach(() => {
    nextId = 0
  })

  it('persists a contact and its related activity in one snapshot', () => {
    const storage = createMemoryStorage()
    const store = createAppStore({
      storage,
      idFactory,
      nowFactory,
      initialData: EMPTY_APP_DATA,
    })

    const contactId = store.getState().addContact({
      name: 'Ana Pérez',
      email: 'ana@example.org',
      phone: '',
      role: 'Coordinadora',
      partnerId: null,
    })
    const activityId = store.getState().addActivity({
      ...validActivityInput,
      responsibleContactId: contactId,
    })

    const snapshot = JSON.parse(storage.value(APP_STORAGE_KEY)!)
    expect(snapshot.version).toBe(2)
    expect(snapshot.data.contacts[contactId].name).toBe('Ana Pérez')
    expect(snapshot.data.activities[activityId].responsibleContactId).toBe(
      contactId
    )
  })

  it('reloads persisted demo data without falling back to the seed', () => {
    const storage = createMemoryStorage()
    const store = createAppStore({
      storage,
      idFactory,
      nowFactory,
      initialData: DEMO_APP_DATA,
    })

    const partnerId = store.getState().addPartner({
      name: 'Fundación Horizonte',
      type: 'Fundación',
      taxId: '',
      email: '',
      phone: '',
      website: '',
      notes: '',
    })

    const reloaded = createAppStore({ storage, idFactory, nowFactory })

    expect(reloaded.getState().storageWarning).toBe(false)
    expect(reloaded.getState().partners[partnerId]?.name).toBe(
      'Fundación Horizonte'
    )
  })

  it('creates web activities as approved records', () => {
    const store = createAppStore({
      storage: createMemoryStorage(),
      idFactory,
      nowFactory,
      initialData: EMPTY_APP_DATA,
    })

    const id = store.getState().addActivity(validActivityInput)

    expect(store.getState().activities[id]).toMatchObject({
      source: 'web',
      approvalStatus: 'approved',
      rejectionReason: null,
    })
  })

  it('requires a rejection reason and clears it when approved', () => {
    const store = createAppStore({
      storage: createMemoryStorage(),
      idFactory,
      nowFactory,
      initialData: EMPTY_APP_DATA,
    })
    const id = store.getState().addActivity(validActivityInput)

    expect(store.getState().rejectActivity(id, '   ')).toBe(false)
    expect(store.getState().activities[id].approvalStatus).toBe('approved')

    expect(store.getState().rejectActivity(id, '  Falta respaldo  ')).toBe(true)
    expect(store.getState().activities[id]).toMatchObject({
      approvalStatus: 'rejected',
      rejectionReason: 'Falta respaldo',
    })

    store.getState().approveActivity(id)
    expect(store.getState().activities[id]).toMatchObject({
      approvalStatus: 'approved',
      rejectionReason: null,
    })
  })

  it('migrates version 1 activities to approved web records', () => {
    const storage = createMemoryStorage({
      [APP_STORAGE_KEY]: JSON.stringify({
        version: 1,
        data: DEMO_APP_DATA,
      }),
    })

    const state = createAppStore({ storage, idFactory, nowFactory }).getState()

    expect(state.storageWarning).toBe(false)
    expect(state.activities['activity-neighborhood-workshop']).toMatchObject({
      source: 'web',
      approvalStatus: 'approved',
      rejectionReason: null,
    })
    expect(JSON.parse(storage.value(APP_STORAGE_KEY)!).version).toBe(2)
  })

  it('keeps current data when an imported snapshot is malformed', () => {
    const store = createAppStore({
      storage: createMemoryStorage(),
      idFactory,
      nowFactory,
      initialData: EMPTY_APP_DATA,
    })
    const contactId = store.getState().addContact({
      name: 'Camila Soto',
      email: '',
      phone: '',
      role: '',
      partnerId: null,
    })

    expect(store.getState().importSnapshot('{invalid')).toEqual({
      success: false,
      error: 'El archivo no contiene un respaldo válido.',
    })
    expect(store.getState().contacts[contactId].name).toBe('Camila Soto')
  })

  it('migrates legacy event owners and assignees into contacts', () => {
    const legacy = {
      version: 1,
      data: {
        events: {
          event1: {
            id: 'event1',
            name: 'Encuentro',
            description: '',
            status: 'planned',
            startsAt: '2026-09-01T09:00',
            endsAt: '2026-09-01T18:00',
            location: 'Valparaíso',
            owner: 'Ana Pérez',
            createdAt: nowFactory(),
            updatedAt: nowFactory(),
          },
        },
        tasks: {
          task1: {
            id: 'task1',
            eventId: 'event1',
            title: 'Confirmar sala',
            description: '',
            assignee: 'Luis Soto',
            dueDate: '2026-08-25',
            priority: 'high',
            status: 'todo',
            createdAt: nowFactory(),
            updatedAt: nowFactory(),
          },
        },
        budgetItems: {},
        expenses: {},
      },
    }
    const storage = createMemoryStorage({
      'contenthub-events-v1': JSON.stringify(legacy),
    })

    const state = createAppStore({ storage, idFactory, nowFactory }).getState()
    const contacts = Object.values(state.contacts)

    expect(contacts.map((contact) => contact.name).sort()).toEqual([
      'Ana Pérez',
      'Luis Soto',
    ])
    expect(state.events.event1.coordinatorContactId).toBe(
      contacts.find((contact) => contact.name === 'Ana Pérez')?.id
    )
    expect(state.tasks.task1.assigneeContactIds).toEqual([
      contacts.find((contact) => contact.name === 'Luis Soto')?.id,
    ])
    expect(storage.value(APP_STORAGE_KEY)).not.toBeNull()
    expect(storage.value('contenthub-events-v1')).toBeNull()
  })
})
