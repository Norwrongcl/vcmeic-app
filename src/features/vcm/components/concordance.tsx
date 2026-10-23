import { Link } from '@tanstack/react-router'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { useVcm } from '../model/use-vcm'
import {
  canRead,
  isIndicatorLinkEligible,
  getIndicatorValue,
} from '../model/workflow'
import { EmptyState, Panel } from './primitives'

export function Concordance({ period = 2026 }: { period?: number }) {
  const { data, actor } = useVcm()
  const visible = {
    ...data,
    cases: Object.fromEntries(
      Object.entries(data.cases).filter(([, c]) => canRead(c, actor))
    ),
  }
  return (
    <div className='grid gap-4 md:grid-cols-2'>
      {!Object.values(data.indicators).some((i) => i.period === period) && (
        <EmptyState>
          No hay metas ni reglas configuradas para este período.
        </EmptyState>
      )}
      {Object.values(data.indicators)
        .filter((i) => i.period === period)
        .map((i) => {
          const value = getIndicatorValue(visible, i.id, i.period)
          const linked = Object.values(data.indicatorLinks).filter(
            (l) =>
              l.indicatorId === i.id &&
              l.period === i.period &&
              data.cases[l.caseId] &&
              canRead(data.cases[l.caseId], actor)
          )
          return (
            <Panel
              key={i.id}
              title={`${i.id} · ${i.name}`}
              description={`${i.period} · ${i.ruleVersion}`}
            >
              <div className='flex flex-wrap items-baseline gap-2'>
                <strong className='text-3xl'>{value}</strong>
                <span className='text-sm text-muted-foreground'>
                  de {i.target ?? 'meta pendiente'} {i.unit}
                </span>
              </div>
              <Progress
                aria-label={`Avance ${i.id}`}
                value={i.target ? Math.min((value / i.target) * 100, 100) : 0}
              />
              <p className='text-xs text-muted-foreground'>{i.rule}</p>
              <Badge variant='outline'>
                Meta institucional · avance de demostración
              </Badge>
              {linked.map((l) => (
                <Link
                  key={l.id}
                  to='/portfolio/$caseId'
                  params={{ caseId: l.caseId }}
                  className='rounded border p-3 text-sm hover:bg-accent'
                >
                  {data.cases[l.caseId]?.name} · aporte {l.value}
                  <span className='block text-xs text-muted-foreground'>
                    {isIndicatorLinkEligible(data, l)
                      ? 'Elegible'
                      : 'Pendiente · excluido del avance'}
                  </span>
                </Link>
              ))}
              {!linked.length ? (
                <p className='text-xs text-muted-foreground'>
                  Sin registros vinculados.
                </p>
              ) : null}
            </Panel>
          )
        })}
    </div>
  )
}
