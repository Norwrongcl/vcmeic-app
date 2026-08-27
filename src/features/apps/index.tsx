import { useMemo, useState } from 'react'
import { Cable, CheckCircle2, SearchIcon, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { apps } from './data/apps'

export function Apps() {
  const [query, setQuery] = useState('')
  const [enabled, setEnabled] = useState<Record<string, boolean>>({
    Hermes: true,
    'Google Drive': true,
    Buffer: false,
  })
  const filtered = useMemo(
    () =>
      apps.filter((app) =>
        app.name
          .toLocaleLowerCase('es-CL')
          .includes(query.toLocaleLowerCase('es-CL'))
      ),
    [query]
  )
  const activeCount = Object.values(enabled).filter(Boolean).length

  const updateConnection = (name: string, active: boolean) => {
    setEnabled((current) => ({ ...current, [name]: active }))
    toast.success(active ? `${name} conectado.` : `${name} desconectado.`)
  }

  return (
    <>
      <Header fixed>
        <Search className='me-auto' />
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>
      <Main className='flex flex-col gap-6 bg-muted/20'>
        <div className='flex flex-wrap items-end justify-between gap-4'>
          <div>
            <h1 className='text-3xl font-bold tracking-tight'>Conexiones</h1>
            <p className='mt-1 text-muted-foreground'>
              Configura integraciones simuladas para validar la experiencia del
              producto.
            </p>
          </div>
          <Button
            variant='outline'
            onClick={() => {
              setEnabled(
                Object.fromEntries(apps.map((app) => [app.name, true]))
              )
              toast.success(
                'Todas las conexiones fueron activadas para la demo.'
              )
            }}
          >
            <Cable data-icon='inline-start' /> Activar todas
          </Button>
        </div>

        <div className='grid gap-4 sm:grid-cols-3'>
          <Card className='border-t-4 border-t-blue-500'>
            <CardContent className='pt-6'>
              <p className='text-sm text-muted-foreground'>Disponibles</p>
              <p className='mt-1 text-3xl font-bold'>{apps.length}</p>
            </CardContent>
          </Card>
          <Card className='border-t-4 border-t-emerald-500'>
            <CardContent className='pt-6'>
              <p className='text-sm text-muted-foreground'>Activas</p>
              <p className='mt-1 text-3xl font-bold'>{activeCount}</p>
            </CardContent>
          </Card>
          <Card className='border-t-4 border-t-violet-500'>
            <CardContent className='pt-6'>
              <p className='text-sm text-muted-foreground'>Estado</p>
              <p className='mt-1 text-lg font-bold'>Demo local</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Catálogo de conexiones</CardTitle>
            <CardDescription>
              Ninguna acción envía datos ni usa credenciales reales.
            </CardDescription>
          </CardHeader>
          <CardContent className='flex flex-col gap-5'>
            <div className='relative max-w-md'>
              <SearchIcon className='absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground' />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className='ps-9'
                placeholder='Buscar conexión'
                aria-label='Buscar conexiones'
              />
            </div>
            <div className='grid gap-4 md:grid-cols-2 xl:grid-cols-3'>
              {filtered.map((app) => {
                const active = enabled[app.name] ?? false
                return (
                  <Card key={app.name} className='shadow-sm'>
                    <CardHeader className='flex-row items-start justify-between gap-4'>
                      <span className='flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary'>
                        {app.logo}
                      </span>
                      <Badge variant={active ? 'default' : 'secondary'}>
                        {active ? 'Conectada' : 'Disponible'}
                      </Badge>
                    </CardHeader>
                    <CardContent className='flex flex-col gap-4'>
                      <div>
                        <CardTitle>{app.name}</CardTitle>
                        <CardDescription className='mt-2 min-h-10'>
                          {app.desc}
                        </CardDescription>
                      </div>
                      <div className='flex items-center justify-between rounded-lg border bg-muted/30 p-3'>
                        <span className='flex items-center gap-2 text-sm font-medium'>
                          {active ? (
                            <CheckCircle2 className='text-emerald-600' />
                          ) : (
                            <ShieldCheck className='text-muted-foreground' />
                          )}
                          {active ? 'Sincronización activa' : 'Activar demo'}
                        </span>
                        <Switch
                          checked={active}
                          onCheckedChange={(checked) =>
                            updateConnection(app.name, checked)
                          }
                          aria-label={`${active ? 'Desactivar' : 'Activar'} ${app.name}`}
                        />
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </Main>
    </>
  )
}
