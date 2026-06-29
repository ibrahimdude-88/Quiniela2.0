const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://ocrtkgcitqxgbwgtzhwd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9jcnRrZ2NpdHF4Z2J3Z3R6aHdkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDc1MDkyOSwiZXhwIjoyMDg2MzI2OTI5fQ.0u2WEt6X7KT3m-XlF0HxwjnHS1nAi0gmVZlT_IoFDa4';
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

const TEAM_NAMES = {
    'MEX': 'México', 'BRA': 'Brasil', 'ARG': 'Argentina', 'USA': 'Estados Unidos', 'CAN': 'Canadá',
    'ESP': 'España', 'FRA': 'Francia', 'GER': 'Alemania', 'ENG': 'Inglaterra', 'POR': 'Portugal',
    'NED': 'Países Bajos', 'BEL': 'Bélgica', 'CRO': 'Croacia', 'URU': 'Uruguay', 'KOR': 'Corea del Sur',
    'JPN': 'Japón', 'SEN': 'Senegal', 'MAR': 'Marruecos', 'SUI': 'Suiza', 'GHA': 'Ghana',
    'CMR': 'Camerún', 'ECU': 'Ecuador', 'KSA': 'Arabia Saudita', 'IRN': 'Irán', 'AUS': 'Australia',
    'CRC': 'Costa Rica', 'POL': 'Polonia', 'TUN': 'Túnez', 'DEN': 'Dinamarca', 'SRB': 'Serbia',
    'WAL': 'Gales', 'QAT': 'Qatar', 'RSA': 'Sudáfrica', 'PAR': 'Paraguay', 'SCO': 'Escocia',
    'CIV': 'Costa de Marfil', 'COL': 'Colombia', 'PAN': 'Panamá', 'AUT': 'Austria', 'ALG': 'Argelia',
    'JOR': 'Jordania', 'NZL': 'Nueva Zelanda', 'EGY': 'Egipto', 'UZB': 'Uzbekistán', 'HAI': 'Haití',
    'CUR': 'Curazao', 'NOR': 'Noruega',
    'CPV': 'Cabo Verde', 'COD': 'RD Congo', 'IRQ': 'Irak', 'BIH': 'Bosnia y Herz.', 'SWE': 'Suecia', 'TUR': 'Turquía', 'CZE': 'Rep. Checa'
};

const ENGLISH_TRANSLATIONS = {
    'México': 'Mexico',
    'Brasil': 'Brazil',
    'Estados Unidos': 'United States',
    'Canadá': 'Canada',
    'España': 'Spain',
    'Francia': 'France',
    'Alemania': 'Germany',
    'Inglaterra': 'England',
    'Países Bajos': 'Netherlands',
    'Bélgica': 'Belgium',
    'Croacia': 'Croatia',
    'Japón': 'Japan',
    'Marruecos': 'Morocco',
    'Suiza': 'Switzerland',
    'Camerún': 'Cameroon',
    'Arabia Saudita': 'Saudi Arabia',
    'Irán': 'Iran',
    'Polonia': 'Poland',
    'Túnez': 'Tunisia',
    'Dinamarca': 'Denmark',
    'Gales': 'Wales',
    'Sudáfrica': 'South Africa',
    'Escocia': 'Scotland',
    'Costa de Marfil': 'Ivory Coast',
    'Cabo Verde': 'Cape Verde',
    'RD Congo': 'DR Congo',
    'Irak': 'Iraq',
    'Bosnia y Herz.': 'Bosnia and Herzegovina',
    'Suecia': 'Sweden',
    'Turquía': 'Turkey',
    'Rep. Checa': 'Czech Republic',
    'Egipto': 'Egypt',
    'Argelia': 'Algeria',
    'Jordania': 'Jordan',
    'Nueva Zelanda': 'New Zealand',
    'Uzbekistán': 'Uzbekistan',
    'Haití': 'Haiti',
    'Curazao': 'Curacao',
    'Noruega': 'Norway'
};

// Build team mapping dynamically
const TEAM_MAPPING = {};
Object.entries(TEAM_NAMES).forEach(([code, name]) => {
    TEAM_MAPPING[name.toLowerCase()] = code;
    if (ENGLISH_TRANSLATIONS[name]) {
        TEAM_MAPPING[ENGLISH_TRANSLATIONS[name].toLowerCase()] = code;
    }
});

function cleanTeamName(name) {
    return name.replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
}

