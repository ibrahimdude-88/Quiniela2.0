import fs from 'fs';

const matches = JSON.parse(fs.readFileSync('c:/Users/Ibrahim/Documents/GitHub/Quiniela2.0/matches_empty.json', 'utf8'));

let allGroupStandings = {};
const teams = {};

matches.forEach(m => {
    if (m.matchday > 3) return;
    if (!m.home_team || !m.away_team || m.home_team === 'TBD' || m.away_team === 'TBD') return;

    if (!teams[m.home_team]) teams[m.home_team] = { code: m.home_team, group: m.group_name, pts: 0, gf: 0, gc: 0, dif: 0, played: 0 };
    if (!teams[m.away_team]) teams[m.away_team] = { code: m.away_team, group: m.group_name, pts: 0, gf: 0, gc: 0, dif: 0, played: 0 };

    if (m.status === 'f') {
        teams[m.home_team].played++;
        teams[m.away_team].played++;
        teams[m.home_team].gf += m.home_score;
        teams[m.away_team].gf += m.away_score;
        teams[m.home_team].gc += m.away_score;
        teams[m.away_team].gc += m.home_score;

        if (m.home_score > m.away_score) teams[m.home_team].pts += 3;
        else if (m.home_score < m.away_score) teams[m.away_team].pts += 3;
        else { teams[m.home_team].pts += 1; teams[m.away_team].pts += 1; }
    }
});

Object.values(teams).forEach(t => t.dif = t.gf - t.gc);
Object.values(teams).forEach(t => {
    if (!allGroupStandings[t.group]) allGroupStandings[t.group] = [];
    allGroupStandings[t.group].push(t);
});

Object.keys(allGroupStandings).forEach(g => {
    allGroupStandings[g].sort((a, b) => b.pts - a.pts || b.dif - a.dif || b.gf - a.gf);
});

const qualifiedThirdPlaces = [];
const structure = [
    { id: 73, home: '2A', away: '2B' },
    { id: 74, home: '1E', away: '3ABCDF' },
    { id: 75, home: '1F', away: '2C' }
];

const claimedThirdPlaces = new Set();
const getTeam = (code) => {
    if (code.startsWith('W') || code.startsWith('L')) return code;

    if (code.startsWith('3') && code.length > 2) {
        const possibleGroups = code.substring(1).split('');
        for (const g of possibleGroups) {
            const team = allGroupStandings[g] && allGroupStandings[g][2];
            if (team && qualifiedThirdPlaces.includes(team.code) && !claimedThirdPlaces.has(team.code)) {
                claimedThirdPlaces.add(team.code);
                return team.code;
            }
        }
        return code;
    }

    const regex = /^(\d)([A-L])$/;
    const match = code.match(regex);
    if (match) {
        const pos = parseInt(match[1]);
        const group = match[2];
        const groupData = allGroupStandings[group];
        if (groupData && groupData[pos - 1]) {
            return groupData[pos - 1].code;
        }
    }
    return code;
};

const updates = [];
for (const item of structure) {
    updates.push({ id: item.id, home: getTeam(item.home), away: getTeam(item.away) });
}
console.log(JSON.stringify(updates, null, 2));
