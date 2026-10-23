import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/activities/')({
  beforeLoad: () => {
    throw redirect({
      to: '/control',
      search: { view: 'activities' },
      replace: true,
    })
  },
})
