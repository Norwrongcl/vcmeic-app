# Route-First Records and Activity Approval Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert every core record workflow to dedicated create/detail/edit routes, add compact table/card/Kanban views, and add persistent approval decisions to Activities.

**Architecture:** Extend the versioned Zustand/localStorage domain model first, then build a small shared view-mode control and module-owned list renderers. Route pages own navigation while reusable form bodies own validation and persistence; workflow mutations remain in the central store.

**Tech Stack:** React 19, TypeScript 6, TanStack Router file routes, Zustand, Zod 4, shadcn/Radix UI, Tailwind CSS 4, Vitest Browser Mode.

## Global Constraints

- Activities remain factual records of completed work; approval is not an execution or planning status.
- Web-created Activities default to `source: 'web'` and `approvalStatus: 'approved'`.
- Rejection requires a non-empty reason; approval clears that reason.
- Existing version-1 localStorage snapshots and backups must migrate without data loss.
- Only Activities and Events expose Kanban; other core modules expose Table and Cards.
- Kanban is navigational in this iteration and has no drag-and-drop.
- List rows and cards are real links; list views contain no `Acciones` column.
- Create, detail, and edit use distinct URLs for Activities, Events, Partners, Contacts, Agreements, and Resources.

---

## File Structure

### Shared domain and presentation

- `src/features/core/model/types.ts`: approval/source types and workflow-safe Activity input.
- `src/features/core/model/schema.ts`: v1/v2 snapshot schemas and Activity invariants.
- `src/features/core/model/app-store.ts`: v1 migration and approve/reject actions.
- `src/features/core/model/seed.ts`: version-2 Activity seed fields.
- `src/features/core/model/view-preferences.ts`: validated per-module view preference hook/storage adapter.
- `src/features/core/components/entity-view-switcher.tsx`: accessible Table/Cards/Kanban selector.
- `src/features/core/components/linked-table-row.tsx`: keyboard/mouse row navigation without nested action controls.

### Activities and Events

- `src/features/activities/components/activity-form.tsx`: reusable full-page Activity form body.
- `src/features/activities/components/activity-approval-badge.tsx`: approval label mapping.
- `src/features/activities/components/reject-activity-dialog.tsx`: required rejection reason.
- `src/features/activities/activity-form-page.tsx`: create/edit route surface and navigation.
- `src/features/activities/activities-page.tsx`: compact Table/Cards/Kanban list.
- `src/features/activities/activity-detail-page.tsx`: routed edit plus approve/reject controls.
- `src/features/events/components/event-form.tsx`: reusable Event form body.
- `src/features/events/event-form-page.tsx`: routed create/edit surface.
- `src/features/events/events-page.tsx`: compact Table/Cards/Kanban list.
- `src/features/events/event-detail-page.tsx`: edit navigates to route.

### Directory, Agreements, and Resources

- `src/features/directory/components/partner-form.tsx` and `contact-form.tsx`: reusable form bodies.
- `src/features/directory/partner-form-page.tsx`, `contact-form-page.tsx`, and `contact-detail-page.tsx`: missing route surfaces.
- `src/features/directory/directory-page.tsx`: separate compact Partner/Contact Table/Card lists.
- `src/features/directory/partner-detail-page.tsx`: routed editing.
- `src/features/agreements/components/agreement-form.tsx` and `agreement-form-page.tsx`: routed Agreement form.
- `src/features/agreements/agreements-page.tsx` and `agreement-detail-page.tsx`: compact list and routed editing.
- `src/features/resources/components/resource-form.tsx`, `resource-form-page.tsx`, and `resource-detail-page.tsx`: full Resource route workflow.
- `src/features/resources/resources-page.tsx`: Table/Card list.

### Routes

- Create `new.tsx` and `$entityId.edit.tsx` under each core module route folder.
- Create missing `$contactId.tsx` and `$resourceId.tsx` detail routes.
- Regenerate `src/routeTree.gen.ts` through the TanStack Router Vite plugin.

---

### Task 1: Version-2 Activity Approval Domain

**Files:**
- Modify: `src/features/core/model/types.ts`
- Modify: `src/features/core/model/schema.ts`
- Modify: `src/features/core/model/app-store.ts`
- Modify: `src/features/core/model/seed.ts`
- Test: `src/features/core/model/app-store.test.ts`
- Test: `src/features/core/model/validation.test.ts`

**Interfaces:**
- Produces: `ActivityApprovalStatus`, `ActivitySource`, Activity workflow fields.
- Produces: `approveActivity(id: string): void` and `rejectActivity(id: string, reason: string): boolean`.
- Produces: exported `APP_SCHEMA_VERSION = 2` and v1-to-v2 migration during load/import.

