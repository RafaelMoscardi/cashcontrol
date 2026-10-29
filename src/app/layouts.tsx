import type * as React from 'react'
import { Outlet, ScrollRestoration } from 'react-router'
import { Logo } from '@/components/app/logo'
import { BottomNav, Sidebar } from './navigation'

/** Telas logadas: barra lateral no desktop, barra inferior no celular. */
export function AppLayout() {
  return (
    <div className="app-glow min-h-dvh lg:pl-64">
      <Sidebar className="hidden lg:flex" />
      <main className="mx-auto w-full max-w-5xl px-4 pb-[calc(var(--bottom-nav-h)+var(--safe-bottom)+2.5rem)] sm:px-6 lg:px-10 lg:pb-16">
        <Outlet />
      </main>
      <BottomNav className="lg:hidden" />
      <ScrollRestoration />
    </div>
  )
}

/** Telas sem navegação (login, primeiro acesso): conteúdo centrado e estreito. */
export function FocusLayout({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="app-glow flex min-h-dvh flex-col px-4 pt-[calc(var(--safe-top)+1.5rem)] pb-[calc(var(--safe-bottom)+2rem)] sm:px-6">
      <header className="mx-auto mb-8 flex w-full max-w-5xl items-center justify-between">
        <Logo />
      </header>
      <main className={wide ? 'mx-auto w-full max-w-2xl' : 'mx-auto w-full max-w-sm'}>{children}</main>
    </div>
  )
}
