import { createFileRoute } from '@tanstack/react-router'
import { CaseDetailPage } from '@/features/vcm/pages/case-detail-page'

export const Route = createFileRoute('/_authenticated/portfolio/$caseId')({
  validateSearch: (
    search: Record<string, unknown>
  ): { tab?: string; field?: string } => ({
    tab:
      typeof search.tab === 'string' &&
      [
        'summary',
        'record',
        'operation',
        'evidence',
        'communications',
        'governance',
        'indicators',
        'history',
      ].includes(search.tab)
        ? search.tab
        : undefined,
    field: typeof search.field === 'string' ? search.field : undefined,
  }),
  component: () => <Page />,
})
// eslint-disable-next-line react-refresh/only-export-components
function Page() {
  const { caseId } = Route.useParams()
  const { tab, field } = Route.useSearch()
  return (
    <CaseDetailPage
      key={`${caseId}:${tab ?? ''}:${field ?? ''}`}
      caseId={caseId}
      initialTab={tab}
      initialField={field}
    />
  )
}
