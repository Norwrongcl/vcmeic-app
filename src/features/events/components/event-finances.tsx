import { useState } from 'react'
import {
  AlertTriangle,
  Banknote,
  Pencil,
  Plus,
  ReceiptText,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Progress } from '@/components/ui/progress'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { useEventsStore } from '../model/events-store'
import { formatClp, formatEventDate } from '../model/formatters'
import { getEventFinancials } from '../model/selectors'
import { type BudgetItem, type Expense } from '../model/types'
import { BudgetFormDialog } from './budget-form-dialog'
import { ExpenseFormDialog } from './expense-form-dialog'
import { MetricCard } from './metric-card'

export function EventFinances({ eventId }: { eventId: string }) {
  const state = useEventsStore((current) => current)
  const deleteBudgetItem = useEventsStore((current) => current.deleteBudgetItem)
  const deleteExpense = useEventsStore((current) => current.deleteExpense)
  const budgetItems = Object.values(state.budgetItems).filter(
    (item) => item.eventId === eventId
  )
  const expenses = Object.values(state.expenses).filter(
    (expense) => expense.eventId === eventId
  )
  const financials = getEventFinancials(state, eventId)
  const itemMetrics = new Map(
    financials.items.map((item) => [item.budgetItemId, item])
  )
  const [budgetDialogOpen, setBudgetDialogOpen] = useState(false)
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false)
  const [editingBudgetItem, setEditingBudgetItem] = useState<BudgetItem>()
  const [editingExpense, setEditingExpense] = useState<Expense>()
  const [deletingExpense, setDeletingExpense] = useState<Expense>()

  const openBudgetDialog = (item?: BudgetItem) => {
    setEditingBudgetItem(item)
    setBudgetDialogOpen(true)
  }
  const openExpenseDialog = (expense?: Expense) => {
    setEditingExpense(expense)
    setExpenseDialogOpen(true)
  }

  return (
    <div className='flex flex-col gap-6'>
      <div className='grid gap-4 sm:grid-cols-2 xl:grid-cols-4'>
        <MetricCard
          label='Presupuestado'
          value={formatClp(financials.planned)}
          icon={Banknote}
        />
        <MetricCard
          label='Gastado'
          value={formatClp(financials.spent)}
          icon={ReceiptText}
          tone='violet'
        />
        <MetricCard
          label='Diferencia presupuestaria'
          value={formatClp(financials.available)}
          description={
            financials.isOverBudget
              ? 'Presupuesto sobre-ejecutado'
              : 'Planificado menos gastos; no acredita fondos'
          }
          icon={Banknote}
          tone='emerald'
        />
        <MetricCard
          label='Ejecución'
          value={`${financials.executionPercentage}%`}
          description={`${expenses.length} gastos registrados`}
          icon={ReceiptText}
          tone='amber'
        />
      </div>

      {financials.items.some((item) => item.isOverBudget) ? (
        <Alert variant='destructive'>
          <AlertTriangle />
          <AlertTitle>Hay partidas sobre-ejecutadas</AlertTitle>
          <AlertDescription>
            Revisa los gastos o ajusta el monto planificado de las partidas
            marcadas.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader className='flex flex-row items-start justify-between gap-4'>
          <div className='flex flex-col gap-1.5'>
            <CardTitle>Partidas presupuestarias</CardTitle>
            <CardDescription>
              Planificación y ejecución por categoría.
            </CardDescription>
          </div>
          <Button onClick={() => openBudgetDialog()}>
            <Plus data-icon='inline-start' />
            Nueva partida
          </Button>
        </CardHeader>
        <CardContent>
          {budgetItems.length ? (
            <div className='overflow-hidden rounded-md border'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Partida</TableHead>
                    <TableHead>Planificado</TableHead>
                    <TableHead>Gastado</TableHead>
                    <TableHead>Diferencia</TableHead>
                    <TableHead>Ejecución</TableHead>
                    <TableHead className='text-end'>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {budgetItems.map((item) => {
                    const metrics = itemMetrics.get(item.id)
                    if (!metrics) return null
                    return (
                      <TableRow key={item.id}>
                        <TableCell className='font-medium'>
                          {item.name}
                        </TableCell>
                        <TableCell>{formatClp(metrics.planned)}</TableCell>
                        <TableCell>{formatClp(metrics.spent)}</TableCell>
                        <TableCell>{formatClp(metrics.available)}</TableCell>
                        <TableCell className='min-w-40'>
                          <div className='flex items-center gap-2'>
                            <Progress
                              value={Math.min(metrics.executionPercentage, 100)}
                              aria-label={`${metrics.executionPercentage}% ejecutado`}
                            />
                            <span className='text-xs tabular-nums'>
                              {metrics.executionPercentage}%
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className='flex justify-end gap-1'>
                            <Button
                              size='icon'
                              variant='ghost'
                              aria-label={`Editar ${item.name}`}
                              onClick={() => openBudgetDialog(item)}
                            >
                              <Pencil />
                            </Button>
                            <Button
                              size='icon'
                              variant='ghost'
                              aria-label={`Eliminar ${item.name}`}
                              onClick={() => {
                                if (deleteBudgetItem(item.id)) {
                                  toast.success('Partida eliminada.')
                                } else {
                                  toast.error(
                                    'No se puede eliminar una partida con gastos. Reasígnalos o elimínalos primero.'
                                  )
                                }
                              }}
                            >
                              <Trash2 />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <Empty className='border'>
              <EmptyHeader>
                <EmptyMedia variant='icon'>
                  <Banknote />
                </EmptyMedia>
                <EmptyTitle>No hay presupuesto</EmptyTitle>
                <EmptyDescription>
                  Crea una partida antes de registrar gastos.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className='flex flex-row items-start justify-between gap-4'>
          <div className='flex flex-col gap-1.5'>
            <CardTitle>Gastos</CardTitle>
            <CardDescription>
              Movimientos imputados al presupuesto.
            </CardDescription>
          </div>
          <Button
            disabled={!budgetItems.length}
            onClick={() => openExpenseDialog()}
          >
            <Plus data-icon='inline-start' />
            Registrar gasto
          </Button>
        </CardHeader>
        <CardContent>
          {expenses.length ? (
            <div className='overflow-hidden rounded-md border'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Concepto</TableHead>
                    <TableHead>Partida</TableHead>
                    <TableHead>Proveedor</TableHead>
                    <TableHead>Referencia</TableHead>
                    <TableHead>Monto</TableHead>
                    <TableHead className='text-end'>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {expenses.map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell>{formatEventDate(expense.date)}</TableCell>
                      <TableCell className='font-medium'>
                        {expense.concept}
                      </TableCell>
                      <TableCell>
                        {state.budgetItems[expense.budgetItemId]?.name ??
                          'Sin partida'}
                      </TableCell>
                      <TableCell>{expense.supplier || '—'}</TableCell>
                      <TableCell>{expense.reference || '—'}</TableCell>
                      <TableCell>{formatClp(expense.amount)}</TableCell>
                      <TableCell>
                        <div className='flex justify-end gap-1'>
                          <Button
                            size='icon'
                            variant='ghost'
                            aria-label={`Editar ${expense.concept}`}
                            onClick={() => openExpenseDialog(expense)}
                          >
                            <Pencil />
                          </Button>
                          <Button
                            size='icon'
                            variant='ghost'
                            aria-label={`Eliminar ${expense.concept}`}
                            onClick={() => setDeletingExpense(expense)}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <Empty className='border'>
              <EmptyHeader>
                <EmptyMedia variant='icon'>
                  <ReceiptText />
                </EmptyMedia>
                <EmptyTitle>No hay gastos</EmptyTitle>
                <EmptyDescription>
                  Los gastos registrados aparecerán en esta tabla.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
        </CardContent>
      </Card>

      <BudgetFormDialog
        key={editingBudgetItem?.id ?? 'new-budget-item'}
        open={budgetDialogOpen}
        onOpenChange={setBudgetDialogOpen}
        eventId={eventId}
        item={editingBudgetItem}
      />
      <ExpenseFormDialog
        key={editingExpense?.id ?? 'new-expense'}
        open={expenseDialogOpen}
        onOpenChange={setExpenseDialogOpen}
        eventId={eventId}
        expense={editingExpense}
      />
      <ConfirmDialog
        open={!!deletingExpense}
        onOpenChange={(open) => {
          if (!open) setDeletingExpense(undefined)
        }}
        title='Eliminar gasto'
        desc='El gasto se descontará de la ejecución de su partida.'
        confirmText='Eliminar'
        destructive
        handleConfirm={() => {
          if (!deletingExpense) return
          deleteExpense(deletingExpense.id)
          setDeletingExpense(undefined)
          toast.success('Gasto eliminado.')
        }}
      />
    </div>
  )
}
