import { Car, CircleEllipsis, LayoutDashboard, ListChecks, LogOut, Plus, Store } from 'lucide-react'
import type { ComponentType } from 'react'
import { NavLink, Link } from 'react-router'
import { Logo } from '@/components/app/logo'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/features/auth/auth-context'
import { cn } from '@/lib/utils'

interface NavItem {
  to: string
  label: string
  icon: ComponentType<{ className?: string }>
  end?: boolean
}

const MAIN_ITEMS: NavItem[] = [
  { to: '/', label: 'Painel', icon: LayoutDashboard, end: true },
  { to: '/jornadas', label: 'Jornadas', icon: ListChecks },
  { to: '/veiculos', label: 'Veículos', icon: Car },
  { to: '/mais', label: 'Mais', icon: CircleEllipsis },
]

/** Barra inferior flutuante (celular): 4 destinos + botão central de registrar. */
export function BottomNav({ className }: { className?: string }) {
  const [first, second, third, fourth] = MAIN_ITEMS as [NavItem, NavItem, NavItem, NavItem]
  return (
    <nav
      aria-label="Navegação principal"
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(var(--safe-bottom)+0.625rem)]',
        // véu escuro para o conteúdo não brigar com a barra
        'before:pointer-events-none before:absolute before:inset-x-0 before:bottom-0 before:h-28 before:bg-gradient-to-t before:from-background before:via-background/80 before:to-transparent',
        className,
      )}
    >
      <div className="relative mx-auto grid h-(--bottom-nav-h) max-w-md grid-cols-5 items-center rounded-[1.75rem] border border-white/[0.07] bg-[#15141c]/90 px-1.5 shadow-[0_18px_40px_-18px_rgb(0_0_0/0.9),inset_0_1px_0_rgb(255_255_255/0.04)] backdrop-blur-xl">
        <BottomNavLink item={first} />
        <BottomNavLink item={second} />
        <div className="flex justify-center">
          <Link
            to="/jornadas/nova"
            aria-label="Registrar jornada"
            className="grid size-14 -translate-y-3 place-items-center rounded-full bg-gradient-to-b from-[#9d75ff] to-primary-strong text-white shadow-[0_12px_28px_-10px_rgb(124_58_237/0.95),inset_0_1px_0_rgb(255_255_255/0.25)] ring-4 ring-background transition-transform duration-150 ease-snappy outline-none select-none focus-visible:ring-ring active:scale-[0.94]"
          >
            <Plus className="size-6" strokeWidth={2.5} />
          </Link>
        </div>
        <BottomNavLink item={third} />
        <BottomNavLink item={fourth} />
      </div>
    </nav>
  )
}

function BottomNavLink({ item }: { item: NavItem }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          'group flex h-full flex-col items-center justify-center gap-1 rounded-2xl text-[0.6875rem] font-medium outline-none select-none',
          'transition-colors duration-150 focus-visible:bg-white/5',
          isActive ? 'text-foreground' : 'text-faint',
        )
      }
    >
      {({ isActive }) => (
        <>
          <span
            className={cn(
              'grid h-7 w-12 place-items-center rounded-full transition-[background-color,transform] duration-150 ease-snappy group-active:scale-[0.92]',
              isActive && 'bg-primary/18 text-primary',
            )}
          >
            <Icon className="size-5" />
          </span>
          {item.label}
        </>
      )}
    </NavLink>
  )
}

const SIDEBAR_ITEMS: NavItem[] = [
  { to: '/', label: 'Painel', icon: LayoutDashboard, end: true },
  { to: '/jornadas', label: 'Jornadas', icon: ListChecks },
  { to: '/veiculos', label: 'Veículos', icon: Car },
  { to: '/plataformas', label: 'Plataformas', icon: Store },
  { to: '/mais', label: 'Conta e app', icon: CircleEllipsis },
]

/** Barra lateral (desktop). */
export function Sidebar({ className }: { className?: string }) {
  const { user, signOut } = useAuth()
  return (
    <aside className={cn('fixed inset-y-0 left-0 z-30 w-64 flex-col border-r border-sidebar-border bg-sidebar px-4 py-6', className)}>
      <Link to="/" className="mb-8 px-2 outline-none">
        <Logo />
      </Link>
      <Button asChild className="mb-6 w-full">
        <Link to="/jornadas/nova">
          <Plus data-icon="inline-start" />
          Registrar jornada
        </Link>
      </Button>
      <nav aria-label="Navegação principal" className="flex flex-col gap-1">
        {SIDEBAR_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium outline-none transition-colors duration-150',
                'hover:bg-white/[0.04] hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50',
                isActive ? 'bg-primary/14 text-foreground' : 'text-muted-foreground',
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon className={cn('size-[1.125rem]', isActive && 'text-primary')} />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto rounded-2xl border border-white/[0.06] bg-card/60 p-3">
        <p className="truncate text-xs text-muted-foreground" title={user?.email ?? ''}>
          {user?.email}
        </p>
        <Button variant="ghost" size="sm" className="mt-2 -ml-2 text-muted-foreground" onClick={() => void signOut()}>
          <LogOut data-icon="inline-start" />
          Sair
        </Button>
      </div>
    </aside>
  )
}
