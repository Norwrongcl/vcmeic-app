import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { campaignIsApproved } from '../model/campaign-rules'
import { text } from '../model/form-utils'
import { weeklyPackageSnapshot } from '../model/package-review'
import type { Content } from '../model/types'
import { webUrl } from '../model/urls'
import { useVcm } from '../model/use-vcm'
import { canOperate, canRead } from '../model/workflow'
import { Field, SaveForm } from './primitives'

type Review = {
  snapshot: string
  pieces: (Content & { caseName: string; strategy: number | null })[]
  inaccessible: boolean
}
export function WeeklyPackageReview({
  packageId,
  caseId,
}: {
  packageId: string
  caseId: string
}) {
  const { data, actor, execute } = useVcm()
  const [review, setReview] = useState<Review | null>(null)
  function open() {
    const pieces = Object.values(data.contents).filter(
      (p) => p.mode === 'weekly' && p.packageId === packageId
    )
    const visible = pieces.filter(
      (p) => data.cases[p.caseId] && canRead(data.cases[p.caseId], actor)
    )
    setReview({
      snapshot: weeklyPackageSnapshot(data, packageId),
      inaccessible: visible.length !== pieces.length,
      pieces: visible.map((p) => ({
        ...p,
        caseName: data.cases[p.caseId].name,
        strategy: campaignIsApproved(data.campaigns[p.caseId])
          ? data.campaigns[p.caseId].approvedVersion
          : null,
      })),
    })
  }
  const changed =
    !!review && review.snapshot !== weeklyPackageSnapshot(data, packageId)
  return (
    <>
      <Button
        variant='outline'
        disabled={!canOperate(actor.role)}
        onClick={open}
      >
        Revisar paquete semanal
      </Button>
      <Dialog
        open={!!review}
        onOpenChange={(value) => {
          if (!value) setReview(null)
        }}
      >
        <DialogContent className='max-h-[85dvh] overflow-y-auto sm:max-w-2xl'>
          <DialogHeader>
            <DialogTitle>
              Revisión del paquete semanal · {packageId}
            </DialogTitle>
            <DialogDescription>
              La aprobación incluye todas las piezas de esta semana, también las
              de otros expedientes. No programa ni publica contenido.
            </DialogDescription>
          </DialogHeader>
          {review?.pieces.map((p) => (
            <article
              key={p.id}
              className='grid gap-2 rounded border p-4 text-sm'
            >
              <h3 className='font-semibold'>
                {p.title} · versión {p.version}
              </h3>
              <p>Expediente: {p.caseName}</p>
              <p>
                {p.channel} · Fecha propuesta: {p.scheduledAt || 'Pendiente'}
              </p>
              <p>
                Estrategia aprobada:{' '}
                {p.strategy ? `versión ${p.strategy}` : 'Pendiente'}
              </p>
              <p className='whitespace-pre-wrap'>
                <strong>Brief de producción:</strong> {p.brief || 'Pendiente'}
              </p>
              <p className='whitespace-pre-wrap'>
                <strong>Texto:</strong> {p.copy || 'Pendiente'}
              </p>
              {webUrl(p.assetUrl) ? (
                <a
                  className='break-all text-primary underline'
                  href={webUrl(p.assetUrl)!}
                  target='_blank'
                  rel='noreferrer'
                >
                  Abrir activo final
                </a>
              ) : (
                <p>Activo final pendiente o enlace no disponible.</p>
              )}
            </article>
          ))}
          {review?.inaccessible && (
            <p role='alert'>
              Hay expedientes del paquete sin acceso para este rol. Solicita
              revisión a Coordinación con acceso completo.
            </p>
          )}
          {changed && (
            <div role='alert' className='rounded border p-3 text-sm'>
              El paquete cambió desde que abriste la revisión.{' '}
              <Button variant='outline' size='sm' onClick={open}>
                Actualizar revisión
              </Button>
            </div>
          )}
          {review && (
            <SaveForm
              key={review.snapshot}
              disabled={
                changed ||
                review.inaccessible ||
                !review.pieces.length ||
                !canOperate(actor.role)
              }
              label='Confirmar aprobación del paquete completo'
              onSave={async (f) => {
                const ok = await execute({
                  type: 'approvePackage',
                  caseId,
                  packageId,
                  reviewedSnapshot: review.snapshot,
                  reason: text(f, 'reason'),
                })
                if (ok) setReview(null)
                return ok
              }}
            >
              <label className='flex items-start gap-2 text-sm'>
                <input
                  type='checkbox'
                  required
                  name='reviewed'
                  className='mt-1'
                />
                He revisado las {review.pieces.length} piezas y sus activos,
                incluidos los otros expedientes.
              </label>
              <Field
                label='Fundamento de aprobación del paquete'
                name='reason'
                required
                multiline
              />
            </SaveForm>
          )}
          <Button type='button' variant='ghost' onClick={() => setReview(null)}>
            Volver sin aprobar
          </Button>
        </DialogContent>
      </Dialog>
    </>
  )
}
