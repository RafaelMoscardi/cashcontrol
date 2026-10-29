import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 10 * 60_000,
      retry: (failureCount, error) => {
        // Erro de permissão ou validação não melhora tentando de novo
        const status = (error as { status?: number }).status
        if (status && status >= 400 && status < 500) return false
        return failureCount < 2
      },
      refetchOnWindowFocus: true,
    },
    mutations: { retry: false },
  },
})

/** Chaves de cache por feature. */
export const queryKeys = {
  profile: ['profile'] as const,
  vehicles: ['vehicles'] as const,
  platforms: ['platforms'] as const,
  shifts: ['shifts'] as const,
  shiftsBetween: (from: string, to: string) => ['shifts', 'between', from, to] as const,
  shift: (id: string) => ['shifts', 'detail', id] as const,
  lastOdometer: (vehicleId: string) => ['shifts', 'last-odometer', vehicleId] as const,
}
