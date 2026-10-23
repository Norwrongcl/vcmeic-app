import { createFileRoute } from '@tanstack/react-router'
import type { CaseKind } from '@/features/vcm/model/types'
import { NewCasePage } from '@/features/vcm/pages/new-case-page'

export const Route = createFileRoute('/_authenticated/portfolio/new')({
  validateSearch: (s: Record<string, unknown>): { kind?: CaseKind } => ({
    kind: ['initiative', 'event', 'activity', 'presence', 'campaign'].includes(
      String(s.kind)
    )
      ? (s.kind as CaseKind)
      : undefined,
  }),
  component: () => <Page />,
})
// eslint-disable-next-line react-refresh/only-export-components
function Page() {
  const { kind } = Route.useSearch()
  return <NewCasePage initialKind={kind} />
}
