import { useQuery } from '@tanstack/react-query'
import { supabaseKey, supabaseUrl } from '@/lib/supabase'

/** Logins sociais ligados no painel do Supabase: o botão do Google aparece sozinho quando é ativado. */
export function useAuthProviders() {
  return useQuery({
    queryKey: ['auth-settings'],
    queryFn: async () => {
      const response = await fetch(`${supabaseUrl}/auth/v1/settings`, { headers: { apikey: supabaseKey } })
      if (!response.ok) throw new Error(`Configurações de login indisponíveis (${response.status})`)
      const settings = (await response.json()) as { external?: Record<string, boolean> }
      return { google: settings.external?.google === true }
    },
    staleTime: 5 * 60_000,
    retry: 1,
  })
}
