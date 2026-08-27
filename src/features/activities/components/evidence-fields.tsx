import { Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { type EvidenceLink } from '@/features/core/model/types'
import { type EvidenceValidationErrors } from '@/features/core/model/validation'

export function EvidenceFields({
  value,
  onChange,
  errors = [],
}: {
  value: EvidenceLink[]
  onChange: (value: EvidenceLink[]) => void
  errors?: EvidenceValidationErrors[]
}) {
  const update = (index: number, field: keyof EvidenceLink, next: string) => {
    onChange(
      value.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: next } : item
      )
    )
  }

  return (
    <div className='grid gap-3'>
      <div className='flex items-center justify-between gap-3'>
        <div>
          <Label>Evidencias</Label>
          <p className='text-xs text-muted-foreground'>
            Agrega enlaces; los archivos se incorporarán cuando exista S3.
          </p>
        </div>
        <Button
          type='button'
          variant='outline'
          size='sm'
          onClick={() => onChange([...value, { name: '', url: '' }])}
        >
          <Plus data-icon='inline-start' /> Agregar evidencia
        </Button>
      </div>
      {value.map((evidence, index) => (
        <div
          key={index}
          className='grid gap-3 rounded-md border p-3 sm:grid-cols-[1fr_1.4fr_auto]'
        >
          <div className='grid gap-2'>
            <Label htmlFor={`evidence-name-${index}`}>
              Nombre de la evidencia
            </Label>
            <Input
              id={`evidence-name-${index}`}
              value={evidence.name}
              onChange={(event) => update(index, 'name', event.target.value)}
            />
            {errors[index]?.name && (
              <p className='text-sm text-destructive'>{errors[index].name}</p>
            )}
          </div>
          <div className='grid gap-2'>
            <Label htmlFor={`evidence-url-${index}`}>
              Enlace de la evidencia
            </Label>
            <Input
              id={`evidence-url-${index}`}
              type='url'
              value={evidence.url}
              onChange={(event) => update(index, 'url', event.target.value)}
              placeholder='https://'
            />
            {errors[index]?.url && (
              <p className='text-sm text-destructive'>{errors[index].url}</p>
            )}
          </div>
          <Button
            type='button'
            variant='ghost'
            size='icon'
            className='self-end'
            onClick={() =>
              onChange(value.filter((_, itemIndex) => itemIndex !== index))
            }
          >
            <Trash2 />
            <span className='sr-only'>Eliminar evidencia {index + 1}</span>
          </Button>
        </div>
      ))}
    </div>
  )
}
