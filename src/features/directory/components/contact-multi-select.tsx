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
import { ContactFormDialog } from './contact-form-dialog'

export function ContactMultiSelect({
  id,
  value,
  onValueChange,
}: {
  id?: string
  value: string[]
  onValueChange: (value: string[]) => void
}) {
  const contacts = useAppStore((state) => state.contacts)
  const [open, setOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const selectedNames = value
    .map((contactId) => contacts[contactId]?.name)
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
                : 'Seleccionar responsables'}
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
                  .map((contact) => {
                    const selected = value.includes(contact.id)
                    return (
                      <CommandItem
                        key={contact.id}
                        value={`${contact.name} ${contact.email}`}
                        onSelect={() =>
                          onValueChange(
                            selected
                              ? value.filter((id) => id !== contact.id)
                              : [...value, contact.id]
                          )
                        }
                      >
                        <Check
                          className={selected ? 'opacity-100' : 'opacity-0'}
                        />
                        {contact.name}
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
        onCreated={(contactId) => onValueChange([...value, contactId])}
      />
    </>
  )
}
