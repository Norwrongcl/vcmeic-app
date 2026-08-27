import { createFileRoute } from '@tanstack/react-router'
import { AgreementDetailPage } from '@/features/agreements'

export const Route = createFileRoute('/_authenticated/agreements/$agreementId')(
  {
    component: RouteComponent,
  }
)

// eslint-disable-next-line react-refresh/only-export-components
function RouteComponent() {
  const { agreementId } = Route.useParams()
  return <AgreementDetailPage agreementId={agreementId} />
}
