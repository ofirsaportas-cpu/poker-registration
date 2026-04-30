import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://gfhnvzykjqhmbfpnnknv.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_pH3kp5hkrzFkSRo6lBponw_m-tZj90y';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
