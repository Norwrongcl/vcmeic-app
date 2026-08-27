import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { afterEach, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { SearchProvider } from '@/context/search-provider'
import { ThemeProvider } from '@/context/theme-provider'
import { SidebarProvider } from '@/components/ui/sidebar'
import { ReportsPage } from './reports-page'

afterEach(() => vi.restoreAllMocks())

it('exports the current report as a local CSV file', async () => {
  let downloadName = ''
  const createUrl = vi
    .spyOn(URL, 'createObjectURL')
    .mockReturnValue('blob:contenthub-report')
  const revokeUrl = vi
    .spyOn(URL, 'revokeObjectURL')
    .mockImplementation(() => {})
  const clickLink = vi
    .spyOn(HTMLAnchorElement.prototype, 'click')
    .mockImplementation(function (this: HTMLAnchorElement) {
      downloadName = this.download
    })
  const rootRoute = createRootRoute()
  const reportsRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/reports',
    component: () => (
      <ThemeProvider defaultTheme='light'>
        <SearchProvider>
          <SidebarProvider>
            <ReportsPage />
          </SidebarProvider>
        </SearchProvider>
      </ThemeProvider>
    ),
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([reportsRoute]),
    history: createMemoryHistory({ initialEntries: ['/reports'] }),
  })
  const screen = await render(<RouterProvider router={router} />)

  await userEvent.click(screen.getByRole('button', { name: 'Exportar CSV' }))

  expect(createUrl).toHaveBeenCalledOnce()
  expect(clickLink).toHaveBeenCalledOnce()
  expect(downloadName).toMatch(/^contenthub-reporte-\d{4}-\d{2}-\d{2}\.csv$/)
  await vi.waitFor(() =>
    expect(revokeUrl).toHaveBeenCalledWith('blob:contenthub-report')
  )
})
