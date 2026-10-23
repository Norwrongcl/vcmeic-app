import { createFileRoute, redirect } from '@tanstack/react-router'
import { ResourceFormPage } from '@/features/resources'
import { useDemoRole } from '@/features/vcm/model/use-vcm'

export const Route = createFileRoute('/_authenticated/resources/new')({
  beforeLoad: () => {
    if (!['coordination', 'leadership'].includes(useDemoRole.getState().role))
      throw redirect({ to: '/portfolio', replace: true })
  },
  component: ResourceFormPage,
})
