import {
  createContext,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  useContext,
  useMemo,
  useState,
} from 'react'
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type KeyboardCoordinateGetter,
} from '@dnd-kit/core'
import { cn } from '@/lib/utils'

export type KanbanMove = {
  itemId: string
  fromColumnId: string
  toColumnId: string
}

type CardData = {
  type: 'card'
  itemId: string
  columnId: string
  label: string
}

type ColumnData = {
  type: 'column'
  columnId: string
  label: string
}

type KanbanContextValue = {
  activeCard: CardData | null
  isDropAllowed: (move: KanbanMove) => boolean
}

const KanbanContext = createContext<KanbanContextValue | null>(null)
const cardId = (itemId: string) => `kanban-card:${itemId}`
const columnId = (value: string) => `kanban-column:${value}`

const keyboardCoordinates: KeyboardCoordinateGetter = (event, args) => {
  const direction = event.code
  if (
    !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(direction)
  ) {
    return undefined
  }

  const activeRect = args.context.draggingNodeRect
  if (!activeRect) return undefined

  const horizontal = direction === 'ArrowLeft' || direction === 'ArrowRight'
  const forwards = direction === 'ArrowRight' || direction === 'ArrowDown'
  const currentCenter = horizontal
    ? activeRect.left + activeRect.width / 2
    : activeRect.top + activeRect.height / 2

  const candidates = args.context.droppableContainers
    .getEnabled()
    .map((container) => {
      const rect = args.context.droppableRects.get(container.id)
      if (!rect) return null
      const center = horizontal
        ? rect.left + rect.width / 2
        : rect.top + rect.height / 2
      const distance = center - currentCenter
      if ((forwards && distance <= 1) || (!forwards && distance >= -1)) {
        return null
      }
      return { rect, distance: Math.abs(distance) }
    })
    .filter(
      (candidate): candidate is NonNullable<typeof candidate> => !!candidate
    )
    .sort((a, b) => a.distance - b.distance)

  const target = candidates[0]?.rect
  if (!target) return undefined
  event.preventDefault()
  return {
    x: target.left + (target.width - activeRect.width) / 2,
    y: target.top + (target.height - activeRect.height) / 2,
  }
}

function isInteractiveTarget(
  target: EventTarget | null,
  draggable: EventTarget | null
) {
  if (!(target instanceof Element)) return false
  const interactive = target.closest(
    'a, button, input, select, textarea, [role="button"], [data-no-drag]'
  )
  return !!interactive && interactive !== draggable
}

export function KanbanDndContext({
  children,
  onMove,
  isDropAllowed,
  renderOverlay,
}: {
  children: ReactNode
  onMove: (move: KanbanMove) => void
  isDropAllowed: (move: KanbanMove) => boolean
  renderOverlay?: (itemId: string) => ReactNode
}) {
  const [activeCard, setActiveCard] = useState<CardData | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 180, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, { coordinateGetter: keyboardCoordinates })
  )
  const contextValue = useMemo(
    () => ({ activeCard, isDropAllowed }),
    [activeCard, isDropAllowed]
  )

  function readCard(event: DragStartEvent | DragEndEvent) {
    const data = event.active.data.current
    return data?.type === 'card' ? (data as CardData) : null
  }

  function handleDragEnd(event: DragEndEvent) {
    const card = readCard(event)
    const column = event.over?.data.current as ColumnData | undefined
    setActiveCard(null)
    if (!card || column?.type !== 'column') return
    const move = {
      itemId: card.itemId,
      fromColumnId: card.columnId,
      toColumnId: column.columnId,
    }
    if (move.fromColumnId !== move.toColumnId && isDropAllowed(move)) {
      onMove(move)
    }
  }

  return (
    <KanbanContext.Provider value={contextValue}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        accessibility={{
          screenReaderInstructions: {
            draggable:
              'Presiona espacio para tomar la tarjeta, usa las flechas para moverla y espacio para soltarla.',
          },
          announcements: {
            onDragStart: ({ active }) =>
              `Tomaste ${String(active.data.current?.label ?? 'la tarjeta')}.`,
            onDragOver: ({ over }) =>
              over?.data.current?.label
                ? `Sobre ${String(over.data.current.label)}.`
                : undefined,
            onDragEnd: ({ over }) =>
              over?.data.current?.label
                ? `Tarjeta soltada en ${String(over.data.current.label)}.`
                : 'Movimiento cancelado.',
            onDragCancel: () => 'Movimiento cancelado.',
          },
        }}
        onDragStart={(event) => setActiveCard(readCard(event))}
        onDragCancel={() => setActiveCard(null)}
        onDragEnd={handleDragEnd}
      >
        {children}
        <DragOverlay>
          {activeCard && renderOverlay ? (
            <div className='w-[280px] rotate-1 opacity-95 shadow-xl'>
              {renderOverlay(activeCard.itemId)}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </KanbanContext.Provider>
  )
}

export function KanbanDroppableColumn({
  columnId: currentColumnId,
  label,
  children,
  className,
}: {
  columnId: string
  label: string
  children: ReactNode
  className?: string
}) {
  const kanban = useContext(KanbanContext)
  if (!kanban)
    throw new Error('KanbanDroppableColumn requires KanbanDndContext')
  const move = kanban.activeCard
    ? {
        itemId: kanban.activeCard.itemId,
        fromColumnId: kanban.activeCard.columnId,
        toColumnId: currentColumnId,
      }
    : null
  const acceptsActive = !!move && kanban.isDropAllowed(move)
  const { isOver, setNodeRef } = useDroppable({
    id: columnId(currentColumnId),
    data: {
      type: 'column',
      columnId: currentColumnId,
      label,
    } satisfies ColumnData,
    disabled: !!kanban.activeCard && !acceptsActive,
  })

  return (
    <section
      ref={setNodeRef}
      aria-label={label}
      className={cn(
        className,
        acceptsActive && 'ring-2 ring-primary/25 ring-offset-2',
        isOver && acceptsActive && 'bg-primary/5 ring-primary'
      )}
    >
      {children}
    </section>
  )
}

export function KanbanDraggableCard({
  itemId,
  columnId: currentColumnId,
  label,
  children,
  disabled = false,
  className,
}: {
  itemId: string
  columnId: string
  label: string
  children: ReactNode
  disabled?: boolean
  className?: string
}) {
  const { attributes, isDragging, listeners, setNodeRef, transform } =
    useDraggable({
      id: cardId(itemId),
      data: {
        type: 'card',
        itemId,
        columnId: currentColumnId,
        label,
      } satisfies CardData,
      disabled,
      attributes: { role: 'button', roleDescription: 'tarjeta arrastrable' },
    })
  const style: CSSProperties | undefined = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined

  function stopInteractiveDrag(event: ReactPointerEvent) {
    if (isInteractiveTarget(event.target, event.currentTarget)) {
      event.stopPropagation()
    }
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'touch-manipulation rounded-lg focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
        !disabled && 'cursor-grab active:cursor-grabbing',
        isDragging && 'opacity-35',
        className
      )}
      aria-label={`Mover ${label}`}
      onPointerDownCapture={stopInteractiveDrag}
      {...attributes}
      {...listeners}
    >
      {children}
    </div>
  )
}
