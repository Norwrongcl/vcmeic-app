import { Header } from '@/components/layout/header'
import { Main } from '@/components/layout/main'
import { ProfileDropdown } from '@/components/profile-dropdown'
import { Search } from '@/components/search'
import { ThemeSwitch } from '@/components/theme-switch'

type ContentHubPlaceholderProps = {
  title: string
}

export function ContentHubPlaceholder({ title }: ContentHubPlaceholderProps) {
  return (
    <>
      <Header>
        <Search className='me-auto' />
        <ThemeSwitch />
        <ProfileDropdown />
      </Header>

      <Main>
        <div className='mb-2 flex items-center justify-between gap-2'>
          <h1 className='text-2xl font-bold tracking-tight'>{title}</h1>
        </div>
        <p className='text-muted-foreground'>
          Esta sección se preparará en una siguiente etapa.
        </p>
      </Main>
    </>
  )
}
