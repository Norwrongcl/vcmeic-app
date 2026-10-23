import { createFileRoute } from '@tanstack/react-router'
import { VcmReportsPage } from '@/features/vcm/pages/reports-page'

export const Route = createFileRoute('/_authenticated/reports/')({
  component: VcmReportsPage,
})
