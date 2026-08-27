import { useRef, useState } from 'react'
import { Database, Download, RotateCcw, Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { useAppStore } from '@/features/core/model/app-store'
import { VCM_LINES } from '@/features/core/model/catalogs'

export function LocalDataSettings() {
  const exportSnapshot = useAppStore((state) => state.exportSnapshot)
  const importSnapshot = useAppStore((state) => state.importSnapshot)
  const resetData = useAppStore((state) => state.resetData)
  const inputRef = useRef<HTMLInputElement>(null)
  const [resetOpen, setResetOpen] = useState(false)

  const downloadBackup = () => {
    const blob = new Blob([exportSnapshot()], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `contenthub-respaldo-${new Date().toISOString().slice(0, 10)}.json`
    link.click()
    URL.revokeObjectURL(url)
    toast.success('Respaldo exportado.')
  }

  const importFile = async (file?: File) => {
    if (!file) return
    const result = importSnapshot(await file.text())
    if (result.success) toast.success('Respaldo importado correctamente.')
    else toast.error(result.error)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <>
      <Header fixed>
        <Search className='me-auto' />
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>
      <Main className='flex flex-col gap-6'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>Configuración</h1>
          <p className='text-muted-foreground'>
            Apariencia, datos locales y herramientas de la demostración.
          </p>
        </div>
        <div className='grid gap-4 lg:grid-cols-2'>
          <Card>
            <CardHeader>
              <div className='flex items-start gap-3'>
                <Database className='mt-0.5 size-5 text-muted-foreground' />
                <div>
                  <CardTitle>Datos locales</CardTitle>
                  <CardDescription>
                    Toda la demostración se guarda en este navegador mediante un
                    snapshot versionado.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className='flex flex-wrap gap-2'>
              <Button onClick={downloadBackup}>
                <Download data-icon='inline-start' /> Exportar respaldo
              </Button>
              <Button
                variant='outline'
                onClick={() => inputRef.current?.click()}
              >
                <Upload data-icon='inline-start' /> Importar respaldo
              </Button>
              <Button variant='destructive' onClick={() => setResetOpen(true)}>
                <RotateCcw data-icon='inline-start' /> Restablecer demostración
              </Button>
              <input
                ref={inputRef}
                type='file'
                accept='application/json,.json'
                className='hidden'
                onChange={(event) => void importFile(event.target.files?.[0])}
              />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Alcance de esta versión</CardTitle>
              <CardDescription>
                La arquitectura queda preparada para integrar el backend
                posterior.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className='grid list-disc gap-2 ps-5 text-sm text-muted-foreground'>
                <li>Acceso y permisos simulados para la revisión de diseño.</li>
                <li>Sin sincronización entre dispositivos.</li>
                <li>Evidencias almacenadas como nombre y enlace.</li>
                <li>Sin carga de archivos ni conexión S3.</li>
              </ul>
            </CardContent>
          </Card>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Líneas VcM predefinidas</CardTitle>
            <CardDescription>
              Clasificación principal disponible para Actividades y Eventos. No
              es editable en esta demostración.
            </CardDescription>
          </CardHeader>
          <CardContent className='grid gap-2 sm:grid-cols-2 lg:grid-cols-3'>
            {VCM_LINES.map((line, index) => (
              <div key={line.id} className='flex gap-3 rounded-md border p-3'>
                <span className='flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold'>
                  {index + 1}
                </span>
                <p className='text-sm font-medium'>{line.label}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </Main>
      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title='Restablecer datos de demostración'
        desc='Se reemplazarán todos los datos guardados en este navegador.'
        confirmText='Restablecer datos'
        destructive
        handleConfirm={() => {
          resetData()
          setResetOpen(false)
          toast.success('Datos de demostración restablecidos.')
        }}
      />
    </>
  )
}
