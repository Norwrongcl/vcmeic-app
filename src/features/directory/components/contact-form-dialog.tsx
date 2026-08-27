import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAppStore } from '@/features/core/model/app-store'
import { type Contact } from '@/features/core/model/types'
import { ContactForm } from './contact-form'

export function ContactFormDialog({
  open,
  onOpenChange,
  contact,
  onCreated,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  contact?: Contact
  onCreated?: (id: string) => void
}) {
  const addContact = useAppStore((state) => state.addContact)
  const updateContact = useAppStore((state) => state.updateContact)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-xl'>
        <DialogHeader>
          <DialogTitle>
            {contact ? 'Editar contacto' : 'Nuevo contacto'}
          </DialogTitle>
          <DialogDescription>
            Un contacto puede existir sin tener acceso como usuario.
          </DialogDescription>
        </DialogHeader>
        <ContactForm
          contact={contact}
          onCancel={() => onOpenChange(false)}
          onSubmit={(input) => {
            if (contact) {
              updateContact(contact.id, input)
              toast.success('Contacto actualizado.')
            } else {
              const id = addContact(input)
              onCreated?.(id)
              toast.success('Contacto creado.')
            }
            onOpenChange(false)
          }}
        />
      </DialogContent>
    </Dialog>
  )
}
