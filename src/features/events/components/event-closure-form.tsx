import { useState } from 'react'
import { CircleCheckBig } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { EvidenceFields } from '@/features/activities/components/evidence-fields'
import { type EvidenceLink } from '@/features/core/model/types'
import {
  validateEvidenceLinks,
  type EvidenceValidationErrors,
} from '@/features/core/model/validation'
import { useEventsStore } from '../model/events-store'

export function EventClosureForm({ eventId }: { eventId: string }) {
  const event = useEventsStore((state) => state.events[eventId])
  const updateEvent = useEventsStore((state) => state.updateEvent)
  const [participantCount, setParticipantCount] = useState(
    event?.participantCount ?? 0
  )
  const [results, setResults] = useState(event?.results ?? '')
  const [evidences, setEvidences] = useState<EvidenceLink[]>(
    event?.evidences ?? []
  )
  const [participantError, setParticipantError] = useState('')
  const [evidenceErrors, setEvidenceErrors] = useState<
    EvidenceValidationErrors[]
  >([])

  if (!event) return null

  const save = () => {
    const nextEvidenceErrors = validateEvidenceLinks(evidences)
    const invalidParticipants =
      !Number.isInteger(participantCount) || participantCount < 0
    setParticipantError(
      invalidParticipants ? 'Ingresa una cantidad total válida.' : ''
    )
    setEvidenceErrors(nextEvidenceErrors)
    if (
      invalidParticipants ||
      nextEvidenceErrors.some((item) => Object.keys(item).length)
    ) {
      return
    }

    updateEvent(eventId, {
      status: 'completed',
      participantCount,
      results,
      evidences,
      closedAt: event.closedAt ?? new Date().toISOString(),
    })
    toast.success(event.closedAt ? 'Cierre actualizado.' : 'Evento finalizado.')
  }

  return (
    <Card>
      <CardHeader>
        <div className='flex items-start gap-3'>
          <CircleCheckBig className='mt-0.5 size-5 text-muted-foreground' />
          <div>
            <CardTitle>Cierre post-evento</CardTitle>
            <CardDescription>
              Registra los hechos de ejecución para finalizar el evento.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className='grid gap-5'>
        <div className='grid gap-4 sm:grid-cols-2'>
          <div className='grid gap-2'>
            <Label htmlFor='event-participants'>Participantes</Label>
            <Input
              id='event-participants'
              type='number'
              min={0}
              step={1}
              value={participantCount}
              onChange={(event) =>
                setParticipantCount(Number(event.target.value))
              }
            />
            {participantError && (
              <p className='text-sm text-destructive'>{participantError}</p>
            )}
          </div>
          <div className='grid gap-2'>
            <Label htmlFor='event-results'>Resultados u observaciones</Label>
            <Textarea
              id='event-results'
              value={results}
              onChange={(event) => setResults(event.target.value)}
            />
          </div>
        </div>
        <EvidenceFields
          value={evidences}
          onChange={setEvidences}
          errors={evidenceErrors}
        />
        <div className='flex justify-end'>
          <Button onClick={save}>
            <CircleCheckBig data-icon='inline-start' />
            {event.closedAt ? 'Actualizar cierre' : 'Finalizar evento'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
