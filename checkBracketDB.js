const fs = require('fs');
const txt = fs.readFileSync('supabaseClient.js', 'utf8');
const urlMatch = txt.match(/const supabaseUrl = '([^']+)'/);
const keyMatch = txt.match(/const supabaseKey = '([^']+)'/);
const baseURL = urlMatch[1];
const apiKey = keyMatch[1];

async function checkMatches() {
    const res = await fetch(`${baseURL}/rest/v1/matches?select=id,home_team,away_team&id=gte.73&id=lte.88`, {
        headers: { apikey: apiKey, Authorization: `Bearer ${apiKey}` }
    });
    const data = await res.json();
    data.sort((a, b) => a.id - b.id);
    console.log(JSON.stringify(data, null, 2));
}

checkMatches();
