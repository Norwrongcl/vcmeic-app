import { Link } from '@tanstack/react-router'
import { ArrowUpRight, FileStack } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { KIND_LABELS } from '../model/catalogs'
import type { Dossier } from '../model/types'
import { EmptyState, StateBadge } from './primitives'

export function CaseList({ cases }: { cases: Dossier[] }) {
  if (!cases.length)
    return <EmptyState>No hay expedientes para estos filtros.</EmptyState>
  return (
    <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
      {cases.map((c) => (
        <Link
          key={c.id}
          to='/portfolio/$caseId'
          params={{ caseId: c.id }}
          className='min-w-0 rounded-xl outline-offset-4'
        >
          <Card className='h-full transition-colors hover:border-primary/50 hover:bg-accent/20'>
            <CardContent className='grid gap-4 pt-5'>
              <div className='flex items-center justify-between gap-2'>
                <span className='flex items-center gap-2 text-xs font-medium text-primary'>
                  <FileStack className='size-4' />
                  {KIND_LABELS[c.kind]}
                </span>
                <ArrowUpRight className='size-4 text-muted-foreground' />
              </div>
              <h2 className='text-lg font-semibold break-words'>{c.name}</h2>
              <p className='line-clamp-2 text-sm text-muted-foreground'>
                {c.fields.description?.value || 'Descripción pendiente.'}
              </p>
              <div className='flex flex-wrap gap-2'>
                <StateBadge state={c.state} />
                {c.priority === 'high' ? (
                  <Badge variant='outline'>Prioridad alta</Badge>
                ) : null}
              </div>
              <div className='border-t pt-3 text-xs text-muted-foreground'>
                <p>
                  {c.responsible || 'Sin responsable'} ·{' '}
                  {c.fields.startsAt?.value.slice(0, 10) || 'Fecha pendiente'}
                </p>
                <p className='mt-1'>
                  {c.portfolio || 'Portafolio pendiente'} · {c.code}
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  )
}
