import type { ReactNode } from 'react'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { useAppStore } from '@/features/core/model/app-store'
import { ROLE_LABELS } from '../model/catalogs'
import type { Role } from '../model/types'
import { useDemoRole } from '../model/use-vcm'

export function VcmShell({
  title,
  description,
  actions,
  children,
}: {
  title: string
  description: string
  actions?: ReactNode
  children: ReactNode
}) {
  const { role, setRole } = useDemoRole()
  const warning = useAppStore((s) => s.storageWarning)
  return (
    <>
      <Header fixed>
        <Search className='me-auto' placeholder='Buscar espacios' />
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>
      <Main className='flex min-w-0 flex-col gap-6 bg-muted/20'>
        <div className='flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed bg-background px-4 py-3 text-xs'>
          <span className='text-muted-foreground'>
            Prototipo local · datos de demostración · integraciones
            desconectadas
          </span>
          <label className='flex items-center gap-2 font-medium'>
            Vista de demostración
            <select
              aria-label='Rol de demostración'
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              className='max-w-48 rounded border bg-background p-1.5'
            >
              {Object.entries(ROLE_LABELS).map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className='flex flex-wrap items-start justify-between gap-4'>
          <div>
            <h1 className='text-3xl font-bold tracking-tight'>{title}</h1>
            <p className='mt-2 max-w-3xl text-sm text-muted-foreground'>
              {description}
            </p>
          </div>
          {actions}
        </div>
        {warning ? (
          <p
            role='alert'
            className='rounded-lg border border-amber-400 bg-amber-50 p-4 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100'
          >
            No se pudo interpretar el almacenamiento anterior. Se conservó una
            copia recuperable; revisa Configuración antes de continuar con datos
            nuevos.
          </p>
        ) : null}
        {children}
      </Main>
    </>
  )
}
