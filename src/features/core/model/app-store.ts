import { useStore } from 'zustand'
import { createStore, type StoreApi } from 'zustand/vanilla'
import {
  appSnapshotSchema,
  appSnapshotV1Schema,
  legacyEventsSnapshotSchema,
} from './schema'
import { DEMO_APP_DATA, EMPTY_APP_DATA } from './seed'
import {
  type Activity,
  type ActivityInput,
  type Agreement,
  type AgreementInput,
  type AppData,
  type BudgetItem,
  type BudgetItemInput,
  type Contact,
  type ContactInput,
  type DeletionImpact,
  type Event,
  type EventInput,
  type EventTask,
  type EventTaskInput,
  type Expense,
  type ExpenseInput,
  type Partner,
  type PartnerInput,
  type Resource,
  type ResourceInput,
} from './types'

export const APP_STORAGE_KEY = 'vcmeic-mvp-v1'
export const LEGACY_EVENTS_STORAGE_KEY = 'contenthub-events-v1'
export const APP_SCHEMA_VERSION = 2

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

type ImportResult = { success: true } | { success: false; error: string }

type AppActions = {
  addActivity: (input: ActivityInput) => string
  updateActivity: (id: string, input: Partial<ActivityInput>) => void
  approveActivity: (id: string) => void
  rejectActivity: (id: string, reason: string) => boolean
  deleteActivity: (id: string) => void
  addPartner: (input: PartnerInput) => string
  updatePartner: (id: string, input: Partial<PartnerInput>) => void
  deletePartner: (id: string) => boolean
  addContact: (input: ContactInput) => string
  updateContact: (id: string, input: Partial<ContactInput>) => void
  deleteContact: (id: string) => boolean
  addEvent: (input: EventInput) => string
  updateEvent: (id: string, input: Partial<EventInput>) => void
  deleteEvent: (id: string) => DeletionImpact
  addTask: (input: EventTaskInput) => string
  updateTask: (id: string, input: Partial<EventTaskInput>) => void
  deleteTask: (id: string) => void
  addBudgetItem: (input: BudgetItemInput) => string
  updateBudgetItem: (id: string, input: Partial<BudgetItemInput>) => void
  deleteBudgetItem: (id: string) => boolean
  addExpense: (input: ExpenseInput) => string
  updateExpense: (id: string, input: Partial<ExpenseInput>) => void
  deleteExpense: (id: string) => void
  addAgreement: (input: AgreementInput) => string
  updateAgreement: (id: string, input: Partial<AgreementInput>) => void
  deleteAgreement: (id: string) => void
  addResource: (input: ResourceInput) => string
  updateResource: (id: string, input: Partial<ResourceInput>) => void
  deleteResource: (id: string) => void
  exportSnapshot: () => string
  importSnapshot: (raw: string) => ImportResult
  resetData: () => void
  dismissStorageWarning: () => void
}

export type AppStoreState = AppData &
  AppActions & {
    storageWarning: boolean
  }

export type CreateAppStoreOptions = {
  storage?: StorageLike
  idFactory?: () => string
  nowFactory?: () => string
  initialData?: AppData
}

function cloneData(data: AppData): AppData {
  return JSON.parse(JSON.stringify(data)) as AppData
}

function dataFromState(state: AppStoreState): AppData {
  return {
    activities: state.activities,
    events: state.events,
    tasks: state.tasks,
    budgetItems: state.budgetItems,
    expenses: state.expenses,
    partners: state.partners,
    contacts: state.contacts,
    agreements: state.agreements,
    resources: state.resources,
  }
}

function snapshot(data: AppData) {
  return JSON.stringify({ version: APP_SCHEMA_VERSION, data }, undefined, 2)
}

function parseSnapshot(raw: string): { data: AppData; migrated: boolean } {
  const json = JSON.parse(raw)
  const current = appSnapshotSchema.safeParse(json)
  if (current.success) {
    return { data: current.data.data, migrated: false }
  }

  const previous = appSnapshotV1Schema.safeParse(json)
  if (!previous.success) throw new Error('Invalid app snapshot')

  return {
    data: {
      ...previous.data.data,
      activities: Object.fromEntries(
        Object.entries(previous.data.data.activities).map(([id, activity]) => [
          id,
          {
            ...activity,
            source: 'web' as const,
            approvalStatus: 'approved' as const,
            rejectionReason: null,
          },
        ])
      ),
    },
    migrated: true,
  }
}

