import { expect, it } from 'vitest'
import { emptyVcmData } from './migration'
import type { Actor } from './types'
import { applyCommand } from './workflow'

const actor: Actor = { id: 'c', name: 'Coordinación', role: 'coordination' }
it('requires the PO strategic handoff fields before approving a campaign', () => {
  let data = applyCommand(
    emptyVcmData(),
    {
      type: 'createCase',
      id: 'c',
      kind: 'campaign',
      name: 'Campaña',
      responsible: 'Ana',
      description: 'Campaña',
      startsAt: '2026-10-21',
      endsAt: '2026-10-21',
      portfolio: '',
    },
    actor
  )
  data = applyCommand(
    data,
    {
      type: 'saveCampaign',
      caseId: 'c',
      objective: 'Objetivo',
      audience: 'Público',
      valueProposition: 'Valor',
      message: 'Mensaje',
      cta: 'Conocer',
      channels: 'LinkedIn',
      kpi: 'Inscripciones',
      schedule: 'Octubre',
      restrictions: 'Privacidad',
    },
    actor
  )
  expect(() =>
    applyCommand(
      data,
      { type: 'approveCampaign', caseId: 'c', reason: 'Revisado' },
      actor
    )
  ).toThrow(/plan de campaña/i)
})
