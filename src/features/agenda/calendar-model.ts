import {
  addDays,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { type AgendaItem } from '@/features/core/model/selectors'

export type CalendarDay = {
  key: string
  date: Date
  inCurrentMonth: boolean
  isToday: boolean
  items: AgendaItem[]
}

export function buildCalendarMonth(
  cursor: Date,
  items: AgendaItem[],
  today = new Date()
): CalendarDay[] {
  const firstVisibleDay = startOfWeek(startOfMonth(cursor), {
    weekStartsOn: 1,
  })
  const itemsByDate = new Map<string, AgendaItem[]>()

  items.forEach((item) => {
    const key = item.date.slice(0, 10)
    itemsByDate.set(key, [...(itemsByDate.get(key) ?? []), item])
  })

  return Array.from({ length: 42 }, (_, index) => {
    const date = addDays(firstVisibleDay, index)
    const key = format(date, 'yyyy-MM-dd')
    return {
      key,
      date,
      inCurrentMonth: isSameMonth(date, cursor),
      isToday: isSameDay(date, today),
      items: itemsByDate.get(key) ?? [],
    }
  })
}
