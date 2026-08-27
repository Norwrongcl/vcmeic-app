import { createFileRoute } from '@tanstack/react-router'
import { ResourceFormPage } from '@/features/resources'

export const Route = createFileRoute(
  '/_authenticated/resources/$resourceId/edit'
)({ component: RouteComponent })
// eslint-disable-next-line react-refresh/only-export-components
function RouteComponent() {
  const { resourceId } = Route.useParams()
  return <ResourceFormPage resourceId={resourceId} />
}
