const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ocrtkgcitqxgbwgtzhwd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9jcnRrZ2NpdHF4Z2J3Z3R6aHdkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDc1MDkyOSwiZXhwIjoyMDg2MzI2OTI5fQ.0u2WEt6X7KT3m-XlF0HxwjnHS1nAi0gmVZlT_IoFDa4';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTestUsers() {
    const { data: users, error } = await supabase.from('profiles').select('*').limit(15);
    console.log(users.map(u => ({ username: u.username, paid: u.paid })));
}
checkTestUsers();
