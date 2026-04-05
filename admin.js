import { supabase } from './supabaseClient.js';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import { checkAdmin, signOut } from './auth.js';

// Create admin client with service role key for user deletion
const supabaseAdmin = createClient(
    'https://ocrtkgcitqxgbwgtzhwd.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9jcnRrZ2NpdHF4Z2J3Z3R6aHdkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDc1MDkyOSwiZXhwIjoyMDg2MzI2OTI5fQ.0u2WEt6X7KT3m-XlF0HxwjnHS1nAi0gmVZlT_IoFDa4',
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
);

// State
let users = [];
let matches = [];
let selectedAdminMatchday = 1;
let selectedAdminGroup = 'A';
let isCompareMode = false;

// Helper
const getFlagUrl = (teamCode) => {
    const codeMap = {
        'MEX': 'mx', 'BRA': 'br', 'ARG': 'ar', 'USA': 'us', 'CAN': 'ca',
        'ESP': 'es', 'FRA': 'fr', 'GER': 'de', 'ENG': 'gb', 'POR': 'pt',
        'NED': 'nl', 'BEL': 'be', 'CRO': 'hr', 'URU': 'uy', 'KOR': 'kr',
        'JPN': 'jp', 'SEN': 'sn', 'MAR': 'ma', 'SUI': 'ch', 'GHA': 'gh',
        'CMR': 'cm', 'ECU': 'ec', 'KSA': 'sa', 'IRN': 'ir', 'AUS': 'au',
        'CRC': 'cr', 'POL': 'pl', 'TUN': 'tn', 'DEN': 'dk', 'SRB': 'rs',
        'WAL': 'wls', 'QAT': 'qa', 'RSA': 'za', 'PAR': 'py', 'SCO': 'sc',
        'CIV': 'ci', 'COL': 'co', 'PAN': 'pa', 'AUT': 'at', 'ALG': 'dz',
        'JOR': 'jo', 'NZL': 'nz', 'EGY': 'eg', 'UZB': 'uz', 'HAI': 'ht',
        'CUR': 'cw', 'NOR': 'no',
        'CPV': 'cv', 'COD': 'cd', 'IRQ': 'iq', 'BIH': 'ba', 'SWE': 'se', 'TUR': 'tr', 'CZE': 'cz'
    };
    const code = codeMap[teamCode] || 'un';
    return `https://flagcdn.com/w80/${code}.png`;
};

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

let qualifiedThirdPlaces = [];
let selectedThirdPlaceCandidate = null;
let selectedQualifiedToRemove = null;
let allGroupStandings = {};

/**
 * Converts any team/placeholder code into a user-friendly Spanish label.
 *  - Real team codes  -> team name from TEAM_NAMES (e.g. 'MEX' -> 'México')
 *  - '3AEHIJ'         -> '3er Lugar (Grp. A/E/H/I/J)'
 *  - 'W73'            -> 'Ganador Partido #73'
 *  - 'L101'           -> 'Perdedor Partido #101'
 *  - 'TBD'            -> 'Por definir'
 *  - Unknown          -> the code itself
 */
function friendlyTeamLabel(code) {
    if (!code) return 'Por definir';
    if (code === 'TBD') return 'Por definir';
    // Real team
    if (TEAM_NAMES[code]) return TEAM_NAMES[code];
    // Playoff / repechaje slots
    const playoffNames = {
        'UEFA1': 'Repechaje UEFA 1', 'UEFA2': 'Repechaje UEFA 2',
        'UEFA3': 'Repechaje UEFA 3', 'UEFA4': 'Repechaje UEFA 4',
        'IC1': 'Repechaje IC 1', 'IC2': 'Repechaje IC 2', 'CPV': 'Repechaje CPV'
    };
    if (playoffNames[code]) return playoffNames[code];
    // 3rd-place placeholder: '3ABCDF' -> '3er Lugar (Grp. A/B/C/D/F)'
    if (/^3[A-L]{2,}$/.test(code)) {
        const groups = code.substring(1).split('').join('/');
        return `3er Lugar (Grp. ${groups})`;
    }
    // Winner/Loser: 'W73' -> 'Ganador #73', 'L101' -> 'Perdedor #101'
    const wl = code.match(/^([WL])(\d+)$/);
    if (wl) {
        return `${wl[1] === 'W' ? 'Ganador' : 'Perdedor'} Partido #${wl[2]}`;
    }
    // Group-position shorthand: '1A' -> '1° Grupo A', '2B' -> '2° Grupo B'
    const gp = code.match(/^(\d)([A-L])$/);
    if (gp) {
        const ord = { '1': '1°', '2': '2°', '3': '3°' };
        return `${ord[gp[1]] || gp[1]}º Grupo ${gp[2]}`;
    }
    return code; // fallback
}


// Initialize
async function init() {
    const isAdmin = await checkAdmin();
    if (!isAdmin) {
        alert('Acceso Denegado');
        window.location.href = '/index.html';
        return;
    }

    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout de conexión')), 10000));

    try {
        await Promise.race([
            Promise.all([loadUsers(), loadMatches(), loadSettings(), loadPlayoffTeams()]),
            timeout
        ]);

        // Initial Render of Qualified Teams Section
        renderQualifiedTeamsSection();
        loadBracketEditor(4);

    } catch (err) {
        console.error('Admin Init Error:', err);
        document.querySelector('main').innerHTML = `
            <div class="flex flex-col items-center justify-center py-20 bg-red-500/10 rounded-xl border border-red-500/20 m-6">
                <span class="material-icons text-6xl text-red-500 mb-4">wifi_off</span>
                <h2 class="text-2xl font-bold text-red-500">Error de Conexión</h2>
                <p class="text-red-300 mt-2">No se pudieron cargar los datos del panel.</p>
                <button onclick="window.location.reload()" class="mt-6 px-6 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-500 transition-colors">Reintentar</button>
            </div>`;
    }

    setupEventListeners();

    // Logout
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        logoutBtn.onclick = async () => {
            await signOut();
            window.location.href = '/login.html';
        };
    }
}

// --- Data Loading ---

async function loadUsers() {
    console.log('[LOAD USERS] Fetching users from database...');

    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('points', { ascending: false });

    if (error) {
        console.error('[LOAD USERS] Error loading users:', error);
        return;
    }

    const { data: predsData, error: predsError } = await supabase.from('predictions')
        .select('user_id, match_id, home_score, away_score');

    const allPreds = predsData || [];

    users = data.map(u => {
        const uPreds = allPreds.filter(p => p.user_id === u.id && p.home_score !== null && p.away_score !== null);
        return { ...u, predictions: uPreds };
    });

    console.log(`[LOAD USERS] Loaded ${users.length} users`);
    console.log('[LOAD USERS] Test users:', users.filter(u => u.is_test).length);

    renderUsers();
    // Refresh prize pool display now that users are loaded
    if (typeof window._updatePrizeDisplay === 'function') window._updatePrizeDisplay();
}

async function loadMatches() {
    try {
        await supabase.from('matches').delete().gt('id', 104);
    } catch (err) {
        console.error("Cleanup error:", err);
    }

    const { data, error } = await supabase
        .from('matches')
        .select('*')
        .order('id', { ascending: true });

    if (error) {
        console.error("Error loading matches:", error);
        return;
    }

    // Filter out invalid duplicated matches (like ID 105+)
    matches = data.filter(m => m.id <= 104);

    renderMatches();
    if (users.length > 0) renderUsers(); // Re-render to show matchday progress correctly once matches arrive
}

function renderMatches() {
    renderGroupTabs();
    renderMatchesTable();
}

function renderGroupTabs() {
    const container = document.getElementById('group-tabs');
    if (!container) return;

    // Get unique groups for the selected matchday
    const currentMatches = matches.filter(m => m.matchday === selectedAdminMatchday);
    const groups = [...new Set(currentMatches.map(m => m.group_name))].sort();

    // If no group selected or selected group not in current matchday, select first
    if (!selectedAdminGroup || !groups.includes(selectedAdminGroup)) {
        selectedAdminGroup = groups[0] || 'A';
    }

    container.innerHTML = groups.map(group => `
        <button 
            onclick="selectAdminGroup('${group}')"
            class="px-5 py-2 rounded-lg font-bold text-sm transition-all whitespace-nowrap ${selectedAdminGroup === group
            ? 'bg-blue-500 text-white shadow-lg'
            : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'
        }">
            Grupo ${group}
        </button>
    `).join('');
}

window.selectAdminGroup = (group) => {
    selectedAdminGroup = group;
    renderMatches();
};

window.toggleCompareMode = (enabled) => {
    isCompareMode = enabled;
    renderMatchesTable();
};

window.checkTie = (matchId) => {
    const homeInput = document.getElementById(`score-home-${matchId}`);
    const awayInput = document.getElementById(`score-away-${matchId}`);
    const penaltyContainer = document.getElementById(`penalty-container-${matchId}`);

    if (homeInput && awayInput && penaltyContainer) {
        const h = parseInt(homeInput.value);
        const a = parseInt(awayInput.value);

        if (!isNaN(h) && !isNaN(a) && h === a) {
            penaltyContainer.classList.remove('hidden', 'opacity-0', 'pointer-events-none');
        } else {
            penaltyContainer.classList.add('hidden', 'opacity-0', 'pointer-events-none');
            // Optional: Uncheck radios if no longer a tie?
            document.querySelectorAll(`input[name="penalty-winner-${matchId}"]`).forEach(r => r.checked = false);
        }
    }
};

