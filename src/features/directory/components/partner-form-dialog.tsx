import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAppStore } from '@/features/core/model/app-store'
import { type Partner } from '@/features/core/model/types'
import { PartnerForm } from './partner-form'

export function PartnerFormDialog({
  open,
  onOpenChange,
  partner,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  partner?: Partner
  onCreated?: (id: string) => void
}) {
  const addPartner = useAppStore((state) => state.addPartner)
  const updatePartner = useAppStore((state) => state.updatePartner)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[90vh] overflow-y-auto sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle>{partner ? 'Editar socio' : 'Nuevo socio'}</DialogTitle>
          <DialogDescription>
            Registra una organización para relacionarla con iniciativas y
            contactos.
          </DialogDescription>
        </DialogHeader>
        <PartnerForm
          partner={partner}
          onCancel={() => onOpenChange(false)}
          onSubmit={(input) => {
            if (partner) {
              updatePartner(partner.id, input)
              toast.success('Socio actualizado.')
            } else {
              const id = addPartner(input)
              onCreated?.(id)
              toast.success('Socio creado.')
            }
            onOpenChange(false)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}
