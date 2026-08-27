import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { expect, it } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { type AgendaItem } from '@/features/core/model/selectors'
import { CALENDAR_DAY_CELL_CLASSNAME, CalendarItem } from './agenda-page'

const item: AgendaItem = {
  id: 'event-start',
  kind: 'event-start',
  title: 'Inicio: Encuentro territorial de innovación',
  date: '2026-09-10T09:00',
  eventId: 'event-territorial',
  status: 'planned',
}

it('contains a long event title and keeps its link clickable inside a narrow day', async () => {
  const rootRoute = createRootRoute()
  const agendaRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => (
      <div
        className='grid'
        style={{
          display: 'grid',
          width: 320,
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
        }}
      >
        <div
          data-testid='calendar-cell'
          className={CALENDAR_DAY_CELL_CLASSNAME}
        >
          <CalendarItem item={item} />
        </div>
        <div className='min-h-20'>Día siguiente</div>
      </div>
    ),
  })
  const eventRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/events/$eventId',
    component: () => <p>Ficha del evento</p>,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([agendaRoute, eventRoute]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  const screen = await render(<RouterProvider router={router} />)
  const cell = screen.getByTestId('calendar-cell')
  const link = screen.getByRole('link', { name: item.title })

  const cellBox = cell.element().getBoundingClientRect()
  const linkBox = link.element().getBoundingClientRect()
  expect(cellBox.width).toBeLessThanOrEqual(160)
  expect(linkBox.width).toBeLessThanOrEqual(cellBox.width)

  await userEvent.click(link)
  await expect.element(screen.getByText('Ficha del evento')).toBeInTheDocument()
})
