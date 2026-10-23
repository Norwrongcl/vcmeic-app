import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/resources/')({
  beforeLoad: () => {
    throw redirect({ to: '/portfolio', search: { view: 'all' }, replace: true })
  },
})
