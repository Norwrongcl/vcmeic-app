import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute(
  '/_authenticated/activities/$activityId/edit'
)({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: '/portfolio/$caseId',
      params: { caseId: params.activityId },
      replace: true,
    })
  },
})
