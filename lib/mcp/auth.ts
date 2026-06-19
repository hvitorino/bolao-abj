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
  const { data, error } = await createServiceClient()
    .from('mcp_access_tokens')
    .select('user_id, expires_at')
    .eq('token', token)
    .maybeSingle()

  if (error || !data) return null
  if (new Date() > new Date(data.expires_at)) return null

  return { userId: data.user_id }
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

export async function validateGroupMembership(
  serviceClient: ReturnType<typeof createServiceClient>,
  userId: string,
  groupId: string
): Promise<{ valid: boolean; errorMessage?: string }> {
  const { data } = await serviceClient
    .from('group_members')
    .select('group_id')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .maybeSingle()

  if (!data) {
    return {
      valid: false,
      errorMessage: 'Você não é membro deste grupo ou o grupo não existe.',
    }
  }

  return { valid: true }
}
