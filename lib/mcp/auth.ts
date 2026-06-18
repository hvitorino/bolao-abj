import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export function createAnonClient() {
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
  })
}

export function createServiceClient() {
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  })
}

export async function authenticateBearer(token: string): Promise<{ userId: string } | null> {
  const { data: { user }, error } = await createAnonClient().auth.getUser(token)
  if (error || !user) return null
  return { userId: user.id }
}

export async function resolveGroupForMcp(
  serviceClient: ReturnType<typeof createServiceClient>,
  userId: string
): Promise<string | null> {
  const { data } = await serviceClient
    .from('group_members')
    .select('group_id')
    .eq('user_id', userId)
    .order('joined_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  return data?.group_id ?? null
}
