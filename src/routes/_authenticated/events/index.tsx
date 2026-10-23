import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/events/')({
  beforeLoad: () => {
    throw redirect({
      to: '/portfolio',
      search: { view: 'event' },
      replace: true,
    })
  },
})
