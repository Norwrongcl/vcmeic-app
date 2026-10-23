import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import type { CommandRegistry } from '../commands/registry.ts'
import { id, reason, civilDate } from '../contracts/common.ts'
import { ApiError } from '../http/errors.ts'
import { assertAction } from '../access/policy.ts'
import { ownObject, projectTarget, bumpProject } from './helpers.ts'
import { caseTarget, bumpCase } from '../cases/cases.service.ts'
import { hasDependencyCycle } from '../../../packages/domain/src/planning.ts'
import { requireMandate } from './mandates.ts'
const projectFields = {
  name: z.string().trim().min(1).max(500),
  kind: z.enum(['initiative', 'event']).default('initiative'),
  startsOn: civilDate.nullable().optional(),
  endsOn: civilDate.nullable().optional(),
  location: z.string().max(4000).nullable().optional(),
}
export function registerProjects(registry: CommandRegistry) {
  registry.register({
    type: 'createProject',
    action: 'editOperationalDraft',
    schema: z.strictObject({
      type: z.literal('createProject'),
      ...projectFields,
    }),
    async target() {
      return undefined
    },
    async run(tx, cmd) {
      const projectId = randomUUID()
      await tx.client.query(
        'INSERT INTO vcm.projects(id,name,kind,starts_on,ends_on,location) VALUES($1,$2,$3,$4,$5,$6)',
        [
          projectId,
          cmd.name,
          cmd.kind,
          cmd.startsOn ?? null,
          cmd.endsOn ?? null,
          cmd.location ?? null,
        ],
      )
      await ownObject(tx, 'project', projectId)
      return {
        objectId: 'project:' + projectId,
        version: 1,
        result: { id: projectId },
        after: { name: cmd.name },
      }
    },
  })
  registry.register({
    type: 'updateProject',
    action: 'editOperationalDraft',
    schema: z.strictObject({
      type: z.literal('updateProject'),
      projectId: id,
      ...projectFields,
      reason,
    }),
    target: projectTarget,
    async run(tx, cmd) {
      await tx.client.query(
        'UPDATE vcm.projects SET name=$1,kind=$2,starts_on=$3,ends_on=$4,location=$5 WHERE id=$6',
        [
          cmd.name,
          cmd.kind,
          cmd.startsOn ?? null,
          cmd.endsOn ?? null,
          cmd.location ?? null,
          cmd.projectId,
        ],
      )
      await tx.client.query(
        'UPDATE vcm.operation_mandates SET revoked_at=now() WHERE project_id=$1 AND revoked_at IS NULL',
        [cmd.projectId],
      )
      return {
        objectId: 'project:' + cmd.projectId,
        version: await bumpProject(tx, cmd.projectId),
        result: { id: cmd.projectId },
        after: { name: cmd.name, mandate: 'invalidated' },
      }
    },
  })
  registry.register({
    type: 'linkCase',
    action: 'editOperationalDraft',
    schema: z.strictObject({
      type: z.literal('linkCase'),
      projectId: id,
      caseId: id,
      reason,
    }),
    target: projectTarget,
    async run(tx, cmd) {
      await assertAction(tx, 'editOperationalDraft', 'case:' + cmd.caseId)
      await tx.client.query(
        'INSERT INTO vcm.project_cases(project_id,case_id) VALUES($1,$2) ON CONFLICT DO NOTHING',
        [cmd.projectId, cmd.caseId],
      )
      return {
        objectId: 'project:' + cmd.projectId,
        version: await bumpProject(tx, cmd.projectId),
        result: { caseId: cmd.caseId },
        after: { caseId: cmd.caseId },
      }
    },
  })
  registry.register({
    type: 'attachProject',
    action: 'editOperationalDraft',
    schema: z.strictObject({
      type: z.literal('attachProject'),
      caseId: id,
      projectId: id.optional(),
      reason,
    }),
    target: caseTarget,
    async run(tx, cmd) {
      let pid = cmd.projectId
      if (pid) await assertAction(tx, 'editOperationalDraft', 'project:' + pid)
      else {
        pid = randomUUID()
        const c = (
          await tx.client.query('SELECT name,kind FROM vcm.cases WHERE id=$1', [
            cmd.caseId,
          ])
        ).rows[0]
        await tx.client.query(
          'INSERT INTO vcm.projects(id,name,kind) VALUES($1,$2,$3)',
          [pid, c.name, c.kind === 'event' ? 'event' : 'initiative'],
        )
        await ownObject(tx, 'project', pid)
      }
      await tx.client.query(
        'INSERT INTO vcm.project_cases(project_id,case_id) VALUES($1,$2) ON CONFLICT DO NOTHING',
        [pid, cmd.caseId],
      )
      return {
        objectId: 'case:' + cmd.caseId,
        version: await bumpCase(tx, cmd.caseId),
        result: { projectId: pid },
        after: { projectId: pid },
      }
    },
  })
  registry.register({
    type: 'setExecutionState',
    action: 'executeMandate',
    schema: z.strictObject({
      type: z.literal('setExecutionState'),
      projectId: id,
      state: z.enum([
        'draft',
        'planned',
        'in_progress',
        'completed',
        'cancelled',
      ]),
      reason,
    }),
    target: projectTarget,
    async run(tx, cmd) {
      const current = (
        await tx.client.query(
          'SELECT execution_state FROM vcm.projects WHERE id=$1',
          [cmd.projectId],
        )
      ).rows[0].execution_state
      const edges: Record<string, string[]> = {
        draft: ['planned', 'cancelled'],
        planned: ['draft', 'in_progress', 'cancelled'],
        in_progress: ['completed', 'cancelled'],
        completed: [],
        cancelled: ['draft'],
      }
      if (!edges[current].includes(cmd.state))
        throw new ApiError(
          422,
          'INVALID_TRANSITION',
          'Estado de ejecución no permitido.',
        )
      if (['in_progress', 'completed'].includes(cmd.state))
        await requireMandate(tx, cmd.projectId, 'execution.change')
      if (
        cmd.state === 'completed' &&
        (
          await tx.client.query(
            "SELECT 1 FROM vcm.tasks WHERE project_id=$1 AND status NOT IN('done','cancelled')",
            [cmd.projectId],
          )
        ).rowCount
      )
        throw new ApiError(
          422,
          'OPEN_TASKS',
          'Completa o cancela las tareas antes de finalizar.',
        )
      await tx.client.query(
        'UPDATE vcm.projects SET execution_state=$1 WHERE id=$2',
        [cmd.state, cmd.projectId],
      )
      return {
        objectId: 'project:' + cmd.projectId,
        version: await bumpProject(tx, cmd.projectId),
        result: { state: cmd.state },
        before: { state: current },
        after: { state: cmd.state },
      }
    },
  })
  registry.register({
    type: 'saveTask',
    action: 'editOperationalDraft',
    schema: z.strictObject({
      type: z.literal('saveTask'),
      projectId: id,
      id: id.optional(),
      title: z.string().trim().min(1).max(500),
      status: z.enum(['todo', 'in_progress', 'review', 'done', 'cancelled']),
      kind: z.enum(['task', 'milestone']).default('task'),
      description: z.string().max(20000).default(''),
      dependencies: z.array(id).max(100).default([]),
      assigneeIds: z.array(id).max(100).default([]),
      dueOn: civilDate.nullable().optional(),
      priority: z.enum(['low', 'medium', 'high']).default('medium'),
      blocked: z.boolean().default(false),
      reason,
    }),
    target: projectTarget,
    async run(tx, cmd) {
      if (['in_progress', 'review', 'done'].includes(cmd.status))
        await requireMandate(tx, cmd.projectId, 'task.update')
      const taskId = cmd.id ?? randomUUID(),
        existing = await tx.client.query(
          'SELECT project_id FROM vcm.tasks WHERE id=$1',
          [taskId],
        )
      if (
        cmd.id &&
        (!existing.rowCount || existing.rows[0].project_id !== cmd.projectId)
      )
        throw new ApiError(
          422,
          'TASK_PROJECT_MISMATCH',
          'Tarea de otro proyecto o inexistente.',
        )
      if (cmd.dependencies.includes(taskId))
        throw new ApiError(
          422,
          'DEPENDENCY_CYCLE',
          'Una tarea no puede depender de sí misma.',
        )
      for (const dep of cmd.dependencies)
        if (
          !(
            await tx.client.query(
              'SELECT 1 FROM vcm.tasks WHERE id=$1 AND project_id=$2',
              [dep, cmd.projectId],
            )
          ).rowCount
        )
          throw new ApiError(
            422,
            'TASK_PROJECT_MISMATCH',
            'Dependencia de otro proyecto o inexistente.',
          )
      const tasks = (
        await tx.client.query('SELECT id FROM vcm.tasks WHERE project_id=$1', [
          cmd.projectId,
        ])
      ).rows
      const edges = (
        await tx.client.query(
          'SELECT task_id,depends_on_id FROM vcm.task_dependencies WHERE project_id=$1 AND active',
          [cmd.projectId],
        )
      ).rows
      if (
        hasDependencyCycle([
          ...tasks
            .filter((t) => t.id !== taskId)
            .map((t) => ({
              id: t.id,
              dependencies: edges
                .filter((e) => e.task_id === t.id)
                .map((e) => e.depends_on_id),
            })),
          { id: taskId, dependencies: cmd.dependencies },
        ])
      )
        throw new ApiError(
          422,
          'DEPENDENCY_CYCLE',
          'Las dependencias forman un ciclo.',
        )
      for (const aid of cmd.assigneeIds)
        await assertAction(tx, 'query', 'contact:' + aid)
      if (cmd.id)
        await tx.client.query(
          'UPDATE vcm.tasks SET title=$1,status=$2,kind=$3,description=$4,due_on=$5,priority=$6,blocked=$7,version=version+1 WHERE id=$8',
          [
            cmd.title,
            cmd.status,
            cmd.kind,
            cmd.description,
            cmd.dueOn ?? null,
            cmd.priority,
            cmd.blocked,
            taskId,
          ],
        )
      else
        await tx.client.query(
          'INSERT INTO vcm.tasks(id,project_id,title,status,kind,description,due_on,priority,blocked) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)',
          [
            taskId,
            cmd.projectId,
            cmd.title,
            cmd.status,
            cmd.kind,
            cmd.description,
            cmd.dueOn ?? null,
            cmd.priority,
            cmd.blocked,
          ],
        )
      await tx.client.query(
        'UPDATE vcm.task_dependencies SET active=false WHERE task_id=$1',
        [taskId],
      )
      for (const dep of cmd.dependencies)
        await tx.client.query(
          'INSERT INTO vcm.task_dependencies(project_id,task_id,depends_on_id) VALUES($1,$2,$3) ON CONFLICT(task_id,depends_on_id) DO UPDATE SET active=true',
          [cmd.projectId, taskId, dep],
        )
      await tx.client.query(
        'UPDATE vcm.task_assignees SET active=false WHERE task_id=$1',
        [taskId],
      )
      for (const aid of cmd.assigneeIds)
        await tx.client.query(
          'INSERT INTO vcm.task_assignees(task_id,contact_id) VALUES($1,$2) ON CONFLICT(task_id,contact_id) DO UPDATE SET active=true',
          [taskId, aid],
        )
      return {
        objectId: 'project:' + cmd.projectId,
        version: await bumpProject(tx, cmd.projectId),
        result: { id: taskId },
        after: { taskId, status: cmd.status },
      }
    },
  })
  registry.register({
    type: 'archiveTask',
    action: 'archiveDraft',
    schema: z.strictObject({
      type: z.literal('archiveTask'),
      projectId: id,
      id,
      reason,
    }),
    target: projectTarget,
    async run(tx, cmd) {
      if (
        (
          await tx.client.query(
            'SELECT 1 FROM vcm.task_dependencies WHERE depends_on_id=$1 AND active',
            [cmd.id],
          )
        ).rowCount
      )
        throw new ApiError(
          422,
          'HAS_DEPENDANTS',
          'Resuelve las tareas dependientes.',
        )
      const r = await tx.client.query(
        "UPDATE vcm.tasks SET status='cancelled',version=version+1 WHERE id=$1 AND project_id=$2 RETURNING id",
        [cmd.id, cmd.projectId],
      )
      if (!r.rowCount)
        throw new ApiError(404, 'NOT_FOUND', 'Tarea no encontrada.')
      return {
        objectId: 'project:' + cmd.projectId,
        version: await bumpProject(tx, cmd.projectId),
        result: { id: cmd.id },
        after: { status: 'cancelled' },
      }
    },
  })
}
