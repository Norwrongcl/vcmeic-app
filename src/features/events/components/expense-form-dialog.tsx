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
import { useEventsStore } from '../model/events-store'
import { type Expense, type ExpenseInput } from '../model/types'
import { validateExpense, type ValidationErrors } from '../model/validation'
import { FormField } from './form-field'

type ExpenseFormDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  eventId: string
  expense?: Expense
}

function expenseValues(eventId: string, expense?: Expense): ExpenseInput {
  return expense
    ? {
        eventId: expense.eventId,
        budgetItemId: expense.budgetItemId,
        concept: expense.concept,
        date: expense.date,
        amount: expense.amount,
        supplier: expense.supplier,
        reference: expense.reference,
      }
    : {
        eventId,
        budgetItemId: '',
        concept: '',
        date: '',
        amount: 0,
        supplier: '',
        reference: '',
      }
}

export function ExpenseFormDialog({
  open,
  onOpenChange,
  eventId,
  expense,
}: ExpenseFormDialogProps) {
  const budgetItems = useEventsStore((state) => state.budgetItems)
  const addExpense = useEventsStore((state) => state.addExpense)
  const updateExpense = useEventsStore((state) => state.updateExpense)
  const eventBudgetItems = Object.values(budgetItems).filter(
    (item) => item.eventId === eventId
  )
  const [values, setValues] = useState<ExpenseInput>(() =>
    expenseValues(eventId, expense)
  )
  const [errors, setErrors] = useState<ValidationErrors<ExpenseInput>>({})

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setValues(expenseValues(eventId, expense))
      setErrors({})
    }
    onOpenChange(nextOpen)
  }

  const setField = <K extends keyof ExpenseInput>(
    key: K,
    value: ExpenseInput[K]
  ) => {
    setValues((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
  }

  const handleSubmit = (submitEvent: FormEvent<HTMLFormElement>) => {
    submitEvent.preventDefault()
    const nextErrors = validateExpense(values)
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }
    if (expense) updateExpense(expense.id, values)
    else addExpense(values)
    toast.success(expense ? 'Gasto actualizado.' : 'Gasto registrado.')
    handleOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className='max-h-[90svh] overflow-y-auto sm:max-w-xl'>
        <DialogHeader>
          <DialogTitle>
            {expense ? 'Editar gasto' : 'Registrar gasto'}
          </DialogTitle>
          <DialogDescription>
            Imputa el gasto a una partida del presupuesto.
          </DialogDescription>
        </DialogHeader>
        <form
          id='expense-form'
          onSubmit={handleSubmit}
          className='flex flex-col gap-4'
        >
          <FormField
            id='expense-budget-item'
            label='Partida'
            error={errors.budgetItemId}
          >
            <Select
              value={values.budgetItemId}
              onValueChange={(value) => setField('budgetItemId', value)}
            >
              <SelectTrigger
                id='expense-budget-item'
                aria-invalid={!!errors.budgetItemId}
              >
                <SelectValue placeholder='Selecciona una partida' />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {eventBudgetItems.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </FormField>
          <FormField
            id='expense-concept'
            label='Concepto'
            error={errors.concept}
          >
            <Input
              id='expense-concept'
              value={values.concept}
              onChange={(inputEvent) =>
                setField('concept', inputEvent.target.value)
              }
              aria-invalid={!!errors.concept}
              autoFocus
            />
          </FormField>
          <div className='grid gap-4 sm:grid-cols-2'>
            <FormField id='expense-date' label='Fecha' error={errors.date}>
              <Input
                id='expense-date'
                type='date'
                value={values.date}
                onChange={(inputEvent) =>
                  setField('date', inputEvent.target.value)
                }
                aria-invalid={!!errors.date}
              />
            </FormField>
            <FormField
              id='expense-amount'
              label='Monto (CLP)'
              error={errors.amount}
            >
              <Input
                id='expense-amount'
                type='number'
                min='1'
                step='1'
                value={values.amount || ''}
                onChange={(inputEvent) =>
                  setField('amount', Number(inputEvent.target.value))
                }
                aria-invalid={!!errors.amount}
              />
            </FormField>
            <FormField id='expense-supplier' label='Proveedor'>
              <Input
                id='expense-supplier'
                value={values.supplier}
                onChange={(inputEvent) =>
                  setField('supplier', inputEvent.target.value)
                }
              />
            </FormField>
            <FormField id='expense-reference' label='Referencia o comprobante'>
              <Input
                id='expense-reference'
                value={values.reference}
                onChange={(inputEvent) =>
                  setField('reference', inputEvent.target.value)
                }
              />
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
          <Button
            type='submit'
            form='expense-form'
            disabled={!eventBudgetItems.length}
          >
            Guardar gasto
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
