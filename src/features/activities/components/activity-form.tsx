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
import { Textarea } from '@/components/ui/textarea'
import { VCM_LINES } from '@/features/core/model/catalogs'
import {
  type Activity,
  type ActivityInput,
  type VcmLineId,
} from '@/features/core/model/types'
import {
  validateActivity,
  validateEvidenceLinks,
  type EvidenceValidationErrors,
  type ValidationErrors,
} from '@/features/core/model/validation'
import { ContactCombobox, PartnerMultiSelect } from '@/features/directory'
import { FormControl } from '@/features/directory/components/form-control'
import { EvidenceFields } from './evidence-fields'

const emptyActivity: ActivityInput = {
  name: '',
  description: '',
  startsAt: '',
  endsAt: '',
  location: '',
  vcmLine: 'community-services',
  responsibleContactId: '',
  partnerIds: [],
  participantCount: 0,
  results: '',
  evidences: [],
}

function inputFromActivity(activity?: Activity): ActivityInput {
  if (!activity) return emptyActivity
  const {
    id: _id,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    approvalStatus: _approvalStatus,
    source: _source,
    rejectionReason: _rejectionReason,
    ...input
  } = activity
  return input
}

export function ActivityForm({
  activity,
  onSubmit,
  onCancel,
  submitLabel = 'Guardar actividad',
}: {
  activity?: Activity
  onSubmit: (input: ActivityInput) => void
  onCancel: () => void
  submitLabel?: string
}) {
  const baseId = useId()
  const [input, setInput] = useState<ActivityInput>(() =>
    inputFromActivity(activity)
  )
  const [errors, setErrors] = useState<ValidationErrors<ActivityInput>>({})
  const [evidenceErrors, setEvidenceErrors] = useState<
    EvidenceValidationErrors[]
  >([])

  const setField = <K extends keyof ActivityInput>(
    key: K,
    value: ActivityInput[K]
  ) => setInput((current) => ({ ...current, [key]: value }))

  const save = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextErrors = validateActivity(input)
    const nextEvidenceErrors = validateEvidenceLinks(input.evidences)
    setErrors(nextErrors)
    setEvidenceErrors(nextEvidenceErrors)
    if (Object.keys(nextErrors).length) return
    onSubmit(input)
  }

  return (
    <form onSubmit={save} className='grid gap-6'>
      <div className='grid gap-4 sm:grid-cols-2'>
        <div className='sm:col-span-2'>
          <FormControl id={`${baseId}-name`} label='Nombre' error={errors.name}>
            <Input
              id={`${baseId}-name`}
              value={input.name}
              onChange={(event) => setField('name', event.target.value)}
            />
          </FormControl>
        </div>
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
          id={`${baseId}-start`}
          label='Inicio'
          error={errors.startsAt}
        >
          <Input
            id={`${baseId}-start`}
            type='datetime-local'
            value={input.startsAt}
            onChange={(event) => setField('startsAt', event.target.value)}
          />
        </FormControl>
        <FormControl id={`${baseId}-end`} label='Término' error={errors.endsAt}>
          <Input
            id={`${baseId}-end`}
            type='datetime-local'
            value={input.endsAt}
            onChange={(event) => setField('endsAt', event.target.value)}
          />
        </FormControl>
        <FormControl id={`${baseId}-location`} label='Lugar o territorio'>
          <Input
            id={`${baseId}-location`}
            value={input.location}
            onChange={(event) => setField('location', event.target.value)}
          />
        </FormControl>
        <FormControl
          id={`${baseId}-participants`}
          label='Participantes'
          error={errors.participantCount}
        >
          <Input
            id={`${baseId}-participants`}
            type='number'
            min={0}
            step={1}
            value={input.participantCount}
            onChange={(event) =>
              setField('participantCount', Number(event.target.value))
            }
          />
        </FormControl>
        <FormControl id={`${baseId}-line`} label='Línea VcM'>
          <Select
            value={input.vcmLine}
            onValueChange={(value) => setField('vcmLine', value as VcmLineId)}
          >
            <SelectTrigger id={`${baseId}-line`} className='w-full'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {VCM_LINES.map((line) => (
                <SelectItem key={line.id} value={line.id}>
                  {line.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormControl>
        <FormControl
          id={`${baseId}-responsible`}
          label='Responsable'
          error={errors.responsibleContactId}
        >
          <ContactCombobox
            id={`${baseId}-responsible`}
            value={input.responsibleContactId}
            onValueChange={(value) => setField('responsibleContactId', value)}
          />
        </FormControl>
        <div className='sm:col-span-2'>
          <FormControl id={`${baseId}-partners`} label='Socios vinculados'>
            <PartnerMultiSelect
              id={`${baseId}-partners`}
              value={input.partnerIds}
              onValueChange={(value) => setField('partnerIds', value)}
            />
          </FormControl>
        </div>
        <div className='sm:col-span-2'>
          <FormControl
            id={`${baseId}-results`}
            label='Resultados u observaciones'
          >
            <Textarea
              id={`${baseId}-results`}
              value={input.results}
              onChange={(event) => setField('results', event.target.value)}
            />
          </FormControl>
        </div>
        <div className='sm:col-span-2'>
          <EvidenceFields
            value={input.evidences}
            onChange={(value) => setField('evidences', value)}
            errors={evidenceErrors}
          />
        </div>
      </div>
      <div className='flex flex-col-reverse gap-2 sm:flex-row sm:justify-end'>
        <Button type='button' variant='outline' onClick={onCancel}>
          Cancelar
        </Button>
        <Button type='submit'>{submitLabel}</Button>
      </div>
    </form>
  )
}
