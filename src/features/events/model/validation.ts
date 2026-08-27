import {
  type BudgetItemInput,
  type EventInput,
  type EventTaskInput,
  type ExpenseInput,
} from './types'

export type ValidationErrors<T> = Partial<Record<keyof T, string>>

function isPositiveInteger(value: number) {
  return Number.isInteger(value) && value > 0
}

export function validateEvent(input: EventInput): ValidationErrors<EventInput> {
  const errors: ValidationErrors<EventInput> = {}
  if (!input.name.trim()) errors.name = 'Ingresa un nombre.'
  if (!input.owner.trim()) errors.owner = 'Ingresa una persona responsable.'
  if (!input.startsAt) errors.startsAt = 'Selecciona una fecha de inicio.'
  if (!input.endsAt) errors.endsAt = 'Selecciona una fecha de término.'
  if (input.startsAt && input.endsAt && input.endsAt < input.startsAt) {
    errors.endsAt = 'La fecha de término no puede ser anterior al inicio.'
  }
  if (input.status === 'completed') {
    if (
      input.participantCount === null ||
      input.participantCount === undefined ||
      !Number.isInteger(input.participantCount) ||
      input.participantCount < 0
    ) {
      errors.participantCount =
        'Registra la cantidad de participantes para finalizar.'
    }
    if (!input.closedAt) {
      errors.closedAt = 'Completa el cierre post-evento antes de finalizar.'
    }
  }
  return errors
}

export function validateBudgetItem(
  input: BudgetItemInput
): ValidationErrors<BudgetItemInput> {
  const errors: ValidationErrors<BudgetItemInput> = {}
  if (!input.name.trim()) errors.name = 'Ingresa un nombre para la partida.'
  if (!isPositiveInteger(input.plannedAmount)) {
    errors.plannedAmount = 'Ingresa un monto entero mayor que cero.'
  }
  return errors
}

export function validateTask(
  input: EventTaskInput
): ValidationErrors<EventTaskInput> {
  const errors: ValidationErrors<EventTaskInput> = {}
  if (!input.title.trim()) errors.title = 'Ingresa un título.'
  if (!input.assignee.trim()) {
    errors.assignee = 'Ingresa una persona responsable.'
  }
  if (!input.dueDate) {
    errors.dueDate = 'Selecciona una fecha de vencimiento.'
  }
  return errors
}

export function validateExpense(
  input: ExpenseInput
): ValidationErrors<ExpenseInput> {
  const errors: ValidationErrors<ExpenseInput> = {}
  if (!input.budgetItemId) errors.budgetItemId = 'Selecciona una partida.'
  if (!input.concept.trim()) errors.concept = 'Ingresa un concepto.'
  if (!input.date) errors.date = 'Selecciona una fecha.'
  if (!isPositiveInteger(input.amount)) {
    errors.amount = 'Ingresa un monto entero mayor que cero.'
  }
  return errors
}
