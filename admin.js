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
        'CUR': 'cw', 'NOR': 'no'
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
    'CUR': 'Curazao', 'NOR': 'Noruega'
};

let qualifiedThirdPlaces = [];
let selectedThirdPlaceCandidate = null;
let selectedQualifiedToRemove = null;
let allGroupStandings = {};

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

    users = data;
    console.log(`[LOAD USERS] Loaded ${users.length} users`);
    console.log('[LOAD USERS] Test users:', users.filter(u => u.is_test).length);

    renderUsers();
}

async function loadMatches() {
    const { data, error } = await supabase
        .from('matches')
        .select('*')
        .order('id', { ascending: true });

    if (error) {
        console.error("Error loading matches:", error);
        return;
    }
    matches = data;
    renderMatches();
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

        // Generate Dropdown Options for Knockout
        let availableTeamsHtml = '';
        if (isKnockout) {
            // Re-calculate qualified just in case
            if (Object.keys(allGroupStandings).length === 0) calculateStandings();

            // Collect all qualified teams
            let qualifiedList = [];
            Object.values(allGroupStandings).forEach(group => {
                if (group[0]) qualifiedList.push(group[0].code);
                if (group[1]) qualifiedList.push(group[1].code);
                if (group[2] && qualifiedThirdPlaces.includes(group[2].code)) qualifiedList.push(group[2].code);
            });
            qualifiedList.sort();

            // Add current team if not in list (e.g. TBD)
            if (!qualifiedList.includes(match.home_team)) qualifiedList.push(match.home_team);
            if (!qualifiedList.includes(match.away_team)) qualifiedList.push(match.away_team);

            availableTeamsHtml = qualifiedList.map(code =>
                `<option value="${code}">${TEAM_NAMES[code] || code}</option>`
            ).join('');
        }

        const homeTeamRender = isKnockout
            ? `
                <select onchange="updateMatchTeam(${match.id}, 'home', this.value)" class="bg-background-dark border border-white/10 rounded px-1 py-1 text-xs text-white max-w-[100px]">
                    <option value="TBD" ${match.home_team === 'TBD' ? 'selected' : ''}>TBD</option>
                    ${availableTeamsHtml.replace(`value="${match.home_team}"`, `value="${match.home_team}" selected`)}
                </select>
            `
            : `<span class="text-sm font-bold text-white text-right hidden md:inline">${match.home_team}</span>
               <span class="text-xs font-bold text-white md:hidden">${match.home_team.substring(0, 3)}</span>`;

        const awayTeamRender = isKnockout
            ? `
                <select onchange="updateMatchTeam(${match.id}, 'away', this.value)" class="bg-background-dark border border-white/10 rounded px-1 py-1 text-xs text-white max-w-[100px]">
                     <option value="TBD" ${match.away_team === 'TBD' ? 'selected' : ''}>TBD</option>
                    ${availableTeamsHtml.replace(`value="${match.away_team}"`, `value="${match.away_team}" selected`)}
                </select>
            `
            : `<span class="text-sm font-bold text-white hidden md:inline">${match.away_team}</span>
               <span class="text-xs font-bold text-white md:hidden">${match.away_team.substring(0, 3)}</span>`;



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

        // Auto-run bracket automation if we're in knockout rounds
        if (selectedAdminMatchday >= 4 && selectedAdminMatchday <= 7) {
            console.log("Auto-running bracket update because knockout results were saved.");
            // We temporarily override window.confirm to bypass the dialog
            const origConfirm = window.confirm;
            window.confirm = () => true;
            const origAlert = window.alert;
            window.alert = () => { }; // suppress success alert from automation

            await window.automateBracket();

            window.confirm = origConfirm;
            window.alert = origAlert;
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
        if (distSetting && Array.isArray(distSetting.value)) {
            document.getElementById('dist-1').value = distSetting.value[0];
            document.getElementById('dist-2').value = distSetting.value[1];
            document.getElementById('dist-3').value = distSetting.value[2];
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
            <td class="px-4 py-3 text-right">
                 <button onclick="toggleAdmin('${user.id}', ${user.role !== 'admin'})" class="p-1.5 rounded-lg hover:bg-white/10 transition-colors ${user.role === 'admin' ? 'text-accent-gold' : 'text-slate-600'}">
                    <span class="material-icons text-sm">shield</span>
                 </button>
                 ${user.is_test ? `
                 <button onclick="deleteTestUser('${user.id}')" class="p-1.5 rounded-lg hover:bg-red-500/20 text-red-400 transition-colors">
                    <span class="material-icons text-sm">delete</span>
                 </button>` : ''}
            </td>
        </tr>
            `).join('');
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
            const { error: profileError } = await supabase.from('profiles').upsert({
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

            const { error: predError } = await supabase.from('predictions').insert(preds);

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
        const { data: allPROFILES, error: profileErr } = await supabaseAdmin.from('profiles').select('id');
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
            const { error } = await supabaseAdmin
                .from('matches')
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
            const { data: currentPreds } = await supabaseAdmin
                .from('predictions')
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
                        await supabaseAdmin
                            .from('predictions')
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
        const { data: users, error: userError } = await supabaseAdmin.from('profiles').select('id');
        if (userError) throw userError;

        const userPoints = {};
        const userExacts = {};
        users.forEach(u => { userPoints[u.id] = 0; userExacts[u.id] = 0; }); // Init all to 0

        // 2. Fetch all predictions with points > 0
        const { data: preds, error } = await supabaseAdmin
            .from('predictions')
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
            // Only include exact_matches if we haven't detected it's missing
            if (!exactMatchesMissing) updates.exact_matches = userExacts[uid];

            const { error } = await supabaseAdmin
                .from('profiles')
                .update(updates)
                .eq('id', uid);

            // Handle error (likely missing column)
            if (error) {
                if (!exactMatchesMissing) {
                    console.warn(`Error updating profile ${uid} (likely missing column), retrying points only...`, error);
                    exactMatchesMissing = true; // Flag to skip column for rest

                    // Retry immediately without exact_matches
                    const { error: retryError } = await supabaseAdmin
                        .from('profiles')
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
        const { error: predError, count: predCount } = await supabaseAdmin
            .from('predictions')
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
        const { data: userBefore } = await supabaseAdmin.from('profiles').select('points').eq('id', user.id).single();
        const startPoints = userBefore ? userBefore.points : 'unknown';

        const { error: profileError, count: profileCount } = await supabaseAdmin
            .from('profiles')
            .update({ points: 0, exact_matches: 0 })
            .gt('points', -1)
            .select('*', { count: 'exact' });

        const { data: userAfter } = await supabaseAdmin.from('profiles').select('points').eq('id', user.id).single();
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
        const { error: matchError, data: updatedMatches } = await supabaseAdmin
            .from('matches')
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
        const { error: bracketError } = await supabaseAdmin
            .from('matches')
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

window.deleteTestUser = async (id) => {
    if (!confirm('¿Eliminar este usuario de prueba?')) return;

    console.log(`[DELETE TEST USER] Deleting single user: ${id} `);

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
            const d1 = document.getElementById('dist-1').value;
            const d2 = document.getElementById('dist-2').value;
            const d3 = document.getElementById('dist-3').value;
            if (fee) await supabase.from('app_settings').upsert({ key: 'entry_fee', value: parseInt(fee) });
            if (d1 && d2 && d3) await supabase.from('app_settings').upsert({ key: 'prize_distribution', value: [parseInt(d1), parseInt(d2), parseInt(d3)] });
            alert('Configuración guardada');
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

        const { error } = await supabaseAdmin.from('predictions').delete().eq('user_id', userId).in('match_id', matchIds);

        if (error) alert('Error al eliminar: ' + error.message);
        else {
            alert('Pronósticos eliminados correctamente.');
            closeDeleteModal();
        }

    } else {
        const gameText = document.getElementById('delete-game-select').selectedOptions[0].text;
        if (!confirm(`¿Estás seguro de eliminar el pronóstico de ${gameText} para ${userName}?`)) return;

        const { error } = await supabaseAdmin.from('predictions').delete().eq('user_id', userId).eq('match_id', gameId);

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
        // Clear if finalized, has score, OR is 's' (scheduled/locked) to force unlock
        if (match.status === 'f' || match.home_score !== null || match.status === 's') {
            try {
                // Use RPC to reset match and recalculate points for all affected users
                const { error } = await supabase.rpc('clear_match_stats', {
                    target_match_id: match.id
                });

                if (error) throw error;

                clearedCount++;
            } catch (err) {
                console.error('Error clearing match', match.id, err);
            }
        }
    }

    if (clearedCount > 0) {
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
        await supabase.from('app_settings').upsert({ key: 'qualified_third_places', value: qualifiedThirdPlaces });
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
        await supabase.from('app_settings').upsert({ key: 'qualified_third_places', value: qualifiedThirdPlaces });
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

            const placeholderOptions = placeholders.map(p =>
                `<option value="${p}" ${p === currentValue ? 'selected' : ''}>${p}</option>`
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

window.automateBracket = async () => {
    if (!confirm('¿Estás seguro de autocompletar las llaves?\n\nEsto sobrescribirá los equipos de la fase eliminatoria basándose en la tabla de posiciones actual y la estructura oficial.')) return;

    const btn = document.querySelector('button[onclick="automateBracket()"]');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="material-icons animate-spin text-sm">refresh</span> Procesando...';

    try {
        console.log('[BRACKET AUTO] Starting automation...');

        // 1. Ensure Standings are up to date
        await calculateStandings();

        // 2. Define the Bracket Structure (Updated per User Request)
        // Note: For 3rd places, this logic is complex. We use generic placeholders for now.
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
            { id: 103, home: 'L101', away: 'L102' }, // 3rd Place
            { id: 104, home: 'W101', away: 'W102' }  // Final
        ];

        // 3. Resolve Teams
        const claimedThirdPlaces = new Set();
        // Helper to get team from code like '1A', '2B', '3ABCDF', 'W73', 'L74'
        const getTeam = (code) => {
            // Handle Winner/Loser from previous matches
            if (code.startsWith('W') || code.startsWith('L')) {
                const isWinner = code.startsWith('W');
                const matchId = parseInt(code.substring(1));
                const previousMatch = matches.find(m => m.id === matchId);

                if (previousMatch && previousMatch.status === 'f') {
                    // Check penalties first
                    if (previousMatch.penalty_winner) {
                        return previousMatch.penalty_winner === 'home'
                            ? (isWinner ? previousMatch.home_team : previousMatch.away_team)
                            : (isWinner ? previousMatch.away_team : previousMatch.home_team);
                    }
                    // Check regular score
                    if (previousMatch.home_score !== null && previousMatch.away_score !== null) {
                        if (previousMatch.home_score > previousMatch.away_score) {
                            return isWinner ? previousMatch.home_team : previousMatch.away_team;
                        } else if (previousMatch.away_score > previousMatch.home_score) {
                            return isWinner ? previousMatch.away_team : previousMatch.home_team;
                        }
                    }
                }
                return code; // Keep placeholder if match not finished or tied without penalties
            }

            // Handle 3rd Place Placeholders (e.g. 3ABCDF) logic: First Available Qualified
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

            const regex = /^(\d)([A-L])$/; // Matches '1A', '2B'
            const match = code.match(regex);

            if (match) {
                const pos = parseInt(match[1]);
                const group = match[2];
                // Check standings
                const groupData = allGroupStandings[group];
                if (groupData && groupData[pos - 1]) {
                    return groupData[pos - 1].code;
                }
            }
            return code; // Fallback to placeholder if not found
        };

        const updates = [];

        // 4. Build Updates
        for (const item of structure) {
            const homeTeam = getTeam(item.home);
            const awayTeam = getTeam(item.away);

            updates.push({
                id: item.id,
                home_team: homeTeam,
                away_team: awayTeam
            });
        }

        console.log('[BRACKET AUTO] Prepared updates:', updates);

        // 5. Exec Updates (Batch if possible, or loop)
        // Since we have an array, we can loop. For better UX, loop and upsert.
        for (const update of updates) {
            const { error } = await supabaseAdmin
                .from('matches')
                .update({ home_team: update.home_team, away_team: update.away_team })
                .eq('id', update.id);

            if (error) console.error(`Error updating match ${update.id}`, error);
        }

        // 6. Refresh
        await loadMatches(); // Reload match data
        renderBracketEditor(); // Re-render logic

        alert('✅ Llaves actualizadas automáticamente base a la estructura oficial.');

    } catch (err) {
        console.error('[BRACKET AUTO] Error:', err);
        alert('Error al autocompletar: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
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
        // neq '0000...' (UUID) covers all
        const { error: pErr } = await supabaseAdmin
            .from('predictions')
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
        const { error: mErr } = await supabaseAdmin
            .from('matches')
            .update({ home_score: null, away_score: null, status: 'a', penalty_winner: null })
            .gt('id', 0);

        if (mErr) throw new Error('Error reseteando partidos: ' + mErr.message);

        // 4. Reset Admin Profile - SPECIFICALLY by ID
        // 4. Reset Admin - Standard (points + exacts)
        const { error: uErr } = await supabaseAdmin
            .from('profiles')
            .update({ points: 0, exact_matches: 0 })
            .eq('id', user.id);

        // Fallback if exact_matches missing
        if (uErr) {
            console.warn('Standard reset failed, trying fallback:', uErr);
            const { error: uErr2 } = await supabaseAdmin
                .from('profiles')
                .update({ points: 0 }) // Points only
                .eq('id', user.id);

            if (uErr2) throw uErr2; // Both failed
            alert('Aviso: Puntos reseteados, pero falta columna "exact_matches".');
        }

        if (uErr) {
            console.error('Error manual profile reset:', uErr);
            alert('Error reset profile: ' + uErr.message);
        }

        // 5. Force Recalculate (Just in case)
        if (typeof updateAllProfilesPoints === 'function') {
            await updateAllProfilesPoints();
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
