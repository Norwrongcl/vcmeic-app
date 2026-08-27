import { createFileRoute } from '@tanstack/react-router'
import { ResourceDetailPage } from '@/features/resources'

export const Route = createFileRoute('/_authenticated/resources/$resourceId')({
  component: RouteComponent,
})
// eslint-disable-next-line react-refresh/only-export-components
function RouteComponent() {
  const { resourceId } = Route.useParams()
  return <ResourceDetailPage resourceId={resourceId} />
}