function resolveTeamCode(name) {
    const cleaned = cleanTeamName(name);
    if (TEAM_MAPPING[cleaned]) return TEAM_MAPPING[cleaned];
    for (const [key, code] of Object.entries(TEAM_MAPPING)) {
        if (cleaned.includes(key) || key.includes(cleaned)) return code;
    }
    return null;
}

// Recalculates prediction points and updates users profiles totals
async function recalculatePointsAndProfiles(matchId, homeScore, awayScore, penaltyWinner) {
    const { data: preds } = await supabaseAdmin.from('predictions').select('*').eq('match_id', matchId);
    if (!preds) return;

    let matchWinnerSign = 0;
    if (homeScore > awayScore) {
        matchWinnerSign = 1;
    } else if (homeScore < awayScore) {
        matchWinnerSign = -1;
    } else {
        if (penaltyWinner === 'home') matchWinnerSign = 1;
        else if (penaltyWinner === 'away') matchWinnerSign = -1;
    }

    for (const p of preds) {
        if (p.home_score === null || p.away_score === null) continue;

        let predWinnerSign = 0;
        const pH = Number(p.home_score);
        const pA = Number(p.away_score);

        if (pH > pA) {
            predWinnerSign = 1;
        } else if (pH < pA) {
            predWinnerSign = -1;
        } else {
            // Draw prediction: only check penalty winner if the real match was actually a draw
            if (homeScore === awayScore) {
                if (p.penalty_winner === 'home') predWinnerSign = 1;
                else if (p.penalty_winner === 'away') predWinnerSign = -1;
            }
        }

        let pts = 0;
        // 1. Correct Outcome (3 Points)
        if (predWinnerSign === matchWinnerSign && matchWinnerSign !== 0) {
            pts += 3;
        } else if (matchWinnerSign === 0 && predWinnerSign === 0) {
            pts += 3;
        }

        // 2. Exact Score (+5 Points)
        if (pH === homeScore && pA === awayScore) {
            if (homeScore === awayScore) {
                if (penaltyWinner === p.penalty_winner) {
                    pts += 5;
                }
            } else {
                pts += 5;
            }
        }

        if (pts !== p.points_earned) {
            console.log(`    -> Updating prediction ID ${p.id} for user ${p.user_id}: ${p.points_earned} -> ${pts} pts`);
            await supabaseAdmin.from('predictions').update({ points_earned: pts }).eq('id', p.id);
        }
    }
}

async function updateAllProfilesPoints() {
    console.log('Recalculating global scores for all profiles...');
    const { data: users } = await supabaseAdmin.from('profiles').select('id, full_name, username');
    const { data: preds } = await supabaseAdmin.from('predictions').select('user_id, points_earned');
    const { data: matches } = await supabaseAdmin.from('matches').select('id, home_score, away_score, status, penalty_winner');

    const matchMap = {};
    matches.forEach(m => { matchMap[m.id] = m; });

    const userPoints = {};
    const userExacts = {};
    users.forEach(u => {
        userPoints[u.id] = 0;
        userExacts[u.id] = 0;
    });

    // We also re-query prediction details to find exact matches safely
    const { data: fullPreds } = await supabaseAdmin.from('predictions').select('user_id, match_id, home_score, away_score, penalty_winner, points_earned');

    fullPreds.forEach(p => {
        const m = matchMap[p.match_id];
        if (!m || m.status !== 'f') return;

        userPoints[p.user_id] = (userPoints[p.user_id] || 0) + (p.points_earned || 0);

        const pH = Number(p.home_score);
        const pA = Number(p.away_score);
        const mH = Number(m.home_score);
        const mA = Number(m.away_score);

        if (pH === mH && pA === mA && (mH !== mA || m.penalty_winner === p.penalty_winner)) {
            userExacts[p.user_id] = (userExacts[p.user_id] || 0) + 1;
        }
    });

    for (const u of users) {
        const pts = userPoints[u.id] || 0;
        const ex = userExacts[u.id] || 0;
        console.log(`  User: ${u.full_name || u.username} -> Points: ${pts}, Exacts: ${ex}`);
        await supabaseAdmin.from('profiles').update({ points: pts, exact_score_count: ex }).eq('id', u.id);
    }
}