function renderMatchesTable() {
    const tbody = document.getElementById('matches-table-body');
    if (!tbody) return;

    const filteredMatches = matches.filter(m =>
        m.matchday === selectedAdminMatchday &&
        m.group_name === selectedAdminGroup
    );

    if (filteredMatches.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="px-4 py-8 text-center text-slate-500">
                    No hay partidos para este grupo en la Jornada ${selectedAdminMatchday}
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = filteredMatches.map(match => {
        const date = new Date(match.date).toLocaleDateString('es-ES', {
            weekday: 'short', day: 'numeric', month: 'short'
        });
        const time = new Date(match.date).toLocaleTimeString('es-ES', {
            hour: '2-digit', minute: '2-digit'
        });

        const statusClass = match.status === 'f'
            ? 'bg-green-500/20 text-green-400 border-green-500/30'
            : match.status === 'b'
                ? 'bg-red-500/20 text-red-400 border-red-500/30'
                : match.status === 's'
                    ? 'bg-slate-500/20 text-slate-400 border-slate-500/30' // Scheduled
                    : 'bg-blue-500/20 text-blue-400 border-blue-500/30';   // Active

        const statusText = match.status === 'f' ? 'FINAL'
            : match.status === 'b' ? 'BLOQ'
                : match.status === 's' ? 'PROG'
                    : 'ABIERTO';

        const isKnockout = match.matchday >= 4;

        // ── Bracket structure: which source matches feed each slot ─────
        // matchId -> { homeSrc, awaySrc }  (src = match id whose winner plays here)
        const BRACKET_STRUCT = {
            // 16vos (8vos en 32 equipos) — matchday 4/5
            74: { homeSrc: null, awaySrc: null },  // group qualifiers — handled below
            75: { homeSrc: null, awaySrc: null },
            76: { homeSrc: null, awaySrc: null },
            77: { homeSrc: null, awaySrc: null },
            78: { homeSrc: null, awaySrc: null },
            79: { homeSrc: null, awaySrc: null },
            80: { homeSrc: null, awaySrc: null },
            81: { homeSrc: null, awaySrc: null },
            82: { homeSrc: null, awaySrc: null },
            83: { homeSrc: null, awaySrc: null },
            84: { homeSrc: null, awaySrc: null },
            85: { homeSrc: null, awaySrc: null },
            86: { homeSrc: null, awaySrc: null },
            87: { homeSrc: null, awaySrc: null },
            88: { homeSrc: null, awaySrc: null },
            // Quarters — matchday 6
            89: { homeSrc: 74, awaySrc: 77 },
            90: { homeSrc: 73, awaySrc: 75 },
            91: { homeSrc: 76, awaySrc: 78 },
            92: { homeSrc: 79, awaySrc: 80 },
            93: { homeSrc: 83, awaySrc: 84 },
            94: { homeSrc: 81, awaySrc: 82 },
            95: { homeSrc: 86, awaySrc: 88 },
            96: { homeSrc: 85, awaySrc: 87 },
            // Semis — matchday 7
            97: { homeSrc: 89, awaySrc: 90 },
            98: { homeSrc: 91, awaySrc: 92 },
            99: { homeSrc: 93, awaySrc: 94 },
            100: { homeSrc: 95, awaySrc: 96 },
            // Semi-finals matchday 7
            101: { homeSrc: 97, awaySrc: 98 },
            102: { homeSrc: 99, awaySrc: 100 },
            // Final & 3rd — matchday 8
            103: { homeSrc: 101, awaySrc: 102, useLosers: true },
            104: { homeSrc: 101, awaySrc: 102 },
        };

        // Helper: resolve winner/loser of a match to a team code
        const resolveMatchResult = (srcId, useLoser) => {
            const srcMatch = matches.find(m => m.id === srcId);
            if (!srcMatch || srcMatch.status !== 'f') return null;
            let winner = null, loser = null;
            if (srcMatch.penalty_winner) {
                winner = srcMatch.penalty_winner === 'home' ? srcMatch.home_team : srcMatch.away_team;
                loser = srcMatch.penalty_winner === 'home' ? srcMatch.away_team : srcMatch.home_team;
            } else if (srcMatch.home_score != null && srcMatch.away_score != null) {
                if (+srcMatch.home_score > +srcMatch.away_score) { winner = srcMatch.home_team; loser = srcMatch.away_team; }
                else if (+srcMatch.away_score > +srcMatch.home_score) { winner = srcMatch.away_team; loser = srcMatch.home_team; }
            }
            return useLoser ? loser : winner;
        };

        // Generate Dropdown Options for Knockout
        let homeTeamOptions = '';
        let awayTeamOptions = '';

        if (isKnockout) {
            if (Object.keys(allGroupStandings).length === 0) calculateStandings();
            const struct = BRACKET_STRUCT[match.id];

            if (struct && struct.homeSrc) {
                // Higher-round match: options = winner (or loser for 3rd) of source match
                const buildOptions = (srcId, useLoser, currentVal) => {
                    const label = useLoser ? 'Perdedor' : 'Ganador';
                    const resolved = resolveMatchResult(srcId, useLoser);
                    const opts = [`<option value="TBD" ${!currentVal || currentVal === 'TBD' ? 'selected' : ''}>Por definir</option>`];
                    if (resolved) {
                        // Actual resolved team
                        opts.push(`<option value="${resolved}" ${currentVal === resolved ? 'selected' : ''}>${friendlyTeamLabel(resolved)}</option>`);
                    }
                    // Also offer the W/L placeholder as option with friendly name
                    const wlCode = (useLoser ? 'L' : 'W') + srcId;
                    if (!resolved) {
                        opts.push(`<option value="${wlCode}" ${currentVal === wlCode ? 'selected' : ''}>${label} Partido #${srcId}</option>`);
                    }
                    return opts.join('');
                };
                homeTeamOptions = buildOptions(struct.homeSrc, !!struct.useLosers, match.home_team);
                awayTeamOptions = buildOptions(struct.awaySrc, !!struct.useLosers, match.away_team);
            } else {
                // Round of 16 / first knockout round: options = group qualifiers
                let qualifiedList = [];
                Object.values(allGroupStandings).forEach(group => {
                    if (group[0]) qualifiedList.push(group[0].code);
                    if (group[1]) qualifiedList.push(group[1].code);
                    if (group[2] && qualifiedThirdPlaces.includes(group[2].code)) qualifiedList.push(group[2].code);
                });
                // Also include playoff/repechaje teams
                ['UEFA1', 'UEFA2', 'UEFA3', 'UEFA4', 'IC1', 'IC2', 'CPV'].forEach(c => {
                    if (!qualifiedList.includes(c)) qualifiedList.push(c);
                });
                qualifiedList.sort();

                const buildGroupOptions = (currentVal) => {
                    const opts = [`<option value="TBD" ${!currentVal || currentVal === 'TBD' ? 'selected' : ''}>Por definir</option>`];
                    // Ensure current value always appears even if not in list
                    if (currentVal && currentVal !== 'TBD' && !qualifiedList.includes(currentVal)) {
                        qualifiedList.push(currentVal);
                    }
                    qualifiedList.forEach(code => {
                        if (code) opts.push(`<option value="${code}" ${currentVal === code ? 'selected' : ''}>${friendlyTeamLabel(code)}</option>`);
                    });
                    return opts.join('');
                };
                homeTeamOptions = buildGroupOptions(match.home_team);
                awayTeamOptions = buildGroupOptions(match.away_team);
            }
        }

        const homeTeamRender = isKnockout
            ? `<select onchange="updateMatchTeam(${match.id}, 'home', this.value)"
                  class="bg-background-dark border border-white/10 rounded px-1 py-1 text-xs text-white max-w-[140px]">
                  ${homeTeamOptions}
               </select>`
            : `<span class="text-sm font-bold text-white text-right hidden md:inline">${friendlyTeamLabel(match.home_team)}</span>
               <span class="text-xs font-bold text-white md:hidden">${(TEAM_NAMES[match.home_team] || match.home_team || '').substring(0, 3)}</span>`;

        const awayTeamRender = isKnockout
            ? `<select onchange="updateMatchTeam(${match.id}, 'away', this.value)"
                  class="bg-background-dark border border-white/10 rounded px-1 py-1 text-xs text-white max-w-[140px]">
                  ${awayTeamOptions}
               </select>`
            : `<span class="text-sm font-bold text-white hidden md:inline">${friendlyTeamLabel(match.away_team)}</span>
               <span class="text-xs font-bold text-white md:hidden">${(TEAM_NAMES[match.away_team] || match.away_team || '').substring(0, 3)}</span>`;





        return `
        <tr class="hover:bg-white/5 transition-colors group border-b border-white/5 last:border-0">
            <td class="px-4 py-3">
                <div class="flex flex-col">
                    <span class="text-xs font-bold text-white">${date}</span>
                    <span class="text-[10px] text-slate-500">${time}</span>
                </div>
            </td>
            <td class="px-4 py-3">
                <div class="flex items-center justify-end gap-2">
                    ${homeTeamRender}
                    <img src="${getFlagUrl(match.home_team)}" class="w-6 h-6 rounded-full bg-slate-700 shadow-sm">
                </div>
                </div>
            </td>
                </div>
            </td>
                </div>
            </td>
            <td class="px-2 py-3 text-center" colspan="3">
                <div class="flex flex-col items-center">
                    <div class="flex items-center justify-center gap-2 relative">
                        ${isCompareMode ? `
                            <div class="absolute -top-6 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-md border border-white/20 px-3 py-1 rounded-full flex items-center gap-2 shadow-xl pointer-events-none z-20">
                                <span class="material-icons text-[12px] text-green-400">cloud_done</span>
                                <span class="text-xs font-mono font-bold text-white tracking-widest">${match.home_score ?? '-'} : ${match.away_score ?? '-'}</span>
                            </div>
                        ` : ''}
                        <input 
                            type="number" 
                            id="score-home-${match.id}" 
                            value="${match.home_score !== null ? match.home_score : ''}" 
                            class="w-12 h-10 text-center bg-slate-800 border border-slate-600 rounded-lg text-white font-bold text-lg focus:border-blue-500 focus:bg-blue-500/20 outline-none transition-all placeholder-slate-500"
                            placeholder="-"
                            oninput="checkTie(${match.id})"
                        >
                        <span class="text-slate-500 font-bold text-lg">:</span>
                        <input 
                            type="number" 
                            id="score-away-${match.id}" 
                            value="${match.away_score !== null ? match.away_score : ''}" 
                            class="w-12 h-10 text-center bg-slate-800 border border-slate-600 rounded-lg text-white font-bold text-lg focus:border-blue-500 focus:bg-blue-500/20 outline-none transition-all placeholder-slate-500"
                            placeholder="-"
                            oninput="checkTie(${match.id})"
                        >
                    </div>

                    ${isKnockout ? `
                    <div id="penalty-container-${match.id}" class="mt-2 flex items-center gap-2 justify-center transition-all ${(match.home_score === match.away_score && match.home_score !== null) ? '' : 'hidden opacity-0 pointer-events-none'}">
                         <div class="flex bg-slate-800 rounded-lg border border-slate-600 p-1 gap-1">
                            <label class="cursor-pointer relative group">
                                <input type="radio" name="penalty-winner-${match.id}" value="home" class="peer sr-only" ${match.penalty_winner === 'home' ? 'checked' : ''}>
                                <div class="w-8 h-8 flex items-center justify-center rounded-md font-bold text-xs text-slate-400 peer-checked:bg-blue-600 peer-checked:text-white transition-all hover:bg-slate-700">
                                    L
                                </div>
                            </label>
                            
                            <label class="cursor-pointer relative group">
                                <input type="radio" name="penalty-winner-${match.id}" value="away" class="peer sr-only" ${match.penalty_winner === 'away' ? 'checked' : ''}>
                                <div class="w-8 h-8 flex items-center justify-center rounded-md font-bold text-xs text-slate-400 peer-checked:bg-blue-600 peer-checked:text-white transition-all hover:bg-slate-700">
                                    V
                                </div>
                            </label>
                        </div>
                    </div>
                    ` : ''}
                </div>
            </td>
            <td class="px-4 py-3">
                <div class="flex items-center justify-start gap-2">
                    <img src="${getFlagUrl(match.away_team)}" class="w-6 h-6 rounded-full bg-slate-700 shadow-sm">
                    ${awayTeamRender}
                </div>
            </td>
            <td class="px-4 py-3 text-center">
                <span class="px-2 py-1 rounded text-[10px] font-bold border ${statusClass}">
                    ${statusText}
                </span>
            </td>
        </tr>
    `}).join('');
}

window.updateMatchTeam = async (matchId, side, teamCode) => {
    try {
        const update = side === 'home' ? { home_team: teamCode } : { away_team: teamCode };
        await supabase.from('matches').update(update).eq('id', matchId);
        // Dont reload everything, just update local state if possible or reload silently
        const idx = matches.findIndex(m => m.id === matchId);
        if (idx !== -1) {
            if (side === 'home') matches[idx].home_team = teamCode;
            else matches[idx].away_team = teamCode;
        }
        renderMatchesTable(); // Re-render to update flags
    } catch (e) {
        console.error(e);
        alert('Error changing team');
    }
}

window.handleEnterKey = (e, matchId, type) => {
    // Only moving logic via Tab, usually handled directly by browser
};

window.saveAllResults = async () => {
    const button = document.getElementById('save-all-results-btn');
    const originalText = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<span class="material-icons animate-spin">refresh</span> Guardando...';

    let updatedCount = 0;
    let errorCount = 0;

    // Get all matches being displayed
    const currentMatches = matches.filter(m =>
        m.matchday === selectedAdminMatchday &&
        m.group_name === selectedAdminGroup
    );

    for (const match of currentMatches) {
        const homeInput = document.getElementById(`score-home-${match.id}`);
        const awayInput = document.getElementById(`score-away-${match.id}`);
        // Penalty radio:
        const penaltyInput = document.querySelector(`input[name="penalty-winner-${match.id}"]:checked`);

        if (!homeInput || !awayInput) continue;

        const homeScoreStr = homeInput.value.trim();
        const awayScoreStr = awayInput.value.trim();
        const penaltyWinner = penaltyInput ? penaltyInput.value : null;

        // Skip if empty (unless clearing a score, but let's assume valid entry for now)
        if (homeScoreStr === '' || awayScoreStr === '') {
            continue;
        }

        const homeScore = parseInt(homeScoreStr);
        const awayScore = parseInt(awayScoreStr);

        // Check if changed or not finalized or penalty changed
        if (match.home_score !== homeScore || match.away_score !== awayScore || match.status !== 'f' || match.penalty_winner !== penaltyWinner) {
            console.log(`Updating match ${match.id}: ${homeScore}-${awayScore} (${penaltyWinner})`);

            try {
                // Update Match
                const { error } = await supabase.from('matches')
                    .update({
                        home_score: homeScore,
                        away_score: awayScore,
                        penalty_winner: penaltyWinner, // Update penalty
                        status: 'f'  // Auto finalize
                    })
                    .eq('id', match.id);

                if (error) throw error;

                // Calculate Points
                const { error: rpcError } = await supabase.rpc('calculate_points_for_match_v2', {
                    match_id_param: match.id
                });

                if (rpcError) {
                    console.warn('RPC failed, calculating manually');
                    await calculatePointsManually(match.id, homeScore, awayScore);
                }

                updatedCount++;

            } catch (err) {
                console.error(`Error updating match ${match.id}:`, err);
                errorCount++;
            }
        }
    }

    // Refresh everything
    await loadMatches();
    await loadUsers(); // Refresh leaderboard

    button.disabled = false;
    button.innerHTML = originalText;

    if (updatedCount > 0) {
        alert(`✅ ${updatedCount} partidos actualizados correctamente.\n${errorCount > 0 ? `⚠️ ${errorCount} errores.` : ''}`);

        // Auto-advance bracket winners if we're in knockout rounds
        if (selectedAdminMatchday >= 4 && selectedAdminMatchday <= 7) {
            console.log("[BRACKET] Auto-advancing bracket winners after saving knockout results.");
            await advanceBracketWinners();
        }

    } else if (errorCount > 0) {
        alert(`❌ Error al actualizar partidos.`);
    } else {
        alert('ℹ️ No hubo cambios para guardar.');
    }
};

async function calculatePointsManually(matchId, homeScore, awayScore) {
    const { data: preds } = await supabase.from('predictions').select('*').eq('match_id', matchId);
    if (!preds) return;

    for (const p of preds) {
        let pts = 0;
        if (p.home_score === homeScore && p.away_score === awayScore) {
            pts = 8;
        } else {
            const realDiff = homeScore - awayScore;
            const predDiff = p.home_score - p.away_score;
            const realWinner = Math.sign(realDiff);
            const predWinner = Math.sign(predDiff);

            if (realWinner === predWinner) {
                pts = (realDiff === predDiff) ? 5 : 3;
            }
        }

        await supabase.from('predictions').update({ points_earned: pts }).eq('id', p.id);
    }
}

async function loadSettings() {
    try {
        const { data, error } = await supabase.from('app_settings').select('*');
        if (error) throw error;
        if (!data) return;

        const feeSetting = data.find(s => s.key === 'entry_fee');
        const distSetting = data.find(s => s.key === 'prize_distribution');

        if (feeSetting) document.getElementById('entry-fee').value = feeSetting.value;

        // Init the automatic prize calculator (no percentages needed)
        initPrizeDistributionUI();

        // Restore enabled state for 4th/5th place from saved setting
        const placesSetting = data.find(s => s.key === 'prize_places_enabled');
        if (placesSetting && placesSetting.value) {
            if (placesSetting.value.p4) document.getElementById('toggle-dist-4')?.click();
            if (placesSetting.value.p5) document.getElementById('toggle-dist-5')?.click();
        }


        const regEnabledSetting = data.find(s => s.key === 'registration_enabled');
        if (regEnabledSetting !== undefined) {
            document.getElementById('reg-enabled').checked = regEnabledSetting.value;
        } else {
            document.getElementById('reg-enabled').checked = true;
        }

        // Matchday Status Toggles UI
        const settingsCard = document.querySelector('.bg-surface-dark .space-y-4');
        let matchdayStatusDiv = document.getElementById('matchday-status-toggles');

        if (!matchdayStatusDiv && settingsCard) {
            matchdayStatusDiv = document.createElement('div');
            matchdayStatusDiv.id = 'matchday-status-toggles';
            matchdayStatusDiv.className = 'pt-4 border-t border-white/10 space-y-3';
            settingsCard.insertBefore(matchdayStatusDiv, settingsCard.lastElementChild);
        }



        if (matchdayStatusDiv) {
            const m1 = data.find(s => s.key === 'matchday_status_1')?.value ?? true;
            const m2 = data.find(s => s.key === 'matchday_status_2')?.value ?? false;
            const m3 = data.find(s => s.key === 'matchday_status_3')?.value ?? false;
            const m4 = data.find(s => s.key === 'matchday_status_4')?.value ?? false; // 16vos
            const m5 = data.find(s => s.key === 'matchday_status_5')?.value ?? false; // 8vos
            const m6 = data.find(s => s.key === 'matchday_status_6')?.value ?? false; // 4tos
            const m7 = data.find(s => s.key === 'matchday_status_7')?.value ?? false; // Semi
            const m8 = data.find(s => s.key === 'matchday_status_8')?.value ?? false; // Final

            matchdayStatusDiv.innerHTML = `
                <label class="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Estado de Jornadas (Activa)</label>
                <div class="space-y-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                    <!-- Group Stage -->
                    ${[1, 2, 3].map(n => `
                        <div class="flex items-center justify-between bg-background-dark p-2 rounded-lg border border-white/5">
                            <span class="text-sm font-bold text-white">Jornada ${n}</span>
                            <label class="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" class="sr-only peer" ${eval(`m${n}`) ? 'checked' : ''} onchange="toggleMatchdayStatus(${n}, this.checked)">
                                <div class="w-9 h-5 bg-slate-700 rounded-full peer peer-checked:bg-green-500 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
                            </label>
                        </div>
                    `).join('')}

                    <!-- Knockout Stage -->
                    ${[
                    { n: 4, l: '16vos' }, { n: 5, l: '8vos' }, { n: 6, l: '4tos' }, { n: 7, l: 'Semis' }, { n: 8, l: 'Finales' }
                ].map(item => `
                         <div class="flex items-center justify-between bg-background-dark p-2 rounded-lg border border-white/5">
                            <span class="text-sm font-bold text-white">${item.l}</span>
                            <label class="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" class="sr-only peer" ${eval(`m${item.n}`) ? 'checked' : ''} onchange="toggleMatchdayStatus(${item.n}, this.checked)">
                                <div class="w-9 h-5 bg-slate-700 rounded-full peer peer-checked:bg-blue-500 peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all"></div>
                            </label>
                        </div>
                    `).join('')}
                </div>
        `;
        }

        // Load Qualified Third Places
        const q3 = data.find(s => s.key === 'qualified_third_places');
        if (q3 && Array.isArray(q3.value)) {
            qualifiedThirdPlaces = q3.value;
        }

    } catch (err) {
        console.error('Error loading settings:', err);
    }
}

const PLAYOFF_KEYS = ['UEFA1', 'UEFA2', 'UEFA3', 'UEFA4', 'IC1', 'IC2', 'CPV'];
let playoffMapping = {};

async function loadPlayoffTeams() {
    console.log('[PLAYOFF TEAMS] Loading playoff teams...');
    try {
        const { data } = await supabase.from('app_settings').select('value').eq('key', 'playoff_mapping').single();
        if (data && data.value) {
            playoffMapping = data.value;
        } else {
            playoffMapping = {};
            PLAYOFF_KEYS.forEach(k => playoffMapping[k] = k);
        }
        renderPlayoffTeams();
    } catch (err) {
        console.error('[PLAYOFF TEAMS] Error loading:', err);
    }
}

function renderPlayoffTeams() {
    const container = document.getElementById('playoff-teams-container');
    if (!container) return;

    container.innerHTML = PLAYOFF_KEYS.map(key => {
        const currentName = playoffMapping[key] || key;
        return `
            <div class="bg-background-dark rounded-lg p-4 border border-white/10 hover:border-white/20 transition-all">
            <div class="flex items-center gap-3 mb-3">
                <div class="w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center">
                    <span class="material-icons text-yellow-400">help_outline</span>
                </div>
                <div class="flex-1">
                    <p class="text-xs text-slate-500 font-bold uppercase">Repechaje: ${key}</p>
                    <p class="text-sm font-black text-white truncate max-w-[150px]" title="${currentName}">${currentName}</p>
                </div>
            </div>
            <div class="flex gap-2">
                <input type="text" id="playoff-${key}" value="${currentName}" class="flex-1 bg-surface-dark border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-blue-500 outline-none" />
                <button onclick="updatePlayoffTeam('${key}')" class="px-3 py-2 bg-blue-500 hover:bg-blue-400 text-white rounded-lg font-bold text-sm transition-all flex items-center justify-center">
                    <span class="material-icons text-sm">save</span>
                </button>
            </div>
        </div>
            `}).join('');
}

function renderUsers() {
    const tbody = document.getElementById('users-table-body');
    const badge = document.getElementById('user-count-badge');
    if (!tbody) return;

    if (badge) badge.textContent = `${users.length} Usuarios`;

    tbody.innerHTML = users.map(user => `
        <tr class="hover:bg-white/5 transition-colors group border-b border-white/5 last:border-0">
            <td class="px-4 py-3">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold ring-2 ring-white/10">
                        ${user.username ? user.username.substring(0, 2).toUpperCase() : 'U'}
                    </div>
                    <div class="flex flex-col">
                        <span class="font-bold text-white text-sm flex items-center gap-2">
                            ${user.username || 'Sin Nombre'}
                            ${user.is_test ? '<span class="text-[8px] bg-slate-700 text-slate-400 px-1 rounded">TEST</span>' : ''}
                        </span>
                        <span class="text-[10px] text-slate-500 truncate max-w-[120px]">${user.email || user.id.substring(0, 8) + '...'}</span>
                    </div>
                </div>
            </td>
            <td class="px-4 py-3 text-center">
                 <button onclick="togglePaid('${user.id}', ${!user.paid})" 
                    class="px-2 py-0.5 rounded text-[10px] font-bold uppercase transition-colors ${user.paid ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}">
                    ${user.paid ? 'Pagado' : 'Pendiente'}
                 </button>
            </td>
            <td class="px-4 py-3 text-center">
                <span class="font-black text-white">${user.points || 0}</span>
            </td>
            <td class="px-4 py-3 text-center">
                <span class="font-bold text-emerald-400">${user.exact_score_count || 0}</span>
            </td>
            <td class="px-4 py-3">
                ${renderUserPredictionProgress(user)}
            </td>
            <td class="px-4 py-3 text-right">
                 <button onclick="toggleAdmin('${user.id}', ${user.role !== 'admin'})" class="p-1.5 rounded-lg hover:bg-white/10 transition-colors ${user.role === 'admin' ? 'text-accent-gold' : 'text-slate-600'}">
                    <span class="material-icons text-sm">shield</span>
                 </button>
                 <button onclick="deleteAnyUser('${user.id}', '${user.username || user.email || 'Usuario'}')" class="p-1.5 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors" title="Eliminar Usuario">
                    <span class="material-icons text-sm">delete</span>
                 </button>
            </td>
        </tr>
            `).join('');
}

function renderUserPredictionProgress(user) {
    if (!matches || matches.length === 0) return '<span class="text-[10px] text-slate-500">Cargando...</span>';

    const userPreds = user.predictions || [];
    const predsByMatchId = new Set(userPreds.map(p => p.match_id));

    const mLabels = {
        1: 'J1', 2: 'J2', 3: 'J3',
        4: '16V', 5: '8V', 6: '4T', 7: 'SM', 8: 'FN'
    };

    let html = '<div class="flex flex-wrap gap-1 justify-center">';

    for (let matchday = 1; matchday <= 8; matchday++) {
        const matchesInMd = matches.filter(m => m.matchday === matchday && m.home_team !== 'TBD' && m.away_team !== 'TBD');

        if (matchesInMd.length === 0) continue;

        let completed = 0;
        matchesInMd.forEach(m => {
            if (predsByMatchId.has(m.id)) completed++;
        });

        const total = matchesInMd.length;
        const isComplete = completed === total;
        const isPartial = completed > 0 && completed < total;

        // bg-green complete, yellow partial, slate none
        let bgClass = 'bg-slate-700/50 text-slate-500 border-slate-600/50';
        if (isComplete) bgClass = 'bg-green-500/20 text-green-400 border-green-500/30';
        else if (isPartial) bgClass = 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';

        html += `<div title="${mLabels[matchday]}: ${completed}/${total} capturados" 
                      class="px-1.5 py-0.5 rounded text-[9px] font-bold border cursor-help ${bgClass}">
                    ${mLabels[matchday]}
                 </div>`;
    }

    html += '</div>';
    return html;
}

// --- Actions ---

window.togglePaid = async (userId, isPaid) => {
    try {
        const { error } = await supabaseAdmin.from('profiles').update({ paid: isPaid }).eq('id', userId);
        if (error) throw error;
        await loadUsers();
    } catch (err) {
        console.error('[TOGGLE PAID] Error:', err);
        alert('Error actualizando pago: ' + err.message);
    }
};

window.toggleAdmin = async (userId, makeAdmin) => {
    if (!confirm(`¿${makeAdmin ? 'Dar' : 'Quitar'} permisos de admin a este usuario ? `)) return;
    try {
        const { error } = await supabaseAdmin.from('profiles').update({ role: makeAdmin ? 'admin' : 'user' }).eq('id', userId);
        if (error) throw error;
        await loadUsers();
    } catch (err) {
        console.error('[TOGGLE ADMIN] Error:', err);
        alert('Error actualizando rol: ' + err.message);
    }
};

window.createTestUsers = async () => {
    if (!confirm('¿Crear 10 usuarios de prueba (J1-J3) y marcarlos como pagados?')) return;
    if (!matches || matches.length === 0) return alert('No hay partidos cargados.');

    console.log('[CREATE TEST USERS] Starting creation process...');

    try {
        let successCount = 0;
        let errorCount = 0;

        for (let i = 0; i < 10; i++) {
            const randomNum = Math.floor(Math.random() * 100000);
            const name = `TestUser_${randomNum}`;
            // Using a cleaner email format
            const email = `testuser${randomNum}@quinielatest.com`;
            const password = 'TestPassword123!';

            console.log(`[CREATE TEST USER ${i + 1}/10] Creating: ${email}`);

            // 1. Create Auth User
            const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
                email,
                password,
                email_confirm: true,
                user_metadata: { username: name, full_name: name, is_test: true }
            });

            if (authError) {
                console.error(`[CREATE TEST USER ${i + 1}] Auth Error:`, authError);
                errorCount++;
                continue;
            }

            if (!authData.user) {
                console.error(`[CREATE TEST USER ${i + 1}] No user data returned`);
                errorCount++;
                continue;
            }

            const userId = authData.user.id;

            // Wait a bit to avoid race conditions with triggers
            await new Promise(r => setTimeout(r, 200));

            // 2. Upsert Profile (Ensure Paid = true)
            const { error: profileError } = await supabaseAdmin.from('profiles').upsert({
                id: userId,
                is_test: true,
                paid: true, // Always paid
                username: name,
                full_name: name,
                role: 'user'
            });

            if (profileError) {
                console.error(`[CREATE TEST USER ${i + 1}] Profile Error:`, profileError);
            }

            // 3. Create Predictions (Only Matchdays 1, 2, 3)
            const matchdays1to3 = matches.filter(m => m.matchday <= 3);
            const preds = matchdays1to3.map(m => ({
                user_id: userId,
                match_id: m.id,
                home_score: Math.floor(Math.random() * 4), // 0-3
                away_score: Math.floor(Math.random() * 4)  // 0-3
            }));

            const { error: predError } = await supabaseAdmin.from('predictions').insert(preds);

            if (predError) {
                console.error(`[CREATE TEST USER ${i + 1}] Predictions Error:`, predError);
            } else {
                successCount++;
            }
        }

        alert(`✅ Proceso finalizado.\nCreados: ${successCount}\nFallidos: ${errorCount}`);
        await loadUsers();

    } catch (err) {
        console.error('[CREATE TEST USERS] Fatal Error:', err);
        alert('Error creando usuarios test: ' + err.message);
    }
};

