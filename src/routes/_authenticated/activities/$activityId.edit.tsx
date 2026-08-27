import { createFileRoute } from '@tanstack/react-router'
import { ActivityFormPage } from '@/features/activities'

export const Route = createFileRoute(
  '/_authenticated/activities/$activityId/edit'
)({
  component: RouteComponent,
})

// eslint-disable-next-line react-refresh/only-export-components
function RouteComponent() {
  const { activityId } = Route.useParams()
  return <ActivityFormPage activityId={activityId} />
}
