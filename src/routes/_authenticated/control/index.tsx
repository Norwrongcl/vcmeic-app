import { createFileRoute } from '@tanstack/react-router'
import { ControlPage } from '@/features/vcm/pages/control-page'

export const Route = createFileRoute('/_authenticated/control/')({
  validateSearch: (search: Record<string, unknown>): { view?: string } => ({
    view: typeof search.view === 'string' ? search.view : 'activities',
  }),
  component: () => <Page />,
})
// eslint-disable-next-line react-refresh/only-export-components
function Page() {
  const { view } = Route.useSearch()
  return <ControlPage key={view} initialView={view} />
}
