import { expect, it } from 'vitest'
import { createAppStore } from '@/features/core/model/app-store'
import { EMPTY_APP_DATA } from '@/features/core/model/seed'

const storage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
}
it('blocks completing a milestone while its dependency is unfinished', () => {
  const store = createAppStore({ storage, initialData: EMPTY_APP_DATA })
  const add = store.getState().addTask
  const first = add({
    title: 'Producir pieza',
    description: '',
    assignee: 'Ana',
    dueDate: '2026-10-21',
    priority: 'medium',
    status: 'todo',
  })
  const milestone = add({
    title: 'Revisión',
    kind: 'milestone',
    dependencyIds: [first],
    description: '',
    assignee: 'Ana',
    dueDate: '2026-10-22',
    priority: 'medium',
    status: 'todo',
  })
  expect(() =>
    store.getState().updateTask(milestone, { status: 'done' })
  ).toThrow()
  expect(store.getState().tasks[milestone].status).toBe('todo')
  store.getState().updateTask(first, { status: 'done' })
  store.getState().updateTask(milestone, { status: 'done' })
  expect(store.getState().tasks[milestone].status).toBe('done')
})
it('does not delete a predecessor that is referenced by a milestone', () => {
  const store = createAppStore({ storage, initialData: EMPTY_APP_DATA })
  const add = store.getState().addTask
  const first = add({
    title: 'Producir pieza',
    description: '',
    assignee: 'Ana',
    dueDate: '2026-10-21',
    priority: 'medium',
    status: 'todo',
  })
  add({
    title: 'Revisión',
    kind: 'milestone',
    dependencyIds: [first],
    description: '',
    assignee: 'Ana',
    dueDate: '2026-10-22',
    priority: 'medium',
    status: 'todo',
  })
  expect(() => store.getState().deleteTask(first)).toThrow()
  expect(store.getState().tasks[first]).toBeDefined()
})
