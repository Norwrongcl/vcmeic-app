import { describe, expect, it } from 'vitest'
import {
  validateBudgetItem,
  validateEvent,
  validateExpense,
  validateTask,
} from './validation'

describe('event form validation', () => {
  it('requires the core event fields and rejects an inverted date range', () => {
    expect(
      validateEvent({
        name: '',
        description: '',
        status: 'draft',
        startsAt: '2026-09-11T18:00',
        endsAt: '2026-09-10T09:00',
        location: '',
        owner: '',
      })
    ).toEqual({
      name: 'Ingresa un nombre.',
      owner: 'Ingresa una persona responsable.',
      endsAt: 'La fecha de término no puede ser anterior al inicio.',
    })
  })

  it('accepts a complete event', () => {
    expect(
      validateEvent({
        name: 'Encuentro',
        description: '',
        status: 'planned',
        startsAt: '2026-09-10T09:00',
        endsAt: '2026-09-10T18:00',
        location: 'Valparaíso',
        owner: 'Ana Pérez',
      })
    ).toEqual({})
  })

  it('requires post-event closure data before finalizing', () => {
    expect(
      validateEvent({
        name: 'Encuentro',
        description: '',
        status: 'completed',
        startsAt: '2026-08-01T09:00',
        endsAt: '2026-08-01T18:00',
        location: 'Valparaíso',
        owner: 'Ana Pérez',
        coordinatorContactId: 'contact-1',
        vcmLine: 'community-services',
        partnerIds: [],
        participantCount: null,
        results: '',
        evidences: [],
        closedAt: null,
      })
    ).toMatchObject({
      participantCount: 'Registra la cantidad de participantes para finalizar.',
      closedAt: 'Completa el cierre post-evento antes de finalizar.',
    })
  })

  it('requires a positive integer budget amount', () => {
    expect(
      validateBudgetItem({ eventId: 'event-1', name: '', plannedAmount: 1.5 })
    ).toEqual({
      name: 'Ingresa un nombre para la partida.',
      plannedAmount: 'Ingresa un monto entero mayor que cero.',
    })
  })

  it('requires task ownership and due date', () => {
    expect(
      validateTask({
        eventId: 'event-1',
        title: '',
        description: '',
        assignee: '',
        dueDate: '',
        priority: 'medium',
        status: 'todo',
      })
    ).toEqual({
      title: 'Ingresa un título.',
      assignee: 'Ingresa una persona responsable.',
      dueDate: 'Selecciona una fecha de vencimiento.',
    })
  })

  it('requires an expense category, concept, date, and positive integer amount', () => {
    expect(
      validateExpense({
        eventId: 'event-1',
        budgetItemId: '',
        concept: '',
        date: '',
        amount: 0,
        supplier: '',
        reference: '',
      })
    ).toEqual({
      budgetItemId: 'Selecciona una partida.',
      concept: 'Ingresa un concepto.',
      date: 'Selecciona una fecha.',
      amount: 'Ingresa un monto entero mayor que cero.',
    })
  })
})
