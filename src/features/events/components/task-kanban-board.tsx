import {
  CalendarDays,
  OctagonAlert,
  Pencil,
  Trash2,
  UserRound,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  KanbanDndContext,
  KanbanDraggableCard,
  KanbanDroppableColumn,
} from '@/features/core/components/kanban-dnd'
import { canMoveTask } from '@/features/core/model/kanban-transitions'
import { formatEventDate } from '../model/formatters'
import { taskPriorityLabels } from '../model/labels'
import { TASK_KANBAN_COLUMNS, groupTasksByStatus } from '../model/task-kanban'
import { type Event, type EventTask, type TaskStatus } from '../model/types'

const columnStyles: Record<TaskStatus, string> = {
  todo: 'border-t-amber-400 bg-amber-50/55 dark:bg-amber-950/20',
  in_progress: 'border-t-blue-500 bg-blue-50/55 dark:bg-blue-950/20',
  review: 'border-t-violet-500 bg-violet-50/55 dark:bg-violet-950/20',
  done: 'border-t-emerald-500 bg-emerald-50/55 dark:bg-emerald-950/20',
  cancelled: 'border-t-rose-400 bg-rose-50/55 dark:bg-rose-950/20',
}

const priorityStyles: Record<EventTask['priority'], string> = {
  low: 'bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-200',
  medium:
    'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200',
  high: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-200',
}

const phaseLabels = {
  pre: 'Pre-evento',
  during: 'Durante',
  post: 'Post-evento',
} as const

export function TaskKanbanBoard({
  tasks,
  events,
  onEdit,
  onDelete,
  onStatusChange,
}: {
  tasks: EventTask[]
  events: Record<string, Event>
  onEdit: (task: EventTask) => void
  onDelete: (task: EventTask) => void
  onStatusChange: (task: EventTask, status: TaskStatus) => void
}) {
  const groups = groupTasksByStatus(tasks)
  const tasksById = Object.fromEntries(tasks.map((task) => [task.id, task]))

  const renderTaskCard = (task: EventTask) => (
    <Card className='gap-4 border-0 py-4 shadow-sm ring-1 ring-black/5 transition-transform hover:-translate-y-0.5 dark:ring-white/10'>
      <CardHeader className='gap-3 px-4'>
        <div className='flex items-start justify-between gap-2'>
          <CardTitle className='text-sm leading-snug'>{task.title}</CardTitle>
          <span
            className={cn(
              'rounded-md px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap',
              priorityStyles[task.priority]
            )}
          >
            {taskPriorityLabels[task.priority]}
          </span>
        </div>
        <p className='text-xs font-medium text-primary'>
          {task.eventId
            ? (events[task.eventId]?.name ?? 'Evento eliminado')
            : 'Tarea general'}
        </p>
        {task.blocked ? (
          <span className='flex w-fit items-center gap-1 rounded-md bg-destructive/10 px-2 py-1 text-xs font-semibold text-destructive'>
            <OctagonAlert className='size-3.5' /> Bloqueada
          </span>
        ) : null}
      </CardHeader>
      <CardContent className='grid gap-2 px-4 text-xs text-muted-foreground'>
        <p className='flex items-center gap-2'>
          <UserRound className='size-3.5' />
          <span className='line-clamp-1'>{task.assignee}</span>
        </p>
        <p className='flex items-center gap-2'>
          <CalendarDays className='size-3.5' />
          {formatEventDate(task.dueDate)} · {phaseLabels[task.phase ?? 'pre']}
        </p>
        <div className='mt-1 flex justify-end gap-1 border-t pt-2'>
          <Button
            size='icon'
            variant='ghost'
            aria-label={`Editar ${task.title}`}
            onClick={() => onEdit(task)}
          >
            <Pencil />
          </Button>
          <Button
            size='icon'
            variant='ghost'
            aria-label={`Eliminar ${task.title}`}
            onClick={() => onDelete(task)}
          >
            <Trash2 />
          </Button>
        </div>
      </CardContent>
    </Card>
  )

  return (
    <KanbanDndContext
      isDropAllowed={({ itemId, toColumnId }) => {
        const task = tasksById[itemId]
        return !!task && canMoveTask(task.status, toColumnId as TaskStatus)
      }}
      onMove={({ itemId, toColumnId }) => {
        const task = tasksById[itemId]
        if (task) onStatusChange(task, toColumnId as TaskStatus)
      }}
      renderOverlay={(itemId) => {
        const task = tasksById[itemId]
        return task ? renderTaskCard(task) : null
      }}
    >
      <div className='grid auto-cols-[minmax(280px,1fr)] grid-flow-col gap-4 overflow-x-auto pb-3 xl:grid-flow-row xl:grid-cols-4'>
        {TASK_KANBAN_COLUMNS.map((column) => (
          <KanbanDroppableColumn
            key={column.status}
            columnId={column.status}
            label={column.label}
            className={cn(
              'rounded-xl border border-t-4 p-3 transition-[box-shadow,background-color]',
              columnStyles[column.status]
            )}
          >
            <div className='mb-3 flex items-center justify-between gap-3 px-1'>
              <h2 id={`task-column-${column.status}`} className='font-semibold'>
                {column.label}
              </h2>
              <span className='flex size-7 items-center justify-center rounded-full bg-background text-xs font-semibold shadow-sm'>
                {groups[column.status].length}
              </span>
            </div>
            <div className='grid gap-3'>
              {groups[column.status].length ? (
                groups[column.status].map((task) => (
                  <KanbanDraggableCard
                    key={task.id}
                    itemId={task.id}
                    columnId={task.status}
                    label={task.title}
                  >
                    {renderTaskCard(task)}
                  </KanbanDraggableCard>
                ))
              ) : (
                <p className='rounded-lg border border-dashed bg-background/50 p-5 text-center text-sm text-muted-foreground'>
                  Sin tareas
                </p>
              )}
            </div>
          </KanbanDroppableColumn>
        ))}
      </div>
    </KanbanDndContext>
  )
}
