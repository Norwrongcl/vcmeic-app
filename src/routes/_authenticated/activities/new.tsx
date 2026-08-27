import { createFileRoute } from '@tanstack/react-router'
import { ActivityFormPage } from '@/features/activities'

export const Route = createFileRoute('/_authenticated/activities/new')({
  component: ActivityFormPage,
})
