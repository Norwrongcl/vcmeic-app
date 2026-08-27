import { useId, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { type Partner, type PartnerInput } from '@/features/core/model/types'
import { validatePartner } from '@/features/core/model/validation'
import { FormControl } from './form-control'

const emptyPartner: PartnerInput = {
  name: '',
  type: '',
  taxId: '',
  email: '',
  phone: '',
  website: '',
  notes: '',
}

function inputFromPartner(partner?: Partner): PartnerInput {
  return partner
    ? {
        name: partner.name,
        type: partner.type,
        taxId: partner.taxId,
        email: partner.email,
        phone: partner.phone,
        website: partner.website,
        notes: partner.notes,
      }
    : emptyPartner
}

export function PartnerForm({
  partner,
  onSubmit,
  onCancel,
}: {
  partner?: Partner
  onSubmit: (input: PartnerInput) => void
  onCancel: () => void
}) {
  const baseId = useId()
  const [input, setInput] = useState<PartnerInput>(() =>
    inputFromPartner(partner)
  )
  const [errors, setErrors] = useState<
    Partial<Record<keyof PartnerInput, string>>
  >({})
  const setField = <K extends keyof PartnerInput>(
    key: K,
    value: PartnerInput[K]
  ) => setInput((current) => ({ ...current, [key]: value }))

  return (
    <form
      className='grid gap-6'
      onSubmit={(event) => {
        event.preventDefault()
        const nextErrors = validatePartner(input)
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
        <FormControl id={`${baseId}-type`} label='Tipo de organización'>
          <Input
            id={`${baseId}-type`}
            value={input.type}
            onChange={(event) => setField('type', event.target.value)}
            placeholder='Institución pública, empresa…'
          />
        </FormControl>
        <FormControl id={`${baseId}-tax`} label='Identificador'>
          <Input
            id={`${baseId}-tax`}
            value={input.taxId}
            onChange={(event) => setField('taxId', event.target.value)}
            placeholder='RUT u otro identificador'
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
        <FormControl
          id={`${baseId}-website`}
          label='Sitio web'
          error={errors.website}
        >
          <Input
            id={`${baseId}-website`}
            type='url'
            value={input.website}
            onChange={(event) => setField('website', event.target.value)}
            placeholder='https://'
          />
        </FormControl>
        <div className='sm:col-span-2'>
          <FormControl id={`${baseId}-notes`} label='Notas'>
            <Textarea
              id={`${baseId}-notes`}
              value={input.notes}
              onChange={(event) => setField('notes', event.target.value)}
            />
          </FormControl>
        </div>
      </div>
      <div className='flex flex-col-reverse gap-2 sm:flex-row sm:justify-end'>
        <Button type='button' variant='outline' onClick={onCancel}>
          Cancelar
        </Button>
        <Button type='submit'>Guardar socio</Button>
      </div>
    </form>
  )
}
