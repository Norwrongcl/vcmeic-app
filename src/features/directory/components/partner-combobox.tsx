import { useState } from 'react'
import { Check, ChevronsUpDown, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { useAppStore } from '@/features/core/model/app-store'
import { PartnerFormDialog } from './partner-form-dialog'

export function PartnerCombobox({
  value,
  onValueChange,
  id,
  allowEmpty = false,
  placeholder = 'Seleccionar socio',
}: {
  value: string | null
  onValueChange: (value: string | null) => void
  id?: string
  allowEmpty?: boolean
  placeholder?: string
}) {
  const partners = useAppStore((state) => state.partners)
  const [open, setOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const selected = value ? partners[value] : undefined

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type='button'
            id={id}
            variant='outline'
            role='combobox'
            aria-expanded={open}
            className='w-full justify-between font-normal'
          >
            <span
              className={cn('truncate', !selected && 'text-muted-foreground')}
            >
              {selected?.name ?? placeholder}
            </span>
            <ChevronsUpDown className='opacity-50' />
          </Button>
        </PopoverTrigger>
        <PopoverContent className='w-[--radix-popover-trigger-width] p-0'>
          <Command>
            <CommandInput placeholder='Buscar socio…' />
            <CommandList>
              <CommandEmpty>No se encontraron socios.</CommandEmpty>
              <CommandGroup>
                {allowEmpty && (
                  <CommandItem
                    value='sin socio'
                    onSelect={() => {
                      onValueChange(null)
                      setOpen(false)
                    }}
                  >
                    <Check
                      className={cn(
                        'me-1',
                        value === null ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    Sin socio relacionado
                  </CommandItem>
                )}
                {Object.values(partners)
                  .sort((a, b) => a.name.localeCompare(b.name, 'es'))
                  .map((partner) => (
                    <CommandItem
                      key={partner.id}
                      value={partner.name}
                      onSelect={() => {
                        onValueChange(partner.id)
                        setOpen(false)
                      }}
                    >
                      <Check
                        className={cn(
                          'me-1',
                          partner.id === value ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      {partner.name}
                    </CommandItem>
                  ))}
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup>
                <CommandItem
                  onSelect={() => {
                    setOpen(false)
                    setCreateOpen(true)
                  }}
                >
                  <Plus /> Crear socio
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <PartnerFormDialog
        key={createOpen ? 'partner-open' : 'partner-closed'}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(id) => onValueChange(id)}
      />
    </>
  )
}
