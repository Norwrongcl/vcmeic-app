import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { expect, it } from 'vitest'
import { render } from 'vitest-browser-react'
import { SearchProvider } from '@/context/search-provider'
import { ThemeProvider } from '@/context/theme-provider'
import { SidebarProvider } from '@/components/ui/sidebar'
import { HomePage } from './home-page'

it('presents the operational dashboard with three decision-oriented charts', async () => {
  const rootRoute = createRootRoute()
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => (
      <ThemeProvider defaultTheme='light'>
        <SearchProvider>
          <SidebarProvider>
            <HomePage />
          </SidebarProvider>
        </SearchProvider>
      </ThemeProvider>
    ),
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  const screen = await render(<RouterProvider router={router} />)

  await expect.element(screen.getByText('Impacto mensual')).toBeInTheDocument()
  await expect
    .element(screen.getByText('Distribución por línea VcM'))
    .toBeInTheDocument()
  await expect.element(screen.getByText('Carga del equipo')).toBeInTheDocument()
})
