import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'
import { useAppStore } from '@/features/core/model/app-store'
import { AgreementForm } from './components/agreement-form'

export function AgreementFormPage({ agreementId }: { agreementId?: string }) {
  const navigate = useNavigate()
  const agreement = useAppStore((state) =>
    agreementId ? state.agreements[agreementId] : undefined
  )
  const addAgreement = useAppStore((state) => state.addAgreement)
  const updateAgreement = useAppStore((state) => state.updateAgreement)
  if (agreementId && !agreement)
    return (
      <>
        <Header>
          <Search className='me-auto' />
          <ThemeSwitch />
          <ProfileDropdown />
        </Header>
        <Main>
          <Empty className='min-h-96 border'>
            <EmptyHeader>
              <EmptyMedia variant='icon'>
                <FileText />
              </EmptyMedia>
              <EmptyTitle>Convenio no encontrado</EmptyTitle>
              <EmptyDescription>
                No es posible editar un registro que no existe.
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button asChild>
                <Link to='/agreements'>Volver a convenios</Link>
              </Button>
            </EmptyContent>
          </Empty>
        </Main>
      </>
    )
  const cancel = () =>
    agreement
      ? navigate({
          to: '/agreements/$agreementId',
          params: { agreementId: agreement.id },
        })
      : navigate({ to: '/agreements' })
  return (
    <>
      <Header fixed>
        <Search className='me-auto' />
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>
      <Main className='mx-auto flex w-full max-w-4xl flex-col gap-6'>
        <Button
          variant='ghost'
          className='w-fit px-0 hover:bg-transparent'
          onClick={cancel}
        >
          <ArrowLeft data-icon='inline-start' /> Volver
        </Button>
        <div>
          <h1 className='text-2xl font-bold tracking-tight'>
            {agreement ? 'Editar convenio' : 'Nuevo convenio'}
          </h1>
          <p className='text-muted-foreground'>
            Relaciona el acuerdo con una organización del catálogo de Socios.
          </p>
        </div>
        <Card>
          <CardContent className='pt-6'>
            <AgreementForm
              agreement={agreement}
              onCancel={cancel}
              onSubmit={(input) => {
                const id = agreement?.id ?? addAgreement(input)
                if (agreement) updateAgreement(agreement.id, input)
                toast.success(
                  agreement ? 'Convenio actualizado.' : 'Convenio creado.'
                )
                navigate({
                  to: '/agreements/$agreementId',
                  params: { agreementId: id },
                })
              }}
            />
          </CardContent>
        </Card>
      </Main>
    </>
  )
}