- [ ] **Step 1: Write failing model/store tests**

```ts
it('creates web activities as approved', () => {
  const id = store.getState().addActivity(validActivityInput)
  expect(store.getState().activities[id]).toMatchObject({
    source: 'web', approvalStatus: 'approved', rejectionReason: null,
  })
})

it('rejects only with a non-empty reason and approval clears it', () => {
  const id = store.getState().addActivity(validActivityInput)
  expect(store.getState().rejectActivity(id, '   ')).toBe(false)
  expect(store.getState().rejectActivity(id, 'Falta respaldo')).toBe(true)
  expect(store.getState().activities[id]).toMatchObject({
    approvalStatus: 'rejected', rejectionReason: 'Falta respaldo',
  })
  store.getState().approveActivity(id)
  expect(store.getState().activities[id]).toMatchObject({
    approvalStatus: 'approved', rejectionReason: null,
  })
})

it('migrates version 1 activities to approved web records', () => {
  storage.setItem(APP_STORAGE_KEY, JSON.stringify({ version: 1, data: v1Data }))
  const migrated = createAppStore({ storage }).getState().activities.activity
  expect(migrated).toMatchObject({
    source: 'web', approvalStatus: 'approved', rejectionReason: null,
  })
})
```

- [ ] **Step 2: Run the focused tests and verify expected failures**

Run: `npm test -- src/features/core/model/app-store.test.ts src/features/core/model/validation.test.ts`

Expected: FAIL because workflow fields/actions and v1 migration do not exist.

- [ ] **Step 3: Implement types, schemas, migration, seed data, and actions**

```ts
export type ActivityApprovalStatus = 'pending' | 'approved' | 'rejected'
export type ActivitySource = 'web' | 'whatsapp'
export type Activity = EntityMetadata & ActivityFields & {
  approvalStatus: ActivityApprovalStatus
  source: ActivitySource
  rejectionReason: string | null
}
export type ActivityInput = ActivityFields
```

Use a v1 schema with the former Activity shape, make `appSnapshotSchema` version 2, and migrate every v1 Activity with the three defaults. Make `addActivity` add those defaults before `createRecord`. Trim rejection reasons in `rejectActivity`; return `false` without persisting if empty or missing.

- [ ] **Step 4: Run core model tests**

Run: `npm test -- src/features/core`

Expected: all core feature tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/core/model
git commit -m "feat: add activity approval workflow"
```

### Task 2: Persistent View Modes and Shared Navigation Primitives

**Files:**
- Create: `src/features/core/model/view-preferences.ts`
- Create: `src/features/core/model/view-preferences.test.ts`
- Create: `src/features/core/components/entity-view-switcher.tsx`
- Create: `src/features/core/components/entity-view-switcher.test.tsx`
- Create: `src/features/core/components/linked-table-row.tsx`

**Interfaces:**
- Produces: `type EntityViewMode = 'table' | 'cards' | 'kanban'`.
- Produces: `useEntityViewPreference(module, allowedModes)` returning `[mode, setMode]`.
- Produces: `<EntityViewSwitcher value modes onValueChange />` and `<LinkedTableRow to params />`.

- [ ] **Step 1: Write failing preference and component tests**

```ts
expect(readViewPreference(storage, 'activities', ['table', 'cards', 'kanban']))
  .toBe('table')
writeViewPreference(storage, 'activities', 'cards')
expect(storage.getItem('vcmeic-view-activities')).toBe('cards')
storage.setItem('vcmeic-view-partners', 'kanban')
expect(readViewPreference(storage, 'partners', ['table', 'cards'])).toBe('table')
```

Render the switcher, click `Tarjetas`, and assert `onValueChange('cards')` plus `aria-pressed="true"` on the selected option.

- [ ] **Step 2: Run tests and verify failures**

Run: `npm test -- src/features/core/model/view-preferences.test.ts src/features/core/components/entity-view-switcher.test.tsx`

Expected: FAIL because the files do not exist.

- [ ] **Step 3: Implement validated preferences and accessible controls**

```ts
export const viewPreferenceKey = (module: string) => `vcmeic-view-${module}`
export function readViewPreference(
  storage: StorageLike, module: string, allowed: readonly EntityViewMode[]
): EntityViewMode {
  const saved = storage.getItem(viewPreferenceKey(module)) as EntityViewMode | null
  return saved && allowed.includes(saved) ? saved : 'table'
}
```

Render icon buttons for `Tabla`, `Tarjetas`, and optional `Kanban`, with `aria-label` and `aria-pressed`. `LinkedTableRow` navigates on pointer click and Enter/Space while preserving valid table markup.

- [ ] **Step 4: Run the new tests and lint the shared files**

Run: `npm test -- src/features/core/model/view-preferences.test.ts src/features/core/components/entity-view-switcher.test.tsx && npx eslint src/features/core/model/view-preferences.ts src/features/core/components`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/core/model/view-preferences* src/features/core/components
git commit -m "feat: add persistent entity view modes"
```

