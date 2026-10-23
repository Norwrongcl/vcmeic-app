import { createFileRoute, redirect } from '@tanstack/react-router'
import { DirectoryFormPage } from '@/features/directory'
import { useDemoRole } from '@/features/vcm/model/use-vcm'

export const Route = createFileRoute('/_authenticated/contacts/new')({
  beforeLoad: () => {
    if (!['coordination', 'leadership'].includes(useDemoRole.getState().role))
      throw redirect({ to: '/portfolio', replace: true })
  },
  component: () => <DirectoryFormPage entity='contacts' />,
})
