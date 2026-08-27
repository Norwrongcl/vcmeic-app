import { createFileRoute } from '@tanstack/react-router'
import { ActivityDetailPage } from '@/features/activities'

export const Route = createFileRoute('/_authenticated/activities/$activityId')({
  component: RouteComponent,
})

// eslint-disable-next-line react-refresh/only-export-components
function RouteComponent() {
  const { activityId } = Route.useParams()
  return <ActivityDetailPage activityId={activityId} />
}
