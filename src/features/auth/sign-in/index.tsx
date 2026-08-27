import { useSearch } from '@tanstack/react-router'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AuthLayout } from '../auth-layout'
import { UserAuthForm } from './components/user-auth-form'

export function SignIn() {
  const { redirect } = useSearch({ from: '/(auth)/sign-in' })

  return (
    <AuthLayout>
      <Card className='w-[min(92vw,28rem)] gap-6 p-2 sm:p-4'>
        <CardHeader>
          <CardTitle className='text-xl tracking-tight'>
            Iniciar sesión
          </CardTitle>
          <p className='text-sm text-muted-foreground'>
            Gestiona iniciativas, relaciones e impacto desde un solo lugar.
          </p>
        </CardHeader>
        <CardContent>
          <UserAuthForm redirectTo={redirect} />
        </CardContent>
      </Card>
    </AuthLayout>
  )
}
