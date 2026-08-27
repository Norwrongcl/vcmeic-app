import { useMemo, useState } from 'react'
import { addMonths, format, startOfMonth } from 'date-fns'
import { Link } from '@tanstack/react-router'
import { es } from 'date-fns/locale'
import { CalendarDays, ChevronLeft, ChevronRight, ListTodo } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { useAppStore } from '@/features/core/model/app-store'
import {
  getAgendaItems,
  type AgendaItem,
} from '@/features/core/model/selectors'
import { buildCalendarMonth } from './calendar-model'

const weekDays = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

export const CALENDAR_DAY_CELL_CLASSNAME =
  'min-h-32 min-w-0 overflow-hidden border-r border-b p-2 last:border-r-0 [&:nth-child(7n)]:border-r-0'

const agendaItemStyles: Record<AgendaItem['kind'], string> = {
  'event-start':
    'border-blue-200 bg-blue-100 text-blue-900 hover:bg-blue-200 dark:border-blue-800 dark:bg-blue-950/70 dark:text-blue-100 dark:hover:bg-blue-900',
  'event-end':
    'border-violet-200 bg-violet-100 text-violet-900 hover:bg-violet-200 dark:border-violet-800 dark:bg-violet-950/70 dark:text-violet-100 dark:hover:bg-violet-900',
  'task-due':
    'border-amber-200 bg-amber-100 text-amber-900 dark:border-amber-800 dark:bg-amber-950/70 dark:text-amber-100',
}

export function CalendarItem({ item }: { item: AgendaItem }) {
  const isTask = item.kind === 'task-due'
  const content = (
    <span
      className={cn(
        'flex min-w-0 items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium transition-colors',
        agendaItemStyles[item.kind]
      )}
      title={item.title}
    >
      {isTask ? (
        <ListTodo className='size-3 shrink-0' />
      ) : (
        <CalendarDays className='size-3 shrink-0' />
      )}
      <span className='truncate'>{item.title}</span>
    </span>
  )

  return item.eventId && !isTask ? (
    <Link
      to='/events/$eventId'
      params={{ eventId: item.eventId }}
      className='block min-w-0 rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none'
    >
      {content}
    </Link>
  ) : (
    content
  )
}

export function AgendaPage() {
  const activities = useAppStore((state) => state.activities)
  const events = useAppStore((state) => state.events)
  const tasks = useAppStore((state) => state.tasks)
  const budgetItems = useAppStore((state) => state.budgetItems)
  const expenses = useAppStore((state) => state.expenses)
  const partners = useAppStore((state) => state.partners)
  const contacts = useAppStore((state) => state.contacts)
  const agreements = useAppStore((state) => state.agreements)
  const resources = useAppStore((state) => state.resources)
  const [kind, setKind] = useState<'all' | 'events' | 'tasks'>('all')
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()))
  const data = useMemo(
    () => ({
      activities,
      events,
      tasks,
      budgetItems,
      expenses,
      partners,
      contacts,
      agreements,
      resources,
    }),
    [
      activities,
      agreements,
      budgetItems,
      contacts,
      events,
      expenses,
      partners,
      resources,
      tasks,
    ]
  )
  const items = getAgendaItems(data).filter(
    (item) =>
      kind === 'all' ||
      (kind === 'tasks' ? item.kind === 'task-due' : item.kind !== 'task-due')
  )
  const calendarDays = buildCalendarMonth(cursor, items)

  return (
    <>
      <Header fixed>
        <Search className='me-auto' />
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>
      <Main className='flex flex-col gap-6'>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>Agenda</h1>
          <p className='text-muted-foreground'>
            Calendario de eventos y vencimientos de tareas.
          </p>
        </div>

        <div className='flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between'>
          <div className='flex items-center gap-2'>
            <Button
              variant='outline'
              size='icon'
              aria-label='Mes anterior'
              onClick={() => setCursor((value) => addMonths(value, -1))}
            >
              <ChevronLeft />
            </Button>
            <Button
              variant='outline'
              onClick={() => setCursor(startOfMonth(new Date()))}
            >
              Hoy
            </Button>
            <Button
              variant='outline'
              size='icon'
              aria-label='Mes siguiente'
              onClick={() => setCursor((value) => addMonths(value, 1))}
            >
              <ChevronRight />
            </Button>
            <h2
              className='ml-2 min-w-40 text-lg font-semibold capitalize'
              aria-live='polite'
            >
              {format(cursor, 'MMMM yyyy', { locale: es })}
            </h2>
          </div>
          <div className='flex flex-wrap items-center gap-3'>
            <div className='hidden items-center gap-2 text-xs text-muted-foreground sm:flex'>
              <Badge className='border-blue-200 bg-blue-100 text-blue-800'>
                Inicio
              </Badge>
              <Badge className='border-violet-200 bg-violet-100 text-violet-800'>
                Término
              </Badge>
              <Badge className='border-amber-200 bg-amber-100 text-amber-800'>
                Tarea
              </Badge>
            </div>
            <Select
              value={kind}
              onValueChange={(value) => setKind(value as typeof kind)}
            >
              <SelectTrigger className='w-full sm:w-48'>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value='all'>Eventos y tareas</SelectItem>
                <SelectItem value='events'>Solo eventos</SelectItem>
                <SelectItem value='tasks'>Solo tareas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Card className='gap-0 overflow-hidden py-0'>
          <CardContent className='overflow-x-auto px-0'>
            <div className='min-w-[860px]'>
              <div className='grid grid-cols-7 border-b bg-muted/55'>
                {weekDays.map((day) => (
                  <div
                    key={day}
                    className='px-3 py-2 text-center text-xs font-semibold tracking-wide text-muted-foreground uppercase'
                  >
                    {day}
                  </div>
                ))}
              </div>
              <div className='grid grid-cols-7'>
                {calendarDays.map((day) => (
                  <div
                    key={day.key}
                    data-testid='calendar-day'
                    className={cn(
                      CALENDAR_DAY_CELL_CLASSNAME,
                      !day.inCurrentMonth && 'bg-muted/25'
                    )}
                  >
                    <div className='mb-2 flex items-center justify-between'>
                      <span
                        className={cn(
                          'flex size-7 items-center justify-center rounded-full text-sm font-medium',
                          !day.inCurrentMonth && 'text-muted-foreground/60',
                          day.isToday &&
                            'bg-primary font-bold text-primary-foreground shadow-sm'
                        )}
                      >
                        {format(day.date, 'd')}
                      </span>
                      {day.items.length > 0 && (
                        <span className='text-[11px] text-muted-foreground'>
                          {day.items.length}
                        </span>
                      )}
                    </div>
                    <div className='grid gap-1.5'>
                      {day.items.map((item) => (
                        <CalendarItem key={item.id} item={item} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </Main>
    </>
  )
}
