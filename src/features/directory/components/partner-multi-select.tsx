import { useState } from 'react'
import { Check, ChevronsUpDown, Plus } from 'lucide-react'
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

export function PartnerMultiSelect({
  id,
  value,
  onValueChange,
}: {
  id?: string
  value: string[]
  onValueChange: (value: string[]) => void
}) {
  const partners = useAppStore((state) => state.partners)
  const [open, setOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const selectedNames = value
    .map((partnerId) => partners[partnerId]?.name)
    .filter(Boolean)

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type='button'
            variant='outline'
            className='w-full justify-between font-normal'
          >
            <span className='truncate text-start'>
              {selectedNames.length
                ? selectedNames.join(', ')
                : 'Seleccionar socios'}
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
                {Object.values(partners)
                  .sort((a, b) => a.name.localeCompare(b.name, 'es'))
                  .map((partner) => {
                    const selected = value.includes(partner.id)
                    return (
                      <CommandItem
                        key={partner.id}
                        value={partner.name}
                        onSelect={() =>
                          onValueChange(
                            selected
                              ? value.filter((id) => id !== partner.id)
                              : [...value, partner.id]
                          )
                        }
                      >
                        <Check
                          className={selected ? 'opacity-100' : 'opacity-0'}
                        />
                        {partner.name}
                      </CommandItem>
                    )
                  })}
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
        onCreated={(partnerId) => onValueChange([...value, partnerId])}
      />
    </>
  )
}
