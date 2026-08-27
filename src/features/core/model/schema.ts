import { z } from 'zod'

const metadataSchema = {
  id: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
}

export const vcmLineSchema = z.enum([
  'linked-teaching',
  'professional-development',
  'community-services',
  'applied-research',
  'innovation-transfer-entrepreneurship',
  'technical-assistance',
  'arts-cultural-extension',
  'knowledge-dissemination',
  'public-policy-development',
])

const evidenceSchema = z.object({
  name: z.string(),
  url: z.string(),
})

const partnerSchema = z.object({
  ...metadataSchema,
  name: z.string(),
  type: z.string(),
  taxId: z.string(),
  email: z.string(),
  phone: z.string(),
  website: z.string(),
  notes: z.string(),
})

const contactSchema = z.object({
  ...metadataSchema,
  name: z.string(),
  email: z.string(),
  phone: z.string(),
  role: z.string(),
  partnerId: z.string().nullable(),
})

const activityV1Schema = z.object({
  ...metadataSchema,
  name: z.string(),
  description: z.string(),
  startsAt: z.string(),
  endsAt: z.string(),
  location: z.string(),
  vcmLine: vcmLineSchema,
  responsibleContactId: z.string(),
  partnerIds: z.array(z.string()),
  participantCount: z.number().int().nonnegative(),
  results: z.string(),
  evidences: z.array(evidenceSchema),
})

const activitySchema = activityV1Schema
  .extend({
    approvalStatus: z.enum(['pending', 'approved', 'rejected']),
    source: z.enum(['web', 'whatsapp']),
    rejectionReason: z.string().nullable(),
  })
  .superRefine((activity, context) => {
    if (
      activity.approvalStatus === 'rejected' &&
      !activity.rejectionReason?.trim()
    ) {
      context.addIssue({
        code: 'custom',
        path: ['rejectionReason'],
        message: 'Una actividad rechazada debe incluir un motivo.',
      })
    }
    if (
      activity.approvalStatus !== 'rejected' &&
      activity.rejectionReason !== null
    ) {
      context.addIssue({
        code: 'custom',
        path: ['rejectionReason'],
        message: 'Sólo una actividad rechazada puede conservar un motivo.',
      })
    }
  })

const eventSchema = z.object({
  ...metadataSchema,
  name: z.string(),
  description: z.string(),
  status: z.enum(['draft', 'planned', 'in_progress', 'completed', 'cancelled']),
  startsAt: z.string(),
  endsAt: z.string(),
  location: z.string(),
  owner: z.string(),
  coordinatorContactId: z.string().nullable().optional(),
  vcmLine: vcmLineSchema.optional(),
  partnerIds: z.array(z.string()).optional(),
  participantCount: z.number().int().nonnegative().nullable().optional(),
  results: z.string().optional(),
  evidences: z.array(evidenceSchema).optional(),
  closedAt: z.string().nullable().optional(),
})

const taskSchema = z.object({
  ...metadataSchema,
  eventId: z.string().optional(),
  title: z.string(),
  description: z.string(),
  assignee: z.string(),
  assigneeContactIds: z.array(z.string()).optional(),
  phase: z.enum(['pre', 'during', 'post']).optional(),
  dueDate: z.string(),
  priority: z.enum(['low', 'medium', 'high']),
  status: z.enum(['todo', 'in_progress', 'review', 'done', 'cancelled']),
  blocked: z.boolean().optional(),
})

const budgetItemSchema = z.object({
  ...metadataSchema,
  eventId: z.string(),
  name: z.string(),
  plannedAmount: z.number().int().nonnegative(),
})

const expenseSchema = z.object({
  ...metadataSchema,
  eventId: z.string(),
  budgetItemId: z.string(),
  concept: z.string(),
  date: z.string(),
  amount: z.number().int().positive(),
  supplier: z.string(),
  reference: z.string(),
})

const agreementSchema = z.object({
  ...metadataSchema,
  name: z.string(),
  type: z.string(),
  description: z.string(),
  partnerId: z.string(),
  responsibleContactId: z.string().nullable(),
  startsAt: z.string(),
  endsAt: z.string().nullable(),
  documentUrl: z.string(),
  notes: z.string(),
  cancelled: z.boolean(),
})

const resourceSchema = z.object({
  ...metadataSchema,
  name: z.string(),
  category: z.enum(['space', 'equipment', 'material', 'service']),
  description: z.string(),
  quantity: z.number().int().nonnegative(),
  notes: z.string(),
})

export const appDataSchema = z.object({
  activities: z.record(z.string(), activitySchema),
  events: z.record(z.string(), eventSchema),
  tasks: z.record(z.string(), taskSchema),
  budgetItems: z.record(z.string(), budgetItemSchema),
  expenses: z.record(z.string(), expenseSchema),
  partners: z.record(z.string(), partnerSchema),
  contacts: z.record(z.string(), contactSchema),
  agreements: z.record(z.string(), agreementSchema),
  resources: z.record(z.string(), resourceSchema),
})

export const appSnapshotSchema = z.object({
  version: z.literal(2),
  data: appDataSchema,
})

export const appSnapshotV1Schema = z.object({
  version: z.literal(1),
  data: z.object({
    activities: z.record(z.string(), activityV1Schema),
    events: z.record(z.string(), eventSchema),
    tasks: z.record(z.string(), taskSchema),
    budgetItems: z.record(z.string(), budgetItemSchema),
    expenses: z.record(z.string(), expenseSchema),
    partners: z.record(z.string(), partnerSchema),
    contacts: z.record(z.string(), contactSchema),
    agreements: z.record(z.string(), agreementSchema),
    resources: z.record(z.string(), resourceSchema),
  }),
})

export const legacyEventsSnapshotSchema = z.object({
  version: z.literal(1),
  data: z.object({
    events: z.record(
      z.string(),
      eventSchema.omit({
        coordinatorContactId: true,
        vcmLine: true,
        partnerIds: true,
        participantCount: true,
        results: true,
        evidences: true,
        closedAt: true,
      })
    ),
    tasks: z.record(
      z.string(),
      taskSchema.omit({ assigneeContactIds: true, phase: true })
    ),
    budgetItems: z.record(z.string(), budgetItemSchema),
    expenses: z.record(z.string(), expenseSchema),
  }),
})
