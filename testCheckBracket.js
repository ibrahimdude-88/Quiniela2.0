const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ocrtkgcitqxgbwgtzhwd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9jcnRrZ2NpdHF4Z2J3Z3R6aHdkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDc1MDkyOSwiZXhwIjoyMDg2MzI2OTI5fQ.0u2WEt6X7KT3m-XlF0HxwjnHS1nAi0gmVZlT_IoFDa4';
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

async function checkMatches() {
    const { data: m } = await supabaseAdmin.from('matches').select('*').gte('id', 73).lte('id', 104);
    for (let match of m) {
        if (match.id >= 89 && match.id <= 92) {
            console.log(match.id, match.home_team, match.away_team);
        }
    }
}
checkMatches();
