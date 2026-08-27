import { useId, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAppStore } from '@/features/core/model/app-store'
import { type Contact, type ContactInput } from '@/features/core/model/types'
import { validateContact } from '@/features/core/model/validation'
import { FormControl } from './form-control'

const emptyContact: ContactInput = {
  name: '',
  email: '',
  phone: '',
  role: '',
  partnerId: null,
}

function inputFromContact(contact?: Contact): ContactInput {
  return contact
    ? {
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
        role: contact.role,
        partnerId: contact.partnerId,
      }
    : emptyContact
}

export function ContactForm({
  contact,
  onSubmit,
  onCancel,
}: {
  contact?: Contact
  onSubmit: (input: ContactInput) => void
  onCancel: () => void
}) {
  const baseId = useId()
  const partners = useAppStore((state) => state.partners)
  const [input, setInput] = useState<ContactInput>(() =>
    inputFromContact(contact)
  )
  const [errors, setErrors] = useState<
    Partial<Record<keyof ContactInput, string>>
  >({})
  const setField = <K extends keyof ContactInput>(
    key: K,
    value: ContactInput[K]
  ) => setInput((current) => ({ ...current, [key]: value }))

  return (
    <form
      className='grid gap-6'
      onSubmit={(event) => {
        event.preventDefault()
        const nextErrors = validateContact(input)
        setErrors(nextErrors)
        if (!Object.keys(nextErrors).length) onSubmit(input)
      }}
    >
      <div className='grid gap-4 sm:grid-cols-2'>
        <FormControl id={`${baseId}-name`} label='Nombre' error={errors.name}>
          <Input
            id={`${baseId}-name`}
            value={input.name}
            onChange={(event) => setField('name', event.target.value)}
          />
        </FormControl>
        <FormControl id={`${baseId}-role`} label='Cargo o función'>
          <Input
            id={`${baseId}-role`}
            value={input.role}
            onChange={(event) => setField('role', event.target.value)}
          />
        </FormControl>
        <FormControl id={`${baseId}-email`} label='Correo' error={errors.email}>
          <Input
            id={`${baseId}-email`}
            type='email'
            value={input.email}
            onChange={(event) => setField('email', event.target.value)}
          />
        </FormControl>
        <FormControl id={`${baseId}-phone`} label='Teléfono'>
          <Input
            id={`${baseId}-phone`}
            value={input.phone}
            onChange={(event) => setField('phone', event.target.value)}
          />
        </FormControl>
        <div className='sm:col-span-2'>
          <FormControl id={`${baseId}-partner`} label='Socio relacionado'>
            <Select
              value={input.partnerId ?? 'none'}
              onValueChange={(value) =>
                setField('partnerId', value === 'none' ? null : value)
              }
            >
              <SelectTrigger id={`${baseId}-partner`} className='w-full'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='none'>Sin socio relacionado</SelectItem>
                {Object.values(partners)
                  .sort((a, b) => a.name.localeCompare(b.name, 'es'))
                  .map((partner) => (
                    <SelectItem key={partner.id} value={partner.id}>
                      {partner.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </FormControl>
        </div>
      </div>
      <div className='flex flex-col-reverse gap-2 sm:flex-row sm:justify-end'>
        <Button type='button' variant='outline' onClick={onCancel}>
          Cancelar
        </Button>
        <Button type='submit'>Guardar contacto</Button>
      </div>
    </form>
  )
}
