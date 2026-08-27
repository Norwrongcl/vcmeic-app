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
import { ContactFormDialog } from './contact-form-dialog'

export function ContactCombobox({
  value,
  onValueChange,
  id,
  placeholder = 'Seleccionar contacto',
}: {
  value: string
  onValueChange: (value: string) => void
  id?: string
  placeholder?: string
}) {
  const contacts = useAppStore((state) => state.contacts)
  const [open, setOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const selected = contacts[value]

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
            <CommandInput placeholder='Buscar contacto…' />
            <CommandList>
              <CommandEmpty>No se encontraron contactos.</CommandEmpty>
              <CommandGroup>
                {Object.values(contacts)
                  .sort((a, b) => a.name.localeCompare(b.name, 'es'))
                  .map((contact) => (
                    <CommandItem
                      key={contact.id}
                      value={`${contact.name} ${contact.email}`}
                      onSelect={() => {
                        onValueChange(contact.id)
                        setOpen(false)
                      }}
                    >
                      <Check
                        className={cn(
                          'me-1',
                          contact.id === value ? 'opacity-100' : 'opacity-0'
                        )}
                      />
                      <span className='truncate'>{contact.name}</span>
                      {contact.email && (
                        <span className='ms-auto truncate text-xs text-muted-foreground'>
                          {contact.email}
                        </span>
                      )}
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
                  <Plus /> Crear contacto
                </CommandItem>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <ContactFormDialog
        key={createOpen ? 'contact-open' : 'contact-closed'}
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={onValueChange}
      />
    </>
  )
}
