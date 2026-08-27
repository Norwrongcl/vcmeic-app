import { useMemo, useState } from 'react'
import { Pencil, Plus, SearchIcon, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { EntityViewSwitcher } from '@/features/core/components/entity-view-switcher'
import { useEntityViewPreference } from '@/features/core/model/view-preferences'
import { TaskStatusBadge } from './components/status-badges'
import { TaskFormDialog } from './components/task-form-dialog'
import { TaskKanbanBoard } from './components/task-kanban-board'
import { useEventsStore } from './model/events-store'
import { formatEventDate } from './model/formatters'
import { taskPriorityLabels, taskStatusLabels } from './model/labels'
import { type EventPhase, type EventTask, type TaskStatus } from './model/types'

const phaseLabels: Record<EventPhase, string> = {
  pre: 'Pre-evento',
  during: 'Durante',
  post: 'Post-evento',
}

const TASK_VIEW_MODES = ['table', 'kanban'] as const

export function GlobalTasksPage() {
  const events = useEventsStore((state) => state.events)
  const tasks = useEventsStore((state) => state.tasks)
  const deleteTask = useEventsStore((state) => state.deleteTask)
  const updateTask = useEventsStore((state) => state.updateTask)
  const [query, setQuery] = useState('')
  const [view, setView] = useEntityViewPreference('tasks', TASK_VIEW_MODES)
  const [status, setStatus] = useState<TaskStatus | 'all'>('all')
  const [eventId, setEventId] = useState('all')
  const [formOpen, setFormOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<EventTask>()
  const [deletingTask, setDeletingTask] = useState<EventTask>()

  const filteredTasks = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('es-CL')
    return Object.values(tasks)
      .filter((task) => {
        const matchesQuery =
          !normalizedQuery ||
          [
            task.title,
            task.assignee,
            task.eventId ? events[task.eventId]?.name : '',
          ]
            .join(' ')
            .toLocaleLowerCase('es-CL')
            .includes(normalizedQuery)
        return (
          matchesQuery &&
          (status === 'all' || task.status === status) &&
          (eventId === 'all' ||
            (eventId === 'none' ? !task.eventId : task.eventId === eventId))
        )
      })
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  }, [eventId, events, query, status, tasks])

  const openCreate = () => {
    setEditingTask(undefined)
    setFormOpen(true)
  }

  return (
    <>
      <Header fixed>
        <Search className='me-auto' />
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>
      <Main className='flex flex-col gap-6'>
        <div className='flex flex-wrap items-end justify-between gap-3'>
          <div>
            <h1 className='text-2xl font-bold tracking-tight'>Tareas</h1>
            <p className='text-muted-foreground'>
              Tareas generales y tareas vinculadas a eventos.
            </p>
          </div>
          <Button onClick={openCreate}>
            <Plus data-icon='inline-start' />
            Nueva tarea
          </Button>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Listado de tareas</CardTitle>
            <CardDescription>
              Los cambios se sincronizan con la ficha de cada evento.
            </CardDescription>
          </CardHeader>
          <CardContent className='flex flex-col gap-4'>
            <div className='grid gap-3 md:grid-cols-[minmax(220px,1fr)_220px_240px]'>
              <div className='relative'>
                <SearchIcon
                  aria-hidden='true'
                  className='absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground'
                />
                <Input
                  value={query}
                  onChange={(inputEvent) => setQuery(inputEvent.target.value)}
                  placeholder='Buscar tarea, responsable o evento'
                  aria-label='Buscar tareas'
                  className='ps-9'
                />
              </div>
              <Select
                value={status}
                onValueChange={(value) =>
                  setStatus(value as TaskStatus | 'all')
                }
              >
                <SelectTrigger aria-label='Filtrar tareas por estado'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value='all'>Todos los estados</SelectItem>
                    {Object.entries(taskStatusLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <Select value={eventId} onValueChange={setEventId}>
                <SelectTrigger aria-label='Filtrar tareas por evento'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value='all'>Todos los eventos</SelectItem>
                    <SelectItem value='none'>Sin evento</SelectItem>
                    {Object.values(events).map((event) => (
                      <SelectItem key={event.id} value={event.id}>
                        {event.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
            <div className='flex justify-end'>
              <EntityViewSwitcher
                value={view}
                modes={TASK_VIEW_MODES}
                onValueChange={setView}
              />
            </div>
            {view === 'table' ? (
              <div className='overflow-hidden rounded-md border'>
                <Table className='min-w-4xl'>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tarea</TableHead>
                      <TableHead>Evento</TableHead>
                      <TableHead>Responsable</TableHead>
                      <TableHead>Etapa</TableHead>
                      <TableHead>Vencimiento</TableHead>
                      <TableHead>Prioridad</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className='text-end'>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTasks.map((task) => (
                      <TableRow key={task.id}>
                        <TableCell className='max-w-72 font-medium whitespace-normal'>
                          {task.title}
                        </TableCell>
                        <TableCell>
                          {task.eventId
                            ? (events[task.eventId]?.name ?? 'Evento eliminado')
                            : '—'}
                        </TableCell>
                        <TableCell>{task.assignee}</TableCell>
                        <TableCell>
                          {phaseLabels[task.phase ?? 'pre']}
                        </TableCell>
                        <TableCell>{formatEventDate(task.dueDate)}</TableCell>
                        <TableCell>
                          {taskPriorityLabels[task.priority]}
                        </TableCell>
                        <TableCell>
                          <TaskStatusBadge status={task.status} />
                        </TableCell>
                        <TableCell>
                          <div className='flex justify-end gap-1'>
                            <Button
                              size='icon'
                              variant='ghost'
                              aria-label={`Editar ${task.title}`}
                              onClick={() => {
                                setEditingTask(task)
                                setFormOpen(true)
                              }}
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
                    {!filteredTasks.length ? (
                      <TableRow>
                        <TableCell colSpan={8} className='h-24 text-center'>
                          No hay tareas que coincidan con los filtros.
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <TaskKanbanBoard
                tasks={filteredTasks}
                events={events}
                onEdit={(task) => {
                  setEditingTask(task)
                  setFormOpen(true)
                }}
                onDelete={setDeletingTask}
                onStatusChange={(task, nextStatus) => {
                  updateTask(task.id, { status: nextStatus })
                  toast.success(
                    `Tarea movida a ${taskStatusLabels[nextStatus]}.`
                  )
                }}
              />
            )}
          </CardContent>
        </Card>
      </Main>
      <TaskFormDialog
        key={editingTask?.id ?? 'new-global-task'}
        open={formOpen}
        onOpenChange={setFormOpen}
        task={editingTask}
      />
      <ConfirmDialog
        open={!!deletingTask}
        onOpenChange={(open) => {
          if (!open) setDeletingTask(undefined)
        }}
        title='Eliminar tarea'
        desc='La tarea se eliminará también de la ficha del evento asociado.'
        confirmText='Eliminar'
        destructive
        handleConfirm={() => {
          if (!deletingTask) return
          deleteTask(deletingTask.id)
          setDeletingTask(undefined)
          toast.success('Tarea eliminada.')
        }}
      />
    </>
  )
}
