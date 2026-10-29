import { createBrowserRouter } from 'react-router'
import { LoadingScreen } from '@/components/app/loading-screen'
import { ForgotPasswordPage, LoginPage, ResetPasswordPage, SignupPage } from '@/features/auth/pages'
import { PublicOnly, RequireAuth, RequireOnboarding } from './guards'
import { AppLayout } from './layouts'
import { NotFoundPage, Root, RouteError } from './route-components'

// Telas pesadas (gráficos, formulários grandes) carregam sob demanda
export const router = createBrowserRouter([
  {
    element: <Root />,
    errorElement: <RouteError />,
    hydrateFallbackElement: <LoadingScreen />,
    children: [
      {
        element: <PublicOnly />,
        children: [
          { path: '/entrar', element: <LoginPage /> },
          { path: '/criar-conta', element: <SignupPage /> },
          { path: '/recuperar-senha', element: <ForgotPasswordPage /> },
        ],
      },
      { path: '/redefinir-senha', element: <ResetPasswordPage /> },
      // Páginas públicas (exigidas pelo Google e pela LGPD), abertas logado ou não
      { path: '/privacidade', lazy: async () => ({ Component: (await import('@/features/legal/pages')).PrivacyPage }) },
      { path: '/termos', lazy: async () => ({ Component: (await import('@/features/legal/pages')).TermsPage }) },
      { path: '/cookies', lazy: async () => ({ Component: (await import('@/features/legal/pages')).CookiesPage }) },
      { path: '/seguranca', lazy: async () => ({ Component: (await import('@/features/legal/pages')).SecurityPage }) },
      {
        element: <RequireAuth />,
        children: [
          {
            path: '/bem-vindo',
            lazy: async () => ({ Component: (await import('@/features/onboarding/onboarding-page')).OnboardingPage }),
          },
          {
            element: <RequireOnboarding />,
            children: [
              {
                element: <AppLayout />,
                children: [
                  {
                    index: true,
                    lazy: async () => ({ Component: (await import('@/features/dashboard/dashboard-page')).DashboardPage }),
                  },
                  {
                    path: '/jornadas',
                    lazy: async () => ({ Component: (await import('@/features/shifts/pages')).ShiftsPage }),
                  },
                  {
                    path: '/jornadas/nova',
                    lazy: async () => ({ Component: (await import('@/features/shifts/pages')).ShiftFormPage }),
                  },
                  {
                    path: '/jornadas/:id',
                    lazy: async () => ({ Component: (await import('@/features/shifts/pages')).ShiftFormPage }),
                  },
                  {
                    path: '/veiculos',
                    lazy: async () => ({ Component: (await import('@/features/vehicles/pages')).VehiclesPage }),
                  },
                  {
                    path: '/veiculos/novo',
                    lazy: async () => ({ Component: (await import('@/features/vehicles/pages')).VehicleFormPage }),
                  },
                  {
                    path: '/veiculos/:id',
                    lazy: async () => ({ Component: (await import('@/features/vehicles/pages')).VehicleFormPage }),
                  },
                  {
                    path: '/plataformas',
                    lazy: async () => ({ Component: (await import('@/features/platforms/pages')).PlatformsPage }),
                  },
                  {
                    path: '/mais',
                    lazy: async () => ({ Component: (await import('@/features/settings/more-page')).MorePage }),
                  },
                  { path: '*', element: <NotFoundPage /> },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
])