// Automatically advance bracket winners in database
async function advanceBracketWinners() {
    console.log('Advancing bracket winners...');
    const { data: matches } = await supabaseAdmin.from('matches').select('*');
    if (!matches) return;

    const feedMap = [
        // 16vos (73-88) -> 8vos (89-96)
        { src: 74, dest: 89, slot: 'home', win: true },
        { src: 77, dest: 89, slot: 'away', win: true },
        { src: 73, dest: 90, slot: 'home', win: true },
        { src: 75, dest: 90, slot: 'away', win: true },
        { src: 76, dest: 91, slot: 'home', win: true },
        { src: 78, dest: 91, slot: 'away', win: true },
        { src: 79, dest: 92, slot: 'home', win: true },
        { src: 80, dest: 92, slot: 'away', win: true },
        { src: 83, dest: 93, slot: 'home', win: true },
        { src: 84, dest: 93, slot: 'away', win: true },
        { src: 81, dest: 94, slot: 'home', win: true },
        { src: 82, dest: 94, slot: 'away', win: true },
        { src: 86, dest: 95, slot: 'home', win: true },
        { src: 88, dest: 95, slot: 'away', win: true },
        { src: 85, dest: 96, slot: 'home', win: true },
        { src: 87, dest: 96, slot: 'away', win: true },
        // 8vos (89-96) -> Cuartos (97-100)
        { src: 89, dest: 97, slot: 'home', win: true },
        { src: 90, dest: 97, slot: 'away', win: true },
        { src: 93, dest: 98, slot: 'home', win: true },
        { src: 94, dest: 98, slot: 'away', win: true },
        { src: 91, dest: 99, slot: 'home', win: true },
        { src: 92, dest: 99, slot: 'away', win: true },
        { src: 95, dest: 100, slot: 'home', win: true },
        { src: 96, dest: 100, slot: 'away', win: true },
        // Cuartos (97-100) -> Semis (101-102)
        { src: 97, dest: 101, slot: 'home', win: true },
        { src: 98, dest: 101, slot: 'away', win: true },
        { src: 99, dest: 102, slot: 'home', win: true },
        { src: 100, dest: 102, slot: 'away', win: true },
        // Semis (101-102) -> Final (104) y 3er lugar (103)
        { src: 101, dest: 104, slot: 'home', win: true },
        { src: 102, dest: 104, slot: 'away', win: true },
        { src: 101, dest: 103, slot: 'home', win: false },
        { src: 102, dest: 103, slot: 'away', win: false },
    ];

    const getResultTeam = (match, wantWinner) => {
        if (!match || match.status !== 'f') return null;
        if (match.penalty_winner) {
            const winTeam = match.penalty_winner === 'home' ? match.home_team : match.away_team;
            const loseTeam = match.penalty_winner === 'home' ? match.away_team : match.home_team;
            return wantWinner ? winTeam : loseTeam;
        }
        if (match.home_score !== null && match.away_score !== null) {
            if (match.home_score > match.away_score) {
                return wantWinner ? match.home_team : match.away_team;
            } else if (match.away_score > match.home_score) {
                return wantWinner ? match.away_team : match.home_team;
            }
        }
        return null;
    };

    for (const feed of feedMap) {
        const srcMatch = matches.find(m => m.id === feed.src);
        if (!srcMatch || srcMatch.status !== 'f') continue;

        const resolvedTeam = getResultTeam(srcMatch, feed.win);
        if (!resolvedTeam) continue;

        const destMatch = matches.find(m => m.id === feed.dest);
        if (!destMatch) continue;

        const currentVal = feed.slot === 'home' ? destMatch.home_team : destMatch.away_team;
        if (currentVal !== resolvedTeam) {
            console.log(`  Updating Match ${feed.dest} ${feed.slot}_team: ${currentVal} -> ${resolvedTeam}`);
            const updatePayload = feed.slot === 'home' ? { home_team: resolvedTeam } : { away_team: resolvedTeam };
            await supabaseAdmin.from('matches').update(updatePayload).eq('id', feed.dest);
        }
    }
}

