import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/features/core/model/app-store'
import { AnnualPlanPanel } from '../components/annual-plan-panel'
import { Concordance } from '../components/concordance'
import { CutsPanel } from '../components/cuts-panel'
import { ManagementOverview } from '../components/management-overview'
import { EmptyState, Metric, Panel, StateBadge } from '../components/primitives'
import { VcmShell } from '../components/shell'
import { contentIsApproved } from '../model/campaign-rules'
import { KIND_LABELS } from '../model/catalogs'
import { isDecisionPending } from '../model/decisions'
import { buildReportCsv, reportHistory } from '../model/report-export'
import { reportCases } from '../model/usability'
import { useSessionView } from '../model/use-session-view'
import { useVcm } from '../model/use-vcm'
import { eligible } from '../model/workflow'

export function VcmReportsPage() {
  const { data, actor } = useVcm()
  const app = useAppStore((s) => s)
  const [view, setView] = useSessionView(
    `${actor.id}:report:view`,
    'operational'
  )
  const [period, setPeriod] = useSessionView(
    `${actor.id}:report:period`,
    String(new Date().getFullYear())
  )
  const { dated: cases, undated, outside } = reportCases(data, actor, period)
  const valid = cases.filter((c) => eligible(data, c.id))
  const ids = new Set(cases.map((c) => c.id))
  const contents = Object.values(data.contents).filter((p) => ids.has(p.caseId))
  const decisions = Object.values(data.decisions).filter((d) =>
    ids.has(d.caseId)
  )
  const exportReport = () => {
    const csv = buildReportCsv(app, actor, Number(period), view)
    const url = URL.createObjectURL(
      new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
    )
    const a = document.createElement('a')
    a.href = url
    a.download = `vcm-${view}-demo-${period}.csv`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 100)
  }
  return (
    <VcmShell
      title='Reportes'
      description='Vistas operativas y ejecutivas desde los mismos expedientes, reglas y decisiones. Los valores corresponden a la demostración local.'
      actions={
        <Button
          variant='outline'
          onClick={exportReport}
          disabled={!/^\d{4}$/.test(period)}
        >
          Exportar vista CSV
        </Button>
      }
    >
      <div className='flex flex-wrap items-center justify-between gap-4'>
        <div
          className='flex flex-wrap gap-2'
          role='group'
          aria-label='Tipos de reporte'
        >
          {[
            ['operational', 'Operativo'],
            ['executive', 'Ejecutivo'],
            ['indicators', 'Indicadores'],
            ['cuts', 'Cortes institucionales'],
            ['history', 'Histórico'],
            ['plan', 'Plan anual'],
          ].map(([id, label]) => (
            <Button
              key={id}
              size='sm'
              variant={view === id ? 'default' : 'outline'}
              onClick={() => setView(id)}
              aria-pressed={view === id}
            >
              {label}
            </Button>
          ))}
        </div>
        <label className='flex items-center gap-2 text-sm'>
          Período
          <input
            aria-label='Período del reporte'
            className='w-24 rounded border bg-background p-2'
            type='number'
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          />
        </label>
      </div>
      {['operational', 'executive', 'history'].includes(view) && (
        <>
          <p className='text-xs text-muted-foreground'>
            Período según fecha de inicio · {outside} expedientes de otros
            períodos excluidos · {undated.length} sin fecha, separados a
            continuación. La exportación CSV incluye solo el período
            seleccionado.
          </p>
          {undated.length > 0 && (
            <Panel
              title={`Expedientes sin fecha · ${undated.length}`}
              description='Pendientes de asignar a un período. Se conservan visibles, pero no se suman a las cifras del año ni al CSV.'
            >
              {undated.map((c) => (
                <Link
                  key={c.id}
                  to='/portfolio/$caseId'
                  params={{ caseId: c.id }}
                  search={{ tab: 'record', field: 'startsAt' }}
                  className='rounded border p-3 text-sm hover:bg-accent'
                >
                  {c.name} · Completar fecha de inicio
                </Link>
              ))}
            </Panel>
          )}
        </>
      )}
      {view === 'plan' ? (
        <AnnualPlanPanel
          key={`${actor.id}:${period}`}
          year={Number(period)}
          readOnly
        />
      ) : view === 'indicators' ? (
        <Concordance period={Number(period)} />
      ) : view === 'cuts' ? (
        <CutsPanel period={Number(period)} />
      ) : view === 'history' ? (
        <Panel
          title='Histórico de cambios'
          description='Los eventos pertenecen al expediente original; no crean una segunda base de reportes.'
        >
          <HistorySummary period={Number(period)} />
          {reportHistory(app, actor, Number(period))
            .slice()
            .reverse()
            .map((a) => (
              <Link
                key={a.id}
                to='/portfolio/$caseId'
                params={{ caseId: a.caseId }}
                className='rounded border p-3 text-sm hover:bg-accent'
              >
                {data.cases[a.caseId]?.name ?? 'Plan anual'} · {a.action}
                <span className='block text-xs text-muted-foreground'>
                  {a.actor.name} · {new Date(a.at).toLocaleString('es-CL')}
                </span>
              </Link>
            ))}
        </Panel>
      ) : (
        <>
          <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-4'>
            <Metric label='Expedientes del período' value={cases.length} />
            <Metric label='Elegibles y validados' value={valid.length} />
            <Metric
              label='Decisiones abiertas'
              value={decisions.filter((d) => isDecisionPending(d)).length}
            />
            <Metric
              label='Contenidos aprobados'
              value={contents.filter((c) => contentIsApproved(data, c)).length}
              note='Ninguna publicación externa ejecutada'
            />
          </div>
          {view === 'executive' && (
            <ManagementOverview period={Number(period)} compact />
          )}
          {view === 'executive' ? (
            <Panel
              title='Síntesis para Dirección y Jefatura'
              description='Avances, brechas y decisiones; sin convertir metas en resultados.'
            >
              <p className='text-sm'>
                {valid.length} de {cases.length} expedientes del período cumplen
                las condiciones de elegibilidad.{' '}
                {cases.filter((c) => c.priority === 'high').length} tienen
                prioridad alta y{' '}
                {cases.filter((c) => c.state === 'escalated').length} requieren
                resolución de Jefatura.
              </p>
              <div className='grid gap-3 sm:grid-cols-2'>
                {[
                  ...new Set(
                    cases.map((c) => c.portfolio || 'Pendiente de asignar')
                  ),
                ].map((p) => (
                  <div className='rounded border p-4 text-sm' key={p}>
                    <strong>{p}</strong>
                    <p className='mt-1 text-muted-foreground'>
                      {
                        cases.filter(
                          (c) => (c.portfolio || 'Pendiente de asignar') === p
                        ).length
                      }{' '}
                      expedientes
                    </p>
                  </div>
                ))}
              </div>
            </Panel>
          ) : null}
          <Panel
            title='Registros que explican la vista'
            description='Cada fila abre su Ficha 360 y las fuentes que sustentan el registro.'
          >
            {cases.map((c) => (
              <Link
                key={c.id}
                to='/portfolio/$caseId'
                params={{ caseId: c.id }}
                className='flex flex-wrap justify-between gap-3 rounded border p-4 hover:bg-accent'
              >
                <div>
                  <p className='font-medium'>{c.name}</p>
                  <p className='text-xs text-muted-foreground'>
                    {KIND_LABELS[c.kind]} · {c.code}
                  </p>
                </div>
                <StateBadge state={c.state} />
              </Link>
            ))}
            {!cases.length ? (
              <EmptyState>
                No hay registros visibles para este período.
              </EmptyState>
            ) : null}
          </Panel>
        </>
      )}
    </VcmShell>
  )
}

function HistorySummary({ period }: { period: number }) {
  const app = useAppStore((s) => s)
  const { actor } = useVcm()
  const history = reportHistory(app, actor, period)
  const months = [...new Set(history.map((a) => a.at.slice(0, 7)))].sort()
  return (
    <div className='grid gap-2 text-sm'>
      <p className='text-muted-foreground'>
        Actividad registrada por mes. Cuenta eventos del historial; no
        reconstruye saldos ni avances históricos anteriores a su captura.
      </p>
      {months.map((month) => (
        <p className='rounded border p-3' key={month}>
          {month} · {history.filter((a) => a.at.startsWith(month)).length}{' '}
          cambios ·{' '}
          {
            history.filter(
              (a) => a.at.startsWith(month) && a.action === 'createCase'
            ).length
          }{' '}
          ingresos nuevos
        </p>
      ))}
      {!history.length && (
        <EmptyState>No hay cambios registrados en este período.</EmptyState>
      )}
    </div>
  )
}
