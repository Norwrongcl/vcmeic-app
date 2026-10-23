import { createFileRoute, redirect } from '@tanstack/react-router'
import { DirectoryFormPage } from '@/features/directory'
import { useDemoRole } from '@/features/vcm/model/use-vcm'

export const Route = createFileRoute(
  '/_authenticated/partners/$partnerId/edit'
)({
  beforeLoad: () => {
    if (!['coordination', 'leadership'].includes(useDemoRole.getState().role))
      throw redirect({ to: '/portfolio', replace: true })
  },
  component: RouteComponent,
})
// eslint-disable-next-line react-refresh/only-export-components
function RouteComponent() {
  const { partnerId } = Route.useParams()
  return <DirectoryFormPage entity='partners' entityId={partnerId} />
}
