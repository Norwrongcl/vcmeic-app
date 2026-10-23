import type { Actor, VcmData } from './types'
import { canRead } from './workflow'

export { weeklyPackageSnapshot } from './package-review'

export function reportCases(data: VcmData, actor: Actor, period: string) {
  const visible = Object.values(data.cases).filter((c) => canRead(c, actor))
  const dated = /^\d{4}$/.test(period)
    ? visible.filter((c) => c.fields.startsAt?.value.startsWith(period))
    : []
  const undated = visible.filter((c) => !c.fields.startsAt?.value.trim())
  return {
    dated,
    undated,
    outside: visible.length - dated.length - undated.length,
  }
}
export { decisionOptions } from './decisions'
