import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { expect, it } from 'vitest'
import { render } from 'vitest-browser-react'
import { SearchProvider } from '@/context/search-provider'
import { ThemeProvider } from '@/context/theme-provider'
import { SidebarProvider } from '@/components/ui/sidebar'
import { VcmHomePage } from './home-page'

it('shows the complete home with visible charts and no expandable cards', async () => {
  const root = createRootRoute({
    component: () => (
      <ThemeProvider defaultTheme='light'>
        <SearchProvider>
          <SidebarProvider>
            <VcmHomePage />
          </SidebarProvider>
        </SearchProvider>
      </ThemeProvider>
    ),
  })
  const router = createRouter({
    routeTree: root,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  const screen = await render(<RouterProvider router={router} />)
  await expect
    .element(screen.getByRole('heading', { name: 'Seguimiento operativo' }))
    .toBeInTheDocument()
  await expect
    .element(screen.getByRole('heading', { name: 'Comunicaciones' }))
    .toBeInTheDocument()
  await expect
    .element(screen.getByRole('heading', { name: 'Convenios', exact: true }))
    .toBeInTheDocument()
  expect(document.querySelectorAll('main details, main summary')).toHaveLength(
    0
  )
  expect(
    screen.getByText('Ver detalle', { exact: true }).elements()
  ).toHaveLength(0)
})