window.simulateGroupStageResults = async () => {
    if (!confirm('¿Generar resultados J1-J3?\n\n- Creará predicciones para TI (Admin).\n- Simulará resultados.\n- Recalculará puntos.')) return;

    const btn = document.querySelector('button[onclick="simulateGroupStageResults()"]');
    const originalText = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = 'Procesando...';
    }

    try {
        console.log('[SIMULATE] Starting...');

        // Filter matches (Matchday 1-3)
        const groupMatches = matches.filter(m => m.matchday <= 3);

        // 0. GENERATE PREDICTIONS FOR ALL USERS (Admin + Test + Regular)
        console.log('[SIMULATE] Generating random predictions for ALL users...');

        // Fetch ALL profiles
        const { data: allPROFILES, error: profileErr } = await supabase.from('profiles').select('id');
        if (profileErr) throw profileErr;

        if (allPROFILES && allPROFILES.length > 0) {
            const allPreds = [];

            for (const profile of allPROFILES) {
                // Generate random scores for each match in the group stage (J1-J3)
                groupMatches.forEach(m => {
                    allPreds.push({
                        user_id: profile.id,
                        match_id: m.id,
                        home_score: Math.floor(Math.random() * 4), // 0-3
                        away_score: Math.floor(Math.random() * 4)  // 0-3
                    });
                });
            }

            // Batch Upsert (All at once for efficiency)
            // Note: Upsert overwrites existing predictions if conflict on (user_id, match_id)
            const { error: batchErr } = await supabaseAdmin.from('predictions').upsert(allPreds);

            if (batchErr) {
                console.error('[SIMULATE] Error batch upserting all preds:', batchErr);
                alert('Error generando predicciones: ' + batchErr.message);
            } else {
                console.log(`[SIMULATE] Generated/Updated ${allPreds.length} predictions for ${allPROFILES.length} users.`);
            }
        }

        console.log('[SIMULATE RESULTS] Starting simulation...');

        let processed = 0;

        for (const match of groupMatches) {
            const newHomeScore = Math.floor(Math.random() * 4);
            const newAwayScore = Math.floor(Math.random() * 4);

            // 1. Update Match
            const { error } = await supabaseAdmin.from('matches')
                .update({
                    home_score: newHomeScore,
                    away_score: newAwayScore,
                    status: 'f' // Finished
                })
                .eq('id', match.id);

            if (error) {
                console.error(`Error updating match ${match.id}`, error);
                continue;
            }

            // 2. Calculate Points MANUALLY for ALL predictions for this match
            // This ensures test users get points even if RPC fails or triggers are missing
            const { data: currentPreds } = await supabaseAdmin.from('predictions')
                .select('*')
                .eq('match_id', match.id);

            if (currentPreds) {
                for (const p of currentPreds) {
                    // Skip if no prediction
                    if (p.home_score === null || p.away_score === null || p.home_score === undefined || p.away_score === undefined) continue;

                    let pts = 0;
                    const pHome = Number(p.home_score);
                    const pAway = Number(p.away_score);
                    const mHome = Number(newHomeScore);
                    const mAway = Number(newAwayScore);

                    // Exact Match (3 points for winner + 5 bonus = 8 total)
                    if (pHome === mHome && pAway === mAway) {
                        pts = 8;
                    } else {
                        // Check Winner / Draw
                        const realDiff = mHome - mAway;
                        const predDiff = pHome - pAway;
                        const realWinner = Math.sign(realDiff); // 1 (Home), -1 (Away), 0 (Draw)
                        const predWinner = Math.sign(predDiff);

                        if (realWinner === predWinner) {
                            pts = 3; // Correct result only
                        }
                    }

                    if (pts !== p.points_earned) {
                        await supabaseAdmin.from('predictions')
                            .update({ points_earned: pts })
                            .eq('id', p.id);
                    }
                }
            }

            processed++;
        }

        console.log('[SIMULATE RESULTS] Matches updated. Recalculating profile totals...');
        await updateAllProfilesPoints();

        alert(`✅ Simulación completada para ${processed} partidos.\nPuntos actualizados.`);
        await loadMatches(); // Refresh UI
        await loadUsers();   // Refresh Leaderboard
        await calculateStandings(); // Update Standings Logic

    } catch (err) {
        console.error('[SIMULATE RESULTS] Error:', err);
        alert('Error: ' + err.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    }
}

