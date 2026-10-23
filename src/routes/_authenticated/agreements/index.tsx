import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/agreements/')({
  beforeLoad: () => {
    throw redirect({
      to: '/portfolio',
      search: { view: 'agreements' },
      replace: true,
    })
  },
})