function defaultStorage(): StorageLike {
  if (typeof window !== 'undefined') return window.localStorage
  return {
    getItem: () => null,
    setItem: () => undefined,
    removeItem: () => undefined,
  }
}

function migrateLegacyData(
  raw: string,
  idFactory: () => string,
  nowFactory: () => string
): AppData {
  const legacy = legacyEventsSnapshotSchema.parse(JSON.parse(raw)).data
  const contacts: Record<string, Contact> = {}
  const idsByNormalizedName = new Map<string, string>()

  const contactIdFor = (name: string) => {
    const normalized = name.trim().toLocaleLowerCase('es-CL')
    const existing = idsByNormalizedName.get(normalized)
    if (existing) return existing

    const id = idFactory()
    const now = nowFactory()
    contacts[id] = {
      id,
      name: name.trim(),
      email: '',
      phone: '',
      role: '',
      partnerId: null,
      createdAt: now,
      updatedAt: now,
    }
    idsByNormalizedName.set(normalized, id)
    return id
  }

  const events = Object.fromEntries(
    Object.entries(legacy.events).map(([id, event]) => [
      id,
      {
        ...event,
        coordinatorContactId: contactIdFor(event.owner),
        partnerIds: [],
        participantCount: null,
        results: '',
        evidences: [],
        closedAt: null,
      },
    ])
  )
  const tasks = Object.fromEntries(
    Object.entries(legacy.tasks).map(([id, task]) => [
      id,
      {
        ...task,
        phase: 'pre' as const,
        assigneeContactIds: task.assignee ? [contactIdFor(task.assignee)] : [],
      },
    ])
  )

  return {
    ...cloneData(EMPTY_APP_DATA),
    events,
    tasks,
    budgetItems: legacy.budgetItems,
    expenses: legacy.expenses,
    contacts,
  }
}

function loadData(
  storage: StorageLike,
  idFactory: () => string,
  nowFactory: () => string
): { data: AppData; storageWarning: boolean } {
  const current = storage.getItem(APP_STORAGE_KEY)
  if (current) {
    try {
      const parsed = parseSnapshot(current)
      if (parsed.migrated) {
        storage.setItem(APP_STORAGE_KEY, snapshot(parsed.data))
      }
      return { data: cloneData(parsed.data), storageWarning: false }
    } catch {
      storage.removeItem(APP_STORAGE_KEY)
      return { data: cloneData(DEMO_APP_DATA), storageWarning: true }
    }
  }

  const legacy = storage.getItem(LEGACY_EVENTS_STORAGE_KEY)
  if (legacy) {
    try {
      const data = migrateLegacyData(legacy, idFactory, nowFactory)
      storage.setItem(APP_STORAGE_KEY, snapshot(data))
      storage.removeItem(LEGACY_EVENTS_STORAGE_KEY)
      return { data, storageWarning: false }
    } catch {
      storage.removeItem(LEGACY_EVENTS_STORAGE_KEY)
      return { data: cloneData(DEMO_APP_DATA), storageWarning: true }
    }
  }

  return { data: cloneData(DEMO_APP_DATA), storageWarning: false }
}

function createRecord<
  TInput,
  TEntity extends TInput & { id: string; createdAt: string; updatedAt: string },
>(input: TInput, idFactory: () => string, nowFactory: () => string): TEntity {
  const id = idFactory()
  const now = nowFactory()
  return { ...input, id, createdAt: now, updatedAt: now } as TEntity
}

