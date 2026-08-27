const clpFormatter = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
})

const dateFormatter = new Intl.DateTimeFormat('es-CL', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

const dateTimeFormatter = new Intl.DateTimeFormat('es-CL', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

export function formatClp(value: number) {
  return clpFormatter.format(value)
}

export function formatEventDate(value: string) {
  return dateFormatter.format(new Date(`${value}T12:00:00`))
}

export function formatEventDateTime(value: string) {
  return dateTimeFormatter.format(new Date(value))
}
