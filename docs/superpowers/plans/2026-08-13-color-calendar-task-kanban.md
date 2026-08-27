# Color, Calendar, and Task Kanban Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add functional color accents, replace Agenda's timeline with a monthly calendar, and add a persistent Kanban view to Tasks without replacing existing UI components.

**Architecture:** Keep shared shadcn primitives and introduce only semantic Tailwind color treatments. Isolate calendar date math and task grouping in pure model modules, then let the existing feature pages render those outputs. Reuse `EntityViewSwitcher` and `useEntityViewPreference` for Tasks.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, Zustand, TanStack Router, date-fns, Vitest Browser.

## Global Constraints

- Do not add dependencies or change the persisted data schema.
- Preserve existing component anatomy, typography, spacing, forms, filters, and CRUD behavior.
- Use restrained semantic color in both light and dark themes.
- Agenda is a Monday-first monthly calendar.
- Tasks support Table and Kanban; Kanban does not support drag and drop.

---

### Task 1: Monthly calendar model

**Files:**
- Create: `src/features/agenda/calendar-model.ts`
- Test: `src/features/agenda/calendar-model.test.ts`

**Interfaces:**
- Produces: `buildCalendarMonth(cursor: Date, items: AgendaItem[]): CalendarDay[]`, where every day has a stable `key`, its `date`, `inCurrentMonth`, `isToday`, and matching `items`.

- [ ] Write tests proving August 2026 produces a Monday-first 42-day grid, assigns items by local date key, and marks today from an injected date.
- [ ] Run `npm test -- src/features/agenda/calendar-model.test.ts` and verify the missing module/API failure.
- [ ] Implement date-key normalization and the 42-cell month grid using `date-fns`.
- [ ] Re-run the focused test and verify it passes.

### Task 2: Task Kanban model and page view

**Files:**
- Create: `src/features/events/model/task-kanban.ts`
- Test: `src/features/events/model/task-kanban.test.ts`
- Modify: `src/features/events/global-tasks-page.tsx`

**Interfaces:**
- Produces: `TASK_KANBAN_COLUMNS` and `groupTasksByStatus(tasks: EventTask[])` with all four `TaskStatus` keys.
- Consumes: `EntityViewSwitcher`, `useEntityViewPreference`, and the current task CRUD dialogs.

- [ ] Write tests proving stable column order and lossless grouping.
- [ ] Run the focused test and verify it fails because the model does not exist.
- [ ] Implement the pure grouping model.
- [ ] Add persistent Table/Kanban selection and render current task data as colored Kanban cards with working edit/delete controls.
- [ ] Run the focused model test and relevant task form tests.

### Task 3: Monthly Agenda UI

**Files:**
- Modify: `src/features/agenda/agenda-page.tsx`

**Interfaces:**
- Consumes: `buildCalendarMonth`, `getAgendaItems`, existing filters, and event detail links.

- [ ] Render month navigation, weekday headers, and the monthly grid from `CalendarDay[]`.
- [ ] Render item colors by kind and preserve event links.
- [ ] Add an accessible empty state inside days with no items and horizontal containment on narrow screens.
- [ ] Run the calendar model test and build to catch integration/type errors.

### Task 4: Shared functional color treatment

**Files:**
- Modify: `src/styles/theme.css`
- Modify: `src/components/layout/nav-group.tsx`
- Modify: `src/features/events/components/status-badges.tsx`
- Modify: `src/features/activities/components/activity-approval-badge.tsx`
- Modify: `src/features/events/components/metric-card.tsx`
- Modify: list pages only where a colored column/card rail is needed.

**Interfaces:**
- Consumes: existing status values and shadcn variants; no new global state.

- [ ] Add semantic light/dark color variables and a blue primary token.
- [ ] Style active navigation, status badges, metric icon treatments, and Kanban column rails with soft semantic colors.
- [ ] Run component tests, lint, and build.

### Task 5: Browser verification

**Files:**
- Create: `docs/superpowers/verification/assets/agenda-calendar-desktop.png`
- Create: `docs/superpowers/verification/assets/tasks-kanban-desktop.png`
- Create: `docs/superpowers/verification/assets/agenda-calendar-mobile.png`

**Interfaces:**
- Consumes: running Vite app and seeded local data.

- [ ] Open `/agenda`, navigate months, inspect event/task colors and event links.
- [ ] Open `/tasks`, switch to Kanban, inspect all columns, and verify edit/delete controls remain reachable.
- [ ] Check desktop and mobile viewport behavior, console errors, and dark-mode contrast.
- [ ] Run final focused tests, `npm run lint`, and `npm run build`.
