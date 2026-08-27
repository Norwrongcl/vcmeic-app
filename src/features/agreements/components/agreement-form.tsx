import { useId, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  type Agreement,
  type AgreementInput,
} from '@/features/core/model/types'
import { validateAgreement } from '@/features/core/model/validation'
import { ContactCombobox, PartnerCombobox } from '@/features/directory'
import { FormControl } from '@/features/directory/components/form-control'

const emptyAgreement: AgreementInput = {
  name: '',
  type: '',
  description: '',
  partnerId: '',
  responsibleContactId: null,
  startsAt: '',
  endsAt: null,
  documentUrl: '',
  notes: '',
  cancelled: false,
}
function inputFromAgreement(agreement?: Agreement): AgreementInput {
  if (!agreement) return emptyAgreement
  const {
    id: _id,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    ...input
  } = agreement
  return input
}

export function AgreementForm({
  agreement,
  onSubmit,
  onCancel,
}: {
  agreement?: Agreement
  onSubmit: (input: AgreementInput) => void
  onCancel: () => void
}) {
  const baseId = useId()
  const [input, setInput] = useState<AgreementInput>(() =>
    inputFromAgreement(agreement)
  )
  const [errors, setErrors] = useState<
    Partial<Record<keyof AgreementInput, string>>
  >({})
  const setField = <K extends keyof AgreementInput>(
    key: K,
    value: AgreementInput[K]
  ) => setInput((current) => ({ ...current, [key]: value }))
  return (
    <form
      className='grid gap-6'
      onSubmit={(event) => {
        event.preventDefault()
        const next = validateAgreement(input)
        setErrors(next)
        if (!Object.keys(next).length) onSubmit(input)
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
        <FormControl id={`${baseId}-type`} label='Tipo de convenio'>
          <Input
            id={`${baseId}-type`}
            value={input.type}
            onChange={(event) => setField('type', event.target.value)}
            placeholder='Marco, específico…'
          />
        </FormControl>
        <div className='sm:col-span-2'>
          <FormControl id={`${baseId}-description`} label='Descripción'>
            <Textarea
              id={`${baseId}-description`}
              value={input.description}
              onChange={(event) => setField('description', event.target.value)}
            />
          </FormControl>
        </div>
        <FormControl
          id={`${baseId}-partner`}
          label='Socio'
          error={errors.partnerId}
        >
          <PartnerCombobox
            id={`${baseId}-partner`}
            value={input.partnerId || null}
            onValueChange={(value) => setField('partnerId', value ?? '')}
          />
        </FormControl>
        <FormControl id={`${baseId}-contact`} label='Contacto responsable'>
          <ContactCombobox
            id={`${baseId}-contact`}
            value={input.responsibleContactId ?? ''}
            onValueChange={(value) => setField('responsibleContactId', value)}
          />
        </FormControl>
        <FormControl
          id={`${baseId}-start`}
          label='Inicio'
          error={errors.startsAt}
        >
          <Input
            id={`${baseId}-start`}
            type='date'
            value={input.startsAt}
            onChange={(event) => setField('startsAt', event.target.value)}
          />
        </FormControl>
        <FormControl id={`${baseId}-end`} label='Término' error={errors.endsAt}>
          <Input
            id={`${baseId}-end`}
            type='date'
            value={input.endsAt ?? ''}
            onChange={(event) => setField('endsAt', event.target.value || null)}
          />
        </FormControl>
        <div className='sm:col-span-2'>
          <FormControl
            id={`${baseId}-document`}
            label='Enlace al documento'
            error={errors.documentUrl}
          >
            <Input
              id={`${baseId}-document`}
              type='url'
              value={input.documentUrl}
              onChange={(event) => setField('documentUrl', event.target.value)}
              placeholder='https://'
            />
          </FormControl>
        </div>
        <div className='sm:col-span-2'>
          <FormControl id={`${baseId}-notes`} label='Notas'>
            <Textarea
              id={`${baseId}-notes`}
              value={input.notes}
              onChange={(event) => setField('notes', event.target.value)}
            />
          </FormControl>
        </div>
        <div className='flex items-center gap-3 sm:col-span-2'>
          <Switch
            id={`${baseId}-cancelled`}
            checked={input.cancelled}
            onCheckedChange={(value) => setField('cancelled', value)}
          />
          <label
            htmlFor={`${baseId}-cancelled`}
            className='text-sm font-medium'
          >
            Convenio cancelado
          </label>
        </div>
      </div>
      <div className='flex flex-col-reverse gap-2 sm:flex-row sm:justify-end'>
        <Button type='button' variant='outline' onClick={onCancel}>
          Cancelar
        </Button>
        <Button type='submit'>Guardar convenio</Button>
      </div>
    </form>
  )
}