### Task 3: Route-First Activities and Approval UI

**Files:**
- Create: `src/features/activities/components/activity-form.tsx`
- Create: `src/features/activities/components/activity-approval-badge.tsx`
- Create: `src/features/activities/components/reject-activity-dialog.tsx`
- Create: `src/features/activities/activity-form-page.tsx`
- Modify: `src/features/activities/activities-page.tsx`
- Modify: `src/features/activities/activity-detail-page.tsx`
- Modify: `src/features/activities/index.ts`
- Create: `src/routes/_authenticated/activities/new.tsx`
- Create: `src/routes/_authenticated/activities/$activityId.edit.tsx`
- Test: `src/features/activities/activities-page.test.tsx`
- Test: `src/features/activities/activity-form-page.test.tsx`
- Test: `src/features/activities/activity-detail-page.test.tsx`

**Interfaces:**
- Consumes: Task 1 approval actions and Task 2 view controls.
- Produces: `ActivityFormPage({ activityId?: string })` and routed list/detail/edit workflow.

- [ ] **Step 1: Write failing Activity route/list/workflow tests**

```ts
expect(screen.queryByText('Acciones')).not.toBeInTheDocument()
await user.click(screen.getByRole('button', { name: 'Kanban' }))
expect(screen.getByRole('heading', { name: 'Por aprobar' })).toBeVisible()
expect(screen.getByRole('heading', { name: 'Aprobadas' })).toBeVisible()
expect(screen.getByRole('heading', { name: 'Rechazadas' })).toBeVisible()
```

Test that submitting the new page calls `addActivity` and navigates to `/activities/$activityId`; submitting edit calls `updateActivity` and preserves approval. Test that rejection blocks an empty reason and displays the stored reason after success.

- [ ] **Step 2: Run Activity tests and verify failures**

Run: `npm test -- src/features/activities`

Expected: FAIL because pages, view switcher usage, and approval controls are missing.

- [ ] **Step 3: Extract the form body and implement route pages**

```tsx
<ActivityForm
  activity={activity}
  submitLabel={activity ? 'Guardar cambios' : 'Registrar actividad'}
  onSubmit={(input) => {
    const id = activity ? activity.id : addActivity(input)
    if (activity) updateActivity(activity.id, input)
    navigate({ to: '/activities/$activityId', params: { activityId: id } })
  }}
/>
```

Add `/activities/new` and `/activities/$activityId/edit`. Replace dialog open-state in list/detail with `Link`s to those routes.

- [ ] **Step 4: Implement compact Table/Cards/Kanban and approval controls**

Use one filtered `rows` array for every renderer. Group Kanban by `approvalStatus`. Detail actions call `approveActivity` or open `RejectActivityDialog`; show `rejectionReason` only when rejected.

- [ ] **Step 5: Run Activity and core tests**

