import { createFileRoute } from '@tanstack/react-router'
import { VcmHomePage } from '@/features/vcm/pages/home-page'

export const Route = createFileRoute('/_authenticated/')({
  component: VcmHomePage,
})
