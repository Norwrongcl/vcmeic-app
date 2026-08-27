import { createFileRoute } from '@tanstack/react-router'
import { DirectoryFormPage } from '@/features/directory'

export const Route = createFileRoute(
  '/_authenticated/partners/$partnerId/edit'
)({ component: RouteComponent })
// eslint-disable-next-line react-refresh/only-export-components
function RouteComponent() {
  const { partnerId } = Route.useParams()
  return <DirectoryFormPage entity='partners' entityId={partnerId} />
}