Run: `npm test -- src/features/core src/features/activities`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/activities src/routes/_authenticated/activities src/routeTree.gen.ts
git commit -m "feat: add routed activity review experience"
```

### Task 4: Route-First Events with Table, Cards, and Kanban

**Files:**
- Create: `src/features/events/components/event-form.tsx`
- Create: `src/features/events/event-form-page.tsx`
- Modify: `src/features/events/events-page.tsx`
- Modify: `src/features/events/event-detail-page.tsx`
- Modify: `src/features/events/index.ts`
- Create: `src/routes/_authenticated/events/new.tsx`
- Create: `src/routes/_authenticated/events/$eventId.edit.tsx`
- Test: `src/features/events/events-page.test.tsx`
- Test: `src/features/events/event-form-page.test.tsx`

**Interfaces:**
- Consumes: `useEntityViewPreference` and `EntityViewSwitcher`.
- Produces: `EventFormPage({ eventId?: string })` and Event Kanban grouped by `EventStatus`.

- [ ] **Step 1: Write failing Event view and route tests**

```ts
expect(screen.queryByText('Acciones')).not.toBeInTheDocument()
await user.click(screen.getByRole('button', { name: 'Kanban' }))
for (const label of ['Borrador', 'Planificado', 'En curso', 'Completado', 'Cancelado']) {
  expect(screen.getByRole('heading', { name: label })).toBeVisible()
}
```

Test that a list record link targets `/events/$eventId`, create navigates to the new detail, and detail Editar targets `/events/$eventId/edit`.

- [ ] **Step 2: Run Event tests and verify failures**

Run: `npm test -- src/features/events/events-page.test.tsx src/features/events/event-form-page.test.tsx`

Expected: FAIL because routed forms and list modes are missing.

- [ ] **Step 3: Extract Event form and add routes**

Reuse all fields and validation from `event-form-dialog.tsx`. The page wrapper handles add/update, toast, cancel destination, and navigation to detail.

- [ ] **Step 4: Replace list actions with linked renderers**

Implement compact Table and Cards, plus five fixed Kanban columns keyed by `draft`, `planned`, `in_progress`, `completed`, and `cancelled`. No card mutates status directly.

- [ ] **Step 5: Run Event tests**

Run: `npm test -- src/features/events src/features/core/model/view-preferences.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/events src/routes/_authenticated/events src/routeTree.gen.ts
git commit -m "feat: add routed event views"
```

### Task 5: Route-First Partners and Contacts

**Files:**
- Create: `src/features/directory/components/partner-form.tsx`
- Create: `src/features/directory/components/contact-form.tsx`
- Create: `src/features/directory/partner-form-page.tsx`
- Create: `src/features/directory/contact-form-page.tsx`
- Create: `src/features/directory/contact-detail-page.tsx`
- Modify: `src/features/directory/directory-page.tsx`
- Modify: `src/features/directory/partner-detail-page.tsx`
- Modify: `src/features/directory/index.ts`
- Create: `src/routes/_authenticated/partners/new.tsx`
- Create: `src/routes/_authenticated/partners/$partnerId.edit.tsx`
- Create: `src/routes/_authenticated/contacts/new.tsx`
- Create: `src/routes/_authenticated/contacts/$contactId.tsx`
- Create: `src/routes/_authenticated/contacts/$contactId.edit.tsx`
- Test: `src/features/directory/directory-page.test.tsx`
- Test: `src/features/directory/directory-routes.test.tsx`

**Interfaces:**
- Produces: complete Partner and Contact create/detail/edit route workflows.
- Consumes: Table/Card view preference; does not allow Kanban.

- [ ] **Step 1: Write failing directory tests**

Assert both tabs have only `Tabla` and `Tarjetas`, no `Kanban`, no `Acciones`, and linked rows/cards. Assert create/edit submit to store and navigate to the matching detail URL.

- [ ] **Step 2: Run directory tests and verify failures**

Run: `npm test -- src/features/directory`

Expected: FAIL on missing route pages and current dialog/action controls.

- [ ] **Step 3: Extract Partner/Contact form bodies and create pages**

```tsx
<PartnerForm initialValue={partner} onSubmit={savePartner} onCancel={goBack} />
<ContactForm initialValue={contact} onSubmit={saveContact} onCancel={goBack} />
```

Preserve current field validation and the Partner combobox relationship on Contact.

- [ ] **Step 4: Build Contact detail and simplify directory lists**

Detail shows contact data, linked Partner, and Edit/Delete actions. Both list modes use real detail links and persist independently as `partners` and `contacts` preferences.

- [ ] **Step 5: Run directory tests**

Run: `npm test -- src/features/directory src/features/core/model/view-preferences.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/directory src/routes/_authenticated/partners src/routes/_authenticated/contacts src/routeTree.gen.ts
git commit -m "feat: add routed partner and contact workflows"
```

### Task 6: Route-First Agreements and Resources

**Files:**
- Create: `src/features/agreements/components/agreement-form.tsx`
- Create: `src/features/agreements/agreement-form-page.tsx`
- Modify: `src/features/agreements/agreements-page.tsx`
- Modify: `src/features/agreements/agreement-detail-page.tsx`
- Modify: `src/features/agreements/index.ts`
- Create: `src/routes/_authenticated/agreements/new.tsx`
- Create: `src/routes/_authenticated/agreements/$agreementId.edit.tsx`
- Create: `src/features/resources/components/resource-form.tsx`
- Create: `src/features/resources/resource-form-page.tsx`
- Create: `src/features/resources/resource-detail-page.tsx`
- Modify: `src/features/resources/resources-page.tsx`
- Modify: `src/features/resources/index.ts`
- Create: `src/routes/_authenticated/resources/new.tsx`
- Create: `src/routes/_authenticated/resources/$resourceId.tsx`
- Create: `src/routes/_authenticated/resources/$resourceId.edit.tsx`
- Test: `src/features/agreements/agreements-page.test.tsx`
- Test: `src/features/resources/resources-page.test.tsx`
- Test: `src/features/resources/resource-routes.test.tsx`

**Interfaces:**
- Produces: complete Agreement and Resource create/detail/edit route workflows.
- Consumes: only Table/Card view modes.

- [ ] **Step 1: Write failing list and route tests**

Assert no `Acciones` header, only Table/Cards controls, correct detail links, and correct create/edit navigation. Resource deletion happens only in detail; Agreement deletion remains only in detail.

- [ ] **Step 2: Run focused tests and verify failures**

Run: `npm test -- src/features/agreements src/features/resources`

Expected: FAIL because routed forms/detail and list modes are incomplete.

- [ ] **Step 3: Extract forms and add page routes**

Preserve Agreement relationship validation and Resource category/quantity validation. New saves navigate to detail; edits return to detail; cancel follows the route contract.

- [ ] **Step 4: Implement compact linked Table/Card lists**

Agreement list retains computed temporal status as its recognition badge. Resource list displays category and quantity. Neither renderer includes inline mutation controls.

- [ ] **Step 5: Run Agreement and Resource tests**

Run: `npm test -- src/features/agreements src/features/resources src/features/core/model/selectors.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/agreements src/features/resources src/routes/_authenticated/agreements src/routes/_authenticated/resources src/routeTree.gen.ts
git commit -m "feat: add routed agreement and resource workflows"
```

### Task 7: Cross-Module Integration and Regression Cleanup

**Files:**
- Modify: `src/features/home/home-page.tsx`
- Modify: `src/features/agenda/agenda-page.tsx` if route typing requires it.
- Modify: `src/routeTree.gen.ts` through generation.
- Test: all touched feature tests.

**Interfaces:**
- Consumes: all route contracts from Tasks 3-6.
- Produces: type-safe links throughout the app and a buildable route tree.

- [ ] **Step 1: Run TypeScript/build to expose stale route or Activity-shape consumers**

Run: `npm run build`

Expected: FAIL only on stale Activity fixtures, removed dialogs, or newly generated route typing.

- [ ] **Step 2: Update every stale Activity fixture and navigation target**

Add the approved web defaults to static Activity objects and point create/edit calls to the dedicated routes. Remove unused dialog imports and state from all touched modules.

- [ ] **Step 3: Regenerate routes and run build**

Run: `npm run build`

Expected: PASS; TanStack Router updates `src/routeTree.gen.ts` with all new routes.

- [ ] **Step 4: Run scoped regression suite and lint**

Run: `npm test -- src/features/core src/features/activities src/features/events src/features/directory src/features/agreements src/features/resources && npm run lint`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src
git commit -m "test: verify route-first record workflows"
```

