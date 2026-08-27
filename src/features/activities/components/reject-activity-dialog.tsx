import { useId, useState } from 'react'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

export function RejectActivityDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (reason: string) => void
}) {
  const inputId = useId()
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  const confirm = () => {
    const normalized = reason.trim()
    if (!normalized) {
      setError('Ingresa el motivo del rechazo.')
      return
    }
    onConfirm(normalized)
    onOpenChange(false)
    setReason('')
    setError('')
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Rechazar actividad</AlertDialogTitle>
          <AlertDialogDescription>
            El motivo quedará visible en el registro para poder corregirlo.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className='grid gap-2'>
          <label htmlFor={inputId} className='text-sm font-medium'>
            Motivo del rechazo
          </label>
          <Textarea
            id={inputId}
            value={reason}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? `${inputId}-error` : undefined}
            onChange={(event) => {
              setReason(event.target.value)
              if (error) setError('')
            }}
            placeholder='Explica qué antecedente falta o debe corregirse.'
          />
          {error && (
            <p id={`${inputId}-error`} className='text-sm text-destructive'>
              {error}
            </p>
          )}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <Button type='button' variant='destructive' onClick={confirm}>
            Rechazar actividad
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
