const fs = require('fs');
async function main() {
    const clientCode = fs.readFileSync('supabaseClient.js', 'utf8');
    const urlMatch = clientCode.match(/const supabaseUrl = '([^']+)'/);
    const keyMatch = clientCode.match(/const supabaseKey = '([^']+)'/);
    const URL = urlMatch[1];
    const KEY = keyMatch[1];

    // Check all matches with matchday >= 8 or group_name containing 'fin'
    const res = await fetch(`${URL}/rest/v1/matches?select=id,matchday,group_name,home_team,away_team&matchday=gte.8`, {
        headers: { 'apikey': KEY, 'Authorization': `Bearer ${KEY}` }
    });
    console.log("MATCHDAY >= 8:", await res.json());

    const res2 = await fetch(`${URL}/rest/v1/matches?select=id,matchday,group_name,home_team,away_team&group_name=ilike.*fin*`, {
        headers: { 'apikey': KEY, 'Authorization': `Bearer ${KEY}` }
    });
    console.log("GROUP NAME *FIN*:", await res2.json());
}
main();
