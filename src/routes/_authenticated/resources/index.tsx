import { createFileRoute } from '@tanstack/react-router'
import { ResourcesPage } from '@/features/resources'

export const Route = createFileRoute('/_authenticated/resources/')({
  component: ResourcesPage,
})
