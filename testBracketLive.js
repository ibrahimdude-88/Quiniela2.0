const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ocrtkgcitqxgbwgtzhwd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9jcnRrZ2NpdHF4Z2J3Z3R6aHdkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDc1MDkyOSwiZXhwIjoyMDg2MzI2OTI5fQ.0u2WEt6X7KT3m-XlF0HxwjnHS1nAi0gmVZlT_IoFDa4';
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data: matches } = await supabaseAdmin.from('matches').select('*');

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

            if (m.home_score > m.away_score) {
                teams[m.home_team].pts += 3;
            } else if (m.home_score < m.away_score) {
                teams[m.away_team].pts += 3;
            } else {
                teams[m.home_team].pts += 1;
                teams[m.away_team].pts += 1;
            }
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

    const thirdPlaceCandidates = [];
    Object.values(allGroupStandings).forEach(groupData => {
        if (groupData[2]) thirdPlaceCandidates.push(groupData[2]);
    });
    thirdPlaceCandidates.sort((a, b) => b.pts - a.pts || b.dif - a.dif || b.gf - a.gf);
    const qualifiedThirdPlaces = thirdPlaceCandidates.slice(0, 8).map(t => t.code);

    const thirdPlaceSlots = [
        '3ABCDF', '3CDFGH', '3CEFHI', '3EHIJK', 
        '3BEFIJ', '3AEHIJ', '3EFGIJ', '3DEIJL'
    ];
    
    const q3Teams = qualifiedThirdPlaces.map(code => {
        for (const [groupLetter, groupData] of Object.entries(allGroupStandings)) {
            if (groupData[2] && groupData[2].code === code) return { code, group: groupLetter };
        }
        return { code, group: '?' };
    }).filter(t => t.group !== '?');

    function solveThirdPlaces(slotIndex, currentAssignment, usedTeams) {
        if (slotIndex >= thirdPlaceSlots.length) return currentAssignment;
        const slot = thirdPlaceSlots[slotIndex];
        const allowedGroups = slot.substring(1).split('');
        for (let i = 0; i < q3Teams.length; i++) {
            const team = q3Teams[i];
            if (!usedTeams.has(team.code) && allowedGroups.includes(team.group)) {
                usedTeams.add(team.code);
                currentAssignment[slot] = team.code;
                const res = solveThirdPlaces(slotIndex + 1, currentAssignment, usedTeams);
                if (res) return res;
                usedTeams.delete(team.code);
                delete currentAssignment[slot];
            }
        }
        return null;
    }
    
    const thirdPlaceMatches = solveThirdPlaces(0, {}, new Set());

    const getTeam = (code) => {
        if (code.startsWith('W') || code.startsWith('L')) {
            const isWinner = code.startsWith('W');
            const matchId = parseInt(code.substring(1));
            const previousMatch = matches.find(m => m.id === matchId);
            if (previousMatch && previousMatch.status === 'f') {
                if (previousMatch.penalty_winner) {
                    return previousMatch.penalty_winner === 'home'
                        ? (isWinner ? previousMatch.home_team : previousMatch.away_team)
                        : (isWinner ? previousMatch.away_team : previousMatch.home_team);
                }
                const homeScore = previousMatch.home_score;
                const awayScore = previousMatch.away_score;
                if (homeScore > awayScore) return isWinner ? previousMatch.home_team : previousMatch.away_team;
                else if (awayScore > homeScore) return isWinner ? previousMatch.away_team : previousMatch.home_team;
            }
            return code;
        }

        if (code.startsWith('3') && code.length > 2) {
            if (thirdPlaceMatches && thirdPlaceMatches[code]) {
                return thirdPlaceMatches[code];
            }
            return code;
        }

        const regex = /^(\d)([A-L])$/;
        const match = code.match(regex);
        if (match) {
            const pos = parseInt(match[1]);
            const group = match[2];
            const groupData = allGroupStandings[group];
            if (groupData && groupData[pos - 1]) return groupData[pos - 1].code;
        }
        return code;
    };

    const structure = [
        { id: 73, home: '2A', away: '2B' },
        { id: 74, home: '1E', away: '3ABCDF' },
        { id: 75, home: '1F', away: '2C' },
        { id: 76, home: '1C', away: '2F' },
        { id: 77, home: '1I', away: '3CDFGH' },
        { id: 78, home: '2E', away: '2I' },
        { id: 79, home: '1A', away: '3CEFHI' },
        { id: 80, home: '1L', away: '3EHIJK' },
        { id: 81, home: '1D', away: '3BEFIJ' },
        { id: 82, home: '1G', away: '3AEHIJ' },
        { id: 83, home: '2K', away: '2L' },
        { id: 84, home: '1H', away: '2J' },
        { id: 85, home: '1B', away: '3EFGIJ' },
        { id: 86, home: '1J', away: '2H' },
        { id: 87, home: '1K', away: '3DEIJL' },
        { id: 88, home: '2D', away: '2G' },
        { id: 89, home: 'W74', away: 'W77' },
        { id: 90, home: 'W73', away: 'W75' },
        { id: 91, home: 'W76', away: 'W78' },
        { id: 92, home: 'W79', away: 'W80' },
        { id: 93, home: 'W83', away: 'W84' },
        { id: 94, home: 'W81', away: 'W82' },
        { id: 95, home: 'W86', away: 'W88' },
        { id: 96, home: 'W85', away: 'W87' },
        { id: 97, home: 'W89', away: 'W90' },
        { id: 98, home: 'W91', away: 'W92' },
        { id: 99, home: 'W93', away: 'W94' },
        { id: 100, home: 'W95', away: 'W96' },
        { id: 101, home: 'W97', away: 'W98' },
        { id: 102, home: 'W99', away: 'W100' },
        { id: 103, home: 'L101', away: 'L102' },
        { id: 104, home: 'W101', away: 'W102' }
    ];

    const updates = [];
    for (const item of structure) {
        updates.push({
            id: item.id,
            home_team: getTeam(item.home),
            away_team: getTeam(item.away)
        });
    }

    let successCount = 0;
    let failCount = 0;

    for (const update of updates) {
        try {
            const { error } = await supabaseAdmin
                .from('matches')
                .update({ home_team: update.home_team, away_team: update.away_team })
                .eq('id', update.id);
            if (error) {
                console.error(`Error on ${update.id}:`, error);
                failCount++;
            } else successCount++;
        } catch (err) {
            failCount++;
        }
    }
    console.log(`Finished ${successCount} success, ${failCount} fail`);
}
run();
