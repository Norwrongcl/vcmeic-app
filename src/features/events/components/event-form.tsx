import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { VCM_LINES } from '@/features/core/model/catalogs'
import { type VcmLineId } from '@/features/core/model/types'
import { ContactCombobox, PartnerMultiSelect } from '@/features/directory'
import { useEventsStore } from '../model/events-store'
import { eventStatusLabels } from '../model/labels'
import { type Event, type EventInput, type EventStatus } from '../model/types'
import { validateEvent, type ValidationErrors } from '../model/validation'
import { FormField } from './form-field'

const emptyEvent: EventInput = {
  name: '',
  description: '',
  status: 'draft',
  startsAt: '',
  endsAt: '',
  location: '',
  owner: '',
  coordinatorContactId: null,
  vcmLine: 'community-services',
  partnerIds: [],
  participantCount: null,
  results: '',
  evidences: [],
  closedAt: null,
}

function eventValues(event?: Event): EventInput {
  return event
    ? {
        name: event.name,
        description: event.description,
        status: event.status,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
        location: event.location,
        owner: event.owner,
        coordinatorContactId: event.coordinatorContactId ?? null,
        vcmLine: event.vcmLine ?? 'community-services',
        partnerIds: event.partnerIds ?? [],
        participantCount: event.participantCount ?? null,
        results: event.results ?? '',
        evidences: event.evidences ?? [],
        closedAt: event.closedAt ?? null,
      }
    : emptyEvent
}

export function EventForm({
  event,
  onSubmit,
  onCancel,
  submitLabel = 'Crear evento',
}: {
  event?: Event
  onSubmit: (input: EventInput) => void
  onCancel: () => void
  submitLabel?: string
}) {
  const contacts = useEventsStore((state) => state.contacts)
  const [values, setValues] = useState<EventInput>(() => eventValues(event))
  const [errors, setErrors] = useState<ValidationErrors<EventInput>>({})

  const setField = <K extends keyof EventInput>(
    key: K,
    value: EventInput[K]
  ) => {
    setValues((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
  }

  const handleSubmit = (submitEvent: FormEvent<HTMLFormElement>) => {
    submitEvent.preventDefault()
    const nextErrors = validateEvent(values)
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }
    onSubmit(values)
  }

  return (
    <form onSubmit={handleSubmit} className='flex flex-col gap-4'>
      <FormField id='event-name' label='Nombre' error={errors.name}>
        <Input
          id='event-name'
          value={values.name}
          onChange={(inputEvent) => setField('name', inputEvent.target.value)}
          aria-invalid={!!errors.name}
          autoFocus
        />
      </FormField>
      <FormField id='event-description' label='Descripción'>
        <Textarea
          id='event-description'
          value={values.description}
          onChange={(inputEvent) =>
            setField('description', inputEvent.target.value)
          }
        />
      </FormField>
      <div className='grid gap-4 sm:grid-cols-2'>
        <FormField id='event-status' label='Estado'>
          <Select
            value={values.status}
            onValueChange={(value) => setField('status', value as EventStatus)}
          >
            <SelectTrigger id='event-status'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {Object.entries(eventStatusLabels)
                  .filter(
                    ([value]) =>
                      value !== 'completed' || event?.status === 'completed'
                  )
                  .map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </FormField>
        <FormField id='event-owner' label='Coordinador' error={errors.owner}>
          <ContactCombobox
            id='event-owner'
            value={values.coordinatorContactId ?? ''}
            onValueChange={(contactId) => {
              setValues((current) => ({
                ...current,
                coordinatorContactId: contactId,
                owner: contacts[contactId]?.name ?? '',
              }))
              setErrors((current) => ({ ...current, owner: undefined }))
            }}
          />
        </FormField>
        <FormField id='event-start' label='Inicio' error={errors.startsAt}>
          <Input
            id='event-start'
            type='datetime-local'
            value={values.startsAt}
            onChange={(inputEvent) =>
              setField('startsAt', inputEvent.target.value)
            }
            aria-invalid={!!errors.startsAt}
          />
        </FormField>
        <FormField id='event-end' label='Término' error={errors.endsAt}>
          <Input
            id='event-end'
            type='datetime-local'
            value={values.endsAt}
            onChange={(inputEvent) =>
              setField('endsAt', inputEvent.target.value)
            }
            aria-invalid={!!errors.endsAt}
          />
        </FormField>
      </div>
      <FormField id='event-location' label='Ubicación'>
        <Input
          id='event-location'
          value={values.location}
          onChange={(inputEvent) =>
            setField('location', inputEvent.target.value)
          }
        />
      </FormField>
      <div className='grid gap-4 sm:grid-cols-2'>
        <FormField id='event-vcm-line' label='Línea VcM'>
          <Select
            value={values.vcmLine ?? 'community-services'}
            onValueChange={(value) => setField('vcmLine', value as VcmLineId)}
          >
            <SelectTrigger id='event-vcm-line'>
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
        </FormField>
        <FormField id='event-partners' label='Socios vinculados'>
          <PartnerMultiSelect
            id='event-partners'
            value={values.partnerIds ?? []}
            onValueChange={(value) => setField('partnerIds', value)}
          />
        </FormField>
      </div>
      <div className='mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end'>
        <Button type='button' variant='outline' onClick={onCancel}>
          Cancelar
        </Button>
        <Button type='submit'>{submitLabel}</Button>
      </div>
    </form>
  )
}
