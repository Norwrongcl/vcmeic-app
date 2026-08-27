import { Bot, FolderOpen, Send } from 'lucide-react'

export const apps = [
  {
    name: 'Hermes',
    logo: <Bot />,
    desc: 'Agente inteligente encargado de automatizar procesos VCM.',
    action: 'Abrir Dashboard',
    url: '#',
  },
  {
    name: 'Google Drive',
    logo: <FolderOpen />,
    desc: 'Repositorio documental de las actividades y archivos institucionales.',
    action: 'Abrir carpeta principal de ContentHub',
    url: '#',
  },
  {
    name: 'Buffer',
    logo: <Send />,
    desc: 'Gestión y programación de publicaciones en redes sociales.',
    action: 'Abrir Buffer',
    url: '#',
  },
]