// Helper to update total points for all users in profiles table
async function updateAllProfilesPoints() {
    console.log('[UPDATE PROFILES] Starting update...');
    try {
        // 1. Fetch all users to initialize
        const { data: users, error: userError } = await supabase.from('profiles').select('id');
        if (userError) throw userError;

        const userPoints = {};
        const userExacts = {};
        users.forEach(u => { userPoints[u.id] = 0; userExacts[u.id] = 0; }); // Init all to 0

        // 2. Fetch all predictions with points > 0
        const { data: preds, error } = await supabase.from('predictions')
            .select('user_id, points_earned')
            .gt('points_earned', 0); // Only positive points matter for sum

        if (error) throw error;

        // 3. Aggregate points & Exacts
        if (preds) {
            preds.forEach(p => {
                const pts = p.points_earned || 0;
                if (userPoints[p.user_id] !== undefined) {
                    userPoints[p.user_id] += pts;
                    if (pts === 8) userExacts[p.user_id]++;
                } else {
                    userPoints[p.user_id] = pts;
                    userExacts[p.user_id] = (pts === 8) ? 1 : 0;
                }
            });
        }

        // 4. Update profiles
        const userIds = Object.keys(userPoints);
        console.log(`[UPDATE PROFILES] Updating ${userIds.length} users...`);

        // Batch updates loop
        // Batch updates loop with Robust Fallback
        let exactMatchesMissing = false;
        for (const uid of userIds) {
            const updates = { points: userPoints[uid] };
            // Only include exact_score_count if we haven't detected it's missing
            if (!exactMatchesMissing) updates.exact_score_count = userExacts[uid];

            const { error } = await supabase.from('profiles')
                .update(updates)
                .eq('id', uid);

            // Handle error (likely missing column)
            if (error) {
                if (!exactMatchesMissing) {
                    console.warn(`Error updating profile ${uid} (likely missing column), retrying points only...`, error);
                    exactMatchesMissing = true; // Flag to skip column for rest

                    // Retry immediately without exact_score_count
                    const { error: retryError } = await supabase.from('profiles')
                        .update({ points: userPoints[uid] }) // Points only
                        .eq('id', uid);

                    if (retryError) console.error(`Retry failed for user ${uid}:`, retryError);
                } else {
                    console.error(`Error updating user ${uid}:`, error);
                }
            }
        }

    } catch (err) {
        console.error('[UPDATE PROFILES] Error:', err);
    }
}

window.resetApp = async () => {
    // Determine current user ID
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return alert('No estás autenticado.');

    if (!confirm('⚠️ PELIGRO: ¿Estás seguro de BORRAR TODO?\n\n- Se borrarán predicciones.\n- Se resetearán partidos.\n- Admin (Tú) se reseteará a 0 puntos.')) return;

    if (!confirm('¿Realmente seguro? No hay vuelta atrás.')) return;

    const btn = document.querySelector('button[onclick="resetApp()"]');
    const originalText = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = 'Borrando...';
    }

    try {
        console.log('[RESET APP] Starting full wipe...');

        // 1. Delete Predictions (All) using UUID filter trick
        // neq '00000000-...' usually matches all standard UUIDs
        const { error: predError, count: predCount } = await supabase.from('predictions')
            .delete({ count: 'exact' })
            .neq('id', '00000000-0000-0000-0000-000000000000');

        if (predError) {
            console.error('Error deleting predictions:', predError);
            alert('Error borrando predicciones: ' + predError.message);
        } else {
            console.log(`[RESET APP] Predictions deleted.`);
        }

        // 2. Delete Other Users
        const { data: allUsers } = await supabaseAdmin.auth.admin.listUsers();
        if (allUsers?.users) {
            const usersToDelete = allUsers.users.filter(u => u.id !== user.id && u.email !== 'zippo0189@gmail.com');
            for (const u of usersToDelete) {
                await supabaseAdmin.auth.admin.deleteUser(u.id);
            }
            console.log(`[RESET APP] Deleted ${usersToDelete.length} users.`);
        }

        // 3. Reset ALL Profile Points (Everyone gets 0)
        // Diagnostic
        const { data: userBefore } = await supabase.from('profiles').select('points').eq('id', user.id).single();
        const startPoints = userBefore ? userBefore.points : 'unknown';

        const { error: profileError, count: profileCount } = await supabase.from('profiles')
            .update({ points: 0, exact_score_count: 0 })
            .neq('id', '00000000-0000-0000-0000-000000000000') // Trick to update all records
            .select('*', { count: 'exact' });

        const { data: userAfter } = await supabase.from('profiles').select('points').eq('id', user.id).single();
        const endPoints = userAfter ? userAfter.points : 'unknown';

        if (profileError) {
            console.error('Error resetting profiles:', profileError);
            alert('Error reseteando perfiles: ' + profileError.message);
        } else {
            console.log(`[RESET APP] Profiles reset.`);
            if (endPoints !== 0) {
                alert(`FALLO UPDATE: Puntos antes: ${startPoints}, Despues: ${endPoints}. Revisa RLS/Permisos.`);
            } else {
                console.log('Update exitoso.');
            }
        }

        // 4. Reset Matches Scores and Status
        const { error: matchError, data: updatedMatches } = await supabase.from('matches')
            .update({
                home_score: null,
                away_score: null,
                status: 'a', // 'a' = Open
                penalty_winner: null
            })
            .gt('id', 0) // Apply to all
            .select('id');

        if (matchError) {
            console.error('Error resetting matches:', matchError);
            alert('Error reseteando partidos: ' + matchError.message);
        } else {
            console.log(`[RESET APP] Matches reset: ${updatedMatches?.length}`);
        }

        // 5. Reset Knockout Brackets (Matchday >= 4)
        const { error: bracketError } = await supabase.from('matches')
            .update({
                home_team: 'TBD',
                away_team: 'TBD'
            })
            .gte('matchday', 4);

        if (bracketError) {
            console.error('Error wiping brackets:', bracketError);
        } else {
            console.log('[RESET APP] Bracket teams wiped.');
        }

        // 6. Reset Qualified Third Places
        const { error: thirdPlacesError } = await supabase.from('app_settings')
            .update({ value: [] })
            .eq('key', 'qualified_third_places');

        if (thirdPlacesError) {
            console.error('Error wiping qualified third places:', thirdPlacesError);
        } else {
            console.log('[RESET APP] Qualified third places wiped.');
        }

        alert('✅ Aplicación reiniciada. La página se recargará.');
        window.location.reload();

    } catch (err) {
        console.error('[RESET APP] Fatal Error:', err);
        alert('Error fatal: ' + err.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    }
};

window.deleteAnyUser = async (id, name) => {
    if (!confirm(`⚠️ ALERTA: ¿Estás seguro de que deseas ELIMINAR permanentemente a "${name}"?\n\nEsta acción borrará al usuario y todas sus predicciones. NO SE PUEDE DESHACER.`)) return;

    if (!confirm(`¿Realmente seguro de borrar a ${name}?`)) return;

    console.log(`[DELETE USER] Deleting single user: ${id} `);

    try {
        await supabase.from('predictions').delete().eq('user_id', id);
        await supabase.from('profiles').delete().eq('id', id);

        const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id);

        if (authError && (!authError.message || !authError.message.includes('User not found'))) {
            throw authError;
        }

        alert('✅ Usuario eliminado');
        await loadUsers();

    } catch (err) {
        console.error('[DELETE TEST USER] Error:', err);
        alert('Error eliminando usuario: ' + err.message);
    }
};

window.toggleMatchdayStatus = async (matchday, active) => {
    try {
        await supabase.from('app_settings').upsert({ key: `matchday_status_${matchday}`, value: active });
    } catch (err) { console.error(err); alert('Error al cambiar estado'); }
};

window.updatePlayoffTeam = async (key) => {
    const input = document.getElementById(`playoff-${key}`);
    const newName = input?.value?.trim();
    if (!newName) return alert('Ingresa un nombre');

    const oldName = playoffMapping[key] || key;

    if (!confirm(`¿Actualizar "${oldName}" a "${newName}" en todos los partidos?`)) return;

    try {
        const { error: err1 } = await supabase.from('matches').update({ home_team: newName }).eq('home_team', oldName);
        const { error: err2 } = await supabase.from('matches').update({ away_team: newName }).eq('away_team', oldName);

        if (err1 || err2) throw (err1 || err2);

        // Update Mapping
        playoffMapping[key] = newName;
        await supabase.from('app_settings').upsert({ key: 'playoff_mapping', value: playoffMapping });

        alert(`✅ Equipo actualizado: ${oldName} → ${newName}`);
        await loadMatches();
        renderPlayoffTeams();
    } catch (err) {
        console.error(err);
        alert('Error al actualizar: ' + err.message);
    }
};

window.resetAllUsers = async () => {
    const secret = prompt('Escribe "DELETE" para confirmar borrado de TODOS los usuarios (excepto admins).');
    if (secret !== 'DELETE') return;
    try {
        await supabase.from('profiles').delete().neq('role', 'admin');
        alert('Base de datos depurada.');
        await loadUsers();
    } catch (err) { console.error(err); alert('Error crítico'); }
};

function setupEventListeners() {
    // Save Settings
    const saveBtn = document.getElementById('save-settings-btn');
    if (saveBtn) {
        saveBtn.onclick = async () => {
            const fee = document.getElementById('entry-fee').value;
            const regEnabled = document.getElementById('reg-enabled').checked;

            // Read which extra places are active (driven by the toggle state in initPrizeDistributionUI)
            // We detect it by checking if the card border has been set (enabled)
            const card4 = document.getElementById('card-dist-4');
            const card5 = document.getElementById('card-dist-5');
            const p4Enabled = card4 && !card4.classList.contains('opacity-40');
            const p5Enabled = card5 && !card5.classList.contains('opacity-40');

            if (fee) await supabase.from('app_settings').upsert({ key: 'entry_fee', value: parseInt(fee) });
            await supabase.from('app_settings').upsert({ key: 'prize_places_enabled', value: { p4: p4Enabled, p5: p5Enabled } });
            await supabase.from('app_settings').upsert({ key: 'registration_enabled', value: regEnabled });

            alert('✅ Configuración guardada');
        };
    }

    // Matchday Filters
    document.querySelectorAll('#admin-matchday-filters button').forEach(btn => {
        btn.onclick = (e) => {
            selectedAdminMatchday = parseInt(e.target.dataset.matchday);
            selectedAdminGroup = null;
            document.querySelectorAll('#admin-matchday-filters button').forEach(b => {
                const isActive = parseInt(b.dataset.matchday) === selectedAdminMatchday;
                b.className = isActive
                    ? "px-3 py-1.5 rounded-md text-xs font-bold bg-blue-500 text-white shadow-lg"
                    : "px-3 py-1.5 rounded-md text-xs font-bold text-slate-400 hover:text-white hover:bg-white/5";
            });
            renderMatches();
        };
    });
}

// --- Prize Distribution UI ---
// Exposed globally so loadUsers can trigger refresh after users load
window._updatePrizeDisplay = null;

