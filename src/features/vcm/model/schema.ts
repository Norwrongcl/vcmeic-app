import { z } from 'zod'

const role = z.enum([
  'coordination',
  'leadership',
  'direction',
  'responsible',
  'designer',
  'technician',
  'viewer',
])
const actor = z.object({ id: z.string(), name: z.string(), role })
const confidentiality = z.enum(['internal', 'restricted', 'sensitive'])
const field = z.object({
  value: z.string(),
  status: z.enum(['confirmed', 'partial', 'pending', 'conflict']),
  sourceIds: z.array(z.string()),
  observation: z.string(),
  candidates: z.array(
    z.object({
      value: z.string(),
      sourceId: z.string(),
      capturedAt: z.string(),
    })
  ),
})
const dossier = z.object({
  id: z.string(),
  code: z.string(),
  kind: z.enum(['initiative', 'event', 'activity', 'presence', 'campaign']),
  name: z.string(),
  portfolio: z.string(),
  state: z.enum([
    'open',
    'construction',
    'waiting',
    'review',
    'escalated',
    'validated',
    'closing',
    'qa',
    'rendered',
    'closed',
    'returned',
  ]),
  version: z.number().int().positive(),
  createdAt: z.string(),
  updatedAt: z.string(),
  responsible: z.string(),
  responsibleActorId: z.string().nullable(),
  confidentiality,
  priority: z.enum(['low', 'medium', 'high']),
  fields: z.record(z.string(), field),
  projectId: z.string().nullable(),
  executionState: z.enum([
    'draft',
    'planned',
    'in_progress',
    'completed',
    'cancelled',
  ]),
  organizationIds: z.array(z.string()).default([]),
  agreementIds: z.array(z.string()).default([]),
  legacyId: z.string().nullable(),
  externalIds: z.record(z.string(), z.string()),
  presenceType: z.string(),
  institutionalValidation: z.enum(['pending', 'observed', 'validated']),
  demo: z.boolean(),
})
const observation = z.object({
  id: z.string(),
  caseId: z.string(),
  text: z.string(),
  category: z.string(),
  responsible: z.string(),
  status: z.enum(['open', 'resolved']),
  resolution: z.string(),
})
const objective = z.object({
  id: z.string(),
  title: z.string(),
  responsible: z.string(),
  dueDate: z.string(),
  target: z.number().int().positive(),
  measure: z.enum(['completed', 'validated']),
  caseIds: z.array(z.string()),
  resources: z.string(),
  dependencies: z.string(),
})
export const vcmDataSchema = z.object({
  plans: z
    .record(
      z.string(),
      z.object({
        id: z.string(),
        year: z.number().int(),
        title: z.string(),
        objectives: z.array(objective),
        status: z.enum(['draft', 'review', 'sanctioned', 'approved']),
        version: z.number().int().positive(),
        approvedVersion: z.number().nullable(),
        reason: z.string(),
        updatedAt: z.string(),
        actor,
      })
    )
    .default({}),
  triage: z
    .record(
      z.string(),
      z.object({
        caseId: z.string(),
        pertinence: z.enum(['pending', 'low', 'medium', 'high']),
        urgency: z.enum(['pending', 'low', 'medium', 'high']),
        reason: z.string(),
        version: z.number().int().positive(),
        actor,
        at: z.string(),
      })
    )
    .default({}),
  commitments: z
    .record(
      z.string(),
      z.object({
        id: z.string(),
        projectId: z.string(),
        caseId: z.string(),
        title: z.string(),
        amount: z.number().int().positive(),
        expenseIds: z.array(z.string()),
        decisionId: z.string(),
        decisionVersion: z.number().int().positive(),
        reference: z.string(),
        status: z.enum(['active', 'cancelled']),
        reason: z.string(),
        version: z.number().int().positive(),
        actor,
        at: z.string(),
      })
    )
    .default({}),
  forecasts: z
    .record(
      z.string(),
      z.object({
        basis: z.string().default(''),
        projectId: z.string(),
        remaining: z.number().int().nonnegative(),
        reason: z.string(),
        version: z.number().int().positive(),
        actor,
        at: z.string(),
      })
    )
    .default({}),

  cases: z.record(z.string(), dossier),
  sources: z.record(
    z.string(),
    z.object({
      id: z.string(),
      caseId: z.string(),
      name: z.string(),
      channel: z.enum(['web', 'legacy', 'whatsapp', 'telegram']),
      capturedAt: z.string(),
      actor,
    })
  ),
  evidences: z.record(
    z.string(),
    z.object({
      id: z.string(),
      caseId: z.string(),
      name: z.string(),
      url: z.string(),
      verified: z.boolean(),
      sourceId: z.string(),
      version: z.number().int().positive(),
      confidentiality,
    })
  ),
  audit: z.array(
    z.object({
      id: z.string(),
      caseId: z.string(),
      at: z.string(),
      actor,
      action: z.string(),
      reason: z.string(),
      before: z.unknown(),
      after: z.unknown(),
      ruleVersion: z.string(),
      correlationId: z.string(),
    })
  ),
  decisions: z.record(
    z.string(),
    z.object({
      id: z.string(),
      caseId: z.string(),
      title: z.string(),
      kind: z.enum(['priority', 'budget', 'exception', 'flow']),
      status: z.enum([
        'pending',
        'approved',
        'returned',
        'escalated',
        'coordination_review',
        'leadership_review',
        'direction_required',
        'rejected',
        'postponed',
        'in_execution',
        'closed',
      ]),
      approvedScope: z.string().nullable().default(null),
      budgetBasis: z.string().nullable().default(null),
      authority: z
        .enum(['coordination', 'leadership', 'direction'])
        .default('coordination'),
      alternatives: z.string().default(''),
      impact: z.string().default(''),
      requestedBy: actor,
      decidedBy: actor.nullable(),
      reason: z.string(),
      amount: z.number().nullable(),
      version: z.number().int().positive(),
      at: z.string(),
    })
  ),
  campaigns: z.record(
    z.string(),
    z.object({
      id: z.string(),
      caseId: z.string(),
      objective: z.string(),
      audience: z.string(),
      problem: z.string().default(''),
      insight: z.string().default(''),
      positioning: z.string().default(''),
      journey: z.string().default(''),
      kpiTarget: z.string().default(''),
      successCriteria: z.string().default(''),
      resources: z.string().default(''),
      valueProposition: z.string(),
      message: z.string(),
      cta: z.string(),
      channels: z.string(),
      kpi: z.string(),
      schedule: z.string(),
      restrictions: z.string(),
      version: z.number().int().positive(),
      approvedVersion: z.number().nullable(),
    })
  ),
  contents: z.record(
    z.string(),
    z.object({
      id: z.string(),
      caseId: z.string(),
      title: z.string(),
      brief: z.string(),
      copy: z.string(),
      channel: z.string(),
      scheduledAt: z.string(),
      assetUrl: z.string(),
      mode: z.enum(['weekly', 'exception']),
      packageId: z.string().nullable(),
      version: z.number().int().positive(),
      approvedVersion: z.number().nullable(),
      approvedCampaignVersion: z.number().nullable(),
      status: z.enum(['draft', 'review', 'approved']),
      integration: z.literal('disconnected'),
    })
  ),
  indicators: z.record(
    z.string(),
    z.object({
      id: z.string(),
      name: z.string(),
      target: z.number().nullable(),
      period: z.number().int(),
      rule: z.string(),
      ruleVersion: z.string(),
      unit: z.string(),
    })
  ),
  indicatorLinks: z.record(
    z.string(),
    z.object({
      id: z.string(),
      caseId: z.string(),
      indicatorId: z.string(),
      period: z.number().int(),
      value: z.number().positive(),
      rule: z.string(),
      evidenceIds: z.array(z.string()),
      status: z.enum(['pending', 'validated']),
      actor,
      version: z.number().int().positive(),
    })
  ),
  cuts: z.record(
    z.string(),
    z.object({
      id: z.string(),
      name: z.string(),
      period: z.string(),
      caseIds: z.array(z.string()),
      version: z.number().int().positive(),
      status: z.enum(['draft', 'review', 'ready', 'closed']),
      observations: z.array(observation),
      response: z.string(),
    })
  ),
})
