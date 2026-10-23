import { createFileRoute } from '@tanstack/react-router'
import { PortfolioPage } from '@/features/vcm/pages/portfolio-page'

export const Route = createFileRoute('/_authenticated/portfolio/')({
  validateSearch: (search: Record<string, unknown>): { view?: string } => ({
    view: typeof search.view === 'string' ? search.view : 'all',
  }),
  component: () => <Page />,
})
// eslint-disable-next-line react-refresh/only-export-components
function Page() {
  const { view } = Route.useSearch()
  return <PortfolioPage key={view} initialView={view} />
}