function initPrizeDistributionUI() {
    let enable4 = false;
    let enable5 = false;

    /**
     * Core calculation — automatic formula.
     * 5th place = costoEntrada + 500 (base fija)
     * Remaining pool split among top places with fixed proportions.
     */
    function calcPrizes(pool, fee, with4, with5) {
        if (pool <= 0 || fee <= 0) return null;
        const BONO_5 = 500;
        const p5 = with5 ? fee + BONO_5 : 0;
        const remanente = pool - p5;
        if (remanente <= 0) return null;

        // Proportions over remanente
        let prop;
        if (with5)       prop = { p1: 0.42, p2: 0.25, p3: 0.18, p4: 0.15 };
        else if (with4)  prop = { p1: 0.47, p2: 0.29, p3: 0.24 };
        else             prop = { p1: 0.50, p2: 0.32, p3: 0.18 };

        let p1 = remanente * prop.p1;
        let p2 = remanente * prop.p2;
        let p3 = remanente * prop.p3;
        let p4 = (with4 || with5) ? remanente * prop.p4 : 0;

        // Guard: 4th must beat 5th
        if (with5 && p4 <= p5) {
            const deficit = p5 - p4 + 1;
            const pool123 = p1 + p2 + p3;
            const factor = (pool123 - deficit) / pool123;
            p1 *= factor; p2 *= factor; p3 *= factor;
            p4 += deficit;
        }

        const r = (n) => Math.round(n * 100) / 100;
        p1 = r(p1); p2 = r(p2); p3 = r(p3); p4 = r(p4);
        const p5final = with5 ? r(pool - p1 - p2 - p3 - p4) : 0;

        return { p1, p2, p3, p4, p5: p5final };
    }

    const fmt = (n) => n > 0
        ? `$${n.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`
        : '$0';

    function updateDisplay() {
        const fee = parseFloat(document.getElementById('entry-fee')?.value) || 0;
        const realUsers = (typeof users !== 'undefined') ? users.filter(u => !u.is_test).length : 0;
        const pool = fee * realUsers;

        // Header pool
        const poolEl = document.getElementById('estimated-pool');
        const partEl = document.getElementById('pool-participants');
        if (poolEl) poolEl.textContent = pool > 0 ? fmt(pool) : '$0';
        if (partEl) partEl.textContent = realUsers;

        const prizes = calcPrizes(pool, fee, enable4, enable5);

        const setVal = (id, val, fallback = '–') => {
            const el = document.getElementById(id);
            if (!el) return;
            el.textContent = prizes ? fmt(val) : fallback;
        };

        if (prizes) {
            setVal('dist-val-1', prizes.p1);
            setVal('dist-val-2', prizes.p2);
            setVal('dist-val-3', prizes.p3);
            document.getElementById('dist-val-4').textContent = (enable4 || enable5) ? fmt(prizes.p4) : '–';
            document.getElementById('dist-val-5').textContent = enable5 ? fmt(prizes.p5) : '–';
        } else {
            ['dist-val-1','dist-val-2','dist-val-3'].forEach(id => {
                const el = document.getElementById(id); if (el) el.textContent = '$0';
            });
            ['dist-val-4','dist-val-5'].forEach(id => {
                const el = document.getElementById(id); if (el) el.textContent = '–';
            });
        }
    }

    // Expose so loadUsers can call it after users are fetched
    window._updatePrizeDisplay = updateDisplay;

    function setupToggle(num, getter, setter) {
        const btn  = document.getElementById(`toggle-dist-${num}`);
        const card = document.getElementById(`card-dist-${num}`);
        if (!btn) return;

        btn.addEventListener('click', () => {
            const nowEnabled = !getter();
            setter(nowEnabled);

            // Card style
            if (card) {
                card.classList.toggle('opacity-40', !nowEnabled);
                card.style.borderColor = nowEnabled
                    ? (num === 4 ? 'rgba(96,165,250,0.35)' : 'rgba(192,132,252,0.35)')
                    : '';
            }
            // Button icon
            btn.innerHTML = nowEnabled
                ? '<span class="material-icons text-[12px]">remove</span>'
                : '<span class="material-icons text-[12px]">add</span>';
            btn.classList.toggle('text-red-400', nowEnabled);
            btn.classList.toggle('text-slate-600', !nowEnabled);

            updateDisplay();
        });
    }

    setupToggle(4, () => enable4, (v) => { enable4 = v; });
    setupToggle(5, () => enable5, (v) => { enable5 = v; });

    // Auto-update on entry fee change (covers user comment: cambiar cuota actualiza todo)
    document.getElementById('entry-fee')?.addEventListener('input', updateDisplay);

    updateDisplay();
}

// --- HOTFIX: Revert DemonSlayer ---
(async function () {
    try {
        console.log('[HOTFIX] Reverting DemonSlayer to UEFA4...');
        await supabase.from('matches').update({ home_team: 'UEFA4' }).eq('home_team', 'DemonSlayer');
        await supabase.from('matches').update({ away_team: 'UEFA4' }).eq('away_team', 'DemonSlayer');

        const { data } = await supabase.from('app_settings').select('value').eq('key', 'playoff_mapping').single();
        if (data && data.value && (data.value['UEFA4'] === 'DemonSlayer' || !data.value['UEFA4'])) {
            data.value['UEFA4'] = 'UEFA4';
            await supabase.from('app_settings').upsert({ key: 'playoff_mapping', value: data.value });
            console.log('[HOTFIX] Mapping updated.');
        }
        console.log('[HOTFIX] Done.');
    } catch (e) { console.error('[HOTFIX] Error:', e); }
})();


/* --- Delete Predictions Functionality --- */
window.openDeletePredictionsModal = async () => {
    const modal = document.getElementById('delete-predictions-modal');
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.style.opacity = '1';
        modal.classList.remove('pointer-events-none');
        modal.querySelector('div').classList.remove('scale-95');
        modal.querySelector('div').classList.add('scale-100');
    }, 10);

    await loadUsersForDelete();
    await loadGamesForDelete();
}

window.closeDeleteModal = () => {
    const modal = document.getElementById('delete-predictions-modal');
    modal.style.opacity = '0';
    modal.classList.add('pointer-events-none');
    modal.querySelector('div').classList.remove('scale-100');
    modal.querySelector('div').classList.add('scale-95');
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 300);
}

window.loadUsersForDelete = async () => {
    const select = document.getElementById('delete-user-select');
    select.innerHTML = '<option value="">Cargando...</option>';

    try {
        // Load profiles using standard client (same as main table)
        // Select * to match permissions of main table load
        const { data: profiles, error } = await supabase.from('profiles').select('*');

        if (error) throw error;

        if (!profiles || profiles.length === 0) {
            select.innerHTML = '<option value="">No hay usuarios encontrados</option>';
            return;
        }

        // Sort alphabetically
        profiles.sort((a, b) => {
            const nameA = (a.username || a.email || '').toLowerCase();
            const nameB = (b.username || b.email || '').toLowerCase();
            return nameA.localeCompare(nameB);
        });

        select.innerHTML = '<option value="">Selecciona un usuario...</option>';
        profiles.forEach(p => {
            const name = p.username || p.email || 'Sin Nombre';
            select.innerHTML += `<option value="${p.id}">${name}</option>`;
        });
    } catch (err) {
        console.error('Error loading users:', err);
        select.innerHTML = `<option value="">Error: ${err.message || 'Error desconocido'}</option>`;
    }
}

window.loadGamesForDelete = async () => {
    const matchdaySep = document.getElementById('delete-matchday-select');
    const gameSelect = document.getElementById('delete-game-select');
    const matchday = matchdaySep.value;

    gameSelect.innerHTML = '<option value="">Cargando...</option>';

    const { data: matchesData, error } = await supabase
        .from('matches')
        .select('*')
        .eq('matchday', matchday)
        .order('home_team', { ascending: true });

    if (error) {
        console.error(error);
        return;
    }

    gameSelect.innerHTML = '<option value="all">-- Eliminar Jornada Completa --</option>';
    matchesData.forEach(m => {
        gameSelect.innerHTML += `<option value="${m.id}">${m.home_team} vs ${m.away_team}</option>`;
    });
}

window.confirmDeletePredictions = async () => {
    const userId = document.getElementById('delete-user-select').value;
    const matchday = document.getElementById('delete-matchday-select').value;
    const gameId = document.getElementById('delete-game-select').value;

    if (!userId) return alert('Selecciona un usuario');

    const userName = document.getElementById('delete-user-select').selectedOptions[0].text;

    if (gameId === 'all') {
        if (!confirm(`¿Estás seguro de eliminar TODOS los pronósticos de la JORNADA ${matchday} para ${userName}? Esta acción no se puede deshacer.`)) return;

        const { data: matchesData } = await supabase.from('matches').select('id').eq('matchday', matchday);
        const matchIds = matchesData.map(m => m.id);

        if (matchIds.length === 0) return alert('No hay partidos en esta jornada');

        const { error } = await supabase.from('predictions').delete().eq('user_id', userId).in('match_id', matchIds);

        if (error) alert('Error al eliminar: ' + error.message);
        else {
            alert('Pronósticos eliminados correctamente.');
            closeDeleteModal();
        }

    } else {
        const gameText = document.getElementById('delete-game-select').selectedOptions[0].text;
        if (!confirm(`¿Estás seguro de eliminar el pronóstico de ${gameText} para ${userName}?`)) return;

        const { error } = await supabase.from('predictions').delete().eq('user_id', userId).eq('match_id', gameId);

        if (error) alert('Error al eliminar: ' + error.message);
        else {
            alert('Pronóstico eliminado correctamente.');
            closeDeleteModal();
        }
    }
}


window.clearResults = async () => {
    if (!confirm('¿Estás SEGURO de borrar los resultados de los partidos visibles en pantalla?\n\nEsto restablecerá los marcadores a vacío y los puntos de todos los usuarios a 0 para estos partidos.')) return;

    const button = document.getElementById('clear-results-btn');
    const originalText = button.innerHTML;
    button.disabled = true;
    button.innerHTML = '<span class="material-icons animate-spin">refresh</span> Borrando...';

    // Get current matches visible in the UI (filtered by day and group)
    const currentMatches = matches.filter(m =>
        m.matchday === selectedAdminMatchday &&
        m.group_name === selectedAdminGroup
    );

    let clearedCount = 0;

    for (const match of currentMatches) {
        if (match.status === 'f' || match.home_score !== null || match.status === 's') {
            try {
                // Update match manually using admin to bypass constraints
                const { error: matchErr } = await supabaseAdmin.from('matches')
                    .update({ home_score: null, away_score: null, status: 'a', penalty_winner: null })
                    .eq('id', match.id);

                if (matchErr) throw matchErr;

                // Reset points for all predictions of this match
                const { error: predErr } = await supabaseAdmin.from('predictions')
                    .update({ points_earned: 0 })
                    .eq('match_id', match.id);

                if (predErr) throw predErr;

                clearedCount++;
            } catch (err) {
                console.error('Error clearing match', match.id, err);
            }
        }
    }

    if (clearedCount > 0) {
        console.log('[CLEAR] Matches cleared. Recalculating profile totals...');
        await updateAllProfilesPoints(); // Thoroughly recalculate user points globally
        alert(`✅ ${clearedCount} resultados borrados y puntos restablecidos.`);
        await loadMatches(); // Refresh data
        await loadUsers();   // Refresh leaderboard points
    } else {
        alert('ℹ️ No había resultados para borrar en este grupo.');
    }

    button.disabled = false;
    button.innerHTML = originalText;
};

/* --- Qualified Teams Logic --- */

window.renderQualifiedTeamsSection = () => {
    calculateStandings();
    renderQualifiedTeamsTables();
}

