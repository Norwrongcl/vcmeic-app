import { describe, expect, it } from 'vitest'
import { type ActivityInput } from './types'
import { validateActivity, validateEvidenceLinks } from './validation'

const validActivity: ActivityInput = {
  name: 'Taller territorial',
  description: '',
  startsAt: '2026-08-01T09:00',
  endsAt: '2026-08-01T13:00',
  location: 'Valparaíso',
  vcmLine: 'community-services',
  responsibleContactId: 'contact1',
  partnerIds: [],
  participantCount: 30,
  results: '',
  evidences: [],
}

describe('core validation', () => {
  it('rejects an activity that has not finished yet', () => {
    expect(
      validateActivity(
        { ...validActivity, endsAt: '2026-08-09T13:00' },
        new Date('2026-08-08T12:00:00')
      )
    ).toMatchObject({ endsAt: 'La actividad debe haber finalizado.' })
  })

  it('rejects negative or fractional participant totals', () => {
    expect(
      validateActivity(
        { ...validActivity, participantCount: -1 },
        new Date('2026-08-08T12:00:00')
      )
    ).toMatchObject({
      participantCount: 'Ingresa una cantidad total válida.',
    })
    expect(
      validateActivity(
        { ...validActivity, participantCount: 2.5 },
        new Date('2026-08-08T12:00:00')
      )
    ).toMatchObject({
      participantCount: 'Ingresa una cantidad total válida.',
    })
  })

  it('requires a complete name and valid URL for every evidence row', () => {
    expect(
      validateEvidenceLinks([
        { name: '', url: 'https://example.org/evidence' },
        { name: 'Fotografías', url: 'not-a-url' },
      ])
    ).toEqual([
      { name: 'Ingresa un nombre para la evidencia.' },
      { url: 'Ingresa un enlace válido.' },
    ])
  })
})
