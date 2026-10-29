import { useMutation, useQuery } from '@tanstack/react-query'
import type { Platform, PlatformKind } from '@/domain/types'
import { unwrap } from '@/lib/errors'
import { queryClient, queryKeys } from '@/lib/query-client'
import { supabase } from '@/lib/supabase'
import type { PlatformRow } from '@/types/database'
import { nextPlatformColors } from './catalog'

const toPlatform = (row: PlatformRow): Platform => ({
  id: row.id,
  name: row.name,
  kind: row.kind,
  color: row.color,
  sortOrder: row.sort_order,
  archivedAt: row.archived_at,
})

async function listPlatforms(): Promise<Platform[]> {
  const rows = unwrap(
    await supabase.from('platforms').select('*').order('sort_order', { ascending: true }).order('created_at', { ascending: true }),
  )
  return rows.map(toPlatform)
}

/** Cria várias de uma vez, com cores livres da paleta. Linhas completas (ver PostgREST em lote). */
async function createPlatforms(items: ReadonlyArray<{ name: string; kind: PlatformKind }>): Promise<Platform[]> {
  const existing = queryClient.getQueryData<Platform[]>(queryKeys.platforms) ?? (await listPlatforms())
  const active = existing.filter((p) => !p.archivedAt)
  const colors = nextPlatformColors(
    active.map((p) => p.color),
    items.length,
  )
  const start = existing.reduce((max, p) => Math.max(max, p.sortOrder), -1) + 1
  const rows = unwrap(
    await supabase
      .from('platforms')
      .insert(items.map((item, i) => ({ name: item.name.trim(), kind: item.kind, color: colors[i]!, sort_order: start + i, archived_at: null })))
      .select(),
  )
  return rows.map(toPlatform)
}

async function updatePlatform({ id, ...patch }: { id: string; name?: string; kind?: PlatformKind; archived?: boolean }) {
  const row = unwrap(
    await supabase
      .from('platforms')
      .update({
        ...(patch.name !== undefined && { name: patch.name.trim() }),
        ...(patch.kind !== undefined && { kind: patch.kind }),
        ...(patch.archived !== undefined && { archived_at: patch.archived ? new Date().toISOString() : null }),
      })
      .eq('id', id)
      .select()
      .single(),
  )
  return toPlatform(row)
}

const invalidate = () => queryClient.invalidateQueries({ queryKey: queryKeys.platforms })

export function usePlatforms() {
  return useQuery({ queryKey: queryKeys.platforms, queryFn: listPlatforms })
}

export function useCreatePlatforms() {
  return useMutation({ mutationFn: createPlatforms, onSettled: invalidate })
}

export function useUpdatePlatform() {
  return useMutation({ mutationFn: updatePlatform, onSettled: invalidate })
}
