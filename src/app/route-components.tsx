import { isRouteErrorResponse, Link, Outlet, useRouteError } from 'react-router'
import { PageHeader } from '@/components/app/page-header'
import { Button } from '@/components/ui/button'
import { FocusLayout } from './layouts'
import { PwaUpdater } from './pwa'

export function Root() {
  return (
    <>
      <Outlet />
      <PwaUpdater />
    </>
  )
}

export function RouteError() {
  const error = useRouteError()
  const notFound = isRouteErrorResponse(error) && error.status === 404
  return (
    <FocusLayout>
      <h1 className="text-2xl font-semibold tracking-tight">{notFound ? 'Página não encontrada' : 'Algo deu errado'}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {notFound ? 'O endereço não existe.' : 'Recarregue a página. Se continuar, tente de novo em alguns minutos.'}
      </p>
      <div className="mt-6 flex gap-2">
        <Button onClick={() => window.location.reload()}>Recarregar</Button>
        <Button asChild variant="outline">
          <Link to="/">Ir para o painel</Link>
        </Button>
      </div>
    </FocusLayout>
  )
}

export function NotFoundPage() {
  return (
    <>
      <PageHeader title="Página não encontrada" description="Esse endereço não existe no app." />
      <Button asChild variant="outline">
        <Link to="/">Voltar ao painel</Link>
      </Button>
    </>
  )
}
