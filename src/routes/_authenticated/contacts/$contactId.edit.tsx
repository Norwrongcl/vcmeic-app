import { createFileRoute } from '@tanstack/react-router'
import { DirectoryFormPage } from '@/features/directory'

export const Route = createFileRoute(
  '/_authenticated/contacts/$contactId/edit'
)({ component: RouteComponent })
// eslint-disable-next-line react-refresh/only-export-components
function RouteComponent() {
  const { contactId } = Route.useParams()
  return <DirectoryFormPage entity='contacts' entityId={contactId} />
}
