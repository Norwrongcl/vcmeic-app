import { z } from 'zod'
import type { CommandRegistry } from './registry.ts'
import { id, reason } from '../contracts/common.ts'
import { ApiError } from '../http/errors.ts'
import { protectedTarget } from '../operations/helpers.ts'
import { resources } from '../operations/resources.ts'
import { communicationResources } from '../communications/communications.controller.ts'
const definitions = [
  { name: 'Case', table: 'cases', kind: 'case', key: 'caseId' },
  { name: 'Project', table: 'projects', kind: 'project', key: 'projectId' },
  { name: 'Campaign', table: 'campaigns', kind: 'campaign', key: 'id' },
  { name: 'Content', table: 'contents', kind: 'content', key: 'id' },
  { name: 'Package', table: 'editorial_packages', kind: 'package', key: 'id' },
  { name: 'Plan', table: 'annual_plans', kind: 'annual_plan', key: 'id' },
  { name: 'Decision', table: 'decisions', kind: 'decision', key: 'id' },
]
export function registerArchives(registry: CommandRegistry) {
  for (const d of definitions) {
    const type = 'archive' + d.name
    registry.register({
      type,
      action: 'archiveDraft',
      schema: z.strictObject({ type: z.literal(type), [d.key]: id, reason }),
      async target(tx, cmd) {
        return protectedTarget(tx, d.table, d.kind, cmd[d.key])
      },
      async run(tx, cmd, target) {
        const objectId = String(cmd[d.key])
        const row = (
          await tx.client.query(`SELECT * FROM vcm.${d.table} WHERE id=$1`, [
            objectId,
          ])
        ).rows[0]
        if (
          (
            await tx.client.query(
              'SELECT 1 FROM vcm.approval_records WHERE object_id=$1',
              [target!.objectId],
            )
          ).rowCount
        )
          throw new ApiError(
            422,
            'FORMAL_OBJECT',
            'Un objeto con aprobación formal no se archiva como borrador.',
          )
        const dependants: Record<string, string> = {
          Case: `SELECT 1 FROM vcm.case_snapshots WHERE case_id=$1 UNION ALL SELECT 1 FROM vcm.indicator_contributions WHERE case_id=$1 UNION ALL SELECT 1 FROM vcm.project_cases pc JOIN vcm.projects p ON p.id=pc.project_id WHERE pc.case_id=$1 AND p.execution_state<>'draft' UNION ALL SELECT 1 FROM vcm.decisions WHERE case_id=$1 UNION ALL SELECT 1 FROM vcm.campaigns WHERE case_id=$1`,
          Project: `SELECT 1 FROM vcm.project_cases pc JOIN vcm.cases c ON c.id=pc.case_id JOIN vcm.protected_objects o ON o.id=c.protected_object_id WHERE pc.project_id=$1 AND o.archived_at IS NULL UNION ALL SELECT 1 FROM vcm.expenses WHERE project_id=$1 UNION ALL SELECT 1 FROM vcm.commitments WHERE project_id=$1 UNION ALL SELECT 1 FROM vcm.operation_mandates WHERE project_id=$1`,
          Campaign: `SELECT 1 FROM vcm.contents c JOIN vcm.protected_objects o ON o.id=c.protected_object_id WHERE c.campaign_id=$1 AND o.archived_at IS NULL`,
          Content: `SELECT 1 FROM vcm.package_items i JOIN vcm.approval_records a ON a.revision_id=i.package_revision_id WHERE i.content_id=$1 UNION ALL SELECT 1 FROM vcm.publication_operations p JOIN vcm.content_revisions r ON r.id=p.content_revision_id WHERE r.content_id=$1`,
          Decision: `SELECT 1 FROM vcm.decision_outcomes o JOIN vcm.decision_revisions r ON r.id=o.decision_revision_id WHERE r.decision_id=$1`,
        }
        if (
          (d.name === 'Case' &&
            !['open', 'construction', 'waiting', 'returned'].includes(
              row.state,
            )) ||
          (d.name === 'Project' && row.execution_state !== 'draft') ||
          (d.name === 'Plan' && row.status !== 'draft') ||
          (d.name === 'Decision' &&
            !['pending', 'returned', 'postponed'].includes(row.status))
        )
          throw new ApiError(
            422,
            'NOT_A_DRAFT',
            'Solo se archivan borradores sin ejecución o validación formal.',
          )
        if (
          dependants[d.name] &&
          (await tx.client.query(dependants[d.name], [objectId])).rowCount
        )
          throw new ApiError(
            422,
            'HAS_DEPENDANTS',
            'Conserva el objeto: tiene relaciones o antecedentes formales.',
          )
        await tx.client.query(
          'UPDATE vcm.protected_objects SET archived_at=now() WHERE id=$1',
          [target!.objectId],
        )
        await tx.client.query(
          `UPDATE vcm.${d.table} SET version=version+1 WHERE id=$1`,
          [objectId],
        )
        return {
          objectId: target!.objectId,
          version: target!.version + 1,
          result: { id: objectId, archived: true },
          before: { archived: false },
          after: { archived: true },
        }
      },
    })
    const resource = [...resources, ...communicationResources].find(
      (r) => r.kind === d.kind,
    )
    if (resource && !resource.commands.includes(type))
      resource.commands.push(type)
  }
}
