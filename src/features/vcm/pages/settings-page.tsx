import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/confirm-dialog'
import {
  APP_STORAGE_KEY,
  LEGACY_EVENTS_STORAGE_KEY,
} from '@/features/core/model/app-store'
import { Panel } from '../components/primitives'
import { VcmShell } from '../components/shell'
import { RULE_VERSION } from '../model/catalogs'
import { downloadText } from '../model/mirror'
import { vcmRepository } from '../model/repository'
import { useVcm } from '../model/use-vcm'

export function VcmSettingsPage() {
  const { actor } = useVcm()
  const input = useRef<HTMLInputElement>(null)
  const [reset, setReset] = useState(false)
  const recovery =
    localStorage.getItem(`${APP_STORAGE_KEY}-unreadable-backup`) ??
    localStorage.getItem(`${LEGACY_EVENTS_STORAGE_KEY}-unreadable-backup`)
  const allowed = ['coordination', 'leadership', 'technician'].includes(
    actor.role
  )
  const download = async () => {
    try {
      const raw = await vcmRepository.exportBackup()
      const url = URL.createObjectURL(
        new Blob([raw], { type: 'application/json' })
      )
      const a = document.createElement('a')
      a.href = url
      a.download = 'vcm-respaldo-v4.json'
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 100)
      toast.success('Respaldo local exportado.')
    } catch {
      toast.error('No se pudo exportar el respaldo.')
    }
  }
  const upload = async (file?: File) => {
    if (!file) return
    try {
      await vcmRepository.importBackup(await file.text())
      toast.success('Respaldo validado e importado.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'No se pudo importar.')
    } finally {
      if (input.current) input.current.value = ''
    }
  }
  return (
    <VcmShell
      title='Configuración'
      description='Datos locales, reglas de referencia y estado de conexiones.'
    >
      {!allowed ? (
        <Panel title='Acceso restringido en la demostración'>
          <p className='text-sm'>
            Selecciona Coordinación, Jefatura o Técnico para revisar
            configuración. Los permisos productivos se aplicarán en backend.
          </p>
        </Panel>
      ) : (
        <>
          <Panel
            title='Respaldo y recuperación'
            description='Incluye expedientes, fuentes, decisiones, historial y todos los datos originales migrados.'
          >
            <div className='flex flex-wrap gap-2'>
              <Button onClick={() => void download()}>Exportar respaldo</Button>
              <Button variant='outline' onClick={() => input.current?.click()}>
                Importar respaldo
              </Button>
              <Button variant='destructive' onClick={() => setReset(true)}>
                Restablecer demostración
              </Button>
            </div>
            <input
              ref={input}
              type='file'
              accept='.json,application/json'
              aria-label='Archivo de respaldo'
              className='hidden'
              onChange={(e) => void upload(e.target.files?.[0])}
            />
            {recovery ? (
              <Button
                variant='outline'
                onClick={() =>
                  downloadText(
                    recovery,
                    'vcm-datos-originales-recuperacion.txt',
                    'text/plain;charset=utf-8'
                  )
                }
              >
                Descargar datos originales conservados
              </Button>
            ) : null}
            <p className='text-xs text-muted-foreground'>
              Exporta antes de restablecer. No hay sincronización entre
              navegadores y no se ejecuta eliminación automática de evidencias.
            </p>
          </Panel>
          <Panel
            title='Servicios externos'
            description='Todos permanecen desconectados de este prototipo.'
          >
            {[
              'Hermes · acceso futuro al backend por identidad de servicio',
              'WhatsApp y Telegram · canales externos de Hermes',
              'Drive · originales y evidencias',
              'Notion · tareas y seguimiento operacional',
              'Buffer · borradores, programación y publicaciones',
              'Canva · diseños editables',
              'Calendar y correo · agenda y comunicación formal',
            ].map((item) => (
              <div key={item} className='rounded border p-3 text-sm'>
                {item}
                <span className='block text-xs text-muted-foreground'>
                  Pendiente de integración
                </span>
              </div>
            ))}
          </Panel>
          <Panel
            title='Reglas y catálogos versionados'
            description={`Referencia activa: ${RULE_VERSION}`}
          >
            <p className='text-sm'>
              Las siete tipologías P5.1 y la matriz P5.2 de 49 campos se basan
              en el documento del PO. Los catálogos institucionales adicionales
              y las reglas completas del Manual de Indicadores están pendientes
              de incorporar.
            </p>
            <p className='text-xs text-muted-foreground'>
              Los cambios de reglas requieren revisión humana y versionado. Este
              prototipo no modifica reglas automáticamente.
            </p>
          </Panel>
        </>
      )}
      <ConfirmDialog
        open={reset}
        onOpenChange={setReset}
        title='Restablecer demostración'
        desc='Se reemplazarán los datos de este navegador. Exporta un respaldo para conservar el trabajo actual.'
        confirmText='Restablecer'
        destructive
        handleConfirm={() => {
          void vcmRepository
            .resetDemo()
            .then(() => {
              setReset(false)
              toast.success('Demostración restablecida.')
            })
            .catch(() => toast.error('No se pudo restablecer.'))
        }}
      />
    </VcmShell>
  )
}
