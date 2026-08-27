import { beforeEach, describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { eventsStore } from '../model/events-store'
import { EventClosureForm } from './event-closure-form'

describe('EventClosureForm', () => {
  beforeEach(() => {
    eventsStore.setState({
      events: {
        event1: {
          id: 'event1',
          name: 'Encuentro territorial',
          description: '',
          status: 'in_progress',
          startsAt: '2026-08-01T09:00',
          endsAt: '2026-08-01T18:00',
          location: 'Valparaíso',
          owner: 'Ana Pérez',
          coordinatorContactId: 'contact1',
          vcmLine: 'community-services',
          partnerIds: [],
          participantCount: null,
          results: '',
          evidences: [],
          closedAt: null,
          createdAt: '2026-01-01T00:00:00.000Z',
          updatedAt: '2026-01-01T00:00:00.000Z',
        },
      },
    })
  })

  it('finalizes an event with post-event execution data', async () => {
    const screen = await render(<EventClosureForm eventId='event1' />)

    await userEvent.fill(screen.getByLabelText('Participantes'), '80')
    await userEvent.fill(
      screen.getByLabelText('Resultados u observaciones'),
      'Se cumplieron los objetivos.'
    )
    await userEvent.click(
      screen.getByRole('button', { name: 'Finalizar evento' })
    )

    expect(eventsStore.getState().events.event1).toMatchObject({
      status: 'completed',
      participantCount: 80,
      results: 'Se cumplieron los objetivos.',
    })
    expect(eventsStore.getState().events.event1.closedAt).toBeTruthy()
  })
})
