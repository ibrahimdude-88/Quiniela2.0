const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ocrtkgcitqxgbwgtzhwd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9jcnRrZ2NpdHF4Z2J3Z3R6aHdkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDc1MDkyOSwiZXhwIjoyMDg2MzI2OTI5fQ.0u2WEt6X7KT3m-XlF0HxwjnHS1nAi0gmVZlT_IoFDa4';
const supabase = createClient(supabaseUrl, supabaseKey);

async function testProfile() {
    const userId = '11111111-1111-1111-1111-111111111111';

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: 'testuser_x1@quinielatest.com',
        password: 'TestPassword123!',
        email_confirm: true,
        user_metadata: { username: 'TestUser_X1', full_name: 'TestUser_X1', is_test: true }
    });
    console.log('Auth:', authError);

    if (authData?.user) {
        const { error: profileError } = await supabase.from('profiles').upsert({
            id: authData.user.id,
            is_test: true,
            paid: true,
            username: 'TestUser_X1',
            full_name: 'TestUser_X1',
            role: 'user'
        });
        console.log('Profile Upsert Error:', profileError);

        const { data: p } = await supabase.from('profiles').select('*').eq('id', authData.user.id);
        console.log('Profile in DB:', p);
    }
}
testProfile();
