import { Columns3, LayoutGrid, Table2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { type EntityViewMode } from '../model/view-preferences'

const VIEW_METADATA: Record<
  EntityViewMode,
  { label: string; icon: typeof Table2 }
> = {
  table: { label: 'Tabla', icon: Table2 },
  cards: { label: 'Tarjetas', icon: LayoutGrid },
  kanban: { label: 'Kanban', icon: Columns3 },
}

export function EntityViewSwitcher({
  value,
  modes,
  onValueChange,
  className,
}: {
  value: EntityViewMode
  modes: readonly EntityViewMode[]
  onValueChange: (mode: EntityViewMode) => void
  className?: string
}) {
  return (
    <div
      role='group'
      aria-label='Modo de vista'
      className={cn(
        'flex w-fit items-center rounded-md border bg-background p-0.5',
        className
      )}
    >
      {modes.map((mode) => {
        const { label, icon: Icon } = VIEW_METADATA[mode]
        const selected = value === mode
        return (
          <Button
            key={mode}
            type='button'
            size='icon'
            variant={selected ? 'secondary' : 'ghost'}
            aria-label={label}
            aria-pressed={selected}
            title={label}
            onClick={() => onValueChange(mode)}
            className='size-8'
          >
            <Icon />
          </Button>
        )
      })}
    </div>
  )
}
