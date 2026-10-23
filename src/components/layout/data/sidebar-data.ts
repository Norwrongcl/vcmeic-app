import {
  Home,
  FolderKanban,
  ShieldCheck,
  ChartColumn,
  Settings,
  Handshake,
} from 'lucide-react'
import type { SidebarData } from '../types'

export const sidebarData: SidebarData = {
  user: {
    name: 'Equipo ContentHub',
    email: 'equipo@contenthub.local',
    avatar: '',
  },
  teams: [
    { name: 'ContentHub', logo: Handshake, plan: 'Vinculación con el Medio' },
  ],
  navGroups: [
    {
      title: 'VcM EIC',
      items: [
        { title: 'Inicio', url: '/', icon: Home },
        { title: 'Portafolio', url: '/portfolio', icon: FolderKanban },
        { title: 'Control', url: '/control', icon: ShieldCheck },
        { title: 'Reportes', url: '/reports', icon: ChartColumn },
      ],
    },
    {
      title: 'Sistema',
      items: [{ title: 'Configuración', url: '/settings', icon: Settings }],
    },
  ],
}
