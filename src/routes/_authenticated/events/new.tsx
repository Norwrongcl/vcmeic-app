import { createFileRoute } from '@tanstack/react-router'
import { EventFormPage } from '@/features/events'

export const Route = createFileRoute('/_authenticated/events/new')({
  component: EventFormPage,
})
