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
import { useEventsStore } from '../model/events-store'
import { type BudgetItem, type BudgetItemInput } from '../model/types'
import { validateBudgetItem, type ValidationErrors } from '../model/validation'
import { FormField } from './form-field'

type BudgetFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  eventId: string
  item?: BudgetItem
}

function budgetValues(eventId: string, item?: BudgetItem): BudgetItemInput {
  return item
    ? {
        eventId: item.eventId,
        name: item.name,
        plannedAmount: item.plannedAmount,
      }
    : { eventId, name: '', plannedAmount: 0 }
}

export function BudgetFormDialog({
  open,
  onOpenChange,
  eventId,
  item,
}: BudgetFormDialogProps) {
  const addBudgetItem = useEventsStore((state) => state.addBudgetItem)
  const updateBudgetItem = useEventsStore((state) => state.updateBudgetItem)
  const [values, setValues] = useState<BudgetItemInput>(() =>
    budgetValues(eventId, item)
  )
  const [errors, setErrors] = useState<ValidationErrors<BudgetItemInput>>({})

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setValues(budgetValues(eventId, item))
      setErrors({})
    }
    onOpenChange(nextOpen)
  }

  const handleSubmit = (submitEvent: FormEvent<HTMLFormElement>) => {
    submitEvent.preventDefault()
    const nextErrors = validateBudgetItem(values)
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }
    if (item) updateBudgetItem(item.id, values)
    else addBudgetItem(values)
    toast.success(item ? 'Partida actualizada.' : 'Partida creada.')
    handleOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item ? 'Editar partida' : 'Nueva partida'}</DialogTitle>
          <DialogDescription>
            Define el monto planificado en pesos chilenos.
          </DialogDescription>
        </DialogHeader>
        <form
          id='budget-form'
          onSubmit={handleSubmit}
          className='flex flex-col gap-4'
        >
          <FormField id='budget-name' label='Nombre' error={errors.name}>
            <Input
              id='budget-name'
              value={values.name}
              onChange={(inputEvent) => {
                setValues((current) => ({
                  ...current,
                  name: inputEvent.target.value,
                }))
                setErrors((current) => ({ ...current, name: undefined }))
              }}
              aria-invalid={!!errors.name}
              autoFocus
            />
          </FormField>
          <FormField
            id='budget-amount'
            label='Monto planificado (CLP)'
            error={errors.plannedAmount}
          >
            <Input
              id='budget-amount'
              type='number'
              min='1'
              step='1'
              value={values.plannedAmount || ''}
              onChange={(inputEvent) => {
                setValues((current) => ({
                  ...current,
                  plannedAmount: Number(inputEvent.target.value),
                }))
                setErrors((current) => ({
                  ...current,
                  plannedAmount: undefined,
                }))
              }}
              aria-invalid={!!errors.plannedAmount}
            />
          </FormField>
        </form>
        <DialogFooter>
          <Button
            type='button'
            variant='outline'
            onClick={() => handleOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button type='submit' form='budget-form'>
            Guardar partida
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
