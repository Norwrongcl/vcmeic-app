import type { VcmData } from './types'

export function weeklyPackageSnapshot(data: VcmData, packageId: string) {
  return JSON.stringify(
    Object.values(data.contents)
      .filter((p) => p.mode === 'weekly' && p.packageId === packageId)
      .sort((a, b) => a.id.localeCompare(b.id))
      .map((p) => [
        p.id,
        p.version,
        data.campaigns[p.caseId]?.version,
        data.campaigns[p.caseId]?.approvedVersion,
      ])
  )
}
