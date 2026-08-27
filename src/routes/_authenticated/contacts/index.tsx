import { createFileRoute } from '@tanstack/react-router'
import { DirectoryPage } from '@/features/directory'

export const Route = createFileRoute('/_authenticated/contacts/')({
  component: () => <DirectoryPage entity='contacts' />,
})
