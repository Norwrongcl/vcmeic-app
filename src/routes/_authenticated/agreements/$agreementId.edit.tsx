import { createFileRoute } from '@tanstack/react-router'
import { AgreementFormPage } from '@/features/agreements'

export const Route = createFileRoute(
  '/_authenticated/agreements/$agreementId/edit'
)({ component: RouteComponent })
// eslint-disable-next-line react-refresh/only-export-components
function RouteComponent() {
  const { agreementId } = Route.useParams()
  return <AgreementFormPage agreementId={agreementId} />
}
