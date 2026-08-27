import { expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-react'
import { userEvent } from 'vitest/browser'
import { ActivityApprovalBadge } from './components/activity-approval-badge'
import { RejectActivityDialog } from './components/reject-activity-dialog'

it('shows the three activity approval labels', async () => {
  const screen = await render(
    <div>
      <ActivityApprovalBadge status='pending' />
      <ActivityApprovalBadge status='approved' />
      <ActivityApprovalBadge status='rejected' />
    </div>
  )

  await expect.element(screen.getByText('Por aprobar')).toBeInTheDocument()
  await expect.element(screen.getByText('Aprobada')).toBeInTheDocument()
  await expect.element(screen.getByText('Rechazada')).toBeInTheDocument()
})

it('requires and trims a reason before confirming rejection', async () => {
  const onConfirm = vi.fn()
  const screen = await render(
    <RejectActivityDialog open onOpenChange={vi.fn()} onConfirm={onConfirm} />
  )

  await userEvent.click(
    screen.getByRole('button', { name: 'Rechazar actividad' })
  )
  await expect
    .element(screen.getByText('Ingresa el motivo del rechazo.'))
    .toBeInTheDocument()
  expect(onConfirm).not.toHaveBeenCalled()

  await userEvent.fill(
    screen.getByLabelText('Motivo del rechazo'),
    '  Falta respaldo  '
  )
  await userEvent.click(
    screen.getByRole('button', { name: 'Rechazar actividad' })
  )

  expect(onConfirm).toHaveBeenCalledWith('Falta respaldo')
})
