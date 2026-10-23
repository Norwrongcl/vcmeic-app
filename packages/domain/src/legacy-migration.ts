import type { z } from 'zod'
import type { appDataSchema } from './legacy-core-schema.ts'
import type { vcmDataSchema } from './legacy-vcm-schema.ts'
type AppData = z.infer<typeof appDataSchema>
type VcmData = z.infer<typeof vcmDataSchema>
type Dossier = VcmData['cases'][string]
type TracedField = Dossier['fields'][string]
type Actor = VcmData['sources'][string]['actor']
const RULE_VERSION = 'PO-2026.09-v1'
const migrationActor: Actor = {
  id: 'migration',
  name: 'Migración de datos locales',
  role: 'technician',
}
export function blankField(): TracedField {
  return {
    value: '',
    status: 'pending',
    sourceIds: [],
    observation: '',
    candidates: [],
  }
}
export function emptyVcmData(): VcmData {
  return {
    plans: {},
    triage: {},
    commitments: {},
    forecasts: {},
    cases: {},
    sources: {},
    evidences: {},
    audit: [],
    decisions: {},
    campaigns: {},
    contents: {},
    indicatorLinks: {},
    cuts: {},
    indicators: {
      '4.2.5': {
        id: '4.2.5',
        name: 'Presencias de académicos en la sociedad',
        target: 14,
        period: 2026,
        unit: 'presencias',
        rule: 'Presencia en la sociedad clasificada, validada y con evidencia. Validación manual de la relación.',
        ruleVersion: RULE_VERSION,
      },
      '4.2.2': {
        id: '4.2.2',
        name: 'Proyectos de asistencia técnica',
        target: 2,
        period: 2026,
        unit: 'proyectos',
        rule: 'Criterio detallado del Manual de Indicadores pendiente de incorporar.',
        ruleVersion: RULE_VERSION,
      },
      '4.2.3': {
        id: '4.2.3',
        name: 'Estudiantes en formación continua',
        target: 240,
        period: 2026,
        unit: 'estudiantes',
        rule: 'Criterio detallado del Manual de Indicadores pendiente de incorporar.',
        ruleVersion: RULE_VERSION,
      },
      '4.2.9': {
        id: '4.2.9',
        name: 'Participaciones en difusión pre/postgrado',
        target: 2,
        period: 2026,
        unit: 'participaciones',
        rule: 'Criterio detallado del Manual de Indicadores pendiente de incorporar.',
        ruleVersion: RULE_VERSION,
      },
      '8.1.3': {
        id: '8.1.3',
        name: 'Académicos en movilidad internacional',
        target: 6,
        period: 2026,
        unit: 'académicos',
        rule: 'Criterio detallado del Manual de Indicadores pendiente de incorporar.',
        ruleVersion: RULE_VERSION,
      },
    },
  }
}
export function migrateVcmData(legacy: AppData): VcmData {
  if (legacy.vcm) return { ...emptyVcmData(), ...structuredClone(legacy.vcm) }
  const data = emptyVcmData()
  for (const [kind, records] of [
    ['activity', legacy.activities],
    ['event', legacy.events],
  ] as const) {
    for (const item of Object.values(records)) {
      const sourceId = `legacy-source-${item.id}`
      data.sources[sourceId] = {
        id: sourceId,
        caseId: item.id,
        name: 'Snapshot anterior · requiere revisión',
        channel: 'legacy',
        capturedAt: item.createdAt,
        actor: migrationActor,
      }
      const source = (value: string): TracedField => ({
        ...blankField(),
        value,
        status: value ? 'partial' : 'pending',
        sourceIds: [sourceId],
        observation: 'Migrado sin inferir validación institucional.',
      })
      const responsible =
        'responsibleContactId' in item
          ? (legacy.contacts[item.responsibleContactId]?.name ?? '')
          : item.owner
      const values: Record<string, string> = {
        internalId: item.id,
        name: item.name,
        responsible,
        description: item.description,
        startsAt: item.startsAt,
        endsAt: item.endsAt,
        location: item.location,
        actionLine: item.vcmLine ?? '',
        resultsActual: item.results ?? '',
        externalPublicActual:
          item.participantCount == null ? '' : String(item.participantCount),
      }
      const dossier: Dossier = {
        id: item.id,
        code: `EIC-${item.id}`,
        kind,
        name: item.name,
        portfolio: '',
        state: 'construction',
        version: 1,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        responsible,
        responsibleActorId: null,
        confidentiality: 'internal',
        priority: 'medium',
        fields: Object.fromEntries(
          Object.entries(values).map(([k, v]) => [k, source(v)]),
        ),
        projectId: kind === 'event' ? item.id : null,
        executionState: 'status' in item ? item.status : 'draft',
        organizationIds: item.partnerIds ?? [],
        agreementIds: [],
        legacyId: item.id,
        externalIds: {},
        presenceType: '',
        institutionalValidation: 'pending',
        demo: true,
      }
      data.cases[item.id] = dossier
      for (const [index, e] of (item.evidences ?? []).entries()) {
        const id = `legacy-evidence-${item.id}-${index}`
        data.evidences[id] = {
          id,
          caseId: item.id,
          name: e.name,
          url: e.url,
          verified: false,
          sourceId,
          version: 1,
          confidentiality: 'internal',
        }
      }
      data.audit.push({
        id: `migration-${item.id}`,
        caseId: item.id,
        at: item.updatedAt,
        actor: migrationActor,
        action: 'migration',
        reason:
          'Se conservan ID, relaciones y campos originales. Revisión formal pendiente.',
        before: null,
        after: dossier,
        ruleVersion: RULE_VERSION,
        correlationId: `migration-${item.id}`,
      })
    }
  }
  return data
}
