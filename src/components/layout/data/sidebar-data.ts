import {
  Calendar,
  CalendarDays,
  ChartColumn,
  ContactRound,
  Boxes,
  Cable,
  Handshake,
  CircleHelp,
  Home,
  ListTodo,
  Settings,
  Tickets,
  UserRound,
} from 'lucide-react'
import { type SidebarData } from '../types'

export const sidebarData: SidebarData = {
  user: {
    name: 'Equipo ContentHub',
    email: 'equipo@contenthub.local',
    avatar: '',
  },
  teams: [
    {
      name: 'ContentHub',
      logo: Handshake,
      plan: 'Vinculación con el Medio',
    },
  ],
  navGroups: [
    {
      title: 'Principal',
      items: [
        {
          title: 'Inicio',
          url: '/',
          icon: Home,
        },
      ],
    },
    {
      title: 'Gestión',
      items: [
        {
          title: 'Actividades',
          url: '/activities',
          icon: CalendarDays,
        },
        {
          title: 'Eventos',
          url: '/events',
          icon: Tickets,
        },
        {
          title: 'Agenda',
          url: '/agenda',
          icon: Calendar,
        },
        {
          title: 'Tareas',
          url: '/tasks',
          icon: ListTodo,
        },
      ],
    },
    {
      title: 'Vinculación',
      items: [
        {
          title: 'Convenios',
          url: '/agreements',
          icon: Handshake,
        },
        {
          title: 'Socios',
          url: '/partners',
          icon: ContactRound,
        },
        {
          title: 'Contactos',
          url: '/contacts',
          icon: UserRound,
        },
      ],
    },
    {
      title: 'Análisis y apoyo',
      items: [
        {
          title: 'Recursos',
          url: '/resources',
          icon: Boxes,
        },
        {
          title: 'Reportes',
          url: '/reports',
          icon: ChartColumn,
        },
        {
          title: 'Conexiones',
          url: '/apps',
          icon: Cable,
        },
      ],
    },
    {
      title: 'Sistema',
      items: [
        {
          title: 'Configuración',
          url: '/settings',
          icon: Settings,
        },
        {
          title: 'Ayuda',
          url: '/help-center',
          icon: CircleHelp,
        },
      ],
    },
  ],
}
