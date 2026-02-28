const fs = require('fs');
const content = fs.readFileSync('admin.js', 'utf8');
const matchURL = content.match(/createClient\(\s*'([^']+)'/);
const matchKey = content.match(/createClient\(\s*'[^']+',\s*'([^']+)'/);
const url = matchURL[1];
const key = matchKey[1];

async function run() {
    try {
        console.log("Cleaning up duplicate 3rd places settings...");

        // Let's just delete them all
        const delRes = await fetch(`${url}/rest/v1/app_settings?key=eq.qualified_third_places`, {
            method: 'DELETE',
            headers: {
                'apikey': key,
                'Authorization': `Bearer ${key}`
            }
        });

        console.log("Delete status: ", delRes.status);

        // Now insert exactly ONE clean array
        const postRes = await fetch(`${url}/rest/v1/app_settings`, {
            method: 'POST',
            headers: {
                'apikey': key,
                'Authorization': `Bearer ${key}`,
                'Content-Type': 'application/json',
                'Prefer': 'return=minimal'
            },
            body: JSON.stringify({ key: 'qualified_third_places', value: [] })
        });
        console.log("Reinsert status: ", postRes.status);
    } catch (e) {
        console.error(e);
    }
}
run();
