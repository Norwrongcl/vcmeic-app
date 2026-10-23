import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CaseList } from '../components/case-list'
import { Concordance } from '../components/concordance'
import { CutsPanel } from '../components/cuts-panel'
import { EmptyState, Panel } from '../components/primitives'
import { VcmShell } from '../components/shell'
import { useVcm } from '../model/use-vcm'
import { canOperate, canRead, getQaIssues } from '../model/workflow'

export function ControlPage({
  initialView = 'activities',
}: {
  initialView?: string
}) {
  const [view, setView] = useState(initialView)
  const [query, setQuery] = useState('')
  const { data, actor } = useVcm()
  const cases = Object.values(data.cases).filter((c) => canRead(c, actor))
  const tabs = [
    ['activities', 'Actividades e iniciativas'],
    ['presences', 'Presencias en la sociedad'],
    ['evidence', 'Evidencias'],
    ['qa', 'Revisión y excepciones'],
    ['concordance', 'Concordancia'],
    ['cuts', 'Cortes institucionales'],
  ]
  const listed = cases.filter(
    (c) =>
      (view === 'presences'
        ? c.kind === 'presence'
        : c.kind === 'activity' ||
          c.kind === 'initiative' ||
          c.kind === 'event') &&
      `${c.name} ${c.responsible}`.toLowerCase().includes(query.toLowerCase())
  )
  return (
    <VcmShell
      title='Control'
      description='Registro, evidencia, clasificación, control de calidad y rendición como vistas del mismo expediente.'
      actions={
        canOperate(actor.role) ? (
          <Button asChild>
            <Link
              to='/portfolio/new'
              search={{ kind: view === 'presences' ? 'presence' : 'activity' }}
            >
              Nuevo registro
            </Link>
          </Button>
        ) : null
      }
    >
      <div
        className='flex flex-wrap gap-2'
        role='group'
        aria-label='Vistas de Control'
      >
        {tabs.map(([id, label]) => (
          <Button
            key={id}
            size='sm'
            variant={view === id ? 'default' : 'outline'}
            aria-pressed={view === id}
            onClick={() => setView(id)}
          >
            {label}
          </Button>
        ))}
      </div>
      {['activities', 'presences'].includes(view) ? (
        <>
          <Input
            aria-label='Buscar registros'
            placeholder='Buscar registro o responsable'
            className='max-w-md'
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <CaseList cases={listed} />
        </>
      ) : view === 'concordance' ? (
        <Concordance />
      ) : view === 'cuts' ? (
        <CutsPanel />
      ) : view === 'evidence' ? (
        <Panel
          title='Índice de evidencias'
          description='Cada referencia pertenece a un expediente y conserva sus controles de visibilidad.'
        >
          {Object.values(data.evidences)
            .filter((e) => cases.some((c) => c.id === e.caseId))
            .map((e) => (
              <div
                key={e.id}
                className='flex flex-wrap items-start justify-between gap-3 rounded-lg border p-4 text-sm'
              >
                <div>
                  <p className='font-medium'>{e.name}</p>
                  <p className='text-xs text-muted-foreground'>
                    {e.verified ? 'Revisada manualmente' : 'Revisión pendiente'}{' '}
                    · {data.cases[e.caseId].name}
                  </p>
                </div>
                <Link
                  to='/portfolio/$caseId'
                  params={{ caseId: e.caseId }}
                  className='text-primary underline'
                >
                  Abrir expediente
                </Link>
              </div>
            ))}
          {!Object.values(data.evidences).some((e) =>
            cases.some((c) => c.id === e.caseId)
          ) ? (
            <EmptyState>No hay evidencias visibles.</EmptyState>
          ) : null}
        </Panel>
      ) : (
        <Panel
          title='Bandeja de revisión y excepciones'
          description='Conflictos, evidencia faltante y decisiones que requieren intervención.'
        >
          {cases
            .filter(
              (c) =>
                getQaIssues(data, c.id).length > 0 ||
                ['review', 'returned', 'escalated'].includes(c.state)
            )
            .map((c) => (
              <div className='grid gap-2 rounded-lg border p-4' key={c.id}>
                <Link
                  to='/portfolio/$caseId'
                  params={{ caseId: c.id }}
                  search={{ tab: 'record' }}
                  className='font-medium text-primary underline'
                >
                  {c.name}
                </Link>
                <ul className='grid list-disc gap-1 ps-5 text-xs text-muted-foreground'>
                  {getQaIssues(data, c.id).map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              </div>
            ))}
          {!cases.some(
            (c) =>
              getQaIssues(data, c.id).length > 0 ||
              ['review', 'returned', 'escalated'].includes(c.state)
          ) ? (
            <EmptyState>
              No hay revisiones pendientes para los expedientes visibles.
            </EmptyState>
          ) : null}
        </Panel>
      )}
    </VcmShell>
  )
}
