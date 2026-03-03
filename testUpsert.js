const supabaseUrl = 'https://ocrtkgcitqxgbwgtzhwd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9jcnRrZ2NpdHF4Z2J3Z3R6aHdkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDc1MDkyOSwiZXhwIjoyMDg2MzI2OTI5fQ.0u2WEt6X7KT3m-XlF0HxwjnHS1nAi0gmVZlT_IoFDa4';

// Use standard fetch
const url = `${supabaseUrl}/rest/v1/matches?select=*`;

fetch(url, { headers: { apikey: supabaseKey, Authorization: 'Bearer ' + supabaseKey } })
    .then(res => res.json())
    .then(async matches => {
        let updates = [{ id: 73, home_team: 'KOR', away_team: 'CAN' }];
        const fullUpdates = updates.map(u => {
            const existing = matches.find(m => m.id === u.id);
            return {
                ...existing,
                home_team: u.home_team,
                away_team: u.away_team
            };
        }).filter(u => u.id);

        const res2 = await fetch(`${supabaseUrl}/rest/v1/matches`, {
            method: 'POST',
            headers: {
                apikey: supabaseKey,
                Authorization: 'Bearer ' + supabaseKey,
                'Content-Type': 'application/json',
                'Prefer': 'resolution=merge-duplicates'
            },
            body: JSON.stringify(fullUpdates)
        });
        console.log(res2.status, await res2.text());
    })
    .catch(console.error);
