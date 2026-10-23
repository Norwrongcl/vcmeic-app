import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { ContactMultiSelect } from '@/features/directory'
import { useEventsStore } from '../model/events-store'
import { taskPriorityLabels, taskStatusLabels } from '../model/labels'
import {
  type EventTask,
  type EventTaskInput,
  type EventPhase,
  type TaskPriority,
  type TaskStatus,
} from '../model/types'
import { validateTask, type ValidationErrors } from '../model/validation'
import { FormField } from './form-field'

type TaskFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  eventId?: string
  phase?: EventPhase
  task?: EventTask
}

function taskValues(
  task?: EventTask,
  eventId?: string,
  phase?: EventPhase
): EventTaskInput {
  return task
    ? {
        eventId: task.eventId,
        title: task.title,
        description: task.description,
        assignee: task.assignee,
        assigneeContactIds: task.assigneeContactIds ?? [],
        phase: task.phase ?? phase ?? 'pre',
        dueDate: task.dueDate,
        priority: task.priority,
        status: task.status,
        blocked: task.blocked ?? false,
      }
    : {
        eventId,
        title: '',
        description: '',
        assignee: '',
        assigneeContactIds: [],
        phase: phase ?? 'pre',
        dueDate: '',
        priority: 'medium',
        status: 'todo',
        blocked: false,
      }
}

export function TaskFormDialog({
  open,
  onOpenChange,
  eventId,
  phase,
  task,
}: TaskFormDialogProps) {
  const events = useEventsStore((state) => state.events)
  const contacts = useEventsStore((state) => state.contacts)
  const addTask = useEventsStore((state) => state.addTask)
  const updateTask = useEventsStore((state) => state.updateTask)
  const [values, setValues] = useState<EventTaskInput>(() =>
    taskValues(task, eventId, phase)
  )
  const [errors, setErrors] = useState<ValidationErrors<EventTaskInput>>({})

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setValues(taskValues(task, eventId, phase))
      setErrors({})
    }
    onOpenChange(nextOpen)
  }

  const setField = <K extends keyof EventTaskInput>(
    key: K,
    value: EventTaskInput[K]
  ) => {
    setValues((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
  }

  const handleSubmit = (submitEvent: FormEvent<HTMLFormElement>) => {
    submitEvent.preventDefault()
    const nextErrors = validateTask(values)
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }
    try {
      if (task) updateTask(task.id, values)
      else addTask(values)
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'No se pudo guardar.'
      )
      return
    }
    toast.success(task ? 'Tarea actualizada.' : 'Tarea creada.')
    handleOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className='max-h-[90svh] overflow-y-auto sm:max-w-xl'>
        <DialogHeader>
          <DialogTitle>{task ? 'Editar tarea' : 'Nueva tarea'}</DialogTitle>
          <DialogDescription>
            La tarea se verá tanto aquí como en el listado general.
          </DialogDescription>
        </DialogHeader>
        <form
          id='task-form'
          onSubmit={handleSubmit}
          className='flex flex-col gap-4'
        >
          {!eventId ? (
            <FormField id='task-event' label='Evento'>
              <Select
                value={values.eventId ?? 'none'}
                onValueChange={(value) =>
                  setField('eventId', value === 'none' ? undefined : value)
                }
              >
                <SelectTrigger id='task-event'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value='none'>Sin evento</SelectItem>
                    {Object.values(events).map((event) => (
                      <SelectItem key={event.id} value={event.id}>
                        {event.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </FormField>
          ) : null}
          <FormField id='task-title' label='Título' error={errors.title}>
            <Input
              id='task-title'
              value={values.title}
              onChange={(inputEvent) =>
                setField('title', inputEvent.target.value)
              }
              aria-invalid={!!errors.title}
              autoFocus
            />
          </FormField>
          <FormField id='task-description' label='Descripción'>
            <Textarea
              id='task-description'
              value={values.description}
              onChange={(inputEvent) =>
                setField('description', inputEvent.target.value)
              }
            />
          </FormField>
          <div className='grid gap-4 sm:grid-cols-2'>
            <FormField id='task-phase' label='Etapa'>
              <Select
                value={values.phase ?? 'pre'}
                onValueChange={(value) =>
                  setField('phase', value as EventPhase)
                }
                disabled={!!phase}
              >
                <SelectTrigger id='task-phase'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value='pre'>Pre-evento</SelectItem>
                  <SelectItem value='during'>Durante</SelectItem>
                  <SelectItem value='post'>Post-evento</SelectItem>
                </SelectContent>
              </Select>
            </FormField>
            <FormField
              id='task-assignee'
              label='Responsables'
              error={errors.assignee}
            >
              <ContactMultiSelect
                id='task-assignee'
                value={values.assigneeContactIds ?? []}
                onValueChange={(contactIds) => {
                  setValues((current) => ({
                    ...current,
                    assigneeContactIds: contactIds,
                    assignee: contactIds
                      .map((contactId) => contacts[contactId]?.name)
                      .filter(Boolean)
                      .join(', '),
                  }))
                  setErrors((current) => ({
                    ...current,
                    assignee: undefined,
                  }))
                }}
              />
            </FormField>
            <FormField
              id='task-due-date'
              label='Vencimiento'
              error={errors.dueDate}
            >
              <Input
                id='task-due-date'
                type='date'
                value={values.dueDate}
                onChange={(inputEvent) =>
                  setField('dueDate', inputEvent.target.value)
                }
                aria-invalid={!!errors.dueDate}
              />
            </FormField>
            <FormField id='task-priority' label='Prioridad'>
              <Select
                value={values.priority}
                onValueChange={(value) =>
                  setField('priority', value as TaskPriority)
                }
              >
                <SelectTrigger id='task-priority'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {Object.entries(taskPriorityLabels).map(
                      ([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      )
                    )}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </FormField>
            <FormField id='task-status' label='Estado'>
              <Select
                value={values.status}
                onValueChange={(value) =>
                  setField('status', value as TaskStatus)
                }
              >
                <SelectTrigger id='task-status'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {Object.entries(taskStatusLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </FormField>
            <FormField id='task-blocked' label='Bloqueo transversal'>
              <div className='flex min-h-9 items-center justify-between rounded-md border px-3'>
                <span className='text-sm'>Marcar como bloqueada</span>
                <Switch
                  id='task-blocked'
                  checked={values.blocked ?? false}
                  onCheckedChange={(checked) => setField('blocked', checked)}
                />
              </div>
            </FormField>
          </div>
        </form>
        <DialogFooter>
          <Button
            type='button'
            variant='outline'
            onClick={() => handleOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button type='submit' form='task-form'>
            Guardar tarea
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
