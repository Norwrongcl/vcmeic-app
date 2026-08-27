# VcM Local-First MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved VcM MVP sections on one versioned, relational `localStorage` model while preserving the existing application shell and Events functionality.

**Architecture:** A Zustand vanilla store owns a normalized `AppData` snapshot and all mutations. Feature pages consume shared selectors and CRUD actions; entity references use ids. The loader validates JSON with Zod, migrates the existing Events v1 snapshot, and supports import/export/reset.

**Tech Stack:** React 19, TypeScript 6, Vite 8, TanStack Router, Zustand 5, Zod 4, Shadcn/Radix, Tailwind CSS 4, Vitest Browser/Playwright.

## Global Constraints

- Persist MVP data in one versioned `localStorage` snapshot.
- An Activity is a completed punctual record with no status or workflow.
- Every Activity and Event has exactly one primary VcM line and no subtype or ámbito.
- An Activity has one Contact responsible; an Event has one Contact coordinator.
- Event tasks may have multiple Contact assignees and belong to pre, during, or post.
- Evidence stores only `name` and `url`; no file upload or S3 integration.
- Participants are stored as one non-negative integer total without group breakdown.
- Events remain Events after execution and never generate Activity records.
- Preserve the existing visual language and responsive application shell.
- Keep pre-existing `tmp/` content outside commits.

---

### Task 1: Central domain model, validation, storage, and migration

**Files:**
- Create: `src/features/core/model/types.ts`
- Create: `src/features/core/model/catalogs.ts`
- Create: `src/features/core/model/schema.ts`
- Create: `src/features/core/model/seed.ts`
- Create: `src/features/core/model/app-store.ts`
- Test: `src/features/core/model/app-store.test.ts`
- Modify: `src/features/events/model/events-store.ts`
- Modify: `src/features/events/model/types.ts`

**Interfaces:**
- Produces: `AppData`, entity/input types, `VCM_LINES`, `createAppStore(options)`, `appStore`, `useAppStore(selector)`, `APP_STORAGE_KEY`, `exportSnapshot()`, `importSnapshot(raw)`, and `resetData()`.
- Preserves: `useEventsStore` as an alias around the central store so current Events screens continue compiling during migration.

- [ ] **Step 1: Write failing storage and migration tests**

```ts
it('persists related entities in one versioned snapshot', () => {
  const storage = createMemoryStorage()
  const store = createAppStore({ storage, idFactory: ids(), nowFactory: now })
  const contactId = store.getState().addContact(contactInput)
  store.getState().addActivity({ ...activityInput, responsibleContactId: contactId })
  expect(JSON.parse(storage.getItem(APP_STORAGE_KEY)!)).toMatchObject({
    version: 1,
    data: { contacts: { [contactId]: contactInputWithMetadata } },
  })
})

it('migrates contenthub-events-v1 owner and assignee names into contacts', () => {
  const storage = storageWithLegacyEvents()
  const state = createAppStore({ storage }).getState()
  expect(Object.values(state.contacts).map((item) => item.name)).toContain('Ana Pérez')
  expect(Object.values(state.events)[0].coordinatorContactId).toBeTruthy()
})
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm test -- src/features/core/model/app-store.test.ts`

Expected: FAIL because the central model and store do not exist.

- [ ] **Step 3: Implement normalized types, fixed catalogs, Zod snapshot schema, seeds, actions, import/export/reset, and legacy migration**

```ts
export type AppData = {
  activities: Record<string, Activity>
  events: Record<string, Event>
  tasks: Record<string, EventTask>
  budgetItems: Record<string, BudgetItem>
  expenses: Record<string, Expense>
  partners: Record<string, Partner>
  contacts: Record<string, Contact>
  agreements: Record<string, Agreement>
  resources: Record<string, Resource>
}

export const APP_STORAGE_KEY = 'vcmeic-mvp-v1'
export const APP_SCHEMA_VERSION = 1
```

