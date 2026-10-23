import { useAppStore } from '@/features/core/model/app-store'
import { formatClp } from '@/features/events/model/formatters'
import { getEventFinancials } from '@/features/events/model/selectors'
import { EmptyState, Panel } from './primitives'

export function FinanceSummary({ projectId }: { projectId: string }) {
  const state = useAppStore((s) => s)
  const totals = getEventFinancials(state, projectId)
  return (
    <Panel
      title='Presupuesto y ejecución · lectura'
      description='Montos locales para seguimiento. Las decisiones de presupuesto se registran en Gobierno.'
    >
      <dl className='grid grid-cols-2 gap-3 text-sm'>
        <dt>Planificado</dt>
        <dd>{formatClp(totals.planned)}</dd>
        <dt>Gastos registrados</dt>
        <dd>{formatClp(totals.spent)}</dd>
        <dt>Diferencia planificado − gastos</dt>
        <dd>{formatClp(totals.available)}</dd>
      </dl>
      {totals.items.map((item) => (
        <p className='rounded border p-3 text-sm' key={item.budgetItemId}>
          {state.budgetItems[item.budgetItemId]?.name} ·{' '}
          {formatClp(item.planned)} previstos / {formatClp(item.spent)}{' '}
          ejecutados
        </p>
      ))}
      {!totals.items.length ? (
        <EmptyState>No hay partidas registradas.</EmptyState>
      ) : null}
    </Panel>
  )
}
