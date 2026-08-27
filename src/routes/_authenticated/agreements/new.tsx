import { createFileRoute } from '@tanstack/react-router'
import { AgreementFormPage } from '@/features/agreements'

export const Route = createFileRoute('/_authenticated/agreements/new')({
  component: AgreementFormPage,
})
