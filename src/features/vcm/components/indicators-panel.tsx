import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { text } from '../model/form-utils'
import type { Dossier } from '../model/types'
import { useVcm } from '../model/use-vcm'
import { canOperate, isIndicatorLinkEligible } from '../model/workflow'
import { EmptyState, Field, Panel, SaveForm } from './primitives'

export function IndicatorsPanel({ dossier: c }: { dossier: Dossier }) {
  const { data, actor, execute } = useVcm()
  const [editing, setEditing] = useState<string | null>(null)
  const current = editing ? data.indicatorLinks[editing] : undefined
  const links = Object.values(data.indicatorLinks).filter(
    (l) => l.caseId === c.id
  )
  const evidences = Object.values(data.evidences).filter(
    (e) => e.caseId === c.id && e.verified
  )
  return (
    <div className='grid gap-6 lg:grid-cols-2'>
      <Panel
        title='Relaciones Registro–Indicador'
        description='Una relación conserva período, aporte, regla y evidencia. Los datos pendientes no incrementan el avance.'
      >
        {links.map((l) => (
          <div className='grid gap-2 rounded-lg border p-4 text-sm' key={l.id}>
            <strong>
              {l.indicatorId} · {data.indicators[l.indicatorId]?.name}
            </strong>
            <p>
              Aporte {l.value} · período {l.period}
            </p>
            <p className='text-muted-foreground'>{l.rule}</p>
            <Badge variant='outline'>
              {isIndicatorLinkEligible(data, l)
                ? 'Elegible y validada'
                : 'Pendiente · no computa'}
            </Badge>
            {canOperate(actor.role) ? (
              <Button variant='outline' onClick={() => setEditing(l.id)}>
                Revisar relación {l.indicatorId}
              </Button>
            ) : null}
          </div>
        ))}
        {!links.length ? (
          <EmptyState>No hay aportes vinculados.</EmptyState>
        ) : null}
      </Panel>
      <Panel
        title='Proponer relación'
        description='Solo se valida si existe regla disponible, expediente elegible y evidencia revisada. Los demás criterios esperan el Manual de Indicadores.'
      >
        {editing ? (
          <Button variant='ghost' onClick={() => setEditing(null)}>
            Cancelar revisión y proponer otra relación
          </Button>
        ) : null}
        <SaveForm
          key={`${editing ?? 'new'}-${current?.version ?? 0}`}
          disabled={!canOperate(actor.role)}
          label='Guardar relación trazable'
          onSave={(f) =>
            execute({
              type: 'linkIndicator',
              id: editing ?? crypto.randomUUID(),
              caseId: c.id,
              indicatorId: text(f, 'indicatorId'),
              period: Number(text(f, 'period')),
              value: Number(text(f, 'value')),
              rule: text(f, 'rule'),
              evidenceIds: f.getAll('evidenceIds').map(String),
              validate: f.get('validate') === 'on',
            })
          }
        >
          <Field
            label='Indicador'
            name='indicatorId'
            value={current?.indicatorId}
          >
            {Object.values(data.indicators).map((i) => (
              <option key={i.id} value={i.id}>
                {i.id} · {i.name}
              </option>
            ))}
          </Field>
          <div className='grid gap-4 sm:grid-cols-2'>
            <Field
              label='Período'
              name='period'
              type='number'
              value={
                current
                  ? String(current.period)
                  : c.fields.startsAt?.value.slice(0, 4) || '2026'
              }
              required
            />
            <Field
              label='Aporte'
              name='value'
              type='number'
              value={current ? String(current.value) : ''}
              required
            />
          </div>
          <Field
            label='Regla y fundamento del aporte'
            name='rule'
            value={current?.rule}
            multiline
            required
          />
          <fieldset className='grid gap-2'>
            <legend className='mb-2 text-sm font-medium'>
              Evidencias revisadas
            </legend>
            {evidences.map((e) => (
              <label key={e.id} className='flex items-center gap-2 text-sm'>
                <input
                  type='checkbox'
                  name='evidenceIds'
                  value={e.id}
                  defaultChecked={current?.evidenceIds.includes(e.id)}
                />
                {e.name}
              </label>
            ))}
            {!evidences.length ? (
              <p className='text-xs text-muted-foreground'>
                Vincula y revisa evidencia antes de proponer un aporte.
              </p>
            ) : null}
          </fieldset>
          <label className='flex items-center gap-2 text-sm'>
            <input name='validate' type='checkbox' />
            Validar relación dentro del mandato de Coordinación
          </label>
        </SaveForm>
      </Panel>
    </div>
  )
}
