import { useMemo } from 'react'
import {
  BarChart3,
  CalendarCheck2,
  CircleCheckBig,
  Download,
  UsersRound,
  WalletCards,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { cn } from '@/lib/utils'
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
import { VCM_LINES } from '@/features/core/model/catalogs'
import { getReportMetrics } from '@/features/core/model/selectors'
import { formatClp } from '@/features/events/model/formatters'

export function ReportsPage() {
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
  const metrics = getReportMetrics(data)
  const counts = new Map(
    metrics.byVcmLine.map((item) => [item.line, item.count])
  )
  const chartData = VCM_LINES.map((line) => ({
    name: line.label,
    total: counts.get(line.id) ?? 0,
  })).filter((item) => item.total > 0)
  const cards = [
    {
      label: 'Actividades ejecutadas',
      value: metrics.activities,
      icon: CalendarCheck2,
      tone: 'border-t-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/15',
      iconTone: 'text-emerald-600 dark:text-emerald-400',
    },
    {
      label: 'Eventos finalizados',
      value: metrics.completedEvents,
      icon: CircleCheckBig,
      tone: 'border-t-blue-500 bg-blue-50/40 dark:bg-blue-950/15',
      iconTone: 'text-blue-600 dark:text-blue-400',
    },
    {
      label: 'Participantes totales',
      value: metrics.participants,
      icon: UsersRound,
      tone: 'border-t-violet-500 bg-violet-50/40 dark:bg-violet-950/15',
      iconTone: 'text-violet-600 dark:text-violet-400',
    },
    {
      label: 'Ejecución presupuestaria',
      value: `${metrics.budgetExecution}%`,
      icon: WalletCards,
      tone: 'border-t-amber-400 bg-amber-50/40 dark:bg-amber-950/15',
      iconTone: 'text-amber-600 dark:text-amber-400',
    },
  ]

  const exportCsv = () => {
    const escapeCell = (value: string | number | null | undefined) =>
      `"${String(value ?? '')
        .split('"')
        .join('""')}"`
    const rows = [
      ['Tipo', 'Nombre', 'Estado', 'Línea VcM', 'Participantes'],
      ...Object.values(activities).map((activity) => [
        'Actividad',
        activity.name,
        activity.approvalStatus,
        activity.vcmLine,
        activity.participantCount,
      ]),
      ...Object.values(events).map((event) => [
        'Evento',
        event.name,
        event.status,
        event.vcmLine,
        event.participantCount ?? 0,
      ]),
    ]
    const csv = rows.map((row) => row.map(escapeCell).join(',')).join('\n')
    const blob = new Blob([`\uFEFF${csv}`], {
      type: 'text/csv;charset=utf-8',
    })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `contenthub-reporte-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.append(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 100)
  }

  return (
    <>
      <Header fixed>
        <Search className='me-auto' />
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>
      <Main className='flex flex-col gap-6'>
        <div className='flex flex-wrap items-start justify-between gap-3'>
          <div>
            <h1 className='text-2xl font-bold tracking-tight'>Reportes</h1>
            <p className='text-muted-foreground'>
              Indicadores derivados de Actividades y Eventos, sin duplicar
              registros.
            </p>
          </div>
          <Button variant='outline' onClick={exportCsv}>
            <Download data-icon='inline-start' /> Exportar CSV
          </Button>
        </div>
        <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-4'>
          {cards.map((item) => (
            <Card key={item.label} className={cn('border-t-4', item.tone)}>
              <CardContent className='flex items-start justify-between pt-6'>
                <div>
                  <p className='text-sm text-muted-foreground'>{item.label}</p>
                  <p className='mt-1 text-3xl font-bold'>{item.value}</p>
                </div>
                <item.icon className={cn('size-5', item.iconTone)} />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className='grid gap-4 xl:grid-cols-[1.35fr_0.65fr]'>
          <Card>
            <CardHeader>
              <CardTitle>Iniciativas por línea VcM</CardTitle>
              <CardDescription>
                Incluye Actividades y Eventos con cierre finalizado.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {chartData.length ? (
                <div className='h-96 w-full'>
                  <ResponsiveContainer
                    width='100%'
                    height='100%'
                    initialDimension={{ width: 800, height: 384 }}
                  >
                    <BarChart
                      data={chartData}
                      layout='vertical'
                      margin={{ left: 16, right: 24 }}
                    >
                      <CartesianGrid strokeDasharray='3 3' horizontal={false} />
                      <XAxis type='number' allowDecimals={false} />
                      <YAxis
                        type='category'
                        dataKey='name'
                        width={180}
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip cursor={{ fill: 'var(--muted)' }} />
                      <Bar
                        dataKey='total'
                        fill='var(--chart-2)'
                        radius={[0, 4, 4, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className='py-24 text-center text-sm text-muted-foreground'>
                  <BarChart3 className='mx-auto mb-3 size-6' />
                  Aún no hay iniciativas cerradas para graficar.
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Presupuesto de eventos</CardTitle>
              <CardDescription>
                Montos planificados y gastos reales.
              </CardDescription>
            </CardHeader>
            <CardContent className='grid gap-6'>
              <div>
                <p className='text-sm text-muted-foreground'>Planificado</p>
                <p className='text-2xl font-bold'>
                  {formatClp(metrics.plannedBudget)}
                </p>
              </div>
              <div>
                <p className='text-sm text-muted-foreground'>Gastado</p>
                <p className='text-2xl font-bold'>
                  {formatClp(metrics.spentBudget)}
                </p>
              </div>
              <div className='grid gap-2'>
                <div className='flex justify-between text-sm'>
                  <span>Ejecución</span>
                  <strong>{metrics.budgetExecution}%</strong>
                </div>
                <Progress value={Math.min(metrics.budgetExecution, 100)} />
              </div>
            </CardContent>
          </Card>
        </div>
      </Main>
    </>
  )
}
