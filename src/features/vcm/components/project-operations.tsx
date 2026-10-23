import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { useAppStore } from '@/features/core/model/app-store'
import type { EventTask } from '@/features/core/model/types'
import { EventTasks } from '@/features/events/components/event-tasks'
import { TaskFormDialog } from '@/features/events/components/task-form-dialog'
import { TaskKanbanBoard } from '@/features/events/components/task-kanban-board'
import { text } from '../model/form-utils'
import type { Dossier } from '../model/types'
import { EmptyState, Field, Panel, SaveForm } from './primitives'

export function ProjectOperations({ dossier: c }: { dossier: Dossier }) {
  const state = useAppStore((s) => s)
  const [view, setView] = useState('table')
  const [editing, setEditing] = useState<EventTask>()
  const [deleting, setDeleting] = useState<EventTask>()
  const tasks = Object.values(state.tasks).filter(
    (t) => t.eventId === c.projectId
  )
  return (
    <div className='grid min-w-0 grid-cols-1 gap-6'>
      <div className='flex gap-2' role='group' aria-label='Vista de tareas'>
        <Button
          size='sm'
          variant={view === 'table' ? 'default' : 'outline'}
          onClick={() => setView('table')}
        >
          Tabla de tareas
        </Button>
        <Button
          size='sm'
          variant={view === 'kanban' ? 'default' : 'outline'}
          onClick={() => setView('kanban')}
        >
          Kanban
        </Button>
      </div>
      {view === 'table' ? (
        <EventTasks eventId={c.projectId!} />
      ) : (
        <div className='min-w-0 overflow-x-auto'>
          <TaskKanbanBoard
            tasks={tasks}
            events={{
              ...state.events,
              [c.projectId!]: {
                id: c.projectId!,
                name: c.name,
                description: '',
                startsAt: c.fields.startsAt?.value ?? '',
                endsAt: c.fields.endsAt?.value ?? '',
                location: '',
                owner: c.responsible,
                status: c.executionState,
                createdAt: c.createdAt,
                updatedAt: c.updatedAt,
              },
            }}
            onEdit={setEditing}
            onDelete={setDeleting}
            onStatusChange={(task, status) => {
              const dependencies = task.dependencyIds ?? []
              if (
                status === 'done' &&
                dependencies.some((id) => state.tasks[id]?.status !== 'done')
              ) {
                toast.error(
                  'Completa las dependencias antes de cerrar esta tarea.'
                )
                return
              }
              state.updateTask(task.id, { status })
            }}
          />
        </div>
      )}
      <Panel
        title='Hitos y dependencias'
        description='Fechas y relaciones operacionales del proyecto. Se conservarán como referencias cuando se conecte Notion.'
      >
        {tasks
          .filter((t) => t.kind === 'milestone')
          .map((t) => (
            <div key={t.id} className='rounded border p-3 text-sm'>
              <strong>{t.title}</strong>
              <p className='text-xs text-muted-foreground'>
                {t.dueDate} · depende de{' '}
                {(t.dependencyIds ?? [])
                  .map((id) => state.tasks[id]?.title ?? id)
                  .join(', ') || 'sin dependencias'}
              </p>
            </div>
          ))}
        <SaveForm
          label='Crear hito local'
          onSave={async (f) => {
            state.addTask({
              eventId: c.projectId!,
              kind: 'milestone',
              title: text(f, 'milestoneTitle'),
              description: text(f, 'milestoneDescription'),
              assignee: c.responsible,
              dueDate: text(f, 'milestoneDate'),
              priority: 'medium',
              status: 'todo',
              dependencyIds: f.getAll('dependencyIds').map(String),
            })
            return true
          }}
        >
          <Field name='milestoneTitle' label='Nombre del hito' required />
          <Field
            name='milestoneDate'
            label='Fecha del hito'
            type='date'
            required
          />
          <Field
            name='milestoneDescription'
            label='Resultado esperado del hito'
            multiline
          />
          <fieldset className='grid gap-2'>
            <legend className='mb-2 text-sm font-medium'>Depende de</legend>
            {tasks.map((t) => (
              <label className='flex gap-2 text-sm' key={t.id}>
                <input type='checkbox' name='dependencyIds' value={t.id} />
                {t.title}
              </label>
            ))}
            {!tasks.length ? (
              <EmptyState>Sin tareas previas para vincular.</EmptyState>
            ) : null}
          </fieldset>
        </SaveForm>
      </Panel>
      <TaskFormDialog
        key={editing?.id ?? 'new'}
        open={Boolean(editing)}
        onOpenChange={(open) => {
          if (!open) setEditing(undefined)
        }}
        eventId={c.projectId!}
        task={editing}
      />
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => {
          if (!open) setDeleting(undefined)
        }}
        title='Eliminar tarea'
        desc='La eliminación quedará registrada en el historial local.'
        confirmText='Eliminar'
        destructive
        handleConfirm={() => {
          if (deleting) {
            try {
              state.deleteTask(deleting.id)
            } catch (error) {
              toast.error(
                error instanceof Error ? error.message : 'No se pudo eliminar.'
              )
              return
            }
          }
          setDeleting(undefined)
        }}
      />
    </div>
  )
}
