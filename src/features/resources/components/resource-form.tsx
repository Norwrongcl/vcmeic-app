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
import { RESOURCE_CATEGORY_LABELS } from '@/features/core/model/catalogs'
import {
  type Resource,
  type ResourceCategory,
  type ResourceInput,
} from '@/features/core/model/types'
import { validateResource } from '@/features/core/model/validation'
import { FormControl } from '@/features/directory/components/form-control'

const emptyResource: ResourceInput = {
  name: '',
  category: 'equipment',
  description: '',
  quantity: 0,
  notes: '',
}
function inputFromResource(resource?: Resource): ResourceInput {
  if (!resource) return emptyResource
  const {
    id: _id,
    createdAt: _createdAt,
    updatedAt: _updatedAt,
    ...input
  } = resource
  return input
}

export function ResourceForm({
  resource,
  onSubmit,
  onCancel,
}: {
  resource?: Resource
  onSubmit: (input: ResourceInput) => void
  onCancel: () => void
}) {
  const baseId = useId()
  const [input, setInput] = useState<ResourceInput>(() =>
    inputFromResource(resource)
  )
  const [errors, setErrors] = useState<
    Partial<Record<keyof ResourceInput, string>>
  >({})
  const setField = <K extends keyof ResourceInput>(
    key: K,
    value: ResourceInput[K]
  ) => setInput((current) => ({ ...current, [key]: value }))
  return (
    <form
      className='grid gap-6'
      onSubmit={(event) => {
        event.preventDefault()
        const next = validateResource(input)
        setErrors(next)
        if (!Object.keys(next).length) onSubmit(input)
      }}
    >
      <div className='grid gap-4 sm:grid-cols-2'>
        <FormControl id={`${baseId}-name`} label='Nombre' error={errors.name}>
          <Input
            id={`${baseId}-name`}
            value={input.name}
            onChange={(event) => setField('name', event.target.value)}
          />
        </FormControl>
        <FormControl id={`${baseId}-category`} label='Categoría'>
          <Select
            value={input.category}
            onValueChange={(value) =>
              setField('category', value as ResourceCategory)
            }
          >
            <SelectTrigger id={`${baseId}-category`} className='w-full'>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(RESOURCE_CATEGORY_LABELS).map(
                ([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>
        </FormControl>
        <FormControl
          id={`${baseId}-quantity`}
          label='Cantidad disponible'
          error={errors.quantity}
        >
          <Input
            id={`${baseId}-quantity`}
            type='number'
            min={0}
            step={1}
            value={input.quantity}
            onChange={(event) =>
              setField('quantity', Number(event.target.value))
            }
          />
        </FormControl>
        <div className='sm:col-span-2'>
          <FormControl id={`${baseId}-description`} label='Descripción'>
            <Textarea
              id={`${baseId}-description`}
              value={input.description}
              onChange={(event) => setField('description', event.target.value)}
            />
          </FormControl>
        </div>
        <div className='sm:col-span-2'>
          <FormControl id={`${baseId}-notes`} label='Notas'>
            <Textarea
              id={`${baseId}-notes`}
              value={input.notes}
              onChange={(event) => setField('notes', event.target.value)}
            />
          </FormControl>
        </div>
      </div>
      <div className='flex flex-col-reverse gap-2 sm:flex-row sm:justify-end'>
        <Button type='button' variant='outline' onClick={onCancel}>
          Cancelar
        </Button>
        <Button type='submit'>Guardar recurso</Button>
      </div>
    </form>
  )
}
