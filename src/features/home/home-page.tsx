import { useMemo } from 'react'
import { Link } from '@tanstack/react-router'
import {
  ArrowUpRight,
  CalendarClock,
  CalendarDays,
  CircleCheckBig,
  CircleDollarSign,
  ListTodo,
  OctagonAlert,
  Plus,
  Sparkles,
  UsersRound,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { useAppStore } from '@/features/core/model/app-store'
import { VCM_LINE_LABELS } from '@/features/core/model/catalogs'
import {
  getDashboardMetrics,
  getReportMetrics,
} from '@/features/core/model/selectors'
import { formatEventDateTime } from '@/features/events/model/formatters'

const chartColors = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
]
const monthFormatter = new Intl.DateTimeFormat('es-CL', { month: 'short' })

function initials(value: string) {
  return value
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

export function HomePage() {
  const activities = useAppStore((state) => state.activities)
  const events = useAppStore((state) => state.events)
  const tasks = useAppStore((state) => state.tasks)
  const budgetItems = useAppStore((state) => state.budgetItems)
  const expenses = useAppStore((state) => state.expenses)
  const partners = useAppStore((state) => state.partners)
  const contacts = useAppStore((state) => state.contacts)
  const agreements = useAppStore((state) => state.agreements)
  const resources = useAppStore((state) => state.resources)
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
  const metrics = getDashboardMetrics(data)
  const reportMetrics = getReportMetrics(data)
  const now = new Date()
  const nowKey = now.toISOString().slice(0, 16)
  const upcoming = Object.values(events)
    .filter((event) => event.startsAt >= nowKey && event.status !== 'cancelled')
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .slice(0, 4)
  const pending = Object.values(tasks)
    .filter((task) => task.status !== 'done' && task.status !== 'cancelled')
    .sort((a, b) => Number(Boolean(b.blocked)) - Number(Boolean(a.blocked)))
    .slice(0, 5)

  const monthlyImpact = Array.from({ length: 6 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1)
    const month = date.getMonth()
    const year = date.getFullYear()
    const initiatives = [
      ...Object.values(activities).map((item) => item.startsAt),
      ...Object.values(events).map((item) => item.startsAt),
    ].filter((startsAt) => {
      const start = new Date(startsAt)
      return start.getMonth() === month && start.getFullYear() === year
    }).length
    return {
      month: monthFormatter.format(date).replace('.', ''),
      iniciativas: initiatives,
    }
  })

  const lineCounts = new Map<string, number>()
  Object.values(activities).forEach((activity) =>
    lineCounts.set(
      activity.vcmLine,
      (lineCounts.get(activity.vcmLine) ?? 0) + 1
    )
  )
  Object.values(events).forEach((event) => {
    if (event.vcmLine)
      lineCounts.set(event.vcmLine, (lineCounts.get(event.vcmLine) ?? 0) + 1)
  })
  const lineDistribution = [...lineCounts.entries()].map(([line, value]) => ({
    name: VCM_LINE_LABELS[line as keyof typeof VCM_LINE_LABELS],
    value,
  }))
  const teamLoadMap = new Map<string, number>()
  pending.forEach((task) => {
    const name = task.assignee || 'Sin responsable'
    teamLoadMap.set(name, (teamLoadMap.get(name) ?? 0) + 1)
  })
  const teamLoad = [...teamLoadMap.entries()]
    .map(([name, total]) => ({ name: name.split(' ')[0], total }))
    .slice(0, 6)

  const kpis = [
    {
      label: 'Iniciativas activas',
      value: metrics.activities + metrics.activeEvents,
      note: `${metrics.upcomingEvents} próximas`,
      icon: Sparkles,
      tone: 'border-t-blue-500',
      iconTone: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
    },
    {
      label: 'Participantes',
      value: reportMetrics.participants.toLocaleString('es-CL'),
      note: 'alcance acumulado',
      icon: UsersRound,
      tone: 'border-t-violet-500',
      iconTone:
        'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
    },
    {
      label: 'Tareas pendientes',
      value: metrics.pendingTasks,
      note: `${pending.filter((task) => task.blocked).length} bloqueadas`,
      icon: ListTodo,
      tone: 'border-t-amber-400',
      iconTone:
        'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
    },
    {
      label: 'Ejecución presupuestaria',
      value: `${reportMetrics.budgetExecution}%`,
      note: 'del presupuesto planificado',
      icon: CircleDollarSign,
      tone: 'border-t-emerald-500',
      iconTone:
        'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
    },
  ]

  return (
    <>
      <Header fixed>
        <Search className='me-auto' placeholder='Buscar en ContentHub' />
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>
      <Main className='flex flex-col gap-6 bg-muted/20'>
        <div className='flex flex-wrap items-end justify-between gap-4'>
          <div>
            <div className='mb-1 flex items-center gap-2 text-sm font-medium text-primary'>
              <span className='size-2 rounded-full bg-emerald-500' />
              Vista operativa · datos locales
            </div>
            <h1 className='text-3xl font-bold tracking-tight'>
              Hola, equipo 👋
            </h1>
            <p className='mt-1 text-muted-foreground'>
              Esto es lo más importante de la vinculación hoy.
            </p>
          </div>
          <Button asChild>
            <Link to='/events/new'>
              <Plus data-icon='inline-start' /> Crear evento
            </Link>
          </Button>
        </div>

        <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-4'>
          {kpis.map((item) => (
            <Card
              key={item.label}
              className={cn('border-t-4 shadow-sm', item.tone)}
            >
              <CardContent className='flex items-start justify-between pt-6'>
                <div>
                  <p className='text-sm text-muted-foreground'>{item.label}</p>
                  <p className='mt-1 text-3xl font-bold'>{item.value}</p>
                  <p className='mt-1 text-xs text-muted-foreground'>
                    {item.note}
                  </p>
                </div>
                <span className={cn('rounded-xl p-2.5', item.iconTone)}>
                  <item.icon className='size-5' />
                </span>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className='grid min-w-0 gap-4 xl:grid-cols-[1.55fr_0.85fr]'>
          <Card className='min-w-0 shadow-sm'>
            <CardHeader>
              <CardTitle>Impacto mensual</CardTitle>
              <CardDescription>
                Iniciativas ejecutadas durante los últimos seis meses.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className='h-72 w-full min-w-0 overflow-hidden'
                aria-label='Gráfico de impacto mensual'
              >
                <ResponsiveContainer
                  width='100%'
                  height='100%'
                  minWidth={0}
                  initialDimension={{ width: 800, height: 288 }}
                >
                  <AreaChart
                    data={monthlyImpact}
                    margin={{ left: -16, right: 8 }}
                  >
                    <defs>
                      <linearGradient
                        id='impactFill'
                        x1='0'
                        y1='0'
                        x2='0'
                        y2='1'
                      >
                        <stop
                          offset='5%'
                          stopColor='var(--chart-1)'
                          stopOpacity={0.32}
                        />
                        <stop
                          offset='95%'
                          stopColor='var(--chart-1)'
                          stopOpacity={0.02}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} strokeDasharray='4 4' />
                    <XAxis dataKey='month' axisLine={false} tickLine={false} />
                    <YAxis
                      allowDecimals={false}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip cursor={{ stroke: 'var(--border)' }} />
                    <Area
                      type='monotone'
                      dataKey='iniciativas'
                      name='Iniciativas'
                      stroke='var(--chart-1)'
                      strokeWidth={3}
                      fill='url(#impactFill)'
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          <Card className='min-w-0 shadow-sm'>
            <CardHeader>
              <CardTitle>Distribución por línea VcM</CardTitle>
              <CardDescription>
                Composición actual del portafolio.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className='h-44 w-full min-w-0 overflow-hidden'
                aria-label='Gráfico de distribución por línea VcM'
              >
                <ResponsiveContainer
                  width='100%'
                  height='100%'
                  minWidth={0}
                  initialDimension={{ width: 360, height: 176 }}
                >
                  <PieChart>
                    <Pie
                      data={lineDistribution}
                      dataKey='value'
                      nameKey='name'
                      innerRadius={48}
                      outerRadius={76}
                      paddingAngle={4}
                    >
                      {lineDistribution.map((item, index) => (
                        <Cell
                          key={item.name}
                          fill={chartColors[index % chartColors.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className='flex flex-col gap-2'>
                {lineDistribution.slice(0, 3).map((item, index) => (
                  <div
                    key={item.name}
                    className='flex items-center justify-between gap-3 text-xs'
                  >
                    <span className='flex min-w-0 items-center gap-2'>
                      <span
                        className='size-2.5 shrink-0 rounded-full'
                        style={{
                          background: chartColors[index % chartColors.length],
                        }}
                      />
                      <span className='truncate'>{item.name}</span>
                    </span>
                    <strong>{item.value}</strong>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className='grid min-w-0 gap-4 xl:grid-cols-[1fr_1fr_0.9fr]'>
          <Card className='min-w-0 shadow-sm'>
            <CardHeader className='flex-row items-start justify-between'>
              <div>
                <CardTitle>Próximos hitos</CardTitle>
                <CardDescription>Agenda de eventos.</CardDescription>
              </div>
              <Button asChild variant='ghost' size='sm'>
                <Link to='/agenda'>
                  Agenda <ArrowUpRight data-icon='inline-end' />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className='flex flex-col gap-3'>
              {upcoming.length ? (
                upcoming.map((event) => (
                  <Link
                    key={event.id}
                    to='/events/$eventId'
                    params={{ eventId: event.id }}
                    className='flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-accent/60'
                  >
                    <span className='flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'>
                      <CalendarClock className='size-5' />
                    </span>
                    <span className='min-w-0'>
                      <span className='block truncate text-sm font-semibold'>
                        {event.name}
                      </span>
                      <span className='text-xs text-muted-foreground'>
                        {formatEventDateTime(event.startsAt)}
                      </span>
                    </span>
                  </Link>
                ))
              ) : (
                <div className='rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground'>
                  No hay próximos eventos en el período.
                </div>
              )}
            </CardContent>
          </Card>

          <Card className='min-w-0 shadow-sm'>
            <CardHeader className='flex-row items-start justify-between'>
              <div>
                <CardTitle>Tareas críticas</CardTitle>
                <CardDescription>
                  Prioridad operativa del equipo.
                </CardDescription>
              </div>
              <Button asChild variant='ghost' size='sm'>
                <Link to='/tasks'>
                  Tablero <ArrowUpRight data-icon='inline-end' />
                </Link>
              </Button>
            </CardHeader>
            <CardContent className='flex flex-col gap-3'>
              {pending.map((task) => (
                <div
                  key={task.id}
                  className='flex items-center gap-3 rounded-lg border p-3'
                >
                  <Avatar className='size-9'>
                    <AvatarFallback className='bg-violet-100 text-xs text-violet-700 dark:bg-violet-950 dark:text-violet-300'>
                      {initials(task.assignee || 'SR')}
                    </AvatarFallback>
                  </Avatar>
                  <div className='min-w-0 flex-1'>
                    <p className='truncate text-sm font-semibold'>
                      {task.title}
                    </p>
                    <p className='text-xs text-muted-foreground'>
                      {task.assignee || 'Sin responsable'}
                    </p>
                  </div>
                  {task.blocked ? (
                    <Badge variant='destructive'>
                      <OctagonAlert /> Bloqueada
                    </Badge>
                  ) : (
                    <Badge variant='outline'>{task.dueDate}</Badge>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className='min-w-0 shadow-sm'>
            <CardHeader>
              <CardTitle>Carga del equipo</CardTitle>
              <CardDescription>Tareas activas por responsable.</CardDescription>
            </CardHeader>
            <CardContent>
              <div
                className='h-44 w-full min-w-0 overflow-hidden'
                aria-label='Gráfico de carga del equipo'
              >
                <ResponsiveContainer
                  width='100%'
                  height='100%'
                  minWidth={0}
                  initialDimension={{ width: 360, height: 176 }}
                >
                  <BarChart data={teamLoad} margin={{ left: -24 }}>
                    <CartesianGrid vertical={false} strokeDasharray='4 4' />
                    <XAxis
                      dataKey='name'
                      axisLine={false}
                      tickLine={false}
                      fontSize={11}
                    />
                    <YAxis
                      allowDecimals={false}
                      axisLine={false}
                      tickLine={false}
                    />
                    <Tooltip cursor={{ fill: 'var(--muted)' }} />
                    <Bar
                      dataKey='total'
                      name='Tareas'
                      fill='var(--chart-4)'
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className='mt-4 flex items-center justify-between text-sm'>
                <span className='text-muted-foreground'>
                  Presupuesto ejecutado
                </span>
                <strong>{reportMetrics.budgetExecution}%</strong>
              </div>
              <Progress
                className='mt-2'
                value={Math.min(reportMetrics.budgetExecution, 100)}
              />
            </CardContent>
          </Card>
        </div>

        <Card className='border-dashed bg-primary/5 shadow-none'>
          <CardContent className='flex flex-wrap items-center justify-between gap-4 py-5'>
            <div className='flex items-center gap-3'>
              <span className='flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground'>
                <CircleCheckBig className='size-5' />
              </span>
              <div>
                <p className='font-semibold'>
                  ContentHub está listo para la revisión de diseño
                </p>
                <p className='text-sm text-muted-foreground'>
                  Los datos de esta demo se guardan solamente en este navegador.
                </p>
              </div>
            </div>
            <Button asChild variant='outline'>
              <Link to='/activities'>
                <CalendarDays data-icon='inline-start' /> Ver portafolio
              </Link>
            </Button>
          </CardContent>
        </Card>
      </Main>
    </>
  )
}
