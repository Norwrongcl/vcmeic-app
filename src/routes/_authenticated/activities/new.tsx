import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/activities/new')({
  beforeLoad: () => {
    throw redirect({
      to: '/portfolio/new',
      search: { kind: 'activity' },
      replace: true,
    })
  },
})
