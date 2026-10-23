import type { StoreApi } from 'zustand/vanilla'
import { appStore, type AppStoreState } from '@/features/core/model/app-store'
import { migrateVcmData } from './migration'
import { budgetScope, hasOperationalMandate } from './operation-mandate'
import { applyPlanningCommand, isPlanningCommand } from './planning'
import type { Actor, Command, VcmData } from './types'
import { applyCommand } from './workflow'

export interface VcmRepository {
  read(): Promise<VcmData>
  execute(command: Command, actor: Actor): Promise<void>
  exportBackup(): Promise<string>
  importBackup(raw: string): Promise<void>
  resetDemo(): Promise<void>
}
export function createVcmRepository(
  store: StoreApi<AppStoreState>
): VcmRepository {
  return {
    async read() {
      return structuredClone(
        store.getState().vcm ?? migrateVcmData(store.getState())
      )
    },
    async execute(command, actor) {
      const state = store.getState()
      const data = state.vcm ?? migrateVcmData(state)
      if (
        command.type === 'setRelations' &&
        (command.organizationIds.some((id) => !state.partners[id]) ||
          command.agreementIds.some((id) => !state.agreements[id]))
      )
        throw new Error('Selecciona entidades maestras existentes.')
      if (
        command.type === 'updateCase' &&
        command.executionState === 'completed' &&
        Object.values(state.tasks).some(
          (t) =>
            t.eventId === data.cases[command.caseId]?.projectId &&
            !['done', 'cancelled'].includes(t.status)
        )
      )
        throw new Error(
          'Completa o cancela las tareas e hitos antes de finalizar el proyecto operativo.'
        )
      if (
        command.type === 'updateCase' &&
        ['in_progress', 'completed'].includes(command.executionState) &&
        command.executionState !== data.cases[command.caseId]?.executionState &&
        !hasOperationalMandate({ ...state, vcm: data }, command.caseId)
      )
        throw new Error(
          'Requiere un plan de trabajo aprobado y vigente. Revisa alcance, fechas, responsables y presupuesto en Gobierno.'
        )
      if (
        command.type === 'transition' &&
        ['qa', 'rendered', 'closed'].includes(command.state) &&
        data.cases[command.caseId]?.projectId &&
        !hasOperationalMandate({ ...state, vcm: data }, command.caseId)
      )
        throw new Error(
          'Revisa el plan de trabajo aprobado antes del cierre documental.'
        )
      const updated = isPlanningCommand(command)
        ? applyPlanningCommand({ ...state, vcm: data }, command, actor)
        : applyCommand(data, command, actor)
      if (
        command.type === 'decide' &&
        command.status === 'approved' &&
        updated.decisions[command.id]?.kind === 'flow' &&
        updated.cases[command.caseId]?.projectId
      ) {
        const basis = budgetScope(
          { ...state, vcm: updated },
          updated.cases[command.caseId].projectId!
        )
        updated.decisions[command.id].budgetBasis = basis
        const entry = updated.audit[updated.audit.length - 1]
        entry.after = {
          ...(entry.after as Record<string, unknown>),
          operationalBudgetBasis: basis,
        }
      }
      state.replaceVcmData(updated)
    },
    async exportBackup() {
      return store.getState().exportSnapshot()
    },
    async importBackup(raw) {
      const result = store.getState().importSnapshot(raw)
      if (!result.success) throw new Error(result.error)
    },
    async resetDemo() {
      store.getState().resetData()
    },
  }
}
export const vcmRepository = createVcmRepository(appStore)
