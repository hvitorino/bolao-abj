import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { RankingTable } from '@/components/bolao/RankingTable'

export const metadata = {
  title: 'Ranking — Bolão do Cartola ABJ',
}

export default async function RankingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <RankingTable currentUserId={user.id} />
    </div>
  )
}
