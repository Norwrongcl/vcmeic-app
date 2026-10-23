import type { CaseKind, CaseState, FieldDefinition, Role } from './types'

export const RULE_VERSION = 'PO-2026.09-v1'
export const PORTFOLIOS = [
  'Internacionalización',
  'Alumni',
  'Formación Continua',
  'Asistencia Técnica',
  'Investigación Aplicada',
  'Innovación/Transferencia',
  'Difusión/Posicionamiento',
]
export const PRESENCE_TYPES = [
  'Reconocimiento',
  'Cargo de relevancia pública o privada',
  'Liderazgo en grupo disciplinar',
  'Participación como expositor/a',
  'Participación como evaluador/a',
  'Participación en una mesa/comisión técnica o asesora',
  'Presencia en medios de comunicación masivos o especializados',
]
export const KIND_LABELS: Record<CaseKind, string> = {
  initiative: 'Iniciativa',
  event: 'Evento',
  activity: 'Actividad e iniciativa',
  presence: 'Presencia en la sociedad',
  campaign: 'Campaña',
}
export const STATE_LABELS: Record<CaseState, string> = {
  open: 'Abierto',
  construction: 'En construcción',
  waiting: 'Esperando información',
  review: 'En validación operativa',
  escalated: 'Requiere decisión de Jefatura',
  validated: 'Validado VcM EIC',
  closing: 'En cierre',
  qa: 'Control de calidad completo',
  rendered: 'Rendido EIC',
  closed: 'Cerrado internamente',
  returned: 'Devuelto para corrección',
}
export const ROLE_LABELS: Record<Role, string> = {
  coordination: 'Coordinación',
  leadership: 'Jefatura',
  direction: 'Dirección',
  responsible: 'Responsable',
  designer: 'Diseño/audiovisual',
  technician: 'Técnico',
  viewer: 'Consulta',
}
export const FIELD_STATUS_LABELS = {
  confirmed: 'Confirmado/sustentado',
  partial: 'Parcial',
  pending: 'Pendiente',
  conflict: 'En conflicto',
}
const f = (
  id: string,
  label: string,
  group: string,
  extra: Partial<FieldDefinition> = {}
): FieldDefinition => ({ id, label, group, ...extra })
export const ACTIVITY_FIELDS: FieldDefinition[] = [
  f('internalId', 'ID interno', 'Control'),
  f('registrar', 'Registrador', 'Control'),
  f('name', 'Nombre de la iniciativa', 'Información general'),
  f('format', 'Formato de la actividad', 'Información general'),
  f('startsAt', 'Fecha inicio', 'Información general'),
  f('endsAt', 'Fecha cierre', 'Información general'),
  f('responsible', 'Responsable de la actividad', 'Información general'),
  f('description', 'Descripción de la actividad', 'Información general'),
  f('objective', 'Objetivo', 'Información general'),
  f('sdg', 'ODS', 'Clasificación institucional', { classification: true }),
  f(
    'educationPact',
    'Compromiso(s) del Pacto Educativo Global',
    'Clasificación institucional',
    { classification: true }
  ),
  f('executingUnit', 'Unidad Ejecutora', 'Clasificación institucional', {
    classification: true,
  }),
  f(
    'participatingUnits',
    'Unidades / Carreras Participantes',
    'Clasificación institucional',
    { classification: true }
  ),
  f('scopeOfAction', 'Ámbito de acción', 'Clasificación institucional', {
    classification: true,
  }),
  f('program', 'Programa', 'Clasificación institucional', {
    classification: true,
  }),
  f('challenges', 'Desafíos', 'Clasificación institucional', {
    classification: true,
  }),
  f('actionLine', 'Línea de acción', 'Clasificación institucional', {
    classification: true,
  }),
  f('activityType', 'Tipo de actividad', 'Clasificación institucional', {
    classification: true,
  }),
  f('course', 'Asignatura', 'Clasificación institucional', {
    classification: true,
  }),
  f('agreement', 'Convenio', 'Clasificación institucional', {
    classification: true,
  }),
  f('internalImpact', 'Impacto hacia la PUCV', 'Clasificación institucional', {
    classification: true,
  }),
  f('externalImpact', 'Impacto hacia el medio', 'Clasificación institucional', {
    classification: true,
  }),
  f('reach', 'Alcance', 'Clasificación institucional', {
    classification: true,
  }),
  f('reachDetail', 'Detalle Alcance', 'Clasificación institucional', {
    classification: true,
  }),
  f(
    'partnerPlanned',
    'Organización socia — planificación',
    'Participantes externos planificados'
  ),
  f(
    'organizationPlanned',
    'Organización participante — planificación',
    'Participantes externos planificados'
  ),
  f(
    'publicPlanned',
    'Público General — planificación',
    'Participantes externos planificados',
    { numeric: true }
  ),
  f('relevantGroup', 'Grupo relevante', 'Participantes externos planificados'),
  f('topic', 'Temática', 'Información general'),
  f('fund2026', 'Fondo Concursable VcM 2026', 'Recursos'),
  f(
    'teachersPlanned',
    'Participación de Docentes PUCV — planificación',
    'Participantes internos planificados',
    { numeric: true }
  ),
  f(
    'studentsPlanned',
    'Participación de Estudiantes PUCV — planificación',
    'Participantes internos planificados',
    { numeric: true }
  ),
  f(
    'staffPlanned',
    'Participación de Funcionarios PUCV — planificación',
    'Participantes internos planificados',
    { numeric: true }
  ),
  f(
    'internalPlanned',
    'Participación Interna PUCV — planificación',
    'Participantes internos planificados',
    { numeric: true }
  ),
  f('products', 'Productos', 'Productos y resultados'),
  f('institutionMoney', 'Dinero aportado por la Institución', 'Recursos', {
    numeric: true,
  }),
  f('externalMoney', 'Dinero externo', 'Recursos', { numeric: true }),
  f(
    'institutionInfrastructure',
    'Infraestructura aportada por la Institución',
    'Recursos'
  ),
  f('externalInfrastructure', 'Infraestructura externa', 'Recursos'),
  f(
    'institutionPeople',
    'Recursos humanos aportados por la Institución',
    'Recursos'
  ),
  f('externalPeople', 'Recursos humanos externos', 'Recursos'),
  f(
    'teachersActual',
    'Participación de Docentes PUCV — dato real',
    'Cobertura real',
    { numeric: true }
  ),
  f(
    'studentsActual',
    'Participación de Estudiantes PUCV — dato real',
    'Cobertura real',
    { numeric: true }
  ),
  f(
    'staffActual',
    'Participación de Funcionarios PUCV — dato real',
    'Cobertura real',
    { numeric: true }
  ),
  f(
    'internalActual',
    'Participación Interna PUCV — dato real',
    'Cobertura real',
    { numeric: true }
  ),
  f(
    'partnerActual',
    'Organización socia — participantes externos reales',
    'Cobertura real'
  ),
  f(
    'organizationActual',
    'Organización participante — participantes externos reales',
    'Cobertura real'
  ),
  f(
    'externalPublicActual',
    'Público General — participantes externos reales',
    'Cobertura real',
    { numeric: true }
  ),
  f('evidence', 'Evidencia', 'Evidencia'),
]
export const PRESENCE_FIELDS: FieldDefinition[] = [
  f('name', 'Nombre del caso', 'Información general'),
  f('responsible', 'Nombre Completo', 'Información general'),
  f(
    'taxId',
    'RUT (solo si lo exige el registro institucional)',
    'Información general'
  ),
  f('executingUnit', 'Entidad Académica', 'Clasificación institucional', {
    classification: true,
  }),
  f('presenceType', 'Qué desea registrar', 'Clasificación institucional', {
    classification: true,
  }),
  f('description', 'Descripción', 'Información general'),
  f('startsAt', 'Fecha Desde', 'Información general'),
  f('endsAt', 'Fecha Hasta', 'Información general'),
  f('reach', 'Alcance', 'Clasificación institucional', {
    classification: true,
  }),
  f('externalOrganization', 'Organización externa', 'Información general'),
  f('evidence', 'Evidencia', 'Evidencia'),
]
export const EXTRA_FIELDS = [
  f('scopeIncluded', 'Alcance incluido', 'Plan de trabajo'),
  f('scopeExcluded', 'Alcance excluido', 'Plan de trabajo'),
  f('closingCriteria', 'Criterios de cierre operativo', 'Plan de trabajo'),
  f('expectedEvidence', 'Evidencias esperadas', 'Plan de trabajo'),
  f('risks', 'Riesgos y restricciones', 'Plan de trabajo'),
  f('resultsPlanned', 'Resultados previstos', 'Productos y resultados'),
  f('resultsActual', 'Resultados observados', 'Productos y resultados'),
  f('location', 'Ubicación', 'Información general'),
]
export function fieldsFor(kind: CaseKind) {
  return kind === 'presence'
    ? [
        ...PRESENCE_FIELDS,
        f('objective', 'Propósito del proyecto', 'Plan de trabajo'),
        f(
          'resultsPlanned',
          'Resultado y entregables esperados',
          'Plan de trabajo'
        ),
        ...EXTRA_FIELDS.filter((f) => f.group === 'Plan de trabajo'),
      ]
    : [...ACTIVITY_FIELDS, ...EXTRA_FIELDS]
}
export const TRANSITIONS: Record<CaseState, CaseState[]> = {
  open: ['construction', 'waiting'],
  construction: ['waiting', 'review'],
  waiting: ['construction', 'review'],
  review: ['validated', 'returned', 'escalated'],
  escalated: ['review', 'returned'],
  validated: ['closing', 'returned'],
  closing: ['qa', 'returned'],
  qa: ['rendered', 'returned'],
  rendered: ['closed', 'returned'],
  closed: ['returned'],
  returned: ['construction', 'review'],
}
