import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { type ActivityApprovalStatus } from '@/features/core/model/types'

const approvalMetadata: Record<
  ActivityApprovalStatus,
  { label: string; className: string }
> = {
  pending: {
    label: 'Por aprobar',
    className:
      'border-amber-300 bg-amber-50 text-amber-800 dark:bg-amber-950/40',
  },
  approved: {
    label: 'Aprobada',
    className:
      'border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40',
  },
  rejected: {
    label: 'Rechazada',
    className: 'border-red-300 bg-red-50 text-red-800 dark:bg-red-950/40',
  },
}

export function ActivityApprovalBadge({
  status,
  className,
}: {
  status: ActivityApprovalStatus
  className?: string
}) {
  const metadata = approvalMetadata[status]
  return (
    <Badge variant='outline' className={cn(metadata.className, className)}>
      {metadata.label}
    </Badge>
  )
}
