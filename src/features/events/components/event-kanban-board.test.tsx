import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { type Event } from '../model/types'
import { EventKanbanBoard } from './event-kanban-board'

const metadata = {
  createdAt: '2026-08-01T10:00:00.000Z',
  updatedAt: '2026-08-01T10:00:00.000Z',
}

const plannedEvent: Event = {
  id: 'event-planned',
  name: 'Feria territorial',
  description: '',
  status: 'planned',
  startsAt: '2026-08-20T09:00',
  endsAt: '2026-08-20T18:00',
  location: 'Patio central',
  owner: 'Ana Pérez',
  ...metadata,
}

const completedEvent: Event = {
  ...plannedEvent,
  id: 'event-completed',
  name: 'Encuentro cerrado',
  status: 'completed',
}

async function renderBoard(
  events: Event[],
  onStatusChange: (event: Event, status: Event['status']) => void
) {
  const rootRoute = createRootRoute()
  const boardRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => (
      <EventKanbanBoard events={events} onStatusChange={onStatusChange} />
    ),
  })
  const eventRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/events/$eventId',
    component: () => <p>Ficha del evento</p>,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([boardRoute, eventRoute]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  return render(<RouterProvider router={router} />)
}

it('moves an open event to a valid adjacent status', async () => {
  const onStatusChange = vi.fn()
  await renderBoard([plannedEvent], onStatusChange)
  ;(
    document.querySelector(
      '[aria-label="Mover Feria territorial"]'
    ) as HTMLElement
  ).focus()
  await userEvent.keyboard('{Space}{ArrowRight}')
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  await userEvent.keyboard('{Space}')

  expect(onStatusChange).toHaveBeenCalledWith(plannedEvent, 'in_progress')
})

it('keeps completed events consolidated', async () => {
  const screen = await renderBoard([completedEvent], vi.fn())

  await expect
    .element(screen.getByText('Encuentro cerrado'))
    .toBeInTheDocument()
  expect(
    document.querySelector('[aria-label="Mover Encuentro cerrado"]')
  ).toBeNull()
})

it('keeps cancelled events in history instead of the active board', async () => {
  const screen = await renderBoard(
    [{ ...plannedEvent, id: 'event-cancelled', status: 'cancelled' }],
    vi.fn()
  )

  await expect
    .element(screen.getByRole('region', { name: 'Cancelado' }))
    .not.toBeInTheDocument()
})

it('keeps card details outside the link so pointer drag can start', async () => {
  const screen = await renderBoard([plannedEvent], vi.fn())
  const location = screen.getByText('Patio central', { exact: true })

  expect(location.element().closest('a')).toBeNull()
  await expect
    .element(screen.getByRole('link', { name: 'Feria territorial' }))
    .toBeInTheDocument()
})
