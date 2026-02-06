import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://xbbrxgitrkoufxtnxtla.supabase.co';
const supabaseKey = 'sb_publishable_Tf-9D_rc1YL3JjWX5zRbpw_uY-6YZ7N';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    storageKey: 'mao-de-obra-auth',
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});