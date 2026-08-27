import {
  type EventStatus,
  type TaskStatus,
} from '@/features/events/model/types'
import { type ActivityApprovalStatus } from './types'

export function canMoveTask(from: TaskStatus, to: TaskStatus) {
  return from !== to
}

export function canMoveEvent(from: EventStatus, to: EventStatus) {
  return from !== to && from !== 'completed' && to !== 'completed'
}

export function getActivityMove(
  from: ActivityApprovalStatus,
  to: ActivityApprovalStatus
): 'approve' | 'reject' | null {
  if (from === to || to === 'pending') return null
  return to === 'approved' ? 'approve' : 'reject'
}
