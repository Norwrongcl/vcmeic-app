export const charterFields = [
  'problem',
  'objective',
  'audience',
  'insight',
  'valueProposition',
  'positioning',
  'message',
  'cta',
  'journey',
  'channels',
  'kpi',
  'kpiTarget',
  'successCriteria',
  'resources',
  'schedule',
  'restrictions',
] as const
export function charterIssues(charter: Record<string, string>) {
  return charterFields.filter(
    (key) => key !== 'insight' && !charter[key]?.trim(),
  )
}
export function withinEditorialWeek(startsOn: string, scheduledAt: string) {
  const local = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(scheduledAt))
  const difference =
    (Date.parse(local + 'T00:00:00Z') - Date.parse(startsOn + 'T00:00:00Z')) /
    86400000
  return Number.isFinite(difference) && difference >= 0 && difference < 7
}
