import type {
  AnnualPlan,
  Triage,
  Commitment,
  Forecast,
  PlanningCommand,
} from './planning-types'

export type Role =
  | 'coordination'
  | 'leadership'
  | 'direction'
  | 'responsible'
  | 'designer'
  | 'technician'
  | 'viewer'
export type Actor = { id: string; name: string; role: Role }
export type FieldStatus = 'confirmed' | 'partial' | 'pending' | 'conflict'
export type CaseKind =
  | 'initiative'
  | 'event'
  | 'activity'
  | 'presence'
  | 'campaign'
export type CaseState =
  | 'open'
  | 'construction'
  | 'waiting'
  | 'review'
  | 'escalated'
  | 'validated'
  | 'closing'
  | 'qa'
  | 'rendered'
  | 'closed'
  | 'returned'
export type Confidentiality = 'internal' | 'restricted' | 'sensitive'
export type Candidate = { value: string; sourceId: string; capturedAt: string }
export type TracedField = {
  value: string
  status: FieldStatus
  sourceIds: string[]
  observation: string
  candidates: Candidate[]
}
export type Source = {
  id: string
  caseId: string
  name: string
  channel: 'web' | 'legacy' | 'whatsapp' | 'telegram'
  capturedAt: string
  actor: Actor
}
export type Dossier = {
  id: string
  code: string
  kind: CaseKind
  name: string
  portfolio: string
  state: CaseState
  version: number
  createdAt: string
  updatedAt: string
  responsible: string
  responsibleActorId: string | null
  confidentiality: Confidentiality
  priority: 'low' | 'medium' | 'high'
  fields: Record<string, TracedField>
  projectId: string | null
  executionState:
    | 'draft'
    | 'planned'
    | 'in_progress'
    | 'completed'
    | 'cancelled'
  organizationIds: string[]
  agreementIds: string[]
  legacyId: string | null
  externalIds: Record<string, string>
  presenceType: string
  institutionalValidation: 'pending' | 'observed' | 'validated'
  demo: boolean
}
export type Evidence = {
  id: string
  caseId: string
  name: string
  url: string
  verified: boolean
  sourceId: string
  version: number
  confidentiality: Confidentiality
}
export type AuditEntry = {
  id: string
  caseId: string
  at: string
  actor: Actor
  action: string
  reason: string
  before: unknown
  after: unknown
  ruleVersion: string
  correlationId: string
}
export type Decision = {
  id: string
  caseId: string
  title: string
  kind: 'priority' | 'budget' | 'exception' | 'flow'
  status:
    | 'pending'
    | 'approved'
    | 'returned'
    | 'escalated'
    | 'coordination_review'
    | 'leadership_review'
    | 'direction_required'
    | 'rejected'
    | 'postponed'
    | 'in_execution'
    | 'closed'
  approvedScope?: string | null
  budgetBasis?: string | null
  authority?: 'coordination' | 'leadership' | 'direction'
  alternatives?: string
  impact?: string
  requestedBy: Actor
  decidedBy: Actor | null
  reason: string
  amount: number | null
  version: number
  at: string
}
export type Campaign = {
  problem?: string
  insight?: string
  positioning?: string
  journey?: string
  kpiTarget?: string
  successCriteria?: string
  resources?: string
  id: string
  caseId: string
  objective: string
  audience: string
  valueProposition: string
  message: string
  cta: string
  channels: string
  kpi: string
  schedule: string
  restrictions: string
  version: number
  approvedVersion: number | null
}
export type Content = {
  id: string
  caseId: string
  title: string
  brief: string
  copy: string
  channel: string
  scheduledAt: string
  assetUrl: string
  mode: 'weekly' | 'exception'
  packageId: string | null
  version: number
  approvedVersion: number | null
  approvedCampaignVersion: number | null
  status: 'draft' | 'review' | 'approved'
  integration: 'disconnected'
}
export type Indicator = {
  id: string
  name: string
  target: number | null
  period: number
  rule: string
  ruleVersion: string
  unit: string
}
export type IndicatorLink = {
  id: string
  caseId: string
  indicatorId: string
  period: number
  value: number
  rule: string
  evidenceIds: string[]
  status: 'pending' | 'validated'
  actor: Actor
  version: number
}
export type CutObservation = {
  id: string
  caseId: string
  text: string
  category: string
  responsible: string
  status: 'open' | 'resolved'
  resolution: string
}
export type InstitutionalCut = {
  id: string
  name: string
  period: string
  caseIds: string[]
  version: number
  status: 'draft' | 'review' | 'ready' | 'closed'
  observations: CutObservation[]
  response: string
}
export type VcmData = {
  plans: Record<string, AnnualPlan>
  triage: Record<string, Triage>
  commitments: Record<string, Commitment>
  forecasts: Record<string, Forecast>
  cases: Record<string, Dossier>
  sources: Record<string, Source>
  evidences: Record<string, Evidence>
  audit: AuditEntry[]
  decisions: Record<string, Decision>
  campaigns: Record<string, Campaign>
  contents: Record<string, Content>
  indicators: Record<string, Indicator>
  indicatorLinks: Record<string, IndicatorLink>
  cuts: Record<string, InstitutionalCut>
}
export type FieldDefinition = {
  id: string
  label: string
  group: string
  numeric?: boolean
  classification?: boolean
}
export type Command =
  | PlanningCommand
  | {
      type: 'createCase'
      id: string
      kind: CaseKind
      name: string
      responsible: string
      description: string
      startsAt: string
      endsAt: string
      portfolio: string
    }
  | {
      type: 'setField'
      caseId: string
      fieldId: string
      value: string
      status: FieldStatus
      source: string
      observation: string
    }
  | {
      type: 'setFields'
      caseId: string
      fields: {
        fieldId: string
        value: string
        status: FieldStatus
        source: string
        observation: string
      }[]
    }
  | {
      type: 'resolveField'
      caseId: string
      fieldId: string
      value: string
      reason: string
    }
  | { type: 'transition'; caseId: string; state: CaseState; reason: string }
  | {
      type: 'updateCase'
      reason?: string
      caseId: string
      responsibleActorId?: string | null
      priority: Dossier['priority']
      confidentiality: Confidentiality
      presenceType: string
      executionState: Dossier['executionState']
      portfolio: string
    }
  | {
      type: 'setRelations'
      caseId: string
      organizationIds: string[]
      agreementIds: string[]
    }
  | { type: 'attachProject'; caseId: string; reason: string }
  | {
      type: 'reviewEvidence'
      caseId: string
      id: string
      name: string
      url: string
      verified: boolean
      reason: string
    }
  | {
      type: 'addEvidence'
      caseId: string
      id: string
      name: string
      url: string
      verified: boolean
    }
  | {
      type: 'proposeDecision'
      caseId: string
      id: string
      title: string
      kind: Decision['kind']
      authority?: Decision['authority']
      alternatives?: string
      impact?: string
      amount: number | null
      reason: string
    }
  | {
      type: 'decide'
      caseId: string
      id: string
      status: Decision['status']
      reason: string
    }
  | ({ type: 'saveCampaign'; caseId: string } & Omit<
      Campaign,
      'id' | 'caseId' | 'version' | 'approvedVersion'
    >)
  | { type: 'approveCampaign'; caseId: string; reason: string }
  | ({ type: 'saveContent' } & Omit<
      Content,
      | 'version'
      | 'approvedVersion'
      | 'approvedCampaignVersion'
      | 'status'
      | 'integration'
      | 'packageId'
    > & { packageId?: string | null })
  | { type: 'approveContent'; caseId: string; id: string; reason: string }
  | {
      type: 'approvePackage'
      reviewedSnapshot: string
      caseId: string
      packageId: string
      reason: string
    }
  | {
      type: 'linkIndicator'
      caseId: string
      id: string
      indicatorId: string
      value: number
      period: number
      rule: string
      evidenceIds: string[]
      validate: boolean
    }
  | {
      type: 'createCut'
      id: string
      name: string
      period: string
      caseIds: string[]
    }
  | {
      type: 'addObservation'
      id: string
      caseId: string
      cutId: string
      text: string
      category: string
      responsible: string
    }
  | {
      type: 'resolveObservation'
      caseId: string
      cutId: string
      id: string
      resolution: string
    }
  | {
      type: 'transitionCut'
      cutId: string
      status: InstitutionalCut['status']
      response: string
    }
