import type { PrincipalContext } from '../contracts/common.ts'
import { ApiError } from '../http/errors.ts'
export type FieldType = 'text' | 'number' | 'money' | 'date' | 'boolean'
export interface Field {
  column?: string
  expr?: (alias: string) => string
  type: FieldType
}
export interface Relation {
  entity: string
  parentKey: string
  childKey: string
  through?: { table: string; parentKey: string; childKey: string }
}
export interface Entity {
  table: string
  fields: Record<string, Field>
  protected: (a: string) => { expr: string; nullable?: boolean }[]
  filter?: (alias: string) => string
  relations: Record<string, Relation>
}
const f = (column: string, type: FieldType = 'text'): Field => ({
  column,
  type,
})
const own = (a: string) => [{ expr: a + '.protected_object_id' }]
const parent = (a: string, table: string, key: string) =>
  `(SELECT p.protected_object_id FROM vcm.${table} p WHERE p.id=${a}.${key})`
const caseProtection = (a: string) => [{ expr: parent(a, 'cases', 'case_id') }]
const masterProtection = (kind: string) => (a: string) => [
  { expr: `'${kind}:'||${a}.id` },
]
const projectProtection = (a: string) => [
  { expr: parent(a, 'projects', 'project_id') },
]
const dateField = (key: string): Field => ({
  expr: (a) =>
    `(SELECT fa.date_value::text FROM vcm.case_fields cf JOIN vcm.field_assertions fa ON fa.id=cf.selected_assertion_id WHERE cf.case_id=${a}.id AND cf.field_key='${key}')`,
  type: 'date',
})
const base = { id: f('id'), version: f('version', 'number') }
export const entities: Record<string, Entity> = {
  cases: {
    table: 'cases',
    fields: {
      ...base,
      code: f('code'),
      name: f('name'),
      kind: f('kind'),
      state: f('state'),
      priority: f('priority'),
      portfolio: {
        expr: (a) =>
          `(SELECT p.name FROM vcm.portfolios p WHERE p.id=${a}.portfolio_id)`,
        type: 'text',
      },
      startsAt: dateField('startsAt'),
      endsAt: dateField('endsAt'),
    },
    protected: own,
    relations: {
      evidence: { entity: 'evidence', parentKey: 'id', childKey: 'case_id' },
      presences: { entity: 'presences', parentKey: 'id', childKey: 'case_id' },
      activities: {
        entity: 'activities',
        parentKey: 'id',
        childKey: 'case_id',
      },
      projects: {
        entity: 'projects',
        parentKey: 'id',
        childKey: 'id',
        through: {
          table: 'project_cases',
          parentKey: 'case_id',
          childKey: 'project_id',
        },
      },
    },
  },
  presences: {
    table: 'presence_records',
    fields: {
      ...base,
      caseId: f('case_id'),
      presenceType: f('type_code'),
      validationStatus: f('validation_status'),
    },
    protected: caseProtection,
    relations: {},
  },
  activities: {
    table: 'activity_records',
    fields: {
      ...base,
      caseId: f('case_id'),
      schemaVersion: f('schema_version'),
      validationStatus: f('validation_status'),
    },
    protected: caseProtection,
    relations: {},
  },
  evidence: {
    table: 'evidences',
    fields: {
      ...base,
      caseId: f('case_id'),
      name: f('name'),
      reviewStatus: f('review_status'),
    },
    protected: (a) => [
      ...caseProtection(a),
      { expr: parent(a, 'document_references', 'document_id'), nullable: true },
    ],
    relations: {},
  },
  projects: {
    table: 'projects',
    fields: {
      ...base,
      name: f('name'),
      kind: f('kind'),
      executionState: f('execution_state'),
      startsOn: f('starts_on', 'date'),
      endsOn: f('ends_on', 'date'),
    },
    protected: own,
    relations: {
      tasks: { entity: 'tasks', parentKey: 'id', childKey: 'project_id' },
      budgets: { entity: 'budgets', parentKey: 'id', childKey: 'project_id' },
      expenses: { entity: 'expenses', parentKey: 'id', childKey: 'project_id' },
    },
  },
  tasks: {
    table: 'tasks',
    fields: {
      ...base,
      projectId: f('project_id'),
      title: f('title'),
      status: f('status'),
      kind: f('kind'),
      blocked: f('blocked', 'boolean'),
      dueOn: f('due_on', 'date'),
    },
    protected: projectProtection,
    relations: {},
  },
  decisions: {
    table: 'decisions',
    fields: {
      ...base,
      caseId: f('case_id'),
      title: f('title'),
      kind: f('kind'),
      status: f('status'),
      authority: f('authority'),
    },
    protected: (a) => [...own(a), ...caseProtection(a)],
    relations: {},
  },
  budgets: {
    table: 'budget_items',
    fields: {
      ...base,
      projectId: f('project_id'),
      name: f('name'),
      plannedAmount: f('planned_amount', 'money'),
    },
    protected: (a) => [...own(a), ...projectProtection(a)],
    relations: {},
  },
  commitments: {
    table: 'commitments',
    fields: {
      ...base,
      projectId: f('project_id'),
      caseId: f('case_id'),
      title: f('title'),
      amount: f('amount', 'money'),
      status: f('status'),
    },
    protected: (a) => [
      ...projectProtection(a),
      ...caseProtection(a),
      {
        expr: `(SELECT d.protected_object_id FROM vcm.budget_authorizations ba JOIN vcm.decision_revisions dr ON dr.id=ba.decision_revision_id JOIN vcm.decisions d ON d.id=dr.decision_id WHERE ba.id=${a}.authorization_id)`,
      },
    ],
    relations: {},
  },
  expenses: {
    table: 'expenses',
    filter: (a) => a + '.archived_at IS NULL',
    fields: {
      ...base,
      projectId: f('project_id'),
      budgetItemId: f('budget_item_id'),
      concept: f('concept'),
      amount: f('amount', 'money'),
      spentOn: f('spent_on', 'date'),
    },
    protected: (a) => [
      ...projectProtection(a),
      { expr: parent(a, 'budget_items', 'budget_item_id') },
    ],
    relations: {},
  },
  campaigns: {
    table: 'campaigns',
    fields: { ...base, caseId: f('case_id'), name: f('name') },
    protected: (a) => [...own(a), ...caseProtection(a)],
    relations: {},
  },
  contents: {
    table: 'contents',
    fields: {
      ...base,
      caseId: f('case_id'),
      campaignId: f('campaign_id'),
      title: f('title'),
      mode: f('mode'),
    },
    protected: (a) => [
      ...own(a),
      ...caseProtection(a),
      { expr: parent(a, 'campaigns', 'campaign_id'), nullable: true },
    ],
    relations: {},
  },
  indicators: {
    table: 'indicators',
    fields: { id: f('id'), name: f('name'), unit: f('unit') },
    protected: () => [],
    relations: {},
  },
  contributions: {
    table: 'indicator_contributions',
    fields: {
      ...base,
      caseId: f('case_id'),
      indicatorId: f('indicator_id'),
      period: f('period', 'number'),
      value: f('value', 'number'),
      validationStatus: f('status'),
    },
    protected: caseProtection,
    relations: {},
  },
  cuts: {
    table: 'institutional_cuts',
    fields: {
      ...base,
      name: f('name'),
      period: f('period'),
      status: f('status'),
    },
    protected: own,
    relations: {},
  },
  organizations: {
    table: 'organizations',
    fields: { ...base, name: f('name'), organizationType: f('type') },
    protected: masterProtection('organization'),
    relations: {},
  },
  contacts: {
    table: 'contacts',
    fields: { ...base, name: f('name') },
    protected: masterProtection('contact'),
    relations: {},
  },
  agreements: {
    table: 'agreements',
    fields: {
      ...base,
      name: f('name'),
      startsOn: f('starts_on', 'date'),
      endsOn: f('ends_on', 'date'),
      status: f('status'),
    },
    protected: own,
    relations: {},
  },
  resources: {
    table: 'resources',
    fields: {
      ...base,
      name: f('name'),
      category: f('category'),
      unit: f('unit'),
      quantity: f('quantity', 'number'),
    },
    protected: masterProtection('resource'),
    relations: {},
  },
}
export function entityAllowed(principal: PrincipalContext, name: string) {
  return (
    principal.kind !== 'service' ||
    !principal.scopes.includes('interview:read') ||
    ['cases', 'presences', 'activities', 'evidence'].includes(name)
  )
}
export function getEntity(principal: PrincipalContext, name: string) {
  if (!Object.hasOwn(entities, name))
    throw new ApiError(422, 'UNKNOWN_ENTITY', 'Entidad no reconocida.')
  if (!entityAllowed(principal, name))
    throw new ApiError(
      403,
      'ENTITY_DENIED',
      'Este perfil no puede consultar esa entidad.',
    )
  return entities[name]
}
export function domainCatalog(principal: PrincipalContext) {
  return {
    version: 'vcm-api-v1',
    limits: {
      rows: 100,
      fields: 20,
      predicates: 20,
      depth: 2,
      inValues: 50,
      sqlTimeoutMs: 2000,
    },
    entities: Object.entries(entities)
      .filter(([name]) => entityAllowed(principal, name))
      .map(([name, e]) => ({
        name,
        fields: Object.entries(e.fields).map(([name, f]) => ({
          name,
          type: f.type,
        })),
        relations: Object.keys(e.relations),
        operations: ['query'],
      })),
    aggregateSemantics:
      'Registros autorizados; sum omite null. Para avance institucional usa /v1/indicators.',
  }
}
