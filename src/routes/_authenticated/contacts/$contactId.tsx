import { createFileRoute } from '@tanstack/react-router'
import { ContactDetailPage } from '@/features/directory'

export const Route = createFileRoute('/_authenticated/contacts/$contactId')({
  component: RouteComponent,
})
// eslint-disable-next-line react-refresh/only-export-components
function RouteComponent() {
  const { contactId } = Route.useParams()
  return <ContactDetailPage contactId={contactId} />
}
