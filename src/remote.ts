import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Null when the env vars are missing: the app then runs as an offline demo on localStorage. */
export const sb: SupabaseClient | null = url && key ? createClient(url, key, { auth: { flowType: 'pkce' } }) : null;
export const remote = sb !== null;