export function createAppStore(
  options: CreateAppStoreOptions = {}
): StoreApi<AppStoreState> {
  const storage = options.storage ?? defaultStorage()
  const idFactory = options.idFactory ?? (() => crypto.randomUUID())
  const nowFactory = options.nowFactory ?? (() => new Date().toISOString())
  const loaded = options.initialData
    ? { data: cloneData(options.initialData), storageWarning: false }
    : loadData(storage, idFactory, nowFactory)

  return createStore<AppStoreState>()((set, get) => {
    const persist = () => {
      storage.setItem(APP_STORAGE_KEY, snapshot(dataFromState(get())))
    }

    const updateRecord = <
      T extends { id: string; updatedAt: string },
      K extends keyof AppData,
    >(
      key: K,
      id: string,
      input: Partial<T>
    ) => {
      const records = get()[key] as unknown as Record<string, T>
      const current = records[id]
      if (!current) return
      set({
        [key]: {
          ...records,
          [id]: { ...current, ...input, id, updatedAt: nowFactory() },
        },
      } as Partial<AppStoreState>)
      persist()
    }

    const removeRecord = (key: keyof AppData, id: string) => {
      const records = { ...(get()[key] as Record<string, unknown>) }
      delete records[id]
      set({ [key]: records } as Partial<AppStoreState>)
      persist()
    }

    return {
      ...loaded.data,
      storageWarning: loaded.storageWarning,
      addActivity: (input) => {
        const item = createRecord<
          Omit<Activity, 'id' | 'createdAt' | 'updatedAt'>,
          Activity
        >(
          {
            ...input,
            source: 'web',
            approvalStatus: 'approved',
            rejectionReason: null,
          },
          idFactory,
          nowFactory
        )
        set((state) => ({
          activities: { ...state.activities, [item.id]: item },
        }))
        persist()
        return item.id
      },
      updateActivity: (id, input) =>
        updateRecord<Activity, 'activities'>('activities', id, input),
      approveActivity: (id) =>
        updateRecord<Activity, 'activities'>('activities', id, {
          approvalStatus: 'approved',
          rejectionReason: null,
        }),
      rejectActivity: (id, reason) => {
        const normalizedReason = reason.trim()
        if (!normalizedReason || !get().activities[id]) return false
        updateRecord<Activity, 'activities'>('activities', id, {
          approvalStatus: 'rejected',
          rejectionReason: normalizedReason,
        })
        return true
      },
      deleteActivity: (id) => removeRecord('activities', id),
      addPartner: (input) => {
        const item = createRecord<PartnerInput, Partner>(
          input,
          idFactory,
          nowFactory
        )
        set((state) => ({
          partners: { ...state.partners, [item.id]: item },
        }))
        persist()
        return item.id
      },
      updatePartner: (id, input) =>
        updateRecord<Partner, 'partners'>('partners', id, input),
      deletePartner: (id) => {
        const state = get()
        if (
          Object.values(state.agreements).some(
            (agreement) => agreement.partnerId === id
          )
        ) {
          return false
        }
        const partners = { ...state.partners }
        delete partners[id]
        set({
          partners,
          contacts: Object.fromEntries(
            Object.entries(state.contacts).map(([key, contact]) => [
              key,
              contact.partnerId === id
                ? { ...contact, partnerId: null, updatedAt: nowFactory() }
                : contact,
            ])
          ),
          activities: Object.fromEntries(
            Object.entries(state.activities).map(([key, activity]) => [
              key,
              {
                ...activity,
                partnerIds: activity.partnerIds.filter(
                  (partnerId) => partnerId !== id
                ),
              },
            ])
          ),
          events: Object.fromEntries(
            Object.entries(state.events).map(([key, event]) => [
              key,
              {
                ...event,
                partnerIds: event.partnerIds?.filter(
                  (partnerId) => partnerId !== id
                ),
              },
            ])
          ),
        })
        persist()
        return true
      },
      addContact: (input) => {
        const item = createRecord<ContactInput, Contact>(
          input,
          idFactory,
          nowFactory
        )
        set((state) => ({
          contacts: { ...state.contacts, [item.id]: item },
        }))
        persist()
        return item.id
      },
      updateContact: (id, input) =>
        updateRecord<Contact, 'contacts'>('contacts', id, input),
      deleteContact: (id) => {
        const state = get()
        const isRequired =
          Object.values(state.activities).some(
            (activity) => activity.responsibleContactId === id
          ) ||
          Object.values(state.events).some(
            (event) => event.coordinatorContactId === id
          )
        if (isRequired) return false

        const contacts = { ...state.contacts }
        delete contacts[id]
        set({
          contacts,
          tasks: Object.fromEntries(
            Object.entries(state.tasks).map(([key, task]) => [
              key,
              {
                ...task,
                assigneeContactIds: task.assigneeContactIds?.filter(
                  (contactId) => contactId !== id
                ),
              },
            ])
          ),
          agreements: Object.fromEntries(
            Object.entries(state.agreements).map(([key, agreement]) => [
              key,
              agreement.responsibleContactId === id
                ? { ...agreement, responsibleContactId: null }
                : agreement,
            ])
          ),
        })
        persist()
        return true
      },
      addEvent: (input) => {
        const item = createRecord<EventInput, Event>(
          input,
          idFactory,
          nowFactory
        )
        set((state) => ({ events: { ...state.events, [item.id]: item } }))
        persist()
        return item.id
      },
      updateEvent: (id, input) =>
        updateRecord<Event, 'events'>('events', id, input),
      deleteEvent: (id) => {
        const state = get()
        const impact = {
          tasks: Object.values(state.tasks).filter(
            (task) => task.eventId === id
          ).length,
          budgetItems: Object.values(state.budgetItems).filter(
            (item) => item.eventId === id
          ).length,
          expenses: Object.values(state.expenses).filter(
            (expense) => expense.eventId === id
          ).length,
        }
        const events = { ...state.events }
        delete events[id]
        set({
          events,
          tasks: Object.fromEntries(
            Object.entries(state.tasks).filter(
              ([, task]) => task.eventId !== id
            )
          ),
          budgetItems: Object.fromEntries(
            Object.entries(state.budgetItems).filter(
              ([, item]) => item.eventId !== id
            )
          ),
          expenses: Object.fromEntries(
            Object.entries(state.expenses).filter(
              ([, expense]) => expense.eventId !== id
            )
          ),
        })
        persist()
        return impact
      },
      addTask: (input) => {
        const item = createRecord<EventTaskInput, EventTask>(
          input,
          idFactory,
          nowFactory
        )
        set((state) => ({ tasks: { ...state.tasks, [item.id]: item } }))
        persist()
        return item.id
      },
      updateTask: (id, input) =>
        updateRecord<EventTask, 'tasks'>('tasks', id, input),
      deleteTask: (id) => removeRecord('tasks', id),
      addBudgetItem: (input) => {
        const item = createRecord<BudgetItemInput, BudgetItem>(
          input,
          idFactory,
          nowFactory
        )
        set((state) => ({
          budgetItems: { ...state.budgetItems, [item.id]: item },
        }))
        persist()
        return item.id
      },
      updateBudgetItem: (id, input) =>
        updateRecord<BudgetItem, 'budgetItems'>('budgetItems', id, input),
      deleteBudgetItem: (id) => {
        if (
          Object.values(get().expenses).some(
            (expense) => expense.budgetItemId === id
          )
        ) {
          return false
        }
        removeRecord('budgetItems', id)
        return true
      },
      addExpense: (input) => {
        const item = createRecord<ExpenseInput, Expense>(
          input,
          idFactory,
          nowFactory
        )
        set((state) => ({
          expenses: { ...state.expenses, [item.id]: item },
        }))
        persist()
        return item.id
      },
      updateExpense: (id, input) =>
        updateRecord<Expense, 'expenses'>('expenses', id, input),
      deleteExpense: (id) => removeRecord('expenses', id),
      addAgreement: (input) => {
        const item = createRecord<AgreementInput, Agreement>(
          input,
          idFactory,
          nowFactory
        )
        set((state) => ({
          agreements: { ...state.agreements, [item.id]: item },
        }))
        persist()
        return item.id
      },
      updateAgreement: (id, input) =>
        updateRecord<Agreement, 'agreements'>('agreements', id, input),
      deleteAgreement: (id) => removeRecord('agreements', id),
      addResource: (input) => {
        const item = createRecord<ResourceInput, Resource>(
          input,
          idFactory,
          nowFactory
        )
        set((state) => ({
          resources: { ...state.resources, [item.id]: item },
        }))
        persist()
        return item.id
      },
      updateResource: (id, input) =>
        updateRecord<Resource, 'resources'>('resources', id, input),
      deleteResource: (id) => removeRecord('resources', id),
      exportSnapshot: () => snapshot(dataFromState(get())),
      importSnapshot: (raw) => {
        try {
          const parsed = parseSnapshot(raw)
          set(cloneData(parsed.data))
          persist()
          return { success: true }
        } catch {
          return {
            success: false,
            error: 'El archivo no contiene un respaldo válido.',
          }
        }
      },
      resetData: () => {
        set(cloneData(DEMO_APP_DATA))
        persist()
      },
      dismissStorageWarning: () => set({ storageWarning: false }),
    }
  })
}

export const appStore = createAppStore()

export function useAppStore<T>(selector: (state: AppStoreState) => T) {
  return useStore(appStore, selector)
}
