import { type DeletionImpact, type EventsData, type EventTask } from './types'

export function getTasksForEvent(
  data: EventsData,
  eventId: string
): EventTask[] {
  return Object.values(data.tasks).filter((task) => task.eventId === eventId)
}

export function getEventDeletionImpact(
  data: EventsData,
  eventId: string
): DeletionImpact {
  return {
    tasks: Object.values(data.tasks).filter((task) => task.eventId === eventId)
      .length,
    budgetItems: Object.values(data.budgetItems).filter(
      (item) => item.eventId === eventId
    ).length,
    expenses: Object.values(data.expenses).filter(
      (expense) => expense.eventId === eventId
    ).length,
  }
}

export function getEventFinancials(data: EventsData, eventId: string) {
  const budgetItems = Object.values(data.budgetItems).filter(
    (item) => item.eventId === eventId
  )
  const expenses = Object.values(data.expenses).filter(
    (expense) => expense.eventId === eventId
  )
  const items = budgetItems.map((item) => {
    const spent = expenses.reduce(
      (sum, expense) =>
        expense.budgetItemId === item.id ? sum + expense.amount : sum,
      0
    )
    const executionPercentage =
      item.plannedAmount === 0
        ? spent > 0
          ? 100
          : 0
        : Math.round((spent / item.plannedAmount) * 100)

    return {
      budgetItemId: item.id,
      planned: item.plannedAmount,
      spent,
      available: item.plannedAmount - spent,
      executionPercentage,
      isOverBudget: spent > item.plannedAmount,
    }
  })
  const planned = items.reduce((sum, item) => sum + item.planned, 0)
  const spent = items.reduce((sum, item) => sum + item.spent, 0)

  return {
    planned,
    spent,
    available: planned - spent,
    executionPercentage:
      planned === 0
        ? spent > 0
          ? 100
          : 0
        : Math.round((spent / planned) * 100),
    isOverBudget: spent > planned,
    items,
  }
}
