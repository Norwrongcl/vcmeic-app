import { cn } from '@/lib/utils'
import { Label } from '@/components/ui/label'

type FormFieldProps = {
  id: string
  label: string
  error?: string
  children: React.ReactNode
  className?: string
}

export function FormField({
  id,
  label,
  error,
  children,
  className,
}: FormFieldProps) {
  return (
    <div
      className={cn('flex flex-col gap-2', className)}
      data-invalid={!!error}
    >
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error ? (
        <p className='text-sm text-destructive' role='alert'>
          {error}
        </p>
      ) : null}
    </div>
  )
}
