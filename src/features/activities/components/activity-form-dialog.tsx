import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAppStore } from '@/features/core/model/app-store'
import { type Activity } from '@/features/core/model/types'
import { ActivityForm } from './activity-form'

export function ActivityFormDialog({
  open,
  onOpenChange,
  activity,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  activity?: Activity
  onCreated?: (id: string) => void
}) {
  const addActivity = useAppStore((state) => state.addActivity)
  const updateActivity = useAppStore((state) => state.updateActivity)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[92vh] overflow-y-auto sm:max-w-3xl'>
        <DialogHeader>
          <DialogTitle>
            {activity ? 'Editar actividad' : 'Registrar actividad'}
          </DialogTitle>
          <DialogDescription>
            Registra una ejecución puntual que ya ocurrió.
          </DialogDescription>
        </DialogHeader>
        <ActivityForm
          activity={activity}
          onCancel={() => onOpenChange(false)}
          onSubmit={(input) => {
            if (activity) {
              updateActivity(activity.id, input)
              toast.success('Actividad actualizada.')
            } else {
              const id = addActivity(input)
              onCreated?.(id)
              toast.success('Actividad registrada.')
            }
            onOpenChange(false)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}
