import { type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

type MetricTone = 'blue' | 'violet' | 'emerald' | 'amber'

const metricToneStyles: Record<MetricTone, string> = {
  blue: 'bg-blue-100 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300',
  violet:
    'bg-violet-100 text-violet-700 dark:bg-violet-950/70 dark:text-violet-300',
  emerald:
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300',
  amber: 'bg-amber-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300',
}

type MetricCardProps = {
  label: string
  value: string
  description?: string
  icon: LucideIcon
  tone?: MetricTone
}

export function MetricCard({
  label,
  value,
  description,
  icon: Icon,
  tone = 'blue',
}: MetricCardProps) {
  return (
    <Card>
      <CardHeader className='flex flex-row items-center justify-between gap-3 pb-2'>
        <CardTitle className='text-sm font-medium'>{label}</CardTitle>
        <span className={cn('rounded-lg p-2', metricToneStyles[tone])}>
          <Icon aria-hidden='true' className='size-4' />
        </span>
      </CardHeader>
      <CardContent>
        <p className='text-2xl font-bold'>{value}</p>
        {description ? (
          <CardDescription className='mt-1'>{description}</CardDescription>
        ) : null}
      </CardContent>
    </Card>
  )
}
