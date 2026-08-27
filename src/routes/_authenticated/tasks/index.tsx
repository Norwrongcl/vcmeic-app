import { createFileRoute } from '@tanstack/react-router'
import { GlobalTasksPage } from '@/features/events/global-tasks-page'

export const Route = createFileRoute('/_authenticated/tasks/')({
  component: GlobalTasksPage,
})
