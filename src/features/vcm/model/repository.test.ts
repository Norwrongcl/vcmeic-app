import { describe, expect, it } from 'vitest'
import {
  APP_STORAGE_KEY,
  createAppStore,
} from '@/features/core/model/app-store'
import { EMPTY_APP_DATA } from '@/features/core/model/seed'
import { createVcmRepository } from './repository'
import type { Actor } from './types'

const actor: Actor = {
  id: 'admin',
  name: 'Coordinación demo',
  role: 'coordination',
}
function memory(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial))
  return {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => {
      values.set(k, v)
    },
    removeItem: (k: string) => {
      values.delete(k)
    },
  }
}
describe('repositorio local y respaldo v3', () => {
  it('migrates v2 and round trips cases, sources and audit with unchanged IDs', async () => {
    const storage = memory({
      [APP_STORAGE_KEY]: JSON.stringify({ version: 2, data: EMPTY_APP_DATA }),
    })
    const store = createAppStore({ storage })
    const repository = createVcmRepository(store)
    await repository.execute(
      {
        type: 'createCase',
        id: 'stable-id',
        kind: 'presence',
        name: 'Presencia',
        responsible: 'Ana',
        description: 'Exposición',
        startsAt: '2026-10-20',
        endsAt: '2026-10-20',
        portfolio: '',
      },
      actor
    )
    const reloaded = createVcmRepository(createAppStore({ storage }))
    expect((await reloaded.read()).cases['stable-id'].id).toBe('stable-id')
    const backup = await reloaded.exportBackup()
    expect(JSON.parse(backup).version).toBe(4)
    const target = createVcmRepository(
      createAppStore({ storage: memory(), initialData: EMPTY_APP_DATA })
    )
    await target.importBackup(backup)
    expect(await target.read()).toEqual(await reloaded.read())
    await expect(target.importBackup('{invalid')).rejects.toThrow()
    expect((await target.read()).cases['stable-id'].name).toBe('Presencia')
  })
  it('keeps unreadable source data recoverable rather than deleting it', () => {
    const storage = memory({ [APP_STORAGE_KEY]: 'bad data' })
    createAppStore({ storage })
    expect(storage.getItem(`${APP_STORAGE_KEY}-unreadable-backup`)).toBe(
      'bad data'
    )
  })
  it('rejects malformed v3 data without replacing the existing state', async () => {
    const repository = createVcmRepository(
      createAppStore({ storage: memory(), initialData: EMPTY_APP_DATA })
    )
    const backup = JSON.parse(await repository.exportBackup())
    backup.data.vcm.cases.bad = { id: 'bad' }
    await expect(
      repository.importBackup(JSON.stringify(backup))
    ).rejects.toThrow()
    expect((await repository.read()).cases).toEqual({})
  })
})

it('attributes reused operational task changes to their dossier and demo actor', () => {
  const storage = memory()
  const store = createAppStore({ storage })
  const projectId = Object.keys(store.getState().events)[0]
  const id = store.getState().addTask({
    eventId: projectId,
    title: 'Hito de cierre',
    description: 'Revisión final',
    assignee: 'Ana',
    dueDate: '2026-10-30',
    priority: 'high',
    status: 'todo',
  })
  const entry = store
    .getState()
    .vcm!.audit.find(
      (a) =>
        a.action === 'operation:tasks' && JSON.stringify(a.after).includes(id)
    )
  expect(entry?.caseId).toBe(projectId)
  expect(entry?.actor.role).toBe('coordination')
  const reloaded = createAppStore({ storage })
  expect(reloaded.getState().vcm!.audit.some((a) => a.id === entry?.id)).toBe(
    true
  )
})

