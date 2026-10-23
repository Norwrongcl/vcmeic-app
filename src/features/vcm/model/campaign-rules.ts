import type { Campaign, Content, VcmData } from './types'

export const CHARTER_FIELDS = {
  problem: 'Problema u oportunidad',
  objective: 'Objetivo estratégico',
  audience: 'Audiencia',
  insight: 'Necesidad o insight respaldado (si existe evidencia)',
  valueProposition: 'Propuesta de valor',
  positioning: 'Posicionamiento',
  message: 'Mensaje central',
  cta: 'Llamado a la acción (CTA)',
  journey: 'Recorrido esperado del público',
  channels: 'Canales',
  kpi: 'KPI de campaña',
  kpiTarget: 'Meta del KPI',
  successCriteria: 'Criterios de éxito y aprobación',
  resources: 'Presupuesto y recursos previstos',
  schedule: 'Calendario macro',
  restrictions: 'Restricciones y riesgos',
} as const
export function campaignIssues(campaign: Campaign) {
  return Object.entries(CHARTER_FIELDS)
    .filter(
      ([id]) =>
        id !== 'insight' && !String(campaign[id as keyof Campaign] ?? '').trim()
    )
    .map(([, label]) => label)
}
export function campaignIsApproved(campaign: Campaign | undefined) {
  return (
    !!campaign &&
    campaign.approvedVersion === campaign.version &&
    !campaignIssues(campaign).length
  )
}
export function contentIsApproved(data: VcmData, content: Content) {
  const campaign = data.campaigns[content.caseId]
  return (
    content.status === 'approved' &&
    content.approvedVersion === content.version &&
    campaignIsApproved(campaign) &&
    content.approvedCampaignVersion === campaign.version
  )
}
