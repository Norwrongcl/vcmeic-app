import { createFileRoute } from '@tanstack/react-router'
import { AgreementsPage } from '@/features/agreements'

export const Route = createFileRoute('/_authenticated/agreements/')({
  component: AgreementsPage,
})