window.calculateStandings = () => {
    allGroupStandings = {};
    const teams = {};

    // process matches
    matches.forEach(m => {
        // Only process Group Stage matches (Matchday 1, 2, 3)
        if (m.matchday > 3) return;

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

    Object.values(teams).forEach(t => {
        t.dif = t.gf - t.gc;
    });

    // Group by group
    Object.values(teams).forEach(t => {
        if (!allGroupStandings[t.group]) allGroupStandings[t.group] = [];
        allGroupStandings[t.group].push(t);
    });

    // Sort
    Object.keys(allGroupStandings).forEach(g => {
        allGroupStandings[g].sort((a, b) => b.pts - a.pts || b.dif - a.dif || b.gf - a.gf);
    });
}

window.renderQualifiedTeamsTables = () => {
    const leftBody = document.getElementById('qualified-teams-body');
    const rightBody = document.getElementById('third-place-body');
    const leftCount = document.getElementById('qualified-count');
    const rightCount = document.getElementById('third-place-count');

    if (!leftBody || !rightBody) return;

    let qualified = [];
    let candidates = [];

    Object.keys(allGroupStandings).forEach(g => {
        const groupTeams = allGroupStandings[g];

        // 1st and 2nd always qualified
        if (groupTeams[0]) qualified.push({ ...groupTeams[0], pos: 1 });
        if (groupTeams[1]) qualified.push({ ...groupTeams[1], pos: 2 });

        // 3rd place checks
        if (groupTeams[2]) {
            const team = groupTeams[2];
            if (qualifiedThirdPlaces.includes(team.code)) {
                qualified.push({ ...team, pos: 3 });
            } else {
                candidates.push({ ...team, pos: 3 });
            }
        }
    });

    // Render Left (Qualified) - Sorted by Group then Pos
    qualified.sort((a, b) => a.group.localeCompare(b.group) || a.pos - b.pos);
    leftCount.textContent = qualified.length;

    leftBody.innerHTML = qualified.map((t, idx) => `
        <tr class="hover:bg-white/5 transition-colors border-b border-white/5 cursor-pointer ${selectedQualifiedToRemove === t.code ? 'bg-red-500/20' : ''}"
    onclick="selectQualifiedToRemove('${t.code}', ${t.pos})">
            <td class="p-3 text-slate-500 font-mono">${idx + 1}</td>
            <td class="p-3">
                <div class="flex items-center gap-3">
                    <img src="${getFlagUrl(t.code)}" class="w-6 h-6 rounded-full bg-slate-700">
                    <div class="flex flex-col">
                        <span class="text-white font-bold text-xs">${TEAM_NAMES[t.code] || t.code}</span>
                        <span class="text-[10px] text-slate-500">${t.code}</span>
                    </div>
                </div>
            </td>
            <td class="p-3 text-center text-xs font-bold text-white">${t.group}</td>
            <td class="p-3 text-center">
                <span class="px-2 py-0.5 rounded text-[10px] font-bold ${t.pos === 1 ? 'bg-yellow-500/20 text-yellow-400' : t.pos === 2 ? 'bg-slate-500/20 text-slate-300' : 'bg-orange-500/20 text-orange-400'}">
                    ${t.pos}º
                </span>
            </td>
        </tr >
        `).join('');

    // Render Right (Candidates) - Sorted by Best 3rd logic (Pts > Dif > GF)
    candidates.sort((a, b) => b.pts - a.pts || b.dif - a.dif || b.gf - a.gf);
    rightCount.textContent = candidates.length;

    rightBody.innerHTML = candidates.map(t => `
        <tr class="hover:bg-white/5 transition-colors border-b border-white/5 cursor-pointer ${selectedThirdPlaceCandidate === t.code ? 'bg-yellow-500/20' : ''}"
    onclick="selectThirdPlaceCandidate('${t.code}')">
            <td class="p-3">
               <div class="flex justify-center">
                    <input type="checkbox" class="accent-yellow-500 pointer-events-none" ${selectedThirdPlaceCandidate === t.code ? 'checked' : ''}>
               </div>
            </td>
            <td class="p-3">
                 <div class="flex items-center gap-3">
                    <img src="${getFlagUrl(t.code)}" class="w-6 h-6 rounded-full bg-slate-700">
                    <div class="flex flex-col">
                        <span class="text-white font-bold text-xs">${TEAM_NAMES[t.code] || t.code}</span>
                        <span class="text-[10px] text-slate-500">${t.code}</span>
                    </div>
                </div>
            </td>
            <td class="p-3 text-center text-xs font-bold text-white">${t.group}</td>
            <td class="p-3 text-center text-xs font-bold text-yellow-400">${t.pts}</td>
        </tr >
        `).join('');

    updateMoveButtons();
}

window.selectThirdPlaceCandidate = (code) => {
    if (selectedThirdPlaceCandidate === code) selectedThirdPlaceCandidate = null;
    else selectedThirdPlaceCandidate = code;
    renderQualifiedTeamsTables();
}

window.selectQualifiedToRemove = (code, pos) => {
    // Only allow removing manually added 3rd places
    if (pos !== 3) {
        // Optional: Alert user they cant remove 1st/2nd
        selectedQualifiedToRemove = null;
    } else {
        if (selectedQualifiedToRemove === code) selectedQualifiedToRemove = null;
        else selectedQualifiedToRemove = code;
    }
    renderQualifiedTeamsTables();
}

window.updateMoveButtons = () => {
    const moveBtn = document.getElementById('move-to-qualified-btn');
    const removeBtn = document.getElementById('remove-from-qualified-btn');

    if (moveBtn) moveBtn.disabled = !selectedThirdPlaceCandidate;
    if (removeBtn) {
        removeBtn.disabled = !selectedQualifiedToRemove;
        removeBtn.classList.toggle('hidden', !selectedQualifiedToRemove); // Optional visibility
    }
}

window.moveSelectedToQualified = async () => {
    if (!selectedThirdPlaceCandidate) return;

    qualifiedThirdPlaces.push(selectedThirdPlaceCandidate);
    selectedThirdPlaceCandidate = null;

    // Optimistic Update
    renderQualifiedTeamsTables();

    // Save
    try {
        await supabase.from('app_settings')
            .update({ value: qualifiedThirdPlaces })
            .eq('key', 'qualified_third_places');
    } catch (e) { console.error(e); }
}

window.removeSelectedFromQualified = async () => {
    if (!selectedQualifiedToRemove) return;

    qualifiedThirdPlaces = qualifiedThirdPlaces.filter(c => c !== selectedQualifiedToRemove);
    selectedQualifiedToRemove = null;

    // Optimistic Update
    renderQualifiedTeamsTables();

    // Save
    try {
        await supabase.from('app_settings')
            .update({ value: qualifiedThirdPlaces })
            .eq('key', 'qualified_third_places');
    } catch (e) { console.error(e); }
}




// --- BRACKET EDITOR LOGIC ---

let selectedBracketRound = 4; // Default to 16vos

window.loadBracketEditor = (round) => {
    selectedBracketRound = round;

    // Update active button state
    const buttons = document.querySelectorAll('#bracket-round-selector button');
    buttons.forEach(btn => {
        // extract numeric arg from onclick attribute string like "loadBracketEditor(4)"
        const match = btn.getAttribute('onclick').match(/\d+/);
        const roundNum = match ? parseInt(match[0]) : 0;

        if (roundNum === round) {
            btn.classList.remove('bg-surface-dark', 'text-slate-400', 'hover:text-white', 'hover:bg-white/5');
            btn.classList.add('bg-indigo-500', 'text-white', 'shadow-lg', 'shadow-indigo-500/20');
        } else {
            btn.classList.add('bg-surface-dark', 'text-slate-400', 'hover:text-white', 'hover:bg-white/5');
            btn.classList.remove('bg-indigo-500', 'text-white', 'shadow-lg', 'shadow-indigo-500/20');
        }
    });

    renderBracketEditor();
};

async function renderBracketEditor() {
    console.log('[BRACKET EDITOR] renderBracketEditor running...');
    const container = document.getElementById('bracket-editor-container');
    if (!container) {
        console.error('[BRACKET EDITOR] Container not found');
        return;
    }

    try {
        // Ensure we have standings for the dropdowns
        if (Object.keys(allGroupStandings).length === 0) {
            console.log('[BRACKET EDITOR] Calculating standings...');
            await calculateStandings();
        }

        const roundMatches = matches.filter(m => m.matchday === selectedBracketRound);
        console.log(`[BRACKET EDITOR] Found ${roundMatches.length} matches for round ${selectedBracketRound}`);

        if (roundMatches.length === 0) {
            container.innerHTML = `
                <div class="col-span-full py-12 text-center text-slate-500 bg-black/20 rounded-xl border border-white/5">
                    <span class="material-icons text-4xl mb-2">event_busy</span>
                    <p>No hay partidos definidos para esta fase (Jornada ${selectedBracketRound}).</p>
                    <p class="text-xs text-slate-600 mt-2">Verifica los datos de los partidos en la base de datos.</p>
                </div>`;
            return;
        }

        // Prepare Qualified Teams List for Dropdowns
        let qualifiedList = [];

        // add from standings
        Object.values(allGroupStandings).forEach(group => {
            // Guard against null/undefined group elements
            if (group[0] && group[0].code) qualifiedList.push({ code: group[0].code, name: group[0].name || group[0].code });
            if (group[1] && group[1].code) qualifiedList.push({ code: group[1].code, name: group[1].name || group[1].code });
            if (group[2] && group[2].code) qualifiedList.push({ code: group[2].code, name: group[2].name || group[2].code });
        });

        // Add teams currently in the bracket matches
        roundMatches.forEach(m => {
            if (m.home_team && !qualifiedList.find(t => t.code === m.home_team)) {
                // If TEAM_NAMES[m.home_team] is undefined, use m.home_team itself, or 'Desconocido'
                const name = (TEAM_NAMES && TEAM_NAMES[m.home_team]) ? TEAM_NAMES[m.home_team] : (m.home_team || 'Desconocido');
                qualifiedList.push({ code: m.home_team, name: name });
            }
            if (m.away_team && !qualifiedList.find(t => t.code === m.away_team)) {
                const name = (TEAM_NAMES && TEAM_NAMES[m.away_team]) ? TEAM_NAMES[m.away_team] : (m.away_team || 'Desconocido');
                qualifiedList.push({ code: m.away_team, name: name });
            }
        });

        // Debug potential bad data and filter out completely empty entries
        qualifiedList = qualifiedList.filter(item => item && item.code);

        // Sort with safety
        qualifiedList.sort((a, b) => {
            const nameA = a.name || '';
            const nameB = b.name || '';
            return nameA.localeCompare(nameB);
        });

        // Create Options Helper
        const createOptions = (currentValue) => {
            const teamOptions = qualifiedList.map(t =>
                `<option value="${t.code}" ${t.code === currentValue ? 'selected' : ''}>${t.name} (${t.code})</option>`
            ).join('');

            const placeholders = ['TBD'];
            // Fill placeholders for round of 16 through final dynamically based on match IDs
            for (let i = 73; i <= 104; i++) {
                placeholders.push(`W${i}`);
                if (i >= 101) placeholders.push(`L${i}`);
            }
            placeholders.push('UEFA1', 'UEFA2', 'UEFA3', 'UEFA4', 'IC1', 'IC2', 'CPV');

            // Add currentValue to placeholders if it's uniquely unresolved so it doesn't get hidden as TBD
            if (currentValue && currentValue !== 'TBD' && !placeholders.includes(currentValue) && !qualifiedList.find(t => t.code === currentValue)) {
                placeholders.push(currentValue);
            }

            const placeholderOptions = placeholders.map(p =>
                `<option value="${p}" ${p === currentValue ? 'selected' : ''}>${friendlyTeamLabel(p)}</option>`
            ).join('');

            return `
                <option value="TBD">-- Seleccionar --</option>
                ${placeholderOptions}
                <optgroup label="Clasificados">
                    ${teamOptions}
                </optgroup>
            `;
        };

        container.innerHTML = roundMatches.map(m => {
            return `
            <div class="bg-background-dark p-4 rounded-xl border border-white/5 shadow-lg flex flex-col gap-4">
                <div class="flex justify-between items-center border-b border-white/5 pb-2">
                    <span class="text-xs font-bold text-indigo-400">Partido #${m.id}</span>
                    <span class="text-[10px] text-slate-500">${m.stadium || 'Estadio'}</span>
                </div>
                
                <!-- HOME -->
                <div class="flex items-center gap-3">
                    <span class="text-[10px] uppercase font-bold text-slate-500 w-8">Local</span>
                    <div class="flex-1">
                        <select onchange="updateMatchTeam(${m.id}, 'home', this.value); setTimeout(() => loadBracketEditor(${selectedBracketRound}), 100)" 
                            class="w-full bg-surface-dark border border-white/10 rounded px-2 py-1.5 text-xs text-white focus:border-indigo-500 outline-none">
                            ${createOptions(m.home_team)}
                        </select>
                    </div>
                    <img src="${getFlagUrl(m.home_team)}" class="w-6 h-6 rounded-full bg-slate-700 shadow-sm" onerror="this.src='https://via.placeholder.com/24?text=?'">
                </div>

                <!-- AWAY -->
                <div class="flex items-center gap-3">
                    <span class="text-[10px] uppercase font-bold text-slate-500 w-8">Visita</span>
                    <div class="flex-1">
                        <select onchange="updateMatchTeam(${m.id}, 'away', this.value); setTimeout(() => loadBracketEditor(${selectedBracketRound}), 100)" 
                            class="w-full bg-surface-dark border border-white/10 rounded px-2 py-1.5 text-xs text-white focus:border-indigo-500 outline-none">
                            ${createOptions(m.away_team)}
                        </select>
                    </div>
                    <img src="${getFlagUrl(m.away_team)}" class="w-6 h-6 rounded-full bg-slate-700 shadow-sm" onerror="this.src='https://via.placeholder.com/24?text=?'">
                </div>
                
                <div class="text-[10px] text-center text-slate-600 pt-2">
                    ${new Date(m.date).toLocaleString('es-ES')}
                </div>
            </div>
            `;
        }).join('');

    } catch (err) {
        console.error('[BRACKET EDITOR] Fatal Error:', err);
        container.innerHTML = `
            <div class="col-span-full py-12 text-center text-red-400 bg-red-500/10 rounded-xl border border-red-500/20">
                <span class="material-icons text-4xl mb-2">error_outline</span>
                <p>Error cargando editor de llaves.</p>
                <p class="text-xs font-mono mt-2 opacity-75">${err.message}</p>
            </div>`;
    }
}


// --- BRACKET AUTOMATION ---

/**
 * advanceBracketWinners:
 * Reads all finished knockout matches and updates the teams in the NEXT round
 * only when both feeder matches are done (or at least one is done so we can partially fill).
 * This is called automatically after saving results in Gestión de Partidos.
 * It does NOT overwrite real teams with placeholder codes.
 */
async function advanceBracketWinners() {
    console.log('[ADVANCE] Starting bracket winner propagation...');

    // Reload latest match data to ensure we have fresh results
    await loadMatches();

    // Map of: which match feeds into which slot of which future match
    // Format: sourceMatchId -> { targetMatchId, slot: 'home'|'away', isWinner: true|false }
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
        { src: 91, dest: 98, slot: 'home', win: true },
        { src: 92, dest: 98, slot: 'away', win: true },
        { src: 93, dest: 99, slot: 'home', win: true },
        { src: 94, dest: 99, slot: 'away', win: true },
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
        { src: 101, dest: 103, slot: 'home', win: false },  // Loser -> 3rd place
        { src: 102, dest: 103, slot: 'away', win: false },  // Loser -> 3rd place
    ];

    // Helper: get the winner or loser team code from a finished match
    const getResultTeam = (match, wantWinner) => {
        if (!match || match.status !== 'f') return null;
        // Determine winner by penalty first
        if (match.penalty_winner) {
            const winTeam = match.penalty_winner === 'home' ? match.home_team : match.away_team;
            const loseTeam = match.penalty_winner === 'home' ? match.away_team : match.home_team;
            return wantWinner ? winTeam : loseTeam;
        }
        // Determine winner by score
        if (match.home_score !== null && match.away_score !== null) {
            if (match.home_score > match.away_score) {
                return wantWinner ? match.home_team : match.away_team;
            } else if (match.away_score > match.home_score) {
                return wantWinner ? match.away_team : match.home_team;
            }
        }
        return null; // Tie without penalty = unresolved
    };

    // Collect updates: { matchId -> { home_team?, away_team? } }
    const pendingUpdates = {};

    for (const feed of feedMap) {
        const srcMatch = matches.find(m => m.id === feed.src);
        if (!srcMatch || srcMatch.status !== 'f') continue; // Source not finished yet, skip

        const resolvedTeam = getResultTeam(srcMatch, feed.win);
        if (!resolvedTeam) continue; // Can't determine winner/loser yet

        // Only update if the destination slot is still a placeholder (Wxx, Lxx, or TBD)
        const destMatch = matches.find(m => m.id === feed.dest);
        if (!destMatch) continue;

        const currentSlotValue = feed.slot === 'home' ? destMatch.home_team : destMatch.away_team;
        const isPlaceholder = !currentSlotValue ||
            currentSlotValue === 'TBD' ||
            /^[WL]\d+$/.test(currentSlotValue); // matches W73, L101, etc.

        if (!isPlaceholder) {
            console.log(`[ADVANCE] Match ${feed.dest} slot '${feed.slot}' already has real team '${currentSlotValue}', skipping.`);
            continue;
        }

        if (!pendingUpdates[feed.dest]) pendingUpdates[feed.dest] = {};
        pendingUpdates[feed.dest][feed.slot + '_team'] = resolvedTeam;
        console.log(`[ADVANCE] Will set Match ${feed.dest}.${feed.slot} = ${resolvedTeam} (from W/L${feed.src})`);
    }

    // Apply updates to DB
    let successCount = 0;
    let failCount = 0;
    for (const [matchIdStr, updateObj] of Object.entries(pendingUpdates)) {
        const matchId = parseInt(matchIdStr);
        try {
            const { error } = await supabaseAdmin
                .from('matches')
                .update(updateObj)
                .eq('id', matchId);
            if (error) {
                console.error(`[ADVANCE] Error updating match ${matchId}:`, error);
                failCount++;
            } else {
                console.log(`[ADVANCE] Match ${matchId} updated:`, updateObj);
                successCount++;
            }
        } catch (e) {
            console.error(`[ADVANCE] Crash on match ${matchId}:`, e);
            failCount++;
        }
    }

    console.log(`[ADVANCE] Done. Updated ${successCount} matches, ${failCount} errors.`);

    if (successCount > 0) {
        // Reload to reflect changes
        await loadMatches();
        renderBracketEditor();
        console.log('[ADVANCE] Bracket advanced successfully. ✅');
    }
}


window.automateBracket = async () => {
    if (!confirm('¿Estás seguro de autocompletar las llaves?\n\nEsto actualizará los equipos de la fase eliminatoria basándose en la tabla de posiciones actual y la estructura oficial.')) return;

    // ── Progress Modal Helpers ──────────────────────────────────────
    const modal = document.getElementById('bracket-progress-modal');
    const inner = document.getElementById('bracket-progress-inner');
    const barEl = document.getElementById('bpm-bar');
    const pctEl = document.getElementById('bpm-pct');
    const labelEl = document.getElementById('bpm-step-label');
    const stepsEl = document.getElementById('bpm-steps');
    const titleEl = document.getElementById('bpm-title');
    const iconEl = document.getElementById('bpm-icon');

    /** Show / reset the modal */
    const showProgress = () => {
        stepsEl.innerHTML = '';
        barEl.style.width = '0%';
        pctEl.textContent = '0%';
        titleEl.textContent = 'Autocompletando bracket...';
        iconEl.textContent = 'auto_fix_high';
        iconEl.className = 'material-icons text-emerald-400 text-xl';
        labelEl.textContent = 'Iniciando...';
        modal.classList.remove('hidden');
        // Animate in
        requestAnimationFrame(() => {
            modal.style.opacity = '1';
            if (inner) inner.style.transform = 'scale(1)';
        });
    };

    /** Advance the progress bar */
    const setProgress = (pct, label) => {
        barEl.style.width = pct + '%';
        pctEl.textContent = pct + '%';
        if (label) labelEl.textContent = label;
    };

    /** Add a step row to the log */
    const addStep = (text, type = 'info') => {
        const colors = {
            info: 'text-slate-400',
            success: 'text-emerald-400',
            warn: 'text-yellow-400',
            error: 'text-red-400',
        };
        const icons = {
            info: 'radio_button_unchecked',
            success: 'check_circle',
            warn: 'warning',
            error: 'error',
        };
        const div = document.createElement('div');
        div.className = `step-item flex items-start gap-2 text-xs ${colors[type] || colors.info}`;
        div.innerHTML = `<span class="material-icons text-xs mt-0.5 flex-shrink-0">${icons[type] || icons.info}</span><span>${text}</span>`;
        stepsEl.appendChild(div);
        stepsEl.scrollTop = stepsEl.scrollHeight;
    };

    /** Close the modal with animation */
    const hideProgress = () => {
        modal.style.opacity = '0';
        if (inner) inner.style.transform = 'scale(0.92)';
        setTimeout(() => modal.classList.add('hidden'), 280);
    };

    /** Mark the modal as "done" (success state) */
    const markDone = (success) => {
        if (success) {
            titleEl.textContent = '¡Llaves actualizadas!';
            iconEl.textContent = 'check_circle';
            iconEl.className = 'material-icons text-emerald-400 text-xl';
            barEl.classList.remove('progress-bar-shimmer');
            barEl.style.background = '#10b981';
            setProgress(100, 'Completado');
        } else {
            titleEl.textContent = 'Ocurrió un error';
            iconEl.textContent = 'error';
            iconEl.className = 'material-icons text-red-400 text-xl';
            setProgress(100, 'Terminado con errores');
        }
    };

    // ── Disable button ──────────────────────────────────────────────
    const btn = document.querySelector('button[onclick*="automateBracket"]');
    const originalText = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="material-icons animate-spin text-sm">refresh</span> Procesando...';
    }

    showProgress();

    try {
        console.log('[BRACKET AUTO] Starting automation...');

        // ── Step 1: Calculate Standings ─────────────────────────────
        setProgress(5, 'Calculando standings...');
        addStep('Calculando tabla de posiciones de grupos...', 'info');
        await calculateStandings();
        addStep('Standings calculados ✓', 'success');
        setProgress(15, 'Seleccionando mejores terceros...');
        await new Promise(r => setTimeout(r, 120)); // small delay so UI updates

        // ── Step 2: Auto-Pick Top 8 Third-Place Teams ───────────────
        const thirdPlaceCandidates = [];
        Object.values(allGroupStandings).forEach(groupData => {
            if (groupData[2]) thirdPlaceCandidates.push(groupData[2]);
        });
        thirdPlaceCandidates.sort((a, b) => b.pts - a.pts || b.dif - a.dif || b.gf - a.gf);
        const best8 = thirdPlaceCandidates.slice(0, 8).map(t => t.code);
        qualifiedThirdPlaces = best8;

        addStep(`Top 8 Terceros seleccionados: ${best8.join(', ')}`, 'success');
        setProgress(22, 'Guardando terceros clasificados...');
        await supabaseAdmin.from('app_settings').upsert({ key: 'qualified_third_places', value: best8 });
        setProgress(28, 'Definiendo estructura del bracket...');
        await new Promise(r => setTimeout(r, 80));

        // ── Step 3: Bracket Structure ───────────────────────────────
        const structure = [
            // ROUND OF 32 (16vos) - Matches 73-88
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
            // ROUND OF 16 (Octavos) - Matches 89-96
            { id: 89, home: 'W74', away: 'W77' },
            { id: 90, home: 'W73', away: 'W75' },
            { id: 91, home: 'W76', away: 'W78' },
            { id: 92, home: 'W79', away: 'W80' },
            { id: 93, home: 'W83', away: 'W84' },
            { id: 94, home: 'W81', away: 'W82' },
            { id: 95, home: 'W86', away: 'W88' },
            { id: 96, home: 'W85', away: 'W87' },
            // QUARTERS (Cuartos) - Matches 97-100
            { id: 97, home: 'W89', away: 'W90' },
            { id: 98, home: 'W91', away: 'W92' },
            { id: 99, home: 'W93', away: 'W94' },
            { id: 100, home: 'W95', away: 'W96' },
            // SEMIS - Matches 101-102
            { id: 101, home: 'W97', away: 'W98' },
            { id: 102, home: 'W99', away: 'W100' },
            // FINAL & 3RD
            { id: 103, home: 'L101', away: 'L102' },
            { id: 104, home: 'W101', away: 'W102' }
        ];

        // ── Step 4: Resolve Teams ───────────────────────────────────
        addStep('Resolviendo equipos del bracket...', 'info');
        setProgress(32, 'Resolviendo equipos...');

        // Correctly allocate 3rd places using backtracking to avoid getting stuck with unmatched slots
        const thirdPlaceSlots = [
            '3ABCDF', '3CDFGH', '3CEFHI', '3EHIJK', 
            '3BEFIJ', '3AEHIJ', '3EFGIJ', '3DEIJL'
        ];
        
        const q3Teams = qualifiedThirdPlaces.map(code => {
            // Find group for this team
            for (const [groupLetter, groupData] of Object.entries(allGroupStandings)) {
                if (groupData[2] && groupData[2].code === code) return { code, group: groupLetter };
            }
            return { code, group: '?' };
        }).filter(t => t.group !== '?');

        function solveThirdPlaces(slotIndex, currentAssignment, usedTeams) {
            if (slotIndex >= thirdPlaceSlots.length) {
                return currentAssignment;
            }
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
            return null; // backtrack if no valid assignment
        }
        
        const thirdPlaceMatches = solveThirdPlaces(0, {}, new Set());
        if (!thirdPlaceMatches) {
            console.warn("[BRACKET AUTO] No perfect matching found for 3rd places! Ensure the top 8 are a valid combination.");
        } else {
            console.log("[BRACKET AUTO] Perfect 3rd place matching found:", thirdPlaceMatches);
        }

        const isPlaceholder = (code) => !code || code === 'TBD' || /^[WL]\d+$/.test(code) || /^3[A-L]{3,}$/.test(code);

        const getTeam = (code) => {
            if (code.startsWith('W') || code.startsWith('L')) {
                const isWinner = code.startsWith('W');
                const matchId = parseInt(code.substring(1));
                const previousMatch = matches.find(m => m.id === matchId);
                if (previousMatch && previousMatch.status === 'f') {
                    if (previousMatch.penalty_winner) {
                        const winCode = previousMatch.penalty_winner === 'home' ? previousMatch.home_team : previousMatch.away_team;
                        const loseCode = previousMatch.penalty_winner === 'home' ? previousMatch.away_team : previousMatch.home_team;
                        return getTeam(isWinner ? winCode : loseCode);
                    }
                    if (previousMatch.home_score !== null && previousMatch.away_score !== null) {
                        if (previousMatch.home_score > previousMatch.away_score)
                            return getTeam(isWinner ? previousMatch.home_team : previousMatch.away_team);
                        else if (previousMatch.away_score > previousMatch.home_score)
                            return getTeam(isWinner ? previousMatch.away_team : previousMatch.home_team);
                    }
                }
                return code;
            }
            if (code.startsWith('3') && code.length > 2) {
                if (thirdPlaceMatches && thirdPlaceMatches[code]) {
                    return thirdPlaceMatches[code];
                }
                // Fallback to placeholder if not found
                return code;
            }
            const m = code.match(/^(\d)([A-L])$/);
            if (m) {
                const groupData = allGroupStandings[m[2]];
                if (groupData && groupData[parseInt(m[1]) - 1])
                    return groupData[parseInt(m[1]) - 1].code;
            }
            return code;
        };

        // Build update list – skip fully-unresolved slots
        const updates = [];
        for (const item of structure) {
            const homeTeam = getTeam(item.home);
            const awayTeam = getTeam(item.away);
            const upd = { id: item.id };
            if (!isPlaceholder(homeTeam)) upd.home_team = homeTeam;
            if (!isPlaceholder(awayTeam)) upd.away_team = awayTeam;
            if (!upd.home_team && !upd.away_team) continue;
            updates.push(upd);
        }

        addStep(`${updates.length} partidos a actualizar en el bracket`, 'info');
        setProgress(38, `Actualizando ${updates.length} partidos...`);
        await new Promise(r => setTimeout(r, 80));

        // ── Step 5: Execute DB Updates with per-item progress ───────
        let successCount = 0;
        let failCount = 0;
        const pctStart = 40;
        const pctEnd = 88;

        for (let i = 0; i < updates.length; i++) {
            const { id, ...fields } = updates[i];
            const pct = Math.round(pctStart + ((i + 1) / updates.length) * (pctEnd - pctStart));
            setProgress(pct, `Guardando partido #${id}...`);

            try {
                const { error } = await supabaseAdmin
                    .from('matches')
                    .update(fields)
                    .eq('id', id);

                if (error) {
                    console.error(`[BRACKET AUTO] Error match ${id}:`, error);
                    addStep(`Error en partido #${id}: ${error.message}`, 'error');
                    failCount++;
                } else {
                    const homeLabel = fields.home_team || '—';
                    const awayLabel = fields.away_team || '—';
                    addStep(`Partido #${id}: ${homeLabel} vs ${awayLabel} ✓`, 'success');
                    successCount++;
                }
            } catch (innerErr) {
                console.error(`[BRACKET AUTO] Crash match ${id}:`, innerErr);
                addStep(`Crash en partido #${id}`, 'error');
                failCount++;
            }
        }

        console.log(`[BRACKET AUTO] Finished. Success: ${successCount}, Failed: ${failCount}`);
        setProgress(90, 'Recargando datos...');
        addStep('Recargando partidos desde la base de datos...', 'info');

        // ── Step 6: Refresh view automatically ─────────────────────
        await loadMatches();
        setProgress(96, 'Actualizando vista...');

        // Re-render bracket editor for the current round
        renderBracketEditor();

        // Also refresh the qualified teams section if visible
        renderQualifiedTeamsSection();

        setProgress(100, 'Completado');
        markDone(failCount === 0);
        addStep(
            failCount === 0
                ? `✅ ${successCount} llaves actualizadas exitosamente.`
                : `⚠️ ${successCount} ok, ${failCount} con error.`,
            failCount === 0 ? 'success' : 'warn'
        );

        // Auto-close the modal after 2 seconds
        setTimeout(() => hideProgress(), 2000);

    } catch (err) {
        console.error('[BRACKET AUTO] Error:', err);
        addStep('Error crítico: ' + err.message, 'error');
        markDone(false);
        setTimeout(() => hideProgress(), 3000);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    }
};


