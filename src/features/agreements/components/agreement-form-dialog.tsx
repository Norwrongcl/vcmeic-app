import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAppStore } from '@/features/core/model/app-store'
import { type Agreement } from '@/features/core/model/types'
import { AgreementForm } from './agreement-form'

export function AgreementFormDialog({
  open,
  onOpenChange,
  agreement,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  agreement?: Agreement
}) {
  const addAgreement = useAppStore((state) => state.addAgreement)
  const updateAgreement = useAppStore((state) => state.updateAgreement)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-h-[92vh] overflow-y-auto sm:max-w-3xl'>
        <DialogHeader>
          <DialogTitle>
            {agreement ? 'Editar convenio' : 'Nuevo convenio'}
          </DialogTitle>
          <DialogDescription>
            Relaciona el acuerdo con una organización del catálogo de Socios.
          </DialogDescription>
        </DialogHeader>
        <AgreementForm
          agreement={agreement}
          onCancel={() => onOpenChange(false)}
          onSubmit={(input) => {
            if (agreement) {
              updateAgreement(agreement.id, input)
              toast.success('Convenio actualizado.')
            } else {
              addAgreement(input)
              toast.success('Convenio creado.')
            }
            onOpenChange(false)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}
