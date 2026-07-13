import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isValidDateString, todayInBrasilia } from '@/lib/date'
import { PalpitesLiveSection } from './palpites-live-section'

export const metadata: Metadata = {
  title: 'Palpites — Bolão da Copa',
}

const ACTIVE_GROUP_COOKIE = 'bolao_active_group'

interface GroupRow {
  joined_at: string
  groups: { id: string } | { id: string }[] | null
}

interface PalpitesPageProps {
  searchParams: Promise<{ date?: string }>
}

export default async function PalpitesPage({ searchParams }: PalpitesPageProps) {
  const params = await searchParams
  const dateParam = params.date

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const cookieStore = await cookies()
  const cookieGroupId = cookieStore.get(ACTIVE_GROUP_COOKIE)?.value

  const [{ data: groupRows }, { data: allMatchDates }] = await Promise.all([
    supabase
      .from('group_members')
      .select('joined_at, groups(id)')
      .eq('user_id', user.id)
      .order('joined_at', { ascending: true }),
    supabase
      .from('games')
      .select('match_day')
      .not('match_day', 'is', null)
      .order('match_day', { ascending: true }),
  ])

  const groups = ((groupRows ?? []) as GroupRow[]).map((row) => {
    const g = Array.isArray(row.groups) ? row.groups[0] : row.groups
    return { id: g?.id ?? '' }
  })

  const availableDates: string[] = allMatchDates
    ? Array.from(new Set(allMatchDates.map((row) => row.match_day as string))).sort()
    : []

  // Data selecionada: respeita o param explícito; caso contrário parte de hoje.
  // Se hoje não tiver jogo, seleciona a próxima data com jogo (se houver adiante),
  // ou a última data em que houve jogo.
  let currentDate: string
  if (dateParam && isValidDateString(dateParam)) {
    currentDate = dateParam
  } else {
    const today = todayInBrasilia()
    if (availableDates.includes(today)) {
      currentDate = today
    } else {
      const nextDate = availableDates.find((d) => d > today)
      currentDate = nextDate ?? availableDates[availableDates.length - 1] ?? today
    }
  }

  const activeGroup = groups.find((g) => g.id === cookieGroupId) ?? groups[0]
  if (!activeGroup?.id) redirect('/grupos')

  return (
    <PalpitesLiveSection
      groupId={activeGroup.id}
      currentUserId={user.id}
      selectedDate={currentDate}
      availableDates={availableDates}
    />
  )
}
