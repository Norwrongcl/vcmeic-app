import { createFileRoute } from '@tanstack/react-router'
import { DirectoryFormPage } from '@/features/directory'

export const Route = createFileRoute('/_authenticated/contacts/new')({
  component: () => <DirectoryFormPage entity='contacts' />,
})
