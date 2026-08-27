import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  KanbanDndContext,
  KanbanDraggableCard,
  KanbanDroppableColumn,
} from '@/features/core/components/kanban-dnd'
import { VCM_LINE_LABELS } from '@/features/core/model/catalogs'
import { getActivityMove } from '@/features/core/model/kanban-transitions'
import {
  type Activity,
  type ActivityApprovalStatus,
} from '@/features/core/model/types'
import { formatEventDateTime } from '@/features/events/model/formatters'
import { RejectActivityDialog } from './reject-activity-dialog'

const approvalColumns: Array<{
  status: ActivityApprovalStatus
  label: string
}> = [
  { status: 'pending', label: 'Por aprobar' },
  { status: 'approved', label: 'Aprobadas' },
  { status: 'rejected', label: 'Rechazadas' },
]

const columnStyles: Record<ActivityApprovalStatus, string> = {
  pending: 'border-t-amber-400 bg-amber-50/50 dark:bg-amber-950/20',
  approved: 'border-t-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20',
  rejected: 'border-t-rose-400 bg-rose-50/50 dark:bg-rose-950/20',
}

function ActivityCard({
  activity,
  responsibleName,
  overlay = false,
}: {
  activity: Activity
  responsibleName: string
  overlay?: boolean
}) {
  return (
    <Card className='h-full transition-colors hover:bg-muted/40'>
      <CardHeader className='gap-3'>
        <CardTitle className='text-base leading-snug'>
          {overlay ? (
            activity.name
          ) : (
            <Link
              to='/activities/$activityId'
              params={{ activityId: activity.id }}
              className='rounded-sm hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'
            >
              {activity.name}
            </Link>
          )}
        </CardTitle>
        <p className='text-sm text-muted-foreground'>
          {formatEventDateTime(activity.endsAt)}
        </p>
      </CardHeader>
      <CardContent className='grid gap-2 text-sm'>
        <p className='line-clamp-1'>{VCM_LINE_LABELS[activity.vcmLine]}</p>
        <p className='line-clamp-1 text-muted-foreground'>{responsibleName}</p>
      </CardContent>
    </Card>
  )
}

export function ActivityKanbanBoard({
  activities,
  getResponsibleName,
  onApprove,
  onReject,
}: {
  activities: Activity[]
  getResponsibleName: (activity: Activity) => string
  onApprove: (activity: Activity) => void
  onReject: (activity: Activity, reason: string) => boolean
}) {
  const [pendingRejection, setPendingRejection] = useState<Activity>()
  const activitiesById = Object.fromEntries(
    activities.map((activity) => [activity.id, activity])
  )

  return (
    <>
      <KanbanDndContext
        isDropAllowed={({ itemId, toColumnId }) => {
          const activity = activitiesById[itemId]
          return (
            !!activity &&
            getActivityMove(
              activity.approvalStatus,
              toColumnId as ActivityApprovalStatus
            ) !== null
          )
        }}
        onMove={({ itemId, toColumnId }) => {
          const activity = activitiesById[itemId]
          if (!activity) return
          const move = getActivityMove(
            activity.approvalStatus,
            toColumnId as ActivityApprovalStatus
          )
          if (move === 'approve') onApprove(activity)
          if (move === 'reject') setPendingRejection(activity)
        }}
        renderOverlay={(itemId) => {
          const activity = activitiesById[itemId]
          return activity ? (
            <ActivityCard
              activity={activity}
              responsibleName={getResponsibleName(activity)}
              overlay
            />
          ) : null
        }}
      >
        <div className='grid auto-cols-[minmax(280px,1fr)] grid-flow-col gap-4 overflow-x-auto pb-3 xl:grid-flow-row xl:grid-cols-3'>
          {approvalColumns.map((column) => {
            const columnRows = activities.filter(
              (activity) => activity.approvalStatus === column.status
            )
            return (
              <KanbanDroppableColumn
                key={column.status}
                columnId={column.status}
                label={column.label}
                className={cn(
                  'rounded-lg border border-t-4 p-3 transition-[box-shadow,background-color]',
                  columnStyles[column.status]
                )}
              >
                <div className='mb-3 flex items-center justify-between'>
                  <h2 className='font-semibold'>{column.label}</h2>
                  <span className='text-sm text-muted-foreground'>
                    {columnRows.length}
                  </span>
                </div>
                <div className='grid gap-3'>
                  {columnRows.length ? (
                    columnRows.map((activity) => (
                      <KanbanDraggableCard
                        key={activity.id}
                        itemId={activity.id}
                        columnId={activity.approvalStatus}
                        label={activity.name}
                      >
                        <ActivityCard
                          activity={activity}
                          responsibleName={getResponsibleName(activity)}
                        />
                      </KanbanDraggableCard>
                    ))
                  ) : (
                    <p className='rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground'>
                      Sin actividades
                    </p>
                  )}
                </div>
              </KanbanDroppableColumn>
            )
          })}
        </div>
      </KanbanDndContext>
      <RejectActivityDialog
        key={pendingRejection?.id ?? 'no-rejection'}
        open={!!pendingRejection}
        onOpenChange={(open) => {
          if (!open) setPendingRejection(undefined)
        }}
        onConfirm={(reason) => {
          if (pendingRejection && onReject(pendingRejection, reason)) {
            setPendingRejection(undefined)
          }
        }}
      />
    </>
  )
}