### Task 8: Browser Verification and Handoff Evidence

**Files:**
- Modify: `docs/superpowers/verification/2026-08-09-route-first-records.md`
- Create: `docs/superpowers/verification/assets/route-first-activities-desktop.png`
- Create: `docs/superpowers/verification/assets/route-first-activities-mobile.png`
- Create: `docs/superpowers/verification/assets/route-first-events-kanban.png`

**Interfaces:**
- Produces: reproducible QA record and screenshots for the finished feature.

- [ ] **Step 1: Start the app and verify direct route workflows**

Run: `npm run dev -- --host 127.0.0.1`

Verify create → detail → edit → detail for all six modules, including direct reload on detail/edit URLs.

- [ ] **Step 2: Verify Activity decisions and persistence**

Create an Activity and confirm it is approved. Reject it with `Falta respaldo`, reload, confirm the reason persists, approve it, reload, and confirm the reason is cleared.

- [ ] **Step 3: Verify every list mode and responsive behavior**

Check Activity and Event Table/Cards/Kanban; check the other four modules in Table/Cards. Verify no `Acciones` columns, no global horizontal overflow at 390×844, and intentional horizontal Kanban scrolling.

- [ ] **Step 4: Record evidence and rerun final checks**

Document the URLs, viewport sizes, interaction results, screenshots, scoped test count, lint, and build outcome. Run:

```bash
npm test -- src/features/core src/features/activities src/features/events src/features/directory src/features/agreements src/features/resources
npm run lint
npm run build
```

- [ ] **Step 5: Commit verification evidence**

```bash
git add docs/superpowers/verification
git commit -m "docs: verify route-first record experience"
```

