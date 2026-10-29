import { isAuthApiError } from '@supabase/supabase-js'
import { useMutation, useQuery } from '@tanstack/react-query'
import { unwrap } from '@/lib/errors'
import { queryClient, queryKeys } from '@/lib/query-client'
import { supabase } from '@/lib/supabase'
import type { ProfileRow } from '@/types/database'

export interface Profile {
  id: string
  fullName: string | null
  onboardedAt: string | null
}

const toProfile = (row: ProfileRow): Profile => ({ id: row.id, fullName: row.full_name, onboardedAt: row.onboarded_at })

async function fetchProfile(): Promise<Profile> {
  return toProfile(unwrap(await supabase.from('profiles').select('*').single()))
}

async function updateProfile(patch: { fullName?: string; onboardedAt?: string }): Promise<Profile> {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) throw new Error('Sessão expirada')
  const row = unwrap(
    await supabase
      .from('profiles')
      .update({
        ...(patch.fullName !== undefined && { full_name: patch.fullName }),
        ...(patch.onboardedAt !== undefined && { onboarded_at: patch.onboardedAt }),
      })
      .eq('id', auth.user.id)
      .select()
      .single(),
  )
  return toProfile(row)
}

export function useProfile(enabled = true) {
  // Com erro, quem monta depois não busca de novo: senão o guarda volta ao carregamento e entra em laço
  return useQuery({ queryKey: queryKeys.profile, queryFn: fetchProfile, enabled, retryOnMount: false })
}

/**
 * A conta ainda existe? Apagada no painel do Supabase, o token guardado continua valendo por até 1 h
 * e só o Auth sabe que ela sumiu. Sem internet, a resposta é sim: ninguém sai da conta por estar offline.
 */
export async function accountExists(): Promise<boolean> {
  const { error } = await supabase.auth.getUser()
  return !(isAuthApiError(error) && [401, 403, 404].includes(error.status))
}

export function useUpdateProfile() {
  return useMutation({
    mutationFn: updateProfile,
    onSuccess: (profile) => queryClient.setQueryData(queryKeys.profile, profile),
  })
}

/** "Rafael Souza" → "Rafael". */
export const firstName = (fullName: string | null | undefined) => fullName?.trim().split(/\s+/)[0] ?? ''