// Check and Fix Tournament Schedule (Auto-Repair)
async function fixTournamentSchedule() {
    console.log('[FIX] Correcting tournament match properties...');

    try {
        // Ensure Match 73 exists
        const { data: m73 } = await supabase.from('matches').select('id').eq('id', 73).single();
        if (!m73) {
            console.log('[FIX] Creating Match 73...');
            await supabaseAdmin.from('matches').insert({
                id: 73, home_team: '2A', away_team: '2B', matchday: 4, group_name: 'RO32', status: 's', date: '2026-06-28 12:00:00+00'
            });
        }

        // Define ranges
        // Round of 32 (16vos)
        await supabaseAdmin.from('matches')
            .update({ matchday: 4, group_name: 'RO32' })
            .gte('id', 73).lte('id', 88);

        // Round of 16 (Octavos)
        await supabaseAdmin.from('matches')
            .update({ matchday: 5, group_name: 'RO16' })
            .gte('id', 89).lte('id', 96);

        // Quarter Finals
        await supabaseAdmin.from('matches')
            .update({ matchday: 6, group_name: 'QF' })
            .gte('id', 97).lte('id', 100);

        // Semi Finals
        await supabaseAdmin.from('matches')
            .update({ matchday: 7, group_name: 'SF' })
            .gte('id', 101).lte('id', 102);

        // Final & 3rd
        await supabaseAdmin.from('matches')
            .update({ matchday: 8, group_name: 'FIN' })
            .gte('id', 103).lte('id', 104);

        console.log('[FIX] Tournament schedule aligned (Matches 73-104).');

    } catch (e) {
        console.error('[FIX] Fatal Error:', e);
    }
}
// Run check once
fixTournamentSchedule();

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// OVERRIDE resetApp with Robust Logic
window.resetApp = async () => {
    // Check Auth
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return alert('No estás autenticado.');

    // Confirmations
    if (!confirm('⚠️ PELIGRO: ¿BORRAR TODO? (Predicciones, Usuarios, Partidos, Puntos)')) return;
    if (!confirm('¿Seguro? No hay vuelta atrás.')) return;

    const btn = document.querySelector('button[onclick="resetApp()"]');
    if (btn) { btn.disabled = true; btn.innerHTML = 'Procesando...'; }

    try {
        console.log('[RESET APP] Starting...');

        // 1. Delete Predictions (All)
        // using UUID so it works with strict RLS types
        const { error: pErr } = await supabaseAdmin.from('predictions')
            .delete({ count: 'exact' })
            .neq('id', '00000000-0000-0000-0000-000000000000');

        if (pErr) throw new Error('Error borrando predicciones: ' + pErr.message);

        // 2. Delete Other Users
        const { data: allUsers } = await supabaseAdmin.auth.admin.listUsers();
        if (allUsers?.users) {
            // Avoid deleting current admin
            const usersToDelete = allUsers.users.filter(u => u.id !== user.id && u.email !== 'zippo0189@gmail.com');
            for (const u of usersToDelete) {
                await supabaseAdmin.auth.admin.deleteUser(u.id);
            }
        }

        // 3. Reset Matches
        const { error: mErr } = await supabaseAdmin.from('matches')
            .update({ home_score: null, away_score: null, status: 'a', penalty_winner: null })
            .gt('id', 0);

        if (mErr) throw new Error('Error reseteando partidos: ' + mErr.message);

        // 4. Reset Admin - Standard (points + exacts)
        const { error: uErr } = await supabaseAdmin.from('profiles')
            .update({ points: 0, exact_score_count: 0 })
            .neq('id', '00000000-0000-0000-0000-000000000000');

        // Fallback if exact_score_count missing
        if (uErr) {
            console.warn('Standard reset failed, trying fallback:', uErr);
            const { error: uErr2 } = await supabaseAdmin.from('profiles')
                .update({ points: 0 }) // Points only
                .neq('id', '00000000-0000-0000-0000-000000000000');

            if (uErr2) throw uErr2; // Both failed
            console.log('Aviso: Puntos reseteados, pero falta columna "exact_score_count".');
        }

        // 5. Force Recalculate (Just in case)
        if (typeof updateAllProfilesPoints === 'function') {
            await updateAllProfilesPoints();
        }

        // 6. Reset Knockout Brackets (Matchday >= 4)
        const { error: bracketError } = await supabase.from('matches')
            .update({
                home_team: 'TBD',
                away_team: 'TBD'
            })
            .gte('matchday', 4);

        if (bracketError) {
            console.error('Error wiping brackets:', bracketError);
        } else {
            console.log('[RESET APP] Bracket teams wiped.');
        }

        // 7. Reset Qualified Third Places
        const { error: thirdPlacesError } = await supabase.from('app_settings')
            .update({ value: [] })
            .eq('key', 'qualified_third_places');

        if (thirdPlacesError) {
            console.error('Error wiping qualified third places:', thirdPlacesError);
        } else {
            console.log('[RESET APP] Qualified third places wiped.');
        }

        alert('✅ Éxito. Aplicación reiniciada a cero.');
        window.location.reload();

    } catch (err) {
        console.error(err);
        alert('Error: ' + err.message);
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = 'Borrar Todo...'; }
    }
};

