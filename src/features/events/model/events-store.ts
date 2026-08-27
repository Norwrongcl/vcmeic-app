import {
  appStore,
  createAppStore,
  LEGACY_EVENTS_STORAGE_KEY,
  useAppStore,
  type AppStoreState,
  type CreateAppStoreOptions,
} from '@/features/core/model/app-store'
import { EMPTY_APP_DATA } from '@/features/core/model/seed'
import { type EventsData } from './types'

export const EVENTS_STORAGE_KEY = LEGACY_EVENTS_STORAGE_KEY

type CreateEventsStoreOptions = Omit<CreateAppStoreOptions, 'initialData'> & {
  initialData?: EventsData
}

export type EventsStoreState = AppStoreState

export function createEventsStore(options: CreateEventsStoreOptions = {}) {
  return createAppStore({
    ...options,
    initialData: options.initialData
      ? { ...EMPTY_APP_DATA, ...options.initialData }
      : undefined,
  })
}

export const eventsStore = appStore
export const useEventsStore = useAppStore