async function run() {
    console.log('Fetching live Wikipedia Knockout Stage page...');
    const res = await fetch('https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_knockout_stage');
    const html = await res.text();

    const boxes = html.split('class="footballbox"');
    console.log(`Parsed ${boxes.length - 1} matches from Wikipedia.`);

    const { data: dbMatches, error: dbErr } = await supabaseAdmin.from('matches').select('*').gte('id', 73).lte('id', 104);
    if (dbErr) {
        console.error('Error fetching matches from DB:', dbErr);
        return;
    }
    console.log(`Fetched ${dbMatches.length} knockout matches from Supabase.`);

    let updatedCount = 0;

    for (let i = 1; i < boxes.length; i++) {
        const box = boxes[i];

        // Parse Home Team
        const homeMatch = box.match(/class="fhome"[^>]*>([\s\S]*?)<\/th>/);
        let homeTeam = '';
        if (homeMatch) {
            const homeContent = homeMatch[1];
            const linkMatch = homeContent.match(/<a [^>]*>([^<]+)<\/a>/);
            homeTeam = linkMatch ? linkMatch[1] : homeContent.replace(/<[^>]*>/g, '').trim();
        }

        // Parse Away Team
        const awayMatch = box.match(/class="faway"[^>]*>([\s\S]*?)<\/th>/);
        let awayTeam = '';
        if (awayMatch) {
            const awayContent = awayMatch[1];
            const linkMatch = awayContent.match(/<a [^>]*>([^<]+)<\/a>/);
            awayTeam = linkMatch ? linkMatch[1] : awayContent.replace(/<[^>]*>/g, '').trim();
        }

        // Parse Score
        const scoreMatch = box.match(/class="fscore"[^>]*>([\s\S]*?)<\/th>/);
        let scoreText = '';
        let homeScore = null;
        let awayScore = null;
        if (scoreMatch) {
            scoreText = scoreMatch[1].replace(/<[^>]*>/g, '').trim();
            const numericMatch = scoreText.match(/(\d+)[\u2013\-s](\d+)/);
            if (numericMatch) {
                homeScore = parseInt(numericMatch[1]);
                awayScore = parseInt(numericMatch[2]);
            }
        }

        // Parse Penalties
        let penaltyWinner = null;
        let penaltyScoreText = '';
        if (box.includes('Penalties') || box.includes('Penalty shoot-out')) {
            const penaltiesBlock = box.split(/Penalties|Penalty shoot-out/)[1];
            const penScoreMatch = penaltiesBlock.match(/<th>(\d+)[\u2013\-](?:\d+)?(\d+)<\/th>/) || penaltiesBlock.match(/(\d+)[\u2013\-](\d+)/);
            if (penScoreMatch) {
                const homePen = parseInt(penScoreMatch[1]);
                const awayPen = parseInt(penScoreMatch[2]);
                penaltyScoreText = `${homePen}-${awayPen}`;
                penaltyWinner = homePen > awayPen ? 'home' : 'away';
            }
        }

        const homeCode = resolveTeamCode(homeTeam);
        const awayCode = resolveTeamCode(awayTeam);

        if (!homeCode || !awayCode) {
            // Future placeholder or invalid team
            continue;
        }

        if (homeScore === null || awayScore === null) {
            // Not played yet
            continue;
        }

        // Find match in DB
        const matchInDb = dbMatches.find(m => 
            (m.home_team === homeCode && m.away_team === awayCode) || 
            (m.home_team === awayCode && m.away_team === homeCode)
        );

        if (matchInDb) {
            const realHomeScore = matchInDb.home_team === homeCode ? homeScore : awayScore;
            const realAwayScore = matchInDb.home_team === homeCode ? awayScore : homeScore;
            const realPenaltyWinner = matchInDb.home_team === homeCode ? penaltyWinner : (penaltyWinner === 'home' ? 'away' : (penaltyWinner === 'away' ? 'home' : null));

            // Check if DB needs update
            const needsUpdate = matchInDb.status !== 'f' || 
                                 matchInDb.home_score !== realHomeScore || 
                                 matchInDb.away_score !== realAwayScore ||
                                 matchInDb.penalty_winner !== realPenaltyWinner;

            if (needsUpdate) {
                console.log(`[UPDATE] Match ${matchInDb.id}: ${matchInDb.home_team} vs ${matchInDb.away_team} -> Score: ${realHomeScore}-${realAwayScore} (Penalties: ${realPenaltyWinner || 'None'})`);
                
                await supabaseAdmin.from('matches').update({
                    home_score: realHomeScore,
                    away_score: realAwayScore,
                    penalty_winner: realPenaltyWinner,
                    status: 'f'
                }).eq('id', matchInDb.id);

                updatedCount++;

                // Recalculate prediction points for this match immediately
                await recalculatePointsAndProfiles(matchInDb.id, realHomeScore, realAwayScore, realPenaltyWinner);
            }
        }
    }

    console.log(`Scraper completed. Updated ${updatedCount} matches.`);

    if (updatedCount > 0) {
        // Advance winners in bracket and update profile totals
        await advanceBracketWinners();
        await updateAllProfilesPoints();
        console.log('Successfully recalculated points and advanced bracket winners.');
    }
}

run().catch(console.error);
