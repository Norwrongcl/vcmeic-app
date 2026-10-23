import { it, expect } from 'vitest'
import { fixture } from './client.ts'
import { operationalProject, envelope } from './operational-fixture.ts'
import { qaIssues } from '../src/capture/qa.ts'

it('invalidates execution authority when the approved flow is returned or revised', async () => {
  for (const change of ['return', 'revision']) {
    const f = await fixture()
    try {
      const p = await operationalProject(f)
      expect(
        (
          await p.send(
            { type: 'setExecutionState', state: 'planned', reason: 'Preparar' },
            5,
          )
        ).status,
      ).toBe(200)
      const d = (
        await f.db.pool.query(
          "SELECT id,version FROM vcm.decisions WHERE case_id=$1 AND kind='flow'",
          [p.caseId],
        )
      ).rows[0]
      const cmd =
        change === 'return'
          ? {
              type: 'decide',
              id: d.id,
              status: 'returned',
              reason: 'Revisar alcance',
            }
          : {
              type: 'reviseDecision',
              id: d.id,
              caseId: p.caseId,
              kind: 'flow',
              title: 'Nuevo flujo',
              proposal: 'Otro alcance',
              reason: 'Cambió alcance',
            }
      const r = await f.post(
        '/v1/decisions/' + d.id + '/commands',
        envelope(cmd, d.version),
      )
      expect(r.status, r.text).toBe(200)
      if (change === 'revision') {
        const approved = await f.post(
          '/v1/decisions/' + d.id + '/commands',
          envelope(
            {
              type: 'decide',
              id: d.id,
              status: 'approved',
              reason: 'Aprobar nuevo alcance',
            },
            d.version + 1,
          ),
        )
        expect(approved.status, approved.text).toBe(200)
      }
      const execution = await p.send(
        {
          type: 'setExecutionState',
          state: 'in_progress',
          reason: 'Intentar ejecutar',
        },
        6,
      )
      expect(execution.status, execution.text).toBe(422)
      expect(execution.body.code).toBe('MANDATE_REQUIRED')
    } finally {
      await f.close()
    }
  }
})
it('uses current budget authority for QA as well as execution', async () => {
  const f = await fixture()
  try {
    const p = await operationalProject(f)
    for (const [i, state] of ['planned', 'in_progress', 'completed'].entries())
      expect(
        (
          await p.send(
            { type: 'setExecutionState', state, reason: 'Ejecución' },
            5 + i,
          )
        ).status,
      ).toBe(200)
    const r = await p.send(
      {
        type: 'saveBudgetItem',
        id: p.budgetItemId,
        name: 'Producción',
        plannedAmount: '2000',
        reason: 'Nueva base',
      },
      8,
    )
    expect(r.status, r.text).toBe(200)
    const client = await f.db.pool.connect()
    try {
      const issues = await qaIssues(
        { client } as Parameters<typeof qaIssues>[0],
        p.caseId,
      )
      expect(issues.some((x) => x.toLowerCase().includes('mandato'))).toBe(true)
    } finally {
      client.release()
    }
  } finally {
    await f.close()
  }
})