The store must clone seeded data, validate persisted data, persist after every mutation, reject invalid imports without overwriting current state, cascade safe child records, and expose a dismissible storage warning.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `npm test -- src/features/core/model/app-store.test.ts src/features/events/model/events-store.test.ts`

Expected: all focused storage tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/features/core src/features/events/model
git commit -m "feat: add centralized local VcM data store"
```

### Task 2: Shared selectors and form validation

**Files:**
- Create: `src/features/core/model/selectors.ts`
- Create: `src/features/core/model/validation.ts`
- Test: `src/features/core/model/selectors.test.ts`
- Test: `src/features/core/model/validation.test.ts`
- Modify: `src/features/events/model/selectors.ts`
- Modify: `src/features/events/model/validation.ts`

**Interfaces:**
- Consumes: `AppData` and input types from Task 1.
- Produces: `getContactName`, `getPartnerName`, `getActivityDeletionImpact`, `getPartnerDeletionImpact`, `getAgendaItems`, `getDashboardMetrics`, `getReportMetrics`, `validateActivity`, `validateContact`, `validatePartner`, `validateAgreement`, `validateResource`, and expanded Event/task validation.

- [ ] **Step 1: Write failing selector and validation tests**

```ts
it('counts an executed event only in event report totals', () => {
  const metrics = getReportMetrics(dataWithActivityAndCompletedEvent)
  expect(metrics.activities).toBe(1)
  expect(metrics.completedEvents).toBe(1)
  expect(metrics.participants).toBe(75)
})

it('rejects a future activity end date', () => {
  expect(validateActivity(futureActivity, new Date('2026-08-08T12:00:00Z')))
    .toMatchObject({ endsAt: 'La actividad debe haber finalizado.' })
})
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `npm test -- src/features/core/model/selectors.test.ts src/features/core/model/validation.test.ts`

Expected: FAIL because selectors and validation functions are absent.

- [ ] **Step 3: Implement derived data and business validation**

Agenda items must be sorted ascending and include `event-start`, `event-end`, and `task-due`. Report participants equal Activity totals plus completed Event closure totals. Agreement temporal status derives from dates unless cancelled. Activity validation enforces nonempty name, line, responsible contact, start/end ordering, past completion, integer participants, and valid evidence URLs.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `npm test -- src/features/core/model/selectors.test.ts src/features/core/model/validation.test.ts src/features/events/model/validation.test.ts`

