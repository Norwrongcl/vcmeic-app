import { createFileRoute, redirect } from '@tanstack/react-router'
import { AgreementFormPage } from '@/features/agreements'
import { useDemoRole } from '@/features/vcm/model/use-vcm'

export const Route = createFileRoute('/_authenticated/agreements/new')({
  beforeLoad: () => {
    if (!['coordination', 'leadership'].includes(useDemoRole.getState().role))
      throw redirect({ to: '/portfolio', replace: true })
  },
  component: AgreementFormPage,
})
