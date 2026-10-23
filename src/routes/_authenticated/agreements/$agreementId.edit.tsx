import { createFileRoute, redirect } from '@tanstack/react-router'
import { AgreementFormPage } from '@/features/agreements'
import { useDemoRole } from '@/features/vcm/model/use-vcm'

export const Route = createFileRoute(
  '/_authenticated/agreements/$agreementId/edit'
)({
  beforeLoad: () => {
    if (!['coordination', 'leadership'].includes(useDemoRole.getState().role))
      throw redirect({ to: '/portfolio', replace: true })
  },
  component: RouteComponent,
})
// eslint-disable-next-line react-refresh/only-export-components
function RouteComponent() {
  const { agreementId } = Route.useParams()
  return <AgreementFormPage agreementId={agreementId} />
}