Expected: all selector and validation tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/features/core/model src/features/events/model
git commit -m "feat: add VcM selectors and domain validation"
```

### Task 3: Socios and Contactos catalogs

**Files:**
- Create: `src/features/directory/directory-page.tsx`
- Create: `src/features/directory/partner-detail-page.tsx`
- Create: `src/features/directory/components/partner-form-dialog.tsx`
- Create: `src/features/directory/components/contact-form-dialog.tsx`
- Create: `src/features/directory/components/contact-combobox.tsx`
- Create: `src/features/directory/components/partner-combobox.tsx`
- Create: `src/features/directory/index.ts`
- Test: `src/features/directory/directory-page.test.tsx`
- Create: `src/routes/_authenticated/contacts/index.tsx`
- Modify: `src/routes/_authenticated/partners/index.tsx`
- Modify: `src/routes/_authenticated/partners/$partnerId.tsx`

**Interfaces:**
- Consumes: partner/contact records and CRUD actions from `useAppStore`.
- Produces: reusable `ContactCombobox` and `PartnerCombobox` accepting selected ids, change callback, and inline creation.

- [ ] **Step 1: Write a failing interaction test**

```tsx
it('creates a contact and links it to the selected partner', async () => {
  render(<DirectoryPage entity='contacts' />)
  await userEvent.click(screen.getByRole('button', { name: 'Nuevo contacto' }))
  await userEvent.type(screen.getByLabelText('Nombre'), 'Camila Soto')
  await userEvent.click(screen.getByRole('button', { name: 'Guardar contacto' }))
  expect(screen.getByText('Camila Soto')).toBeVisible()
})
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm test -- src/features/directory/directory-page.test.tsx`

Expected: FAIL because the directory page is absent.

- [ ] **Step 3: Implement responsive directory lists, dialogs, detail, filtering, deletion impact, and comboboxes**

Desktop uses a table; narrow screens use readable stacked rows. Empty states expose the primary create action. Deleting a referenced partner/contact must explain its impact and either clear optional references or block deletion for required responsible references.

- [ ] **Step 4: Run the feature test and build check**

Run: `npm test -- src/features/directory/directory-page.test.tsx && npx tsc -b --pretty false`

Expected: test and TypeScript pass after route generation.

- [ ] **Step 5: Commit**

```bash
git add src/features/directory src/routes/_authenticated/contacts src/routes/_authenticated/partners
git commit -m "feat: build partner and contact directories"
```

### Task 4: Activities workflow

**Files:**
- Create: `src/features/activities/activities-page.tsx`
- Create: `src/features/activities/activity-detail-page.tsx`
- Create: `src/features/activities/components/activity-form-dialog.tsx`
- Create: `src/features/activities/components/evidence-fields.tsx`
- Create: `src/features/activities/index.ts`
- Test: `src/features/activities/activity-form-dialog.test.tsx`
- Modify: `src/routes/_authenticated/activities/index.tsx`
- Modify: `src/routes/_authenticated/activities/$activityId.tsx`

**Interfaces:**
- Consumes: Activity CRUD, fixed VcM lines, Contact/Partner comboboxes, and `validateActivity`.
- Produces: searchable/filterable Activity page and complete Activity detail page.

- [ ] **Step 1: Write failing form behavior tests**

```tsx
it('saves a completed activity with one responsible and evidence link', async () => {
  render(<ActivityFormDialog open onOpenChange={() => undefined} />)
  await fillRequiredActivityFields()
  await userEvent.type(screen.getByLabelText('Nombre de la evidencia'), 'Lista de asistencia')
  await userEvent.type(screen.getByLabelText('Enlace de la evidencia'), 'https://example.org/lista')
  await userEvent.click(screen.getByRole('button', { name: 'Guardar actividad' }))
  expect(screen.queryByText('La actividad debe haber finalizado.')).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm test -- src/features/activities/activity-form-dialog.test.tsx`

Expected: FAIL because the Activity form does not exist.

- [ ] **Step 3: Implement create/edit dialog, evidence rows, list filters, detail, and confirmed deletion**

Filters include text, VcM line, responsible contact, partner, and date range. The detail renders factual data without a status badge. Add/remove evidence rows preserve at least zero rows and validate each nonempty row as a complete name/URL pair.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `npm test -- src/features/activities/activity-form-dialog.test.tsx src/features/core/model/validation.test.ts`

Expected: all Activity tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/features/activities src/routes/_authenticated/activities
git commit -m "feat: implement completed activity records"
```

### Task 5: Event lifecycle, contact assignments, and post-event closure

**Files:**
- Modify: `src/features/events/model/types.ts`
- Modify: `src/features/events/model/seed.ts`
- Modify: `src/features/events/model/validation.ts`
- Modify: `src/features/events/components/event-form-dialog.tsx`
- Modify: `src/features/events/components/task-form-dialog.tsx`
- Modify: `src/features/events/components/event-tasks.tsx`
- Create: `src/features/events/components/event-closure-form.tsx`
- Modify: `src/features/events/event-detail-page.tsx`
- Modify: `src/features/events/events-page.tsx`
- Modify: `src/features/events/global-tasks-page.tsx`
- Test: `src/features/events/components/event-form-dialog.test.tsx`
- Test: `src/features/events/model/events-store.test.ts`

**Interfaces:**
- Consumes: central Contact/Partner relations and evidence shape.
- Produces: `EventTask.phase`, `EventTask.assigneeContactIds`, `Event.coordinatorContactId`, `Event.partnerIds`, `Event.vcmLine`, and Event closure fields.

- [ ] **Step 1: Extend existing tests before production changes**

```ts
it('stores task phase and multiple contact assignees', () => {
  const taskId = store.getState().addTask({
    ...taskInput,
    phase: 'pre',
    assigneeContactIds: ['contact-1', 'contact-2'],
  })
  expect(store.getState().tasks[taskId].assigneeContactIds).toHaveLength(2)
})

it('requires post-event closure before completed status', () => {
  expect(validateEvent(completedEventWithoutClosure)).toMatchObject({
    participantCount: 'Registra la cantidad de participantes para finalizar.',
  })
})
```

- [ ] **Step 2: Run focused Events tests and verify RED**

Run: `npm test -- src/features/events/model/events-store.test.ts src/features/events/components/event-form-dialog.test.tsx`

Expected: FAIL on missing lifecycle fields and contact assignment behavior.

- [ ] **Step 3: Implement lifecycle tabs, task phases, multi-contact assignment, coordinator/partners/line selection, and closure form**

The detail tabs become Resumen, Pre-evento, Durante, Post-evento, and Presupuesto y gastos. Each phase shows only its tasks. Post-evento includes closure facts and evidence. Existing financial calculations remain unchanged.

- [ ] **Step 4: Run Events regression suite and verify GREEN**

Run: `npm test -- src/features/events`

Expected: all Events tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/features/events
git commit -m "feat: add complete event lifecycle"
```

### Task 6: Convenios and Recursos

**Files:**
- Create: `src/features/agreements/agreements-page.tsx`
- Create: `src/features/agreements/agreement-detail-page.tsx`
- Create: `src/features/agreements/components/agreement-form-dialog.tsx`
- Create: `src/features/agreements/index.ts`
- Create: `src/features/resources/resources-page.tsx`
- Create: `src/features/resources/components/resource-form-dialog.tsx`
- Create: `src/features/resources/index.ts`
- Test: `src/features/agreements/agreements-page.test.tsx`
- Test: `src/features/resources/resources-page.test.tsx`
- Modify: `src/routes/_authenticated/agreements/index.tsx`
- Modify: `src/routes/_authenticated/agreements/$agreementId.tsx`
- Modify: `src/routes/_authenticated/resources/index.tsx`

**Interfaces:**
- Consumes: Partner/Contact comboboxes, agreement/resource CRUD, temporal agreement selector.
- Produces: searchable agreement registry with detail and a resource catalog with category/availability filters.

- [ ] **Step 1: Write failing CRUD tests**

```tsx
it('shows agreement validity derived from its dates', () => {
  render(<AgreementsPage now={new Date('2026-08-08')} />)
  expect(screen.getByText('Vigente')).toBeVisible()
})

it('creates a reusable equipment resource', async () => {
  render(<ResourcesPage />)
  await createResource({ name: 'Proyector', category: 'equipment', quantity: 2 })
  expect(screen.getByText('Proyector')).toBeVisible()
})
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- src/features/agreements/agreements-page.test.tsx src/features/resources/resources-page.test.tsx`

Expected: FAIL because both feature modules are absent.

- [ ] **Step 3: Implement both registries, forms, filters, details, and delete confirmations**

Agreement document links open safely with `rel="noreferrer"`. Resource quantity is a non-negative integer. Both surfaces use the shared empty-state and responsive table conventions.

- [ ] **Step 4: Run tests and verify GREEN**

Run: `npm test -- src/features/agreements src/features/resources`

Expected: all Convenios and Recursos tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/features/agreements src/features/resources src/routes/_authenticated/agreements src/routes/_authenticated/resources
git commit -m "feat: implement agreements and resources"
```

### Task 7: Dashboard, Agenda, Reportes, Configuración, and navigation

**Files:**
- Create: `src/features/home/home-page.tsx`
- Create: `src/features/agenda/agenda-page.tsx`
- Create: `src/features/reports/reports-page.tsx`
- Create: `src/features/settings/local-data-settings.tsx`
- Test: `src/features/agenda/agenda-page.test.tsx`
- Test: `src/features/settings/local-data-settings.test.tsx`
- Modify: `src/features/settings/index.tsx`
- Modify: `src/routes/_authenticated/index.tsx`
- Modify: `src/routes/_authenticated/agenda/index.tsx`
- Modify: `src/routes/_authenticated/reports/index.tsx`
- Modify: `src/components/layout/data/sidebar-data.ts`
- Modify: `src/components/command-menu.tsx`

**Interfaces:**
- Consumes: dashboard/report/agenda selectors and store backup actions.
- Produces: complete cross-module overview, chronological agenda, KPI reports, and JSON backup/restore controls.

- [ ] **Step 1: Write failing Agenda and import/export tests**

```tsx
it('orders event dates and task deadlines chronologically', () => {
  render(<AgendaPage />)
  const items = screen.getAllByTestId('agenda-item')
  expect(items.map((item) => item.textContent)).toEqual(expectedChronology)
})

it('does not replace current data when import JSON is invalid', async () => {
  render(<LocalDataSettings />)
  await uploadText('{invalid')
  expect(screen.getByText('El archivo no contiene un respaldo válido.')).toBeVisible()
  expect(appStore.getState().contacts).toEqual(originalContacts)
})
```

- [ ] **Step 2: Run tests and verify RED**

Run: `npm test -- src/features/agenda/agenda-page.test.tsx src/features/settings/local-data-settings.test.tsx`

Expected: FAIL because the screens are absent.

- [ ] **Step 3: Implement pages, charts, backup controls, and complete navigation**

Dashboard cards link to their source section. Agenda filters by item kind and date. Report charts use Recharts and the fixed line labels. Settings downloads a timestamped `.json`, imports through a hidden file input, and confirms reset. Sidebar adds Contactos and Recursos, removes template Conexiones, and uses VcM-branded static account text without implying authentication.

- [ ] **Step 4: Generate the route tree and run focused tests**

Run: `npx vite build && npm test -- src/features/agenda src/features/settings src/features/core/model/selectors.test.ts`

Expected: route generation/build and focused tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/features/home src/features/agenda src/features/reports src/features/settings src/routes/_authenticated src/components/layout/data/sidebar-data.ts src/components/command-menu.tsx src/routeTree.gen.ts
git commit -m "feat: complete VcM overview and operations"
```

### Task 8: Integration verification and responsive QA

**Files:**
- Modify: files identified by verification failures only within the MVP scope.
- Create: `docs/superpowers/verification/2026-08-08-vcmeic-mvp.md`

**Interfaces:**
- Consumes: all feature routes and core workflows.
- Produces: evidence that persistence, routing, CRUD, event lifecycle, reporting, and responsive layouts work together.

- [ ] **Step 1: Run automated verification**

Run: `npm test -- src/features/core src/features/events src/features/activities src/features/directory src/features/agreements src/features/resources src/features/agenda src/features/settings`

Expected: all MVP-focused tests pass.

Run: `npm run build && npm run lint && npm run format:check`

Expected: build, lint, and formatting pass. If format check finds only MVP files, run `npm run format -- <listed MVP files>` and re-run the checks.

- [ ] **Step 2: Run the app and verify core desktop workflows**

Run: `npm run dev -- --host 127.0.0.1`

Use Browser/IAB at desktop size to create a Socio, create a Contact linked to it, create a completed Activity with evidence, create an Event, assign staged tasks, record a post-event closure, and confirm Dashboard/Agenda/Reports update.

- [ ] **Step 3: Verify persistence and backup**

Reload the browser and confirm created records remain. Export JSON, change a record, import the backup, and confirm the exported state is restored. Import invalid JSON and confirm current data remains intact.

- [ ] **Step 4: Verify responsive layouts and record the fidelity ledger**

At a mobile-sized viewport, inspect sidebar navigation, tables/rows, dialogs, Activity form, Event tabs, Agenda, and charts. Record at least five checks covering hierarchy, typography, palette, spacing/container model, icons, and mobile behavior in the verification document. The reference is the existing Events visual system rather than a new design concept.

- [ ] **Step 5: Commit verification fixes and evidence**

```bash
git add src docs/superpowers/verification/2026-08-08-vcmeic-mvp.md
git commit -m "test: verify local-first VcM MVP"
```
