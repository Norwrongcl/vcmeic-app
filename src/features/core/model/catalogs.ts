import { type ResourceCategory, type VcmLineId } from './types'

export const VCM_LINES: ReadonlyArray<{ id: VcmLineId; label: string }> = [
  { id: 'linked-teaching', label: 'Docencia vinculada' },
  { id: 'professional-development', label: 'Desarrollo profesional' },
  { id: 'community-services', label: 'Servicios comunitarios' },
  { id: 'applied-research', label: 'Investigación aplicada' },
  {
    id: 'innovation-transfer-entrepreneurship',
    label: 'Innovación, Transferencia Tecnológica y Emprendimiento',
  },
  { id: 'technical-assistance', label: 'Asistencia técnica' },
  { id: 'arts-cultural-extension', label: 'Extensión artístico-cultural' },
  { id: 'knowledge-dissemination', label: 'Divulgación de conocimiento' },
  {
    id: 'public-policy-development',
    label: 'Desarrollo de Políticas públicas',
  },
]

export const VCM_LINE_LABELS = Object.fromEntries(
  VCM_LINES.map((line) => [line.id, line.label])
) as Record<VcmLineId, string>

export const RESOURCE_CATEGORY_LABELS: Record<ResourceCategory, string> = {
  space: 'Espacio',
  equipment: 'Equipamiento',
  material: 'Material',
  service: 'Servicio',
}
