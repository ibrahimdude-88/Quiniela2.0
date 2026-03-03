const fetch = require('node-fetch');

async function checkServiceRole() {
    const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9jcnRrZ2NpdHF4Z2J3Z3R6aHdkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDc1MDkyOSwiZXhwIjoyMDg2MzI2OTI5fQ.0u2WEt6X7KT3m-XlF0HxwjnHS1nAi0gmVZlT_IoFDa4';
    const url = 'https://ocrtkgcitqxgbwgtzhwd.supabase.co';

    console.log("Trying to update match 73 with service_role key...");
    const res = await fetch(`${url}/rest/v1/matches?id=eq.73`, {
        method: 'PATCH',
        headers: {
            'apikey': key,
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        },
        body: JSON.stringify({ home_team: 'TEST2' })
    });

    console.log("Status:", res.status);
    console.log("Response text:", await res.text());
}
checkServiceRole();
