import type { Actor } from './types'

export type PlanObjective = {
  id: string
  title: string
  responsible: string
  dueDate: string
  target: number
  measure: 'completed' | 'validated'
  caseIds: string[]
  resources: string
  dependencies: string
}
export type AnnualPlan = {
  id: string
  year: number
  title: string
  objectives: PlanObjective[]
  status: 'draft' | 'review' | 'sanctioned' | 'approved'
  version: number
  approvedVersion: number | null
  reason: string
  updatedAt: string
  actor: Actor
}
export type Triage = {
  caseId: string
  pertinence: 'pending' | 'low' | 'medium' | 'high'
  urgency: 'pending' | 'low' | 'medium' | 'high'
  reason: string
  version: number
  actor: Actor
  at: string
}
export type Commitment = {
  id: string
  projectId: string
  caseId: string
  title: string
  amount: number
  expenseIds: string[]
  decisionId: string
  decisionVersion: number
  reference: string
  status: 'active' | 'cancelled'
  reason: string
  version: number
  actor: Actor
  at: string
}
export type Forecast = {
  basis: string
  projectId: string
  remaining: number
  reason: string
  version: number
  actor: Actor
  at: string
}
export type PlanningCommand =
  | {
      type: 'savePlan'
      id: string
      year: number
      title: string
      objectives: PlanObjective[]
      reason: string
    }
  | {
      type: 'transitionPlan'
      id: string
      status: AnnualPlan['status']
      reason: string
    }
  | {
      type: 'saveTriage'
      caseId: string
      pertinence: Triage['pertinence']
      urgency: Triage['urgency']
      reason: string
    }
  | {
      type: 'saveCommitment'
      caseId: string
      id: string
      title: string
      amount: number
      expenseIds: string[]
      decisionId: string
      reference: string
      status: Commitment['status']
      reason: string
    }
  | { type: 'saveForecast'; caseId: string; remaining: number; reason: string }
