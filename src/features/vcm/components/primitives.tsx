import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { STATE_LABELS } from '../model/catalogs'
import type { CaseState } from '../model/types'
import { useFormDraft } from './use-form-draft'

export function Panel({
  title,
  description,
  children,
  collapsible = false,
}: {
  title: string
  description?: string
  children: ReactNode
  collapsible?: boolean
}) {
  if (collapsible)
    return (
      <Card className='min-w-0'>
        <details className='group'>
          <summary className='cursor-pointer rounded-lg p-5 text-sm font-semibold outline-offset-4'>
            {title}
            <span className='ml-2 text-xs font-normal text-primary group-open:hidden'>
              Ver detalle
            </span>
            <span className='ml-2 hidden text-xs font-normal text-primary group-open:inline'>
              Ocultar detalle
            </span>
          </summary>
          <CardContent className='grid min-w-0 grid-cols-1 gap-4'>
            {description && (
              <p className='text-sm text-muted-foreground'>{description}</p>
            )}
            {children}
          </CardContent>
        </details>
      </Card>
    )
  return (
    <Card className='min-w-0'>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className='grid min-w-0 grid-cols-1 gap-4'>
        {children}
      </CardContent>
    </Card>
  )
}
export function Field({
  label,
  name,
  value,
  required = false,
  type = 'text',
  multiline = false,
  children,
  defaultValue,
  disabled = false,
}: {
  label: string
  name: string
  value?: string
  defaultValue?: string
  required?: boolean
  type?: string
  multiline?: boolean
  children?: ReactNode
  disabled?: boolean
}) {
  const inputId = useId()
  const props = {
    id: inputId,
    name,
    'aria-label': label,
    required,
    disabled,
    defaultValue: defaultValue ?? value,
  }
  return (
    <label
      className='grid min-w-0 grid-cols-1 gap-2 text-sm font-medium'
      htmlFor={inputId}
    >
      {label}
      {children ? (
        <select
          {...props}
          className='h-10 w-full min-w-0 rounded-md border bg-background px-3 text-sm font-normal'
        >
          {children}
        </select>
      ) : multiline ? (
        <Textarea {...props} className='min-w-0' rows={3} />
      ) : (
        <Input {...props} type={type} />
      )}
    </label>
  )
}
export function SaveForm({
  children,
  onSave,
  label = 'Guardar',
  disabled = false,
  draftKey,
}: {
  children: ReactNode
  onSave: (values: FormData) => Promise<boolean>
  draftKey?: string
  label?: string
  disabled?: boolean
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const {
    ref: formRef,
    dirty,
    unavailable,
    persist,
    clear,
    suspend,
    restore,
  } = useFormDraft(draftKey, disabled)
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = event.currentTarget
    setSaving(true)
    setError('')
    const savedDraft = suspend()
    try {
      if (await onSave(new FormData(form))) {
        clear()
        form.reset()
      } else {
        restore(savedDraft)
        setError(
          'No se pudo guardar. Revisa los datos e inténtalo de nuevo; tu borrador se conserva.'
        )
      }
    } catch (error) {
      restore(savedDraft)
      setError(error instanceof Error ? error.message : 'No se pudo guardar.')
    } finally {
      setSaving(false)
    }
  }
  return (
    <form
      ref={formRef}
      className='grid min-w-0 grid-cols-1 gap-4'
      onChange={persist}
      onSubmit={(e) => void submit(e)}
    >
      {dirty && !disabled ? (
        <div className='rounded border border-dashed p-3 text-xs' role='status'>
          <p>
            {unavailable
              ? 'No se pudo conservar el borrador. Guarda antes de salir.'
              : 'Borrador conservado en esta pestaña. Aún no forma parte del expediente; puedes volver y continuar.'}
          </p>
          <Button
            type='button'
            size='sm'
            variant='ghost'
            onClick={() => {
              clear()
              formRef.current?.reset()
            }}
          >
            Descartar borrador
          </Button>
        </div>
      ) : null}
      <fieldset
        disabled={disabled || saving}
        className='grid min-w-0 grid-cols-1 gap-4'
      >
        {children}
        {error ? (
          <p role='alert' className='text-sm text-destructive'>
            {error}
          </p>
        ) : null}
        <div>
          <Button type='submit' disabled={disabled || saving}>
            {saving ? 'Guardando…' : label}
          </Button>
        </div>
      </fieldset>
    </form>
  )
}
export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className='rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground'>
      {children}
    </p>
  )
}
export function StateBadge({ state }: { state: CaseState }) {
  return (
    <Badge
      variant={
        state === 'returned' || state === 'escalated'
          ? 'destructive'
          : state === 'closed' || state === 'validated'
            ? 'default'
            : 'secondary'
      }
    >
      {STATE_LABELS[state]}
    </Badge>
  )
}
export function Metric({
  label,
  value,
  note,
}: {
  label: string
  value: ReactNode
  note?: string
}) {
  return (
    <Card className='border-t-4 border-t-primary/60'>
      <CardContent className='pt-5'>
        <p className='text-sm text-muted-foreground'>{label}</p>
        <p className='my-2 text-3xl font-semibold'>{value}</p>
        {note ? <p className='text-xs text-muted-foreground'>{note}</p> : null}
      </CardContent>
    </Card>
  )
}
