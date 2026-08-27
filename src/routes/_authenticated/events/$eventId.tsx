import { createFileRoute } from '@tanstack/react-router'
import { EventDetailPage } from '@/features/events'

export const Route = createFileRoute('/_authenticated/events/$eventId')({
  component: RouteComponent,
})

// eslint-disable-next-line react-refresh/only-export-components
function RouteComponent() {
  const { eventId } = Route.useParams()
  return <EventDetailPage eventId={eventId} />
}
