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
import { type Activity } from '@/features/core/model/types'
import { ActivityKanbanBoard } from './activity-kanban-board'

const activity: Activity = {
  id: 'activity-1',
  name: 'Taller territorial',
  description: '',
  startsAt: '2026-08-01T09:00',
  endsAt: '2026-08-01T13:00',
  location: 'Valparaíso',
  vcmLine: 'community-services',
  responsibleContactId: 'contact-1',
  partnerIds: [],
  participantCount: 20,
  results: '',
  evidences: [],
  approvalStatus: 'pending',
  source: 'whatsapp',
  rejectionReason: null,
  createdAt: '2026-08-01T14:00:00.000Z',
  updatedAt: '2026-08-01T14:00:00.000Z',
}

async function renderBoard(
  item: Activity,
  onApprove: (activity: Activity) => void,
  onReject: (activity: Activity, reason: string) => boolean
) {
  const rootRoute = createRootRoute()
  const boardRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => (
      <ActivityKanbanBoard
        activities={[item]}
        getResponsibleName={() => 'Ana Pérez'}
        onApprove={onApprove}
        onReject={onReject}
      />
    ),
  })
  const detailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/activities/$activityId',
    component: () => <p>Ficha de actividad</p>,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([boardRoute, detailRoute]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  return render(<RouterProvider router={router} />)
}

async function moveRight(label: string) {
  ;(
    document.querySelector(`[aria-label="Mover ${label}"]`) as HTMLElement
  ).focus()
  await userEvent.keyboard('{Space}{ArrowRight}')
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  await userEvent.keyboard('{Space}')
}

it('approves an activity immediately from the Kanban', async () => {
  const onApprove = vi.fn()
  await renderBoard(
    activity,
    onApprove,
    vi.fn(() => true)
  )

  await moveRight('Taller territorial')

  expect(onApprove).toHaveBeenCalledWith(activity)
})

it('waits for a rejection reason and keeps the change pending when cancelled', async () => {
  const approved = { ...activity, approvalStatus: 'approved' as const }
  const onReject = vi.fn(() => true)
  const screen = await renderBoard(approved, vi.fn(), onReject)

  await moveRight('Taller territorial')

  await expect.element(screen.getByRole('alertdialog')).toBeInTheDocument()
  expect(onReject).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
  expect(onReject).not.toHaveBeenCalled()
})

it('rejects only after confirming a trimmed reason', async () => {
  const approved = { ...activity, approvalStatus: 'approved' as const }
  const onReject = vi.fn(() => true)
  const screen = await renderBoard(approved, vi.fn(), onReject)

  await moveRight('Taller territorial')
  await userEvent.fill(
    screen.getByLabelText('Motivo del rechazo'),
    '  Falta respaldo  '
  )
  await userEvent.click(
    screen.getByRole('button', { name: 'Rechazar actividad' })
  )

  expect(onReject).toHaveBeenCalledWith(approved, 'Falta respaldo')
})
