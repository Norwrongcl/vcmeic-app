import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/events/$eventId/edit')({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/portfolio/$caseId',
      params: { caseId: params.eventId },
      replace: true,
    })
  },
})
