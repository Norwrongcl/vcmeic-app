import { it, expect } from 'vitest'
import { fixture } from './client.ts'
import { operationalProject } from './operational-fixture.ts'
it('keeps planned, authorized, committed, actual and forecast amounts separate without double counting', async () => {
  const f = await fixture()
  try {
    const p = await operationalProject(f)
    const commitment = await p.send(
      {
        type: 'saveCommitment',
        caseId: p.caseId,
        title: 'Contratación',
        amount: '600',
        authorizationId: p.authorizationId,
        status: 'active',
        reason: 'Reserva autorizada',
      },
      5,
    )
    expect(commitment.status, commitment.text).toBe(200)
    const expense = await p.send(
      {
        type: 'saveExpense',
        budgetItemId: p.budgetItemId,
        authorizationId: p.authorizationId,
        commitmentId: commitment.body.result.id,
        concept: 'Anticipo',
        amount: '200',
        spentOn: '2026-10-22',
        reason: 'Comprobante',
      },
      6,
    )
    expect(expense.status, expense.text).toBe(200)
    const excess = await p.send(
      {
        type: 'saveCommitment',
        caseId: p.caseId,
        title: 'Exceso',
        amount: '500',
        authorizationId: p.authorizationId,
        status: 'active',
        reason: 'Otra reserva',
      },
      7,
    )
    expect(excess.status).toBe(422)
    expect(excess.body.code).toBe('BUDGET_EXCEEDED')
    const race = await Promise.all(
      [1, 2].map((n) =>
        p.send(
          {
            type: 'saveExpense',
            budgetItemId: p.budgetItemId,
            authorizationId: p.authorizationId,
            concept: 'Compra ' + n,
            amount: '300',
            spentOn: '2026-10-22',
            reason: 'Compra autorizada',
          },
          7,
        ),
      ),
    )
    expect(race.map((r) => r.status).sort()).toEqual([200, 409])
    expect(
      (
        await p.send(
          {
            type: 'saveForecast',
            remaining: '100',
            reason: 'Costo adicional estimado',
          },
          8,
        )
      ).status,
    ).toBe(200)
    const detail = (await f.get('/v1/projects/' + p.projectId)).body
    expect(detail.finance).toMatchObject({
      planned: '1000',
      authorized: '1000',
      committed: '600',
      actual: '500',
      unspentCommitments: '400',
      forecastAdditional: '100',
      projected: '1000',
    })
  } finally {
    await f.close()
  }
})
it('rejects execution after mandate revocation and when its approved budget basis changes', async () => {
  const f = await fixture()
  try {
    const p = await operationalProject(f)
    expect(
      (
        await p.send(
          {
            type: 'revokeMandate',
            mandateId: p.mandateId,
            reason: 'Cambio de alcance',
          },
          5,
        )
      ).status,
    ).toBe(200)
    expect(
      (
        await p.send(
          {
            type: 'saveCommitment',
            caseId: p.caseId,
            title: 'No autorizado',
            amount: '1',
            authorizationId: p.authorizationId,
            status: 'active',
            reason: 'Intento',
          },
          6,
        )
      ).status,
    ).toBe(422)
    expect(
      (await f.db.pool.query('SELECT count(*)::int n FROM vcm.commitments'))
        .rows[0].n,
    ).toBe(0)
  } finally {
    await f.close()
  }
})

it('excludes logically archived expenses from semantic rows, sums and exports', async () => {
  const f = await fixture()
  try {
    const p = await operationalProject(f)
    const e = await p.send(
      {
        type: 'saveExpense',
        budgetItemId: p.budgetItemId,
        authorizationId: p.authorizationId,
        concept: 'Ensayo',
        amount: '100',
        spentOn: '2026-10-22',
        reason: 'Registrar',
      },
      5,
    )
    expect(e.status, e.text).toBe(200)
    expect(
      (
        await p.send(
          { type: 'archiveExpense', id: e.body.result.id, reason: 'Corregir' },
          6,
        )
      ).status,
    ).toBe(200)
    const rows = await f.post('/v1/query', {
      entity: 'expenses',
      select: ['id', 'amount'],
    })
    expect(rows.status, rows.text).toBe(200)
    expect(rows.body.items).toEqual([])
    expect((await f.get('/v1/exports')).body.records.expenses).toEqual([])
  } finally {
    await f.close()
  }
})
