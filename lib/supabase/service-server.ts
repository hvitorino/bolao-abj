import { createClient } from '@supabase/supabase-js'

/**
 * Cria um cliente Supabase com a chave service_role (bypass RLS).
 * Usar apenas em Server Components e Route Handlers — nunca expor ao cliente.
 * A seleção de colunas deve ser feita com critério para não vazar dados sensíveis.
 */
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}
