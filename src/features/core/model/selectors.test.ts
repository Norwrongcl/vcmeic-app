import { describe, expect, it } from 'vitest'
import { EMPTY_APP_DATA } from './seed'
import {
  getAgendaItems,
  getAgreementTemporalStatus,
  getEventTemporalStatus,
  getReportMetrics,
} from './selectors'
import { type AppData } from './types'

const metadata = {
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

function dataFixture(): AppData {
  return {
    ...EMPTY_APP_DATA,
    activities: {
      activity1: {
        id: 'activity1',
        name: 'Asistencia técnica ejecutada',
        description: '',
        startsAt: '2026-07-01T09:00',
        endsAt: '2026-07-01T12:00',
        location: 'Valparaíso',
        vcmLine: 'technical-assistance',
        responsibleContactId: 'contact1',
        partnerIds: [],
        participantCount: 25,
        results: '',
        evidences: [],
        approvalStatus: 'approved',
        source: 'web',
        rejectionReason: null,
        ...metadata,
      },
    },
    events: {
      event1: {
        id: 'event1',
        name: 'Seminario finalizado',
        description: '',
        status: 'completed',
        startsAt: '2026-06-01T09:00',
        endsAt: '2026-06-01T18:00',
        location: 'Viña del Mar',
        owner: 'Ana Pérez',
        coordinatorContactId: 'contact1',
        vcmLine: 'knowledge-dissemination',
        partnerIds: [],
        participantCount: 50,
        results: 'Evento cerrado.',
        evidences: [],
        closedAt: '2026-06-02T10:00:00.000Z',
        ...metadata,
      },
      event2: {
        id: 'event2',
        name: 'Encuentro próximo',
        description: '',
        status: 'planned',
        startsAt: '2026-08-20T09:00',
        endsAt: '2026-08-20T18:00',
        location: 'Quillota',
        owner: 'Ana Pérez',
        coordinatorContactId: 'contact1',
        vcmLine: 'community-services',
        partnerIds: [],
        participantCount: null,
        results: '',
        evidences: [],
        closedAt: null,
        ...metadata,
      },
    },
    tasks: {
      task1: {
        id: 'task1',
        eventId: 'event2',
        title: 'Confirmar invitaciones',
        description: '',
        assignee: 'Ana Pérez',
        assigneeContactIds: ['contact1'],
        phase: 'pre',
        dueDate: '2026-08-15',
        priority: 'high',
        status: 'todo',
        ...metadata,
      },
    },
  }
}

describe('core selectors', () => {
  it('does not duplicate completed events as activities in reports', () => {
    const metrics = getReportMetrics(dataFixture())

    expect(metrics.activities).toBe(1)
    expect(metrics.completedEvents).toBe(1)
    expect(metrics.participants).toBe(75)
    expect(metrics.byVcmLine).toEqual([
      { line: 'technical-assistance', count: 1 },
      { line: 'knowledge-dissemination', count: 1 },
    ])
  })

  it('sorts event dates and task deadlines into one agenda', () => {
    const items = getAgendaItems(dataFixture())

    expect(items.slice(-3).map((item) => [item.kind, item.date])).toEqual([
      ['task-due', '2026-08-15'],
      ['event-start', '2026-08-20T09:00'],
      ['event-end', '2026-08-20T18:00'],
    ])
  })

  it('derives agreement validity from dates unless it is cancelled', () => {
    const base = {
      id: 'agreement1',
      name: 'Convenio',
      type: 'Marco',
      description: '',
      partnerId: 'partner1',
      responsibleContactId: null,
      startsAt: '2026-01-01',
      endsAt: '2026-12-31',
      documentUrl: '',
      notes: '',
      cancelled: false,
      ...metadata,
    }

    expect(
      getAgreementTemporalStatus(base, new Date('2026-08-08T12:00:00Z'))
    ).toBe('active')
    expect(
      getAgreementTemporalStatus(
        { ...base, cancelled: true },
        new Date('2026-08-08T12:00:00Z')
      )
    ).toBe('cancelled')
  })

  it('derives an event temporal condition independently from its workflow status', () => {
    const event = dataFixture().events.event2
    expect(getEventTemporalStatus(event, new Date('2026-08-08T12:00:00'))).toBe(
      'upcoming'
    )
    expect(
      getEventTemporalStatus(
        {
          ...event,
          startsAt: '2026-08-08T09:00',
          endsAt: '2026-08-08T18:00',
        },
        new Date('2026-08-08T12:00:00')
      )
    ).toBe('ongoing')
  })
})
