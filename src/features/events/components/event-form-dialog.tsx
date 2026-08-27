import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useEventsStore } from '../model/events-store'
import { type Event } from '../model/types'
import { EventForm } from './event-form'

export function EventFormDialog({
  open,
  onOpenChange,
  event,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  event?: Event
  onSaved?: (eventId: string) => void
}) {
  const addEvent = useEventsStore((state) => state.addEvent)
  const updateEvent = useEventsStore((state) => state.updateEvent)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[90svh] overflow-y-auto sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle>{event ? 'Editar evento' : 'Nuevo evento'}</DialogTitle>
          <DialogDescription>
            Define los datos generales. Luego podrás agregar tareas y finanzas.
          </DialogDescription>
        </DialogHeader>
        <EventForm
          event={event}
          onCancel={() => onOpenChange(false)}
          submitLabel={event ? 'Guardar cambios' : 'Crear evento'}
          onSubmit={(input) => {
            const eventId = event?.id ?? addEvent(input)
            if (event) updateEvent(event.id, input)
            toast.success(event ? 'Evento actualizado.' : 'Evento creado.')
            onOpenChange(false)
            onSaved?.(eventId)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}
