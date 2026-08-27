import { createFileRoute } from '@tanstack/react-router'
import { AgendaPage } from '@/features/agenda'

export const Route = createFileRoute('/_authenticated/agenda/')({
  component: AgendaPage,
})
