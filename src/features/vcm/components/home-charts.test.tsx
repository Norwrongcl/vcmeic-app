import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { expect, it } from 'vitest'
import { render } from 'vitest-browser-react'
import { EMPTY_APP_DATA } from '@/features/core/model/seed'
import { buildDashboard } from '../model/dashboard'
import { migrateVcmData } from '../model/migration'
import type { Actor } from '../model/types'
import { HomeCharts, HomeOperations } from './home-charts'

const actor: Actor = {
  id: 'demo-coordination',
  name: 'Coordinación',
  role: 'coordination',
}
function fixture() {
  return buildDashboard(
    { ...EMPTY_APP_DATA, vcm: migrateVcmData(EMPTY_APP_DATA) },
    actor,
    new Date('2026-10-24T12:00:00Z')
  )
}
function show(dashboard: ReturnType<typeof buildDashboard>, government = true) {
  const root = createRootRoute({
    component: () => (
      <>
        <HomeCharts dashboard={dashboard} government={government} />
        <HomeOperations
          dashboard={dashboard}
          data={migrateVcmData(EMPTY_APP_DATA)}
        />
      </>
    ),
  })
  const router = createRouter({
    routeTree: root,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  return render(<RouterProvider router={router} />)
}

it('keeps an empty portfolio and missing budget explicit rather than inventing progress', async () => {
  const d = fixture()
  const screen = await show(d)
  await expect
    .element(screen.getByRole('img', { name: /Distribución de 0 iniciativas/ }))
    .toBeInTheDocument()
  await expect
    .element(screen.getByText('No hay portafolios con iniciativas visibles.'))
    .toBeInTheDocument()
  await expect.element(screen.getByText('Sin base')).toBeInTheDocument()
})

it('distinguishes an undefined target from exceeding a defined target and flags overspending', async () => {
  const d = fixture()
  const base = d.indicators[0]
  d.indicators = [
    {
      ...base,
      id: 'missing',
      name: 'Sin objetivo definido',
      value: 4,
      target: null,
      gap: null,
    },
    {
      ...base,
      id: 'exceeded',
      name: 'Objetivo superado',
      value: 15,
      target: 10,
      gap: 0,
    },
  ]
  d.finance = { ...d.finance, planned: 100, spent: 150, hasBudget: true }
  const screen = await show(d)
  await expect
    .element(screen.getByText('Sin meta', { exact: true }))
    .toBeInTheDocument()
  await expect
    .element(screen.getByRole('meter', { name: 'Objetivo superado' }))
    .toHaveAttribute('aria-valuenow', '10')
  await expect
    .element(screen.getByText('Los gastos superan lo planificado en $50.'))
    .toBeInTheDocument()
  expect(
    screen.getByRole('meter', { name: 'Sin objetivo definido' }).elements()
  ).toHaveLength(0)
})

it('does not render the consolidated budget or annual plan for operational roles', async () => {
  const screen = await show(fixture(), false)
  await expect
    .element(screen.getByRole('heading', { name: /Metas e indicadores/ }))
    .toBeInTheDocument()
  expect(
    screen
      .getByRole('heading', { name: 'Ejecución del presupuesto' })
      .elements()
  ).toHaveLength(0)
  expect(
    screen.getByRole('heading', { name: /Objetivos del plan anual/ }).elements()
  ).toHaveLength(0)
})

it('keeps charts and long portfolio labels within a mobile viewport', async () => {
  const { page } = await import('vitest/browser')
  await page.viewport(390, 844)
  try {
    const d = fixture()
    d.portfolios = [
      {
        name: 'Vinculación territorial y colaboración con organizaciones de la comunidad',
        total: 12,
        completed: 5,
        validated: 2,
      },
    ]
    const screen = await show(d)
    await expect
      .element(
        screen.getByRole('img', { name: /12 iniciativas, 5 ejecutadas/ })
      )
      .toBeInTheDocument()
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(
      document.documentElement.clientWidth
    )
  } finally {
    await page.viewport(1280, 720)
  }
})

it('shows operational charts without disclosure controls, including empty communications', async () => {
  const screen = await show(fixture())
  await expect
    .element(
      screen.getByRole('img', {
        name: 'contenidos: Aprobados 0, Por aprobar 0',
        exact: true,
      })
    )
    .toBeInTheDocument()
  await expect
    .element(screen.getByRole('img', { name: /convenios: Vigente 0/ }))
    .toBeInTheDocument()
  await expect
    .element(
      screen.getByRole('img', { name: 'Tareas bloqueadas: 0', exact: true })
    )
    .toBeInTheDocument()
  expect(document.querySelectorAll('details, summary')).toHaveLength(0)
})
