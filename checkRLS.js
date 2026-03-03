const fs = require('fs');

async function checkRLS() {
    const txt = fs.readFileSync('supabaseClient.js', 'utf8');
    const url = txt.match(/const supabaseUrl = '([^']+)'/)[1];
    const key = txt.match(/const supabaseKey = '([^']+)'/)[1];

    console.log("Trying to update match 73 to testing values with anon key...");
    const res = await fetch(`${url}/rest/v1/matches?id=eq.73`, {
        method: 'PATCH',
        headers: {
            'apikey': key,
            'Authorization': `Bearer ${key}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
        },
        body: JSON.stringify({ home_team: 'TEST' })
    });

    console.log("Status:", res.status);
    console.log("Response text:", await res.text());

    // Restore back
    if (res.status === 200 || res.status === 204) {
        await fetch(`${url}/rest/v1/matches?id=eq.73`, {
            method: 'PATCH',
            headers: {
                'apikey': key,
                'Authorization': `Bearer ${key}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ home_team: 'TBD' })
        });
    }
}
checkRLS();
