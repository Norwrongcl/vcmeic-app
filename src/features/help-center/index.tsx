import {
  BookOpen,
  CircleHelp,
  Keyboard,
  LifeBuoy,
  MousePointer2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'

const guides = [
  {
    icon: MousePointer2,
    title: 'Organiza con Kanban',
    text: 'Arrastra eventos y tareas entre columnas. También funciona con teclado.',
  },
  {
    icon: BookOpen,
    title: 'Relaciona la información',
    text: 'Vincula socios, convenios, responsables y evidencias en cada iniciativa.',
  },
  {
    icon: Keyboard,
    title: 'Busca más rápido',
    text: 'Usa ⌘K o Ctrl+K para abrir la búsqueda global desde cualquier vista.',
  },
]

export function HelpCenter() {
  return (
    <>
      <Header fixed>
        <Search className='me-auto' />
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>
      <Main className='flex flex-col gap-6 bg-muted/20'>
        <div>
          <h1 className='text-3xl font-bold tracking-tight'>Ayuda</h1>
          <p className='mt-1 text-muted-foreground'>
            Guía rápida para explorar el prototipo de ContentHub.
          </p>
        </div>
        <Card className='overflow-hidden border-0 bg-primary text-primary-foreground shadow-lg'>
          <CardContent className='flex flex-wrap items-center justify-between gap-6 py-8'>
            <div className='flex max-w-2xl items-start gap-4'>
              <span className='flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary-foreground/15'>
                <CircleHelp className='size-6' />
              </span>
              <div>
                <h2 className='text-xl font-bold'>¿Por dónde empiezo?</h2>
                <p className='mt-1 text-primary-foreground/80'>
                  Crea un evento, cambia al tablero Kanban y muévelo entre
                  estados. Los indicadores del inicio se actualizarán con los
                  datos locales.
                </p>
              </div>
            </div>
            <Button
              variant='secondary'
              onClick={() =>
                toast.success('Recorrido de demostración iniciado.')
              }
            >
              Iniciar recorrido
            </Button>
          </CardContent>
        </Card>
        <div className='grid gap-4 md:grid-cols-3'>
          {guides.map((guide) => (
            <Card key={guide.title}>
              <CardHeader>
                <span className='mb-2 flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary'>
                  <guide.icon className='size-5' />
                </span>
                <CardTitle>{guide.title}</CardTitle>
                <CardDescription>{guide.text}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Preguntas frecuentes</CardTitle>
          </CardHeader>
          <CardContent className='grid gap-4 md:grid-cols-2'>
            <div className='rounded-lg border p-4'>
              <p className='font-semibold'>¿Estos datos son reales?</p>
              <p className='mt-1 text-sm text-muted-foreground'>
                No. Es una demostración frontend y todo se almacena únicamente
                en este navegador.
              </p>
            </div>
            <div className='rounded-lg border p-4'>
              <p className='font-semibold'>¿Ya existe un backend?</p>
              <p className='mt-1 text-sm text-muted-foreground'>
                Todavía no. La integración comenzará después de aprobar la
                experiencia UI/UX.
              </p>
            </div>
            <div className='rounded-lg border p-4'>
              <p className='font-semibold'>¿Puedo restaurar la demo?</p>
              <p className='mt-1 text-sm text-muted-foreground'>
                Sí. Ve a Configuración y selecciona “Restablecer demostración”.
              </p>
            </div>
            <div className='rounded-lg border p-4'>
              <p className='font-semibold'>¿Cómo pido soporte?</p>
              <Button
                variant='link'
                className='h-auto p-0'
                onClick={() =>
                  toast.info('Canal de soporte simulado para esta revisión.')
                }
              >
                Contactar soporte <LifeBuoy />
              </Button>
            </div>
          </CardContent>
        </Card>
      </Main>
    </>
  )
}
