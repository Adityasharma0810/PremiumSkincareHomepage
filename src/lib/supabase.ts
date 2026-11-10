import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  // Thrown at import time so the developer sees a clear message rather than
  // obscure network failures. Secrets go in .env (see AGENTS.md / secrets note).
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY environment variables. ' +
      'Add them to a .env file at the project root (see the Secrets section below).',
  )
}

/**
 * Supabase client.
 *
 * The client is intentionally left loosely typed (`Database = any`) because
 * the handwritten `Database` type in `src/lib/types.ts` mirrors DATABASE_SCHEMA.md
 * for documentation and service-level contracts; casting at the service
 * boundaries keeps the code compiling without fighting Supabase's generated
 * GenericSchema constraints. Named interfaces (Profile, Product, Order, …) are
 * still imported and used throughout `src/services/` as data contracts.
 */
export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'aura-supabase-auth',
    },
  },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
) as any

export type { Database }