it('round trips inherited non-web evidence references without replacing the dossier on reload', async () => {
  const timestamp = '2026-10-21T10:00:00Z'
  const legacy = {
    ...EMPTY_APP_DATA,
    events: {
      old: {
        id: 'old',
        createdAt: timestamp,
        updatedAt: timestamp,
        name: 'Original con evidencia local',
        description: 'Original',
        startsAt: '2026-10-20',
        endsAt: '2026-10-20',
        status: 'completed' as const,
        owner: 'Ana',
        location: 'EIC',
        evidences: [
          { name: 'Respaldo anterior', url: 'file:///tmp/evidence.pdf' },
        ],
      },
    },
  }
  const storage = memory({
    [APP_STORAGE_KEY]: JSON.stringify({ version: 2, data: legacy }),
  })
  const first = createAppStore({ storage })
  expect(first.getState().vcm!.cases.old.name).toBe(
    'Original con evidencia local'
  )
  const reloaded = createAppStore({ storage })
  expect(reloaded.getState().storageWarning).toBe(false)
  expect(reloaded.getState().vcm!.cases.old.name).toBe(
    'Original con evidencia local'
  )
  expect(Object.values(reloaded.getState().vcm!.evidences)[0].url).toBe(
    'file:///tmp/evidence.pdf'
  )
})
it('normalizes accepted HTTPS evidence before persistence and reload', async () => {
  const storage = memory()
  const store = createAppStore({ storage, initialData: EMPTY_APP_DATA })
  const repository = createVcmRepository(store)
  await repository.execute(
    {
      type: 'createCase',
      id: 'uppercase',
      kind: 'presence',
      name: 'Prueba',
      responsible: 'Ana',
      description: 'Prueba',
      startsAt: '2026-10-20',
      endsAt: '2026-10-20',
      portfolio: '',
    },
    actor
  )
  await repository.execute(
    {
      type: 'addEvidence',
      caseId: 'uppercase',
      id: 'e',
      name: 'Programa',
      url: 'HTTPS://example.com/doc',
      verified: true,
    },
    actor
  )
  const reloaded = createAppStore({ storage })
  expect(reloaded.getState().storageWarning).toBe(false)
  expect(reloaded.getState().vcm!.cases.uppercase.name).toBe('Prueba')
  expect(reloaded.getState().vcm!.evidences.e.url).toBe(
    'https://example.com/doc'
  )
})
it('protects linked master entities and audits their changes in the dossier', async () => {
  const store = createAppStore({
    storage: memory(),
    initialData: EMPTY_APP_DATA,
  })
  const repository = createVcmRepository(store)
  const organization = store
    .getState()
    .addPartner({
      name: 'Organización',
      type: 'Colegio',
      taxId: '',
      email: '',
      phone: '',
      website: '',
      notes: '',
    })
  const agreement = store
    .getState()
    .addAgreement({
      name: 'Acuerdo',
      type: 'Convenio',
      description: '',
      partnerId: organization,
      responsibleContactId: null,
      startsAt: '2026-10-20',
      endsAt: null,
      documentUrl: '',
      notes: '',
      cancelled: false,
    })
  await repository.execute(
    {
      type: 'createCase',
      id: 'master-linked',
      kind: 'activity',
      name: 'Taller',
      responsible: 'Ana',
      description: 'Prueba',
      startsAt: '2026-10-20',
      endsAt: '2026-10-20',
      portfolio: '',
    },
    actor
  )
  await repository.execute(
    {
      type: 'setRelations',
      caseId: 'master-linked',
      organizationIds: [organization],
      agreementIds: [agreement],
    },
    actor
  )
  expect(store.getState().deleteAgreement(agreement)).toBe(false)
  expect(store.getState().deletePartner(organization)).toBe(false)
  store
    .getState()
    .updatePartner(organization, { name: 'Organización corregida' })
  expect(
    store
      .getState()
      .vcm!.audit.some(
        (a) => a.caseId === 'master-linked' && a.action === 'operation:partners'
      )
  ).toBe(true)
  store.setState({ operationActor: { ...actor, role: 'viewer' } })
  const unlinked = store
    .getState()
    .addAgreement({
      name: 'Sin vínculo',
      type: 'Convenio',
      description: '',
      partnerId: organization,
      responsibleContactId: null,
      startsAt: '2026-10-20',
      endsAt: null,
      documentUrl: '',
      notes: '',
      cancelled: false,
    })
  expect(store.getState().deleteAgreement(unlinked)).toBe(false)
  expect(store.getState().agreements[unlinked]).toBeDefined()
})
