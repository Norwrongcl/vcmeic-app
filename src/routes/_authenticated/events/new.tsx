import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/events/new')({
  beforeLoad: () => {
    throw redirect({
      to: '/portfolio/new',
      search: { kind: 'event' },
      replace: true,
    })
  },
})
