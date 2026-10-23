import { useState } from 'react'
import { CheckCircle2, ListTodo, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { useEventsStore } from '../model/events-store'
import { formatEventDate } from '../model/formatters'
import { taskPriorityLabels } from '../model/labels'
import { type EventPhase, type EventTask } from '../model/types'
import { TaskStatusBadge } from './status-badges'
import { TaskFormDialog } from './task-form-dialog'

const phaseLabels: Record<EventPhase, string> = {
  pre: 'Pre-evento',
  during: 'Durante',
  post: 'Post-evento',
}

export function EventTasks({
  eventId,
  phase,
}: {
  eventId: string
  phase?: EventPhase
}) {
  const tasks = useEventsStore((state) => state.tasks)
  const contacts = useEventsStore((state) => state.contacts)
  const updateTask = useEventsStore((state) => state.updateTask)
  const deleteTask = useEventsStore((state) => state.deleteTask)
  const eventTasks = Object.values(tasks).filter(
    (task) =>
      task.eventId === eventId && (!phase || (task.phase ?? 'pre') === phase)
  )
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<EventTask>()
  const [deletingTask, setDeletingTask] = useState<EventTask>()

  const openCreate = () => {
    setEditingTask(undefined)
    setDialogOpen(true)
  }

  const openEdit = (task: EventTask) => {
    setEditingTask(task)
    setDialogOpen(true)
  }

  return (
    <Card>
      <CardHeader className='flex flex-row items-start justify-between gap-4'>
        <div className='flex flex-col gap-1.5'>
          <CardTitle>
            {phase ? `Tareas · ${phaseLabels[phase]}` : 'Tareas del evento'}
          </CardTitle>
          <CardDescription>
            {eventTasks.filter((task) => task.status === 'done').length} de{' '}
            {eventTasks.length} completadas
          </CardDescription>
        </div>
        <Button onClick={openCreate}>
          <Plus data-icon='inline-start' />
          Nueva tarea
        </Button>
      </CardHeader>
      <CardContent>
        {eventTasks.length ? (
          <div className='overflow-hidden rounded-md border'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tarea</TableHead>
                  <TableHead>Responsable</TableHead>
                  <TableHead>Vencimiento</TableHead>
                  <TableHead>Prioridad</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className='text-end'>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {eventTasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell className='max-w-64 whitespace-normal'>
                      <p className='font-medium'>{task.title}</p>
                      {task.description ? (
                        <p className='line-clamp-1 text-xs text-muted-foreground'>
                          {task.description}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {task.assigneeContactIds?.length
                        ? task.assigneeContactIds
                            .map((id) => contacts[id]?.name)
                            .filter(Boolean)
                            .join(', ')
                        : task.assignee}
                    </TableCell>
                    <TableCell>{formatEventDate(task.dueDate)}</TableCell>
                    <TableCell>{taskPriorityLabels[task.priority]}</TableCell>
                    <TableCell>
                      <TaskStatusBadge status={task.status} />
                    </TableCell>
                    <TableCell>
                      <div className='flex justify-end gap-1'>
                        {task.status !== 'done' ? (
                          <Button
                            size='icon'
                            variant='ghost'
                            aria-label={`Completar ${task.title}`}
                            onClick={() => {
                              try {
                                updateTask(task.id, { status: 'done' })
                                toast.success('Tarea completada.')
                              } catch (error) {
                                toast.error(
                                  error instanceof Error
                                    ? error.message
                                    : 'No se pudo completar.'
                                )
                              }
                            }}
                          >
                            <CheckCircle2 />
                          </Button>
                        ) : null}
                        <Button
                          size='icon'
                          variant='ghost'
                          aria-label={`Editar ${task.title}`}
                          onClick={() => openEdit(task)}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          size='icon'
                          variant='ghost'
                          aria-label={`Eliminar ${task.title}`}
                          onClick={() => setDeletingTask(task)}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <Empty className='border'>
            <EmptyHeader>
              <EmptyMedia variant='icon'>
                <ListTodo />
              </EmptyMedia>
              <EmptyTitle>No hay tareas</EmptyTitle>
              <EmptyDescription>
                Crea la primera tarea para organizar este evento.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button onClick={openCreate}>Crear tarea</Button>
            </EmptyContent>
          </Empty>
        )}
      </CardContent>
      <TaskFormDialog
        key={`${editingTask?.id ?? 'new-event-task'}-${phase ?? 'all'}`}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        eventId={eventId}
        phase={phase}
        task={editingTask}
      />
      <ConfirmDialog
        open={!!deletingTask}
        onOpenChange={(open) => {
          if (!open) setDeletingTask(undefined)
        }}
        title='Eliminar tarea'
        desc='La tarea se eliminará también del listado general.'
        confirmText='Eliminar'
        destructive
        handleConfirm={() => {
          if (!deletingTask) return
          try {
            deleteTask(deletingTask.id)
          } catch (error) {
            toast.error(
              error instanceof Error ? error.message : 'No se pudo eliminar.'
            )
            return
          }
          setDeletingTask(undefined)
          toast.success('Tarea eliminada.')
        }}
      />
    </Card>
  )
}
