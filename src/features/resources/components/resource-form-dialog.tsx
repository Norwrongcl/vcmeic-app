import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAppStore } from '@/features/core/model/app-store'
import { type Resource } from '@/features/core/model/types'
import { ResourceForm } from './resource-form'

export function ResourceFormDialog({
  open,
  onOpenChange,
  resource,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  resource?: Resource
}) {
  const addResource = useAppStore((state) => state.addResource)
  const updateResource = useAppStore((state) => state.updateResource)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-xl'>
        <DialogHeader>
          <DialogTitle>
            {resource ? 'Editar recurso' : 'Nuevo recurso'}
          </DialogTitle>
          <DialogDescription>
            Agrega un elemento reutilizable para la organización de eventos.
          </DialogDescription>
        </DialogHeader>
        <ResourceForm
          resource={resource}
          onCancel={() => onOpenChange(false)}
          onSubmit={(input) => {
            if (resource) {
              updateResource(resource.id, input)
              toast.success('Recurso actualizado.')
            } else {
              addResource(input)
              toast.success('Recurso creado.')
            }
            onOpenChange(false)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}
