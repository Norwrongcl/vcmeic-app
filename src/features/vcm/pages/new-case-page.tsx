import { useNavigate, Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Field, Panel, SaveForm } from '../components/primitives'
import { VcmShell } from '../components/shell'
import { KIND_LABELS, PORTFOLIOS } from '../model/catalogs'
import { text } from '../model/form-utils'
import type { CaseKind } from '../model/types'
import { useVcm } from '../model/use-vcm'
import { canOperate } from '../model/workflow'

export function NewCasePage({
  initialKind = 'initiative',
}: {
  initialKind?: CaseKind
}) {
  const { execute, actor } = useVcm()
  const navigate = useNavigate()
  return (
    <VcmShell
      key={actor.id}
      title='Nuevo expediente'
      description='Ingreso inicial breve. Los antecedentes se completan y revisan progresivamente; guardar no equivale a validar.'
      actions={
        <Button asChild variant='outline'>
          <Link to='/portfolio'>Volver al portafolio</Link>
        </Button>
      }
    >
      <Panel
        title='Antecedentes iniciales'
        description='Los campos institucionales y datos de cierre se revisan dentro de la Ficha 360.'
      >
        <SaveForm
          draftKey={`${actor.id}:new-case:${initialKind}`}
          disabled={!canOperate(actor.role)}
          label='Crear expediente'
          onSave={async (f) => {
            const id = crypto.randomUUID()
            const ok = await execute({
              type: 'createCase',
              id,
              kind: text(f, 'kind') as CaseKind,
              name: text(f, 'name'),
              responsible: text(f, 'responsible'),
              description: text(f, 'description'),
              startsAt: text(f, 'startsAt'),
              endsAt: text(f, 'endsAt'),
              portfolio: text(f, 'portfolio'),
            })
            if (ok)
              await navigate({
                to: '/portfolio/$caseId',
                params: { caseId: id },
              })
            return ok
          }}
        >
          <div className='grid gap-4 md:grid-cols-2'>
            <Field label='Tipo de expediente' name='kind' value={initialKind}>
              {Object.entries(KIND_LABELS).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </Field>
            <Field label='Portafolio' name='portfolio'>
              <option value=''>Por definir</option>
              {PORTFOLIOS.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </Field>
            <Field label='Nombre' name='name' required />
            <Field label='Responsable' name='responsible' required />
            <Field label='Fecha inicio' name='startsAt' type='date' />
            <Field label='Fecha cierre' name='endsAt' type='date' />
          </div>
          <Field
            label='Descripción y propósito'
            name='description'
            multiline
            required
          />
        </SaveForm>
      </Panel>
    </VcmShell>
  )
}
