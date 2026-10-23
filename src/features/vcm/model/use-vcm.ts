import { toast } from 'sonner'
import { create } from 'zustand'
import { appStore, useAppStore } from '@/features/core/model/app-store'
import { ROLE_LABELS } from './catalogs'
import { vcmRepository } from './repository'
import type { Actor, Command, Role } from './types'

const savedRole = () => {
  try {
    return localStorage.getItem('vcm-demo-role') ?? 'coordination'
  } catch {
    return 'coordination'
  }
}
const initial = savedRole()
const initialRole = (initial in ROLE_LABELS ? initial : 'coordination') as Role
export const useDemoRole = create<{
  role: Role
  setRole: (role: Role) => void
}>((set) => ({
  role: initialRole,
  setRole: (role) => {
    localStorage.setItem('vcm-demo-role', role)
    appStore.setState({ operationActor: demoActor(role) })
    set({ role })
  },
}))
export function demoActor(role: Role): Actor {
  return {
    id: `demo-${role}`,
    role,
    name: `${ROLE_LABELS[role]} · demostración`,
  }
}
appStore.setState({ operationActor: demoActor(initialRole) })
export function useVcm() {
  const data = useAppStore((s) => s.vcm)!
  const role = useDemoRole((s) => s.role)
  const actor = demoActor(role)
  const execute = async (command: Command) => {
    try {
      await vcmRepository.execute(command, actor)
      toast.success('Cambio guardado en este navegador.')
      return true
    } catch (error) {
      throw error instanceof Error
        ? error
        : new Error(
            'No se pudo guardar. Revisa los datos e inténtalo de nuevo.'
          )
    }
  }
  return { data, actor, execute }
}
