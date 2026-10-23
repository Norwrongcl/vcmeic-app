import { createFileRoute, redirect } from '@tanstack/react-router'
import { ResourceFormPage } from '@/features/resources'
import { useDemoRole } from '@/features/vcm/model/use-vcm'

export const Route = createFileRoute(
  '/_authenticated/resources/$resourceId/edit'
)({
  beforeLoad: () => {
    if (!['coordination', 'leadership'].includes(useDemoRole.getState().role))
      throw redirect({ to: '/portfolio', replace: true })
  },
  component: RouteComponent,
})
// eslint-disable-next-line react-refresh/only-export-components
function RouteComponent() {
  const { resourceId } = Route.useParams()
  return <ResourceFormPage resourceId={resourceId} />
}
