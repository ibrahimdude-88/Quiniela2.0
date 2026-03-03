import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabaseAdmin = createClient(
    'https://ocrtkgcitqxgbwgtzhwd.supabase.co',
    '<service_role_key>',
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
);

// I will just use the normal client for this test because the anon key is in supabaseClient.js
