import { createFileRoute } from '@tanstack/react-router'
import { PartnerDetailPage } from '@/features/directory'

export const Route = createFileRoute('/_authenticated/partners/$partnerId')({
  component: RouteComponent,
})

// eslint-disable-next-line react-refresh/only-export-components
function RouteComponent() {
  const { partnerId } = Route.useParams()
  return <PartnerDetailPage partnerId={partnerId} />
}
