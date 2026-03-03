const fs = require('fs');
const url = 'https://ocrtkgcitqxgbwgtzhwd.supabase.co/rest/v1/matches?select=*';
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9jcnRrZ2NpdHF4Z2J3Z3R6aHdkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDc1MDkyOSwiZXhwIjoyMDg2MzI2OTI5fQ.0u2WEt6X7KT3m-XlF0HxwjnHS1nAi0gmVZlT_IoFDa4';

fetch(url, { headers: { apikey: key, Authorization: 'Bearer ' + key } })
    .then(res => res.json())
    .then(data => fs.writeFileSync('c:/Users/Ibrahim/Documents/GitHub/Quiniela2.0/matches.json', JSON.stringify(data, null, 2)))
    .catch(console.error);
