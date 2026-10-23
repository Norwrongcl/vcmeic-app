import { z } from 'zod'
import {
  appDataSchema,
  appSnapshotSchema,
  appSnapshotV1Schema,
  appSnapshotV2Schema,
  appSnapshotV3Schema,
} from '../../../packages/domain/src/legacy-core-schema.ts'
import { migrateVcmData } from '../../../packages/domain/src/legacy-migration.ts'
import { ApiError } from '../http/errors.ts'
export function redactSecrets(value: unknown, depth = 0): unknown {
  if (depth > 50)
    throw new ApiError(
      422,
      'SNAPSHOT_TOO_DEEP',
      'El archivo tiene una profundidad no admitida.',
    )
  if (Array.isArray(value)) return value.map((v) => redactSecrets(v, depth + 1))
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .filter(
          ([key]) =>
            !/^(password(?:_hash)?|accessToken|refreshToken|api[_-]?key|token(?:_hash)?|authorization|cookie|cookies|sessions?|sessionId|credentials?|\.env)$/i.test(
              key,
            ),
        )
        .map(([key, v]) => [key, redactSecrets(v, depth + 1)]),
    )
  return value
}
export function normalizeSnapshot(raw: unknown) {
  const safe = redactSecrets(raw)
  const result = z
    .union([
      appSnapshotSchema,
      appSnapshotV3Schema,
      appSnapshotV2Schema,
      appSnapshotV1Schema,
    ])
    .safeParse(safe)
  if (!result.success)
    throw new ApiError(
      422,
      'INVALID_SNAPSHOT',
      'El archivo no tiene un snapshot válido versión 1–4.',
    )
  const original = result.data,
    data = {
      ...original.data,
      activities: Object.fromEntries(
        Object.entries(original.data.activities).map(([key, a]) => [
          key,
          {
            ...a,
            source: 'source' in a ? a.source : 'web',
            approvalStatus:
              'approvalStatus' in a ? a.approvalStatus : 'pending',
            rejectionReason: 'rejectionReason' in a ? a.rejectionReason : null,
          },
        ]),
      ),
    }
  const normalized = { ...data, vcm: migrateVcmData(appDataSchema.parse(data)) }
  const demoUnknownIds =
    !('vcm' in original.data) || !original.data.vcm
      ? Object.keys(normalized.vcm.cases)
      : []
  for (const id of demoUnknownIds) normalized.vcm.cases[id].demo = false
  return {
    sourceVersion: original.version,
    data: normalized,
    raw: safe,
    demoUnknownIds,
  }
}
export type Normalized = ReturnType<typeof normalizeSnapshot>['data']
