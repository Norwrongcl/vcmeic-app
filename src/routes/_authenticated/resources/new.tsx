import { createFileRoute } from '@tanstack/react-router'
import { ResourceFormPage } from '@/features/resources'

export const Route = createFileRoute('/_authenticated/resources/new')({
  component: ResourceFormPage,
})
