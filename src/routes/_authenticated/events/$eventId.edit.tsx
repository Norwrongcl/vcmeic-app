import { createFileRoute } from '@tanstack/react-router'
import { EventFormPage } from '@/features/events'

export const Route = createFileRoute('/_authenticated/events/$eventId/edit')({
  component: RouteComponent,
})

// eslint-disable-next-line react-refresh/only-export-components
function RouteComponent() {
  const { eventId } = Route.useParams()
  return <EventFormPage eventId={eventId} />
}
