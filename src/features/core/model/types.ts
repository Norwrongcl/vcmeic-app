import type { VcmData } from '@/features/vcm/model/types'

export type EntityMetadata = {
  id: string
  createdAt: string
  updatedAt: string
}

export type VcmLineId =
  | 'linked-teaching'
  | 'professional-development'
  | 'community-services'
  | 'applied-research'
  | 'innovation-transfer-entrepreneurship'
  | 'technical-assistance'
  | 'arts-cultural-extension'
  | 'knowledge-dissemination'
  | 'public-policy-development'

export type EvidenceLink = {
  name: string
  url: string
}

export type Partner = EntityMetadata & {
  name: string
  type: string
  taxId: string
  email: string
  phone: string
  website: string
  notes: string
}

export type Contact = EntityMetadata & {
  name: string
  email: string
  phone: string
  role: string
  partnerId: string | null
}

export type ActivityApprovalStatus = 'pending' | 'approved' | 'rejected'
export type ActivitySource = 'web' | 'whatsapp'

export type Activity = EntityMetadata & {
  name: string
  description: string
  startsAt: string
  endsAt: string
  location: string
  vcmLine: VcmLineId
  responsibleContactId: string
  partnerIds: string[]
  participantCount: number
  results: string
  evidences: EvidenceLink[]
  approvalStatus: ActivityApprovalStatus
  source: ActivitySource
  rejectionReason: string | null
}

export type EventStatus =
  | 'draft'
  | 'planned'
  | 'in_progress'
  | 'completed'
  | 'cancelled'

export type TaskStatus =
  | 'todo'
  | 'in_progress'
  | 'review'
  | 'done'
  | 'cancelled'
export type TaskPriority = 'low' | 'medium' | 'high'
export type EventPhase = 'pre' | 'during' | 'post'

export type Event = EntityMetadata & {
  name: string
  description: string
  status: EventStatus
  startsAt: string
  endsAt: string
  location: string
  owner: string
  coordinatorContactId?: string | null
  vcmLine?: VcmLineId
  partnerIds?: string[]
  participantCount?: number | null
  results?: string
  evidences?: EvidenceLink[]
  closedAt?: string | null
}

export type EventTask = EntityMetadata & {
  eventId?: string
  title: string
  kind?: 'task' | 'milestone'
  dependencyIds?: string[]
  description: string
  assignee: string
  assigneeContactIds?: string[]
  phase?: EventPhase
  dueDate: string
  priority: TaskPriority
  status: TaskStatus
  blocked?: boolean
}

export type BudgetItem = EntityMetadata & {
  eventId: string
  name: string
  plannedAmount: number
}

export type Expense = EntityMetadata & {
  eventId: string
  budgetItemId: string
  concept: string
  date: string
  amount: number
  supplier: string
  reference: string
}

export type Agreement = EntityMetadata & {
  name: string
  type: string
  description: string
  partnerId: string
  responsibleContactId: string | null
  startsAt: string
  endsAt: string | null
  documentUrl: string
  notes: string
  cancelled: boolean
}

export type ResourceCategory = 'space' | 'equipment' | 'material' | 'service'

export type Resource = EntityMetadata & {
  name: string
  category: ResourceCategory
  description: string
  quantity: number
  notes: string
}

export type EventsData = {
  events: Record<string, Event>
  tasks: Record<string, EventTask>
  budgetItems: Record<string, BudgetItem>
  expenses: Record<string, Expense>
}

export type AppData = EventsData & {
  vcm?: VcmData
  activities: Record<string, Activity>
  partners: Record<string, Partner>
  contacts: Record<string, Contact>
  agreements: Record<string, Agreement>
  resources: Record<string, Resource>
}

export type ActivityInput = Omit<
  Activity,
  keyof EntityMetadata | 'approvalStatus' | 'source' | 'rejectionReason'
>
export type PartnerInput = Omit<Partner, keyof EntityMetadata>
export type ContactInput = Omit<Contact, keyof EntityMetadata>
export type EventInput = Omit<Event, keyof EntityMetadata>
export type EventTaskInput = Omit<EventTask, keyof EntityMetadata>
export type BudgetItemInput = Omit<BudgetItem, keyof EntityMetadata>
export type ExpenseInput = Omit<Expense, keyof EntityMetadata>
export type AgreementInput = Omit<Agreement, keyof EntityMetadata>
export type ResourceInput = Omit<Resource, keyof EntityMetadata>

export type DeletionImpact = {
  tasks: number
  budgetItems: number
  expenses: number
}
