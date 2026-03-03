const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ocrtkgcitqxgbwgtzhwd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9jcnRrZ2NpdHF4Z2J3Z3R6aHdkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDc1MDkyOSwiZXhwIjoyMDg2MzI2OTI5fQ.0u2WEt6X7KT3m-XlF0HxwjnHS1nAi0gmVZlT_IoFDa4';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    const { data: matches, error: loadError } = await supabase.from('matches').select('*');
    if (loadError) return console.error(loadError);

    let updates = [{ id: 73, home_team: 'KOR', away_team: 'CAN' }];
    const fullUpdates = updates.map(u => {
        const existing = matches.find(m => m.id === u.id);
        return {
            ...existing,
            home_team: u.home_team,
            away_team: u.away_team
        };
    }).filter(u => u.id);

    const { data, error } = await supabase.from('matches').upsert(fullUpdates);
    console.log('Result:', data, 'Error:', error);
}
test();
