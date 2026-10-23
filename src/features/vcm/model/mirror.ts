import { ACTIVITY_FIELDS } from './catalogs'
import type { Dossier } from './types'

const presenceColumns = [
  ['internalId', 'N°'],
  ['responsible', 'Nombre Completo'],
  ['taxId', 'RUT'],
  ['executingUnit', 'Entidad Académica'],
  ['presenceType', 'Qué desea registrar'],
  ['description', 'Descripción'],
  ['startsAt', 'Fecha Desde'],
  ['endsAt', 'Fecha Hasta'],
  ['reach', 'Alcance'],
  ['externalOrganization', 'Organización externa'],
  ['evidence', 'Evidencia'],
]
export function mirrorCsv(c: Dossier) {
  const fields =
    c.kind === 'presence'
      ? presenceColumns
      : ACTIVITY_FIELDS.map((f) => [f.id, f.label])
  const escape = (value: string) =>
    `"${value
      .replace(/^[=+@-]/, "'$&")
      .split('"')
      .join('""')}"`
  return (
    '\uFEFF' +
    [
      fields.map(([, label]) => label),
      fields.map(([id]) =>
        id === 'internalId' ? c.id : (c.fields[id]?.value ?? '')
      ),
    ]
      .map((row) => row.map(escape).join(','))
      .join('\n')
  )
}
export function downloadText(
  content: string,
  name: string,
  type = 'text/csv;charset=utf-8'
) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 100)
}