// ═══════════════════════════════════════════════════════════════════
//  SIMULATE RESULTS MODAL
// ═══════════════════════════════════════════════════════════════════

let _simAllProfiles = []; // cache for user list

window.openSimulateModal = async () => {
    const modal = document.getElementById('simulate-modal');
    const inner = document.getElementById('simulate-modal-inner');
    // Reset state
    document.getElementById('sim-progress-wrap').classList.add('hidden');
    document.getElementById('sim-log').innerHTML = '';
    document.getElementById('sim-progress-bar').style.width = '0%';
    document.getElementById('sim-progress-pct').textContent = '0%';
    document.getElementById('sim-run-btn').disabled = false;
    document.getElementById('sim-run-btn').innerHTML = '<span class="material-icons text-sm">play_arrow</span> Ejecutar Simulación';
    document.getElementById('sim-cancel-btn').disabled = false;

    // Show modal
    modal.classList.remove('hidden');
    requestAnimationFrame(() => {
        modal.style.opacity = '1';
        inner.style.transform = 'scale(1)';
    });

    // Load user list for the "specific" option
    await loadSimUserList();
};

window.closeSimulateModal = () => {
    const modal = document.getElementById('simulate-modal');
    const inner = document.getElementById('simulate-modal-inner');
    modal.style.opacity = '0';
    inner.style.transform = 'scale(0.93)';
    setTimeout(() => modal.classList.add('hidden'), 220);
};

window.toggleSimUserList = (show) => {
    const list = document.getElementById('sim-user-list');
    if (show) list.classList.remove('hidden');
    else list.classList.add('hidden');
};

// Listen for radio changes to show/hide user list
document.addEventListener('change', (e) => {
    if (e.target.name === 'sim-user-target') {
        const list = document.getElementById('sim-user-list');
        if (e.target.value === 'specific') list.classList.remove('hidden');
        else list.classList.add('hidden');
    }
});

async function loadSimUserList() {
    const listEl = document.getElementById('sim-user-list');
    try {
        const { data, error } = await supabaseAdmin
            .from('profiles')
            .select('id, username, full_name, email')
            .order('username');
        if (error) throw error;
        _simAllProfiles = data || [];
        listEl.innerHTML = _simAllProfiles.map(u =>
            `<label class="flex items-center gap-2 px-1 py-1 rounded hover:bg-white/5 cursor-pointer">
                <input type="checkbox" class="sim-user-check w-3.5 h-3.5 rounded accent-blue-500" value="${u.id}">
                <span class="text-xs text-slate-300 truncate">${u.username || u.full_name || u.email || u.id}</span>
            </label>`
        ).join('') || '<p class="text-[10px] text-slate-500 px-1">Sin usuarios</p>';

    } catch (err) {
        listEl.innerHTML = `<p class="text-[10px] text-red-400 px-1">Error: ${err.message}</p>`;
    }
}

window.runSimulation = async () => {
    // ── Read configuration ──────────────────────────────────────────
    const selectedMatchdays = [...document.querySelectorAll('.sim-md-check:checked')].map(c => parseInt(c.value));
    if (selectedMatchdays.length === 0) {
        alert('Selecciona al menos una jornada o fase para simular.');
        return;
    }

    const userTarget = document.querySelector('input[name="sim-user-target"]:checked')?.value || 'all';
    const genPredictions = document.getElementById('sim-gen-predictions').checked;
    const setResults = document.getElementById('sim-set-results').checked;
    const calcPoints = document.getElementById('sim-calc-points').checked;

    const phaseNames = { 1: 'Jornada 1', 2: 'Jornada 2', 3: 'Jornada 3', 4: '16vos', 5: 'Octavos', 6: 'Cuartos', 7: 'Semis', 8: 'Final y 3er' };
    const phaseList = selectedMatchdays.map(d => phaseNames[d] || `Jornada ${d}`).join(', ');

    if (!confirm(`¿Ejecutar simulación?\n\nFases: ${phaseList}\nUsuarios: ${userTarget === 'all' ? 'Todos' : userTarget === 'test' ? 'Solo test' : 'Específicos'}\nPredicciones: ${genPredictions ? 'Sí' : 'No'} | Resultados: ${setResults ? 'Sí' : 'No'} | Puntos: ${calcPoints ? 'Sí' : 'No'}`)) return;

    // ── Determine target profiles ───────────────────────────────────
    let targetProfiles = [];
    if (userTarget === 'all') {
        // Use supabaseAdmin to bypass RLS and include ALL profiles (including admin)
        const { data, error } = await supabaseAdmin.from('profiles').select('id');
        if (error) { addLog('Error cargando perfiles: ' + error.message, 'error'); return; }
        targetProfiles = data || [];
    } else if (userTarget === 'test') {
        // Use supabaseAdmin so test-admin accounts are also included if they match
        const { data, error } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .or('username.ilike.%test%,full_name.ilike.%test%,email.ilike.%test%');
        if (error) { addLog('Error cargando perfiles test: ' + error.message, 'error'); return; }
        targetProfiles = data || [];
    } else {
        const checkedIds = [...document.querySelectorAll('.sim-user-check:checked')].map(c => c.value);
        if (checkedIds.length === 0) { alert('Selecciona al menos un usuario.'); return; }
        targetProfiles = checkedIds.map(id => ({ id }));
    }


    // ── Get target matches ──────────────────────────────────────────
    const targetMatches = matches.filter(m => selectedMatchdays.includes(m.matchday));
    if (targetMatches.length === 0) {
        alert('No se encontraron partidos para las fases seleccionadas.');
        return;
    }

    // ── UI: lock controls, show progress ───────────────────────────
    const runBtn = document.getElementById('sim-run-btn');
    const cancelBtn = document.getElementById('sim-cancel-btn');
    const progressWrap = document.getElementById('sim-progress-wrap');
    const progressBar = document.getElementById('sim-progress-bar');
    const progressPct = document.getElementById('sim-progress-pct');
    const progressLbl = document.getElementById('sim-progress-label');
    const logEl = document.getElementById('sim-log');

    runBtn.disabled = true;
    runBtn.innerHTML = '<span class="material-icons animate-spin text-sm">refresh</span> Simulando...';
    cancelBtn.disabled = true;
    progressWrap.classList.remove('hidden');
    logEl.innerHTML = '';

    const setProgress = (pct, label) => {
        progressBar.style.width = pct + '%';
        progressPct.textContent = pct + '%';
        if (label) progressLbl.textContent = label;
    };

    const addLog = (text, type = 'info') => {
        const colors = { info: 'text-slate-400', success: 'text-emerald-400', warn: 'text-yellow-400', error: 'text-red-400' };
        const icons = { info: 'radio_button_unchecked', success: 'check_circle', warn: 'warning', error: 'error' };
        const el = document.createElement('div');
        el.className = `step-item flex items-start gap-1.5 ${colors[type] || colors.info}`;
        el.innerHTML = `<span class="material-icons text-[10px] mt-0.5 flex-shrink-0">${icons[type] || icons.info}</span><span>${text}</span>`;
        logEl.appendChild(el);
        logEl.scrollTop = logEl.scrollHeight;
    };

    try {
        let totalSteps = (genPredictions ? targetProfiles.length : 0) + (setResults ? targetMatches.length : 0) + (calcPoints ? 1 : 0);
        let doneSteps = 0;
        const tick = (label) => {
            doneSteps++;
            const pct = Math.round((doneSteps / Math.max(totalSteps, 1)) * 100);
            setProgress(Math.min(pct, 98), label);
        };

        // ── Step 1: Generate random predictions ─────────────────────
        if (genPredictions && targetProfiles.length > 0) {
            addLog(`Generando predicciones para ${targetProfiles.length} usuarios y ${targetMatches.length} partidos...`, 'info');
            setProgress(2, 'Generando predicciones...');

            const batchSize = 50; // build in batches to avoid huge upsert
            for (let i = 0; i < targetProfiles.length; i += batchSize) {
                const slice = targetProfiles.slice(i, i + batchSize);
                const preds = [];
                slice.forEach(profile => {
                    targetMatches.forEach(m => {
                        preds.push({
                            user_id: profile.id,
                            match_id: m.id,
                            home_score: Math.floor(Math.random() * 4),
                            away_score: Math.floor(Math.random() * 4)
                        });
                    });
                });
                const { error: bErr } = await supabaseAdmin.from('predictions').upsert(preds, { onConflict: 'user_id,match_id' });

                if (bErr) addLog(`Advertencia en lote ${i}: ${bErr.message}`, 'warn');
                tick(`Predicciones: ${Math.min(i + batchSize, targetProfiles.length)}/${targetProfiles.length} usuarios`);
                await new Promise(r => setTimeout(r, 30)); // yield to UI
            }
            addLog(`✓ Predicciones generadas para ${targetProfiles.length} usuarios`, 'success');
        }

        // ── Step 2: Set random match results ────────────────────────
        if (setResults) {
            addLog(`Simulando resultados para ${targetMatches.length} partidos...`, 'info');
            let matchOk = 0;
            for (const match of targetMatches) {
                const newHome = Math.floor(Math.random() * 4);
                const newAway = Math.floor(Math.random() * 4);

                const { error } = await supabaseAdmin.from('matches')
                    .update({ home_score: newHome, away_score: newAway, status: 'f' })
                    .eq('id', match.id);

                if (error) {
                    addLog(`Error Partido #${match.id}: ${error.message}`, 'error');
                } else {
                    matchOk++;
                    // Recalculate points for THIS match for all users
                    const { data: preds } = await supabaseAdmin.from('predictions').select('*').eq('match_id', match.id);
                    if (preds) {
                        for (const p of preds) {
                            if (p.home_score === null || p.away_score === null) continue;
                            let pts = 0;
                            const pH = Number(p.home_score), pA = Number(p.away_score);
                            const mH = Number(newHome), mA = Number(newAway);
                            if (pH === mH && pA === mA) {
                                pts = 8;
                            } else if (Math.sign(mH - mA) === Math.sign(pH - pA)) {
                                pts = 3;
                            }
                            if (pts !== p.points_earned) {
                                await supabaseAdmin.from('predictions').update({ points_earned: pts }).eq('id', p.id);
                            }
                        }
                    }
                }
                tick(`Partidos: ${matchOk}/${targetMatches.length}`);
                await new Promise(r => setTimeout(r, 20));
            }
            addLog(`✓ ${matchOk}/${targetMatches.length} partidos simulados`, matchOk === targetMatches.length ? 'success' : 'warn');
        }

        // ── Step 3: Recalculate profile totals ───────────────────────
        if (calcPoints) {
            addLog('Recalculando puntos globales...', 'info');
            setProgress(97, 'Recalculando puntos...');
            await updateAllProfilesPoints();
            tick('Puntos actualizados');
            addLog('✓ Puntos y ranking actualizados', 'success');
        }

        // ── Finalize ─────────────────────────────────────────────────
        setProgress(100, '¡Simulación completa!');
        progressBar.classList.remove('progress-bar-shimmer');
        progressBar.style.background = '#10b981';
        addLog(`✅ Simulación finalizada. ${targetMatches.length} partidos · ${targetProfiles.length} usuarios.`, 'success');

        // Refresh UI data
        await loadMatches();
        await loadUsers();
        await calculateStandings();

        runBtn.disabled = false;
        runBtn.innerHTML = '<span class="material-icons text-sm">check_circle</span> Completado';
        cancelBtn.disabled = false;
        cancelBtn.textContent = 'Cerrar';

    } catch (err) {
        console.error('[SIM] Error:', err);
        addLog('Error crítico: ' + err.message, 'error');
        setProgress(100, 'Error');
        runBtn.disabled = false;
        runBtn.innerHTML = '<span class="material-icons text-sm">play_arrow</span> Reintentar';
        cancelBtn.disabled = false;
    }
};

