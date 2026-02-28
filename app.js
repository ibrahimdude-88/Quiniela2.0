import { supabase } from './supabaseClient.js'
import { getCurrentUser, signOut } from './auth.js'

// State
let currentUser = null;
let currentMatchday = 1;
let matches = [];
let predictions = {};
let appSettings = [];

// Helper for Flags
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

// Initialize
async function init() {
    console.log('[INIT] Starting initialization...');

    try {
        currentUser = await getCurrentUser();
        console.log('[INIT] Current user:', currentUser);

        if (!currentUser) {
            console.log('[INIT] No user found, redirecting to login');
            window.location.href = '/login.html';
            return;
        }

        console.log('[INIT] User authenticated, updating header');
        updateHeader();

        // Timeout wrapper
        const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('Tiempo de espera agotado (10s)')), 10000));

        try {
            console.log('[INIT] Loading data...');
            await Promise.race([loadData(), timeout]);
            console.log('[INIT] Data loaded successfully');
        } catch (err) {
            console.error('[INIT] Error loading data:', err);
            const matchesContainer = document.querySelector('#matches-list');
            if (matchesContainer) {
                matchesContainer.innerHTML = `
                    <div class="text-center py-12 bg-red-500/10 rounded-xl border border-red-500/20">
                        <span class="material-icons text-4xl text-red-500 mb-4">wifi_off</span>
                        <p class="text-red-400 font-medium">La conexión está tardando demasiado.</p>
                        <p class="text-red-400/50 text-xs mt-2">Verifica tu internet o recarga la página.</p>
                        <button onclick="window.location.reload()" class="mt-4 px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-bold">Recargar</button>
                    </div>`;
            }
        }

        console.log('[INIT] Setting up event listeners');
        setupEventListeners();

        // Rules Modal Logic
        window.toggleRules = () => {
            const modal = document.getElementById('rules-modal');
            if (!modal) return;

            if (modal.classList.contains('hidden')) {
                modal.classList.remove('hidden');
                setTimeout(() => {
                    modal.classList.remove('opacity-0');
                    const modalDiv = modal.querySelector('div');
                    if (modalDiv) {
                        modalDiv.classList.remove('scale-95');
                        modalDiv.classList.add('scale-100');
                    }
                }, 10);
            } else {
                modal.classList.add('opacity-0');
                const modalDiv = modal.querySelector('div');
                if (modalDiv) {
                    modalDiv.classList.remove('scale-100');
                    modalDiv.classList.add('scale-95');
                }
                setTimeout(() => modal.classList.add('hidden'), 300);
            }
        };

        // Bind hero button
        const heroRulesBtn = document.getElementById('btn-rules');
        if (heroRulesBtn) {
            heroRulesBtn.onclick = (e) => {
                e.preventDefault();
                window.toggleRules();
            };
            heroRulesBtn.removeAttribute('href');
        }

        console.log('[INIT] Initialization complete');
    } catch (error) {
        console.error('[INIT] Fatal error during initialization:', error);
        alert('Error crítico al inicializar la aplicación. Por favor recarga la página.');
    }
}

async function updateHeader() {
    console.log('[HEADER] Updating header...');

    if (currentUser && currentUser.profile) {
        const userName = document.querySelector('#user-name');
        const pointsDisplay = document.querySelector('#user-points');

        if (userName) userName.innerHTML = `${currentUser.profile.full_name || currentUser.email}`;
        const points = currentUser.profile.points || 0;

        // Update header points
        if (pointsDisplay) pointsDisplay.textContent = `${points} pts`;

        // Update Hero Section
        const heroName = document.getElementById('hero-user-name');
        const heroPoints = document.getElementById('hero-points');
        const heroRank = document.getElementById('hero-rank');

        if (heroName) heroName.textContent = currentUser.profile.username || 'Crack';
        if (heroPoints) heroPoints.textContent = points;
        if (heroRank) heroRank.textContent = '#--'; // Will update in loadRanking

        // Admin Button
        if (currentUser.profile.role === 'admin') {
            const headerActions = document.querySelector('.flex.items-center.gap-6');
            if (headerActions && !headerActions.querySelector('a[href="/admin.html"]')) {
                const adminBtn = document.createElement('a');
                adminBtn.href = '/admin.html';
                adminBtn.className = 'flex items-center gap-2 bg-red-500/10 border border-red-500/50 text-red-400 px-3 py-1.5 rounded-full hover:bg-red-500 hover:text-white transition-all text-[10px] font-bold uppercase tracking-wider shadow-lg shadow-red-500/20';
                adminBtn.innerHTML = '<span class="material-icons text-sm">admin_panel_settings</span> <span class="hidden sm:inline">Admin</span>';
                headerActions.insertBefore(adminBtn, headerActions.firstChild);
            }
        }

        // Logout Button
        const headerActions = document.querySelector('.flex.items-center.gap-6');
        if (headerActions && !headerActions.querySelector('button[title="Cerrar Sesión"]')) {
            const logoutBtn = document.createElement('button');
            logoutBtn.className = 'ml-4 flex items-center justify-center w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:bg-red-500 hover:text-white transition-all';
            logoutBtn.innerHTML = '<span class="material-icons text-sm">logout</span>';
            logoutBtn.title = 'Cerrar Sesión';
            logoutBtn.onclick = async () => {
                await signOut();
                window.location.href = '/login.html';
            };
            headerActions.appendChild(logoutBtn);
        }
    }

    console.log('[HEADER] Header updated');
}

async function loadData() {
    console.log('[DATA] Loading data...');

    try {
        console.log('[DATA] Fetching matches...');
        const { data: matchesData, error: matchesError } = await supabase
            .from('matches')
            .select('*')
            .order('date', { ascending: true });

        if (matchesError) throw matchesError;
        matches = matchesData || [];
        window.matches = matches; // Expose globally for bracket
        console.log('[DATA] Matches loaded:', matches.length);

        console.log('[DATA] Fetching predictions...');
        const { data: predictionsData, error: predictionsError } = await supabase
            .from('predictions')
            .select('*')
            .eq('user_id', currentUser.profile.id);

        if (predictionsError) throw predictionsError;

        predictions = {};
        (predictionsData || []).forEach(p => {
            predictions[p.match_id] = p;
        });
        console.log('[DATA] Predictions loaded:', Object.keys(predictions).length);

        console.log('[DATA] Fetching settings...');
        const { data: settingsData, error: settingsError } = await supabase.from('app_settings').select('*');
        if (!settingsError && settingsData) {
            appSettings = settingsData;
            console.log('[DATA] Settings loaded:', appSettings.length);
        }

        console.log('[DATA] Rendering matches...');
        renderMatches();

        console.log('[DATA] Loading ranking...');
        loadRanking();

        console.log('[DATA] Checking achievements...');
        checkAchievements();

        console.log('[DATA] Updating prize pool...');
        await updatePrizePool();

        console.log('[DATA] Calculating group standings...');
        renderGroupStandings();

        console.log('[DATA] All data loaded successfully');
    } catch (err) {
        console.error('[DATA] Error loading data:', err);
        const matchesContainer = document.querySelector('#matches-list');
        if (matchesContainer) {
            matchesContainer.innerHTML = `
                <div class="text-center py-12 bg-red-500/10 rounded-xl border border-red-500/20">
                    <span class="material-icons text-4xl text-red-500 mb-4">error_outline</span>
                    <p class="text-red-400 font-medium">Error cargando datos. Por favor intenta recargar.</p>
                    <p class="text-red-400/50 text-xs mt-2">${err.message || 'Error desconocido'}</p>
                </div>`;
        }
        throw err;
    }
}

async function updatePrizePool() {
    try {
        // Get settings
        const { data: settings, error: settingsError } = await supabase
            .from('app_settings')
            .select('*');

        let entryFee = 50; // Default
        let distribution = [50, 30, 20]; // Default

        if (!settingsError && settings) {
            const fee = settings.find(s => s.key === 'entry_fee');
            if (fee) entryFee = fee.value;

            const dist = settings.find(s => s.key === 'prize_distribution');
            if (dist && Array.isArray(dist.value)) distribution = dist.value;
        }

        // Get count of paid users
        const { count, error: countError } = await supabase
            .from('profiles')
            .select('*', { count: 'exact', head: true })
            .eq('paid', true);

        const paidUsers = count || 0;
        const totalPrize = paidUsers * entryFee;

        const p1 = Math.floor(totalPrize * (distribution[0] / 100));
        const p2 = Math.floor(totalPrize * (distribution[1] / 100));
        const p3 = Math.floor(totalPrize * (distribution[2] / 100));

        // Update UI (Hero Section)
        const prizeTotalEl = document.getElementById('hero-prize-total');
        if (prizeTotalEl) prizeTotalEl.textContent = `$${totalPrize}`;

        const elP1 = document.getElementById('prize-1');
        const elP2 = document.getElementById('prize-2');
        const elP3 = document.getElementById('prize-3');

        if (elP1) elP1.textContent = `$${p1}`;
        if (elP2) elP2.textContent = `$${p2}`;
        if (elP3) elP3.textContent = `$${p3}`;

        // Also update the percentage labels to match DB values
        const elL1 = document.getElementById('prize-label-1');
        const elL2 = document.getElementById('prize-label-2');
        const elL3 = document.getElementById('prize-label-3');
        if (elL1) elL1.textContent = `1er (${distribution[0]}%)`;
        if (elL2) elL2.textContent = `2do (${distribution[1]}%)`;
        if (elL3) elL3.textContent = `3er (${distribution[2]}%)`;

    } catch (err) {
        console.error('Error updating prize pool:', err);
    }
}

// Achievements Data
const ALL_ACHIEVEMENTS = [
    { id: 'login', title: 'Primer Vistazo', desc: 'Iniciaste sesión por primera vez.', icon: 'visibility', condition: () => true },
    { id: 'nostradamus', title: 'Nostradamus', desc: 'Acierta un marcador exacto.', icon: 'psychology', condition: (preds) => preds.some(p => p.points_earned >= 8) },
    { id: 'hattrick', title: 'Hat-Trick', desc: 'Acierta 3 marcadores exactos.', icon: 'looks_3', condition: (preds) => preds.filter(p => p.points_earned >= 8).length >= 3 },
    {
        id: 'invictus', title: 'Invicto', desc: 'Obtén puntos en 5 partidos seguidos.', icon: 'shield', condition: (preds) => {
            const earned = preds.filter(p => p.points_earned > 0).length;
            return earned >= 5;
        }
    },
    { id: 'sniper', title: 'Francotirador', desc: '5 Marcadores Exactos.', icon: 'gps_fixed', condition: (preds) => preds.filter(p => p.points_earned >= 8).length >= 5 },
    { id: 'leader', title: 'Líder', desc: 'Top 1 del Ranking.', icon: 'emoji_events', condition: (preds, rank) => rank === 1 },
    { id: 'master_strategist', title: 'Estratega', desc: 'Acierta un empate exacto.', icon: 'balance', condition: (preds) => preds.some(p => p.points_earned >= 8 && p.home_score === p.away_score) },
    { id: 'goal_rain', title: 'Lluvia de Goles', desc: 'Acierta en partido con +3 goles.', icon: 'thunderstorm', condition: (preds) => preds.some(p => p.points_earned >= 8 && (p.home_score + p.away_score) > 3) },
    { id: 'lock', title: 'Candado', desc: 'Acierta un 0-0 exacto.', icon: 'lock', condition: (preds) => preds.some(p => p.home_score === 0 && p.away_score === 0 && p.points_earned >= 8) }
];

function checkAchievements() {
    const list = document.getElementById('achievements-modal-list');
    if (!list) return;

    list.innerHTML = '';
    const predsArray = Object.values(predictions);

    let rank = 999;
    const rankEl = document.getElementById('hero-rank');
    if (rankEl) {
        const txt = rankEl.textContent.replace('#', '').trim();
        rank = parseInt(txt) || 999;
    }

    ALL_ACHIEVEMENTS.forEach(ach => {
        let unlocked = false;
        try {
            if (ach.id === 'leader') unlocked = ach.condition(predsArray, rank);
            else unlocked = ach.condition(predsArray);
        } catch (e) { } // Ignore errors in condition

        renderAchievementCard(list, ach, unlocked);
    });
}

window.toggleAchievements = () => {
    const modal = document.getElementById('achievements-modal');
    if (!modal) return;

    if (modal.classList.contains('hidden')) {
        modal.classList.remove('hidden');
        setTimeout(() => {
            modal.classList.remove('opacity-0');
            const inner = modal.querySelector('div');
            if (inner) {
                inner.classList.remove('scale-95');
                inner.classList.add('scale-100');
            }
        }, 10);
        checkAchievements();
    } else {
        modal.classList.add('opacity-0');
        const inner = modal.querySelector('div');
        if (inner) {
            inner.classList.remove('scale-100');
            inner.classList.add('scale-95');
        }
        setTimeout(() => modal.classList.add('hidden'), 300);
    }
};

function renderAchievementCard(container, ach, unlocked) {
    const card = document.createElement('div');
    const bgClass = unlocked ? 'bg-background-dark border-purple-500/30' : 'bg-background-dark border-white/5 opacity-40 grayscale';
    const iconColor = unlocked ? 'text-purple-400' : 'text-slate-500';
    const textColor = unlocked ? 'text-slate-200' : 'text-slate-500';

    card.className = `p-3 rounded-lg border ${bgClass} relative overflow-hidden group transition-all`;
    card.innerHTML = `
        ${unlocked ? '<div class="absolute inset-0 bg-purple-500/5 group-hover:bg-purple-500/10 transition-colors"></div>' : ''}
        <span class="material-icons ${iconColor} text-2xl mb-1">${ach.icon}</span>
        <p class="text-xs font-bold ${textColor}">${ach.title}</p>
        <p class="text-xs text-slate-500 leading-tight">${ach.desc}</p>
    `;
    container.appendChild(card);
}


function renderMatches() {
    console.log('[RENDER] Rendering matches for matchday', currentMatchday);

    const container = document.querySelector('#matches-list');
    if (!container) {
        console.error('[RENDER] Container #matches-list not found');
        return;
    }

    container.innerHTML = '';

    // Filter by Matchday
    const filteredMatches = matches.filter(m => m.matchday == currentMatchday);
    console.log('[RENDER] Filtered matches:', filteredMatches.length);

    // Helper to safely parse boolean settings
    const getBoolSetting = (key, defaultValue) => {
        const item = appSettings.find(s => s.key === key);
        if (!item || item.value === undefined || item.value === null) return defaultValue;
        if (item.value === 'true') return true;
        if (item.value === 'false') return false;
        return !!item.value;
    };

    // Dynamic Status Check
    let defaultStatus = false;
    if (currentMatchday === 1) defaultStatus = true;

    // Check if current matchday is enabled
    const mdStatus = getBoolSetting(`matchday_status_${currentMatchday}`, defaultStatus);
    const isScheduleMode = !mdStatus;

    console.log('[RENDER] Schedule mode:', isScheduleMode);

    // Update Buttons UI
    document.querySelectorAll('button[data-matchday]').forEach(btn => {
        const md = parseInt(btn.dataset.matchday);
        let def = false;
        if (md === 1) def = true;
        const isOpen = getBoolSetting(`matchday_status_${md}`, def);

        if (md === currentMatchday) {
            btn.classList.remove('bg-surface-dark', 'text-slate-400', 'hover:bg-white/5');
            btn.classList.add('bg-primary', 'text-white');
        } else {
            btn.classList.add('bg-surface-dark', 'text-slate-400', 'hover:bg-white/5');
            btn.classList.remove('bg-primary', 'text-white');
        }
    });

    if (filteredMatches.length === 0) {
        container.innerHTML = `
        <div class="text-center py-12 bg-surface-dark rounded-xl border border-white/5">
            <span class="material-icons text-6xl text-slate-700 mb-4">sports_soccer</span>
            <p class="text-slate-400 font-medium">No hay partidos para la Jornada ${currentMatchday}.</p>
        </div>`;
        return;
    }

    // Sort by date inside matchday
    filteredMatches.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Update Progress Counter
    const totalMatches = filteredMatches.length;
    let predictedMatches = 0;

    // Check if user has paid
    const isPaid = currentUser.profile.paid;

    // Update Counter UI
    const totalCountEl = document.getElementById('total-count');
    if (totalCountEl) totalCountEl.textContent = totalMatches;

    // --- Grouping Logic ---
    const matchesByGroup = filteredMatches.reduce((acc, match) => {
        const groupName = match.group_name || 'Sin Grupo';
        if (!acc[groupName]) acc[groupName] = [];
        acc[groupName].push(match);
        return acc;
    }, {});
    const sortedGroups = Object.keys(matchesByGroup).sort();

    const progressCountEl = document.getElementById('progress-count');
    let htmlContent = '';

    if (isScheduleMode) {
        // --- SCHEDULE VIEW (No Inputs, Just Calendar) ---
        htmlContent = `<div class="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg mb-6 text-center">
            <span class="text-yellow-400 text-xs font-bold uppercase tracking-wider">Jornada Cerrada (Modo Calendario)</span>
        </div>`;

        sortedGroups.forEach(group => {
            htmlContent += `
                <div class="mb-6">
                    <h3 class="text-white font-bold text-lg mb-3 pl-2 border-l-4 border-primary/50 bg-background-dark/50 py-1">Grupo ${group}</h3>
                    <div class="space-y-3">
            `;
            matchesByGroup[group].forEach(match => {
                let dateObj = new Date(match.date);
                if (isNaN(dateObj)) dateObj = new Date();
                const dateStr = dateObj.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
                const timeStr = dateObj.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });

                htmlContent += `
                <div class="flex items-center justify-between p-4 bg-surface-dark rounded-xl border border-white/5 transition-colors hover:bg-white/5 mx-2">
                    <div class="flex items-center gap-4 w-1/3">
                        <img src="${getFlagUrl(match.home_team)}" class="w-8 h-8 rounded-full shadow-md object-cover">
                        <span class="font-bold text-slate-200 text-sm md:text-base truncate">${match.home_team}</span>
                    </div>
                    <div class="flex flex-col items-center w-1/3 min-w-[80px]">
                        <span class="text-xs font-bold text-slate-500 uppercase tracking-wider bg-slate-800 px-2 py-0.5 rounded border border-white/5">${timeStr}</span>
                        <span class="text-[10px] text-slate-600 mt-1 truncate max-w-full">${match.stadium || 'Estadio'}</span>
                        <span class="text-[10px] text-slate-400 capitalize truncate w-full text-center">${dateStr}</span>
                    </div>
                    <div class="flex items-center justify-end gap-4 w-1/3">
                        <span class="font-bold text-slate-200 text-sm md:text-base truncate text-right">${match.away_team}</span>
                        <img src="${getFlagUrl(match.away_team)}" class="w-8 h-8 rounded-full shadow-md object-cover">
                    </div>
                </div>`;
            });
            htmlContent += `</div></div>`;
        });

    } else {
        // --- PREDICTION VIEW (Normal) ---
        sortedGroups.forEach(group => {
            htmlContent += `
                <div class="mb-8">
                    <h3 class="text-white font-bold text-lg mb-4 pl-2 border-l-4 border-primary/50 sticky top-[72px] z-10 bg-background-dark/95 backdrop-blur py-2 shadow-lg shadow-background-dark/10">Grupo ${group}</h3>
                    <div class="space-y-4">
            `;

            matchesByGroup[group].forEach(match => {
                const prediction = predictions[match.id];

                // Count if prediction exists
                if (prediction) predictedMatches++;

                const isLocked = match.status !== 'a';
                const isFinal = match.status === 'f';
                const hasPrediction = !!prediction;

                const inputsDisabled = isLocked || (hasPrediction && !isFinal);

                let displayHomeScore = '';
                let displayAwayScore = '';
                let inputType = 'number';
                let placeholder = '-';
                let inputStateClass = '';

                if (hasPrediction) {
                    if (isPaid) {
                        displayHomeScore = prediction.home_score;
                        displayAwayScore = prediction.away_score;
                        inputStateClass = 'text-white border-primary/50 bg-primary/5';
                    } else {
                        inputType = 'password';
                        displayHomeScore = '';
                        displayAwayScore = '';
                        placeholder = '🔒';
                        inputStateClass = 'text-slate-500 bg-slate-900/50 cursor-not-allowed';
                    }
                } else {
                    inputStateClass = isLocked ? 'opacity-50 cursor-not-allowed bg-slate-800/50' : 'text-white bg-background-dark';
                }

                if (inputsDisabled) {
                    inputStateClass += ' opacity-75 cursor-not-allowed';
                }

                let statusHtml = '';
                if (isFinal) {
                    const points = prediction?.points_earned || 0;
                    const colorClass = points > 0 ? 'text-accent-gold' : 'text-slate-500';
                    statusHtml = `
                        <div class="flex flex-col items-center md:items-end gap-2 min-w-[120px]">
                            <div class="px-3 py-1 rounded-full bg-slate-800/50 border border-slate-700/50 text-xs font-bold uppercase tracking-wider text-slate-400">Final</div>
                            <div class="flex items-center gap-1 ${colorClass}">
                                <span class="material-icons text-sm">stars</span>
                                <span class="font-bold">+${points} Pts</span>
                            </div>
                        </div>`;
                } else if (inputsDisabled) {
                    if (hasPrediction) {
                        let lockMessage = isPaid ? 'Guardado' : 'Oculto (Pago)';
                        let lockColor = isPaid ? 'text-primary border-primary/20 bg-primary/10' : 'text-orange-400 border-orange-500/20 bg-orange-500/10';

                        statusHtml = `
                            <div class="flex flex-col items-center md:items-end gap-2 min-w-[120px]">
                                <div class="px-3 py-1.5 rounded-full ${lockColor} border text-xs font-bold uppercase tracking-wider flex items-center gap-1 shadow-lg">
                                    <span class="material-icons text-[10px]">${isPaid ? 'check_circle' : 'visibility_off'}</span> ${lockMessage}
                                </div>
                            </div>`;
                    } else {
                        statusHtml = `
                            <div class="flex flex-col items-center md:items-end gap-2 min-w-[120px]">
                                <div class="px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-xs font-bold uppercase tracking-wider text-red-400 flex items-center gap-1">
                                    <span class="material-icons text-[10px]">lock</span> Cerrado
                                </div>
                            </div>`;
                    }
                } else {
                    const matchDate = new Date(match.date);
                    const dateStr = isNaN(matchDate) ? 'Próximamente' : matchDate.toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric', month: 'short' });

                    statusHtml = `
                         <div class="flex flex-col items-center md:items-end gap-3 min-w-[120px]">
                            <div class="text-xs text-slate-400 text-center md:text-right hidden md:block">
                                <p class="font-medium text-slate-300 capitalize">${dateStr}</p>
                            </div>
                            <button onclick="savePrediction(${match.id})" class="bg-primary hover:bg-green-500 text-white w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-lg shadow-primary/20 group transform hover:scale-105 active:scale-95">
                                <span class="material-icons text-lg group-hover:scale-110 transition-transform">save</span>
                            </button>
                        </div>`;
                }

                // Knockout Penalty Logic
                const isKnockout = match.matchday >= 4;
                let penaltyHtml = '';

                if (isKnockout) {
                    const predPenalty = prediction?.penalty_winner;
                    penaltyHtml = `
                        <div class="mt-4 pt-4 border-t border-white/5 w-full flex flex-col items-center gap-2">
                             <span class="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Ganador en Penales (Si hay empate)</span>
                             <div class="flex items-center gap-4">
                                <label class="flex items-center gap-2 cursor-pointer bg-black/20 px-3 py-1.5 rounded-lg border border-white/5 hover:bg-white/5 transition-colors">
                                    <input type="radio" name="penalty-${match.id}" value="home" ${predPenalty === 'home' ? 'checked' : ''} ${inputsDisabled ? 'disabled' : ''} class="text-primary focus:ring-primary/50 bg-transparent border-slate-600">
                                    <span class="text-xs font-bold text-slate-300">Local</span>
                                </label>
                                <label class="flex items-center gap-2 cursor-pointer bg-black/20 px-3 py-1.5 rounded-lg border border-white/5 hover:bg-white/5 transition-colors">
                                    <input type="radio" name="penalty-${match.id}" value="away" ${predPenalty === 'away' ? 'checked' : ''} ${inputsDisabled ? 'disabled' : ''} class="text-primary focus:ring-primary/50 bg-transparent border-slate-600">
                                    <span class="text-xs font-bold text-slate-300">Visitante</span>
                                </label>
                             </div>
                        </div>
                    `;
                }

                // Status Badge for Penalty Result (if final)
                if (isFinal && isKnockout && match.penalty_winner) {
                    const pWin = match.penalty_winner === 'home' ? match.home_team : match.away_team;
                    statusHtml += `
                        <div class="mt-2 text-[10px] text-slate-400 bg-slate-800/50 px-2 py-0.5 rounded border border-white/5">
                            Penales: <span class="text-white font-bold">${pWin}</span>
                        </div>
                     `;
                }

                const html = `
                  <div class="bg-surface-dark rounded-2xl p-5 border ${hasPrediction ? 'border-primary/20 bg-primary/[0.02]' : 'border-white/5'} flex flex-col transition-all hover:bg-white/[0.02] group relative overflow-hidden mb-4">
                    ${hasPrediction ? '<div class="absolute top-0 right-0 w-16 h-16 bg-gradient-to-bl from-primary/10 to-transparent pointer-events-none"></div>' : ''}
            
                    <div class="flex flex-col md:flex-row items-center justify-between gap-6">
                        <div class="flex-1 flex items-center justify-center md:justify-between w-full gap-4 md:gap-8">
                          <div class="flex flex-col items-center gap-3 w-24 md:w-28">
                            <div class="w-12 h-12 md:w-16 md:h-16 rounded-full overflow-hidden border-2 border-slate-700 shadow-xl relative bg-slate-800 group-hover:border-primary/50 transition-colors">
                                 <img src="${getFlagUrl(match.home_team)}" alt="${match.home_team}" class="w-full h-full object-cover transform hover:scale-110 transition-transform duration-500">
                            </div>
                            <span class="font-bold text-xs md:text-sm tracking-wider text-slate-300 truncate max-w-full text-center">${match.home_team}</span>
                          </div>
                
                          <div class="flex items-center gap-2 md:gap-4 relative">
                            <input id="pred-home-${match.id}" 
                                   class="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-background-dark border-2 border-slate-700/50 text-center text-xl md:text-2xl font-bold focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all ${inputStateClass}" 
                                   type="${inputType}" 
                                   value="${displayHomeScore}" 
                                   ${inputsDisabled ? 'disabled' : ''}
                                   placeholder="${placeholder}"/>
                            <span class="text-slate-600 font-black text-lg md:text-xl select-none">vs</span>
                            <input id="pred-away-${match.id}" 
                                   class="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-background-dark border-2 border-slate-700/50 text-center text-xl md:text-2xl font-bold focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all ${inputStateClass}" 
                                   type="${inputType}" 
                                   value="${displayAwayScore}" 
                                   ${inputsDisabled ? 'disabled' : ''}
                                   placeholder="${placeholder}"/>
                          </div>
                
                           <div class="flex flex-col items-center gap-3 w-24 md:w-28">
                            <div class="w-12 h-12 md:w-16 md:h-16 rounded-full overflow-hidden border-2 border-slate-700 shadow-xl relative bg-slate-800 group-hover:border-primary/50 transition-colors">
                                 <img src="${getFlagUrl(match.away_team)}" alt="${match.away_team}" class="w-full h-full object-cover transform hover:scale-110 transition-transform duration-500">
                            </div>
                            <span class="font-bold text-xs md:text-sm tracking-wider text-slate-300 truncate max-w-full text-center">${match.away_team}</span>
                          </div>
                        </div>
                
                        <div class="w-full md:w-auto flex justify-center md:justify-end border-t border-white/5 md:border-0 pt-4 md:pt-0 mt-2 md:mt-0">
                            ${statusHtml}
                        </div>
                    </div>
                    
                    ${penaltyHtml}
                  </div>
                `;
                htmlContent += html;
            });

            htmlContent += `</div></div>`;
        });
    }

    if (progressCountEl) progressCountEl.textContent = predictedMatches;
    container.innerHTML = htmlContent;

    console.log('[RENDER] Matches rendered successfully');
}

function setupEventListeners() {
    console.log('[EVENTS] Setting up event listeners');

    // Matchday buttons
    document.querySelectorAll('button[data-matchday]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            currentMatchday = parseInt(e.currentTarget.dataset.matchday);
            console.log('[EVENTS] Matchday changed to:', currentMatchday);
            renderMatches();
        });
    });

    window.savePrediction = async (matchId) => {
        console.log('[SAVE] Saving prediction for match:', matchId);

        const homeInput = document.getElementById(`pred-home-${matchId}`);
        const awayInput = document.getElementById(`pred-away-${matchId}`);

        if (!homeInput || !awayInput) {
            console.error('[SAVE] Input elements not found');
            return;
        }

        const homeScore = homeInput.value === '' ? 0 : parseInt(homeInput.value);
        const awayScore = awayInput.value === '' ? 0 : parseInt(awayInput.value);

        // Capture Penalty Winner
        let penaltyWinner = null;
        const penaltyInput = document.querySelector(`input[name="penalty-${matchId}"]:checked`);
        if (penaltyInput) {
            penaltyWinner = penaltyInput.value;
        }

        const btn = document.querySelector(`button[onclick="savePrediction(${matchId})"]`);
        const originalContent = btn ? btn.innerHTML : '';
        if (btn) {
            btn.innerHTML = '<span class="material-icons animate-spin">refresh</span>';
            btn.disabled = true;
        }

        try {
            const { data, error } = await supabase
                .from('predictions')
                .upsert({
                    user_id: currentUser.profile.id,
                    match_id: matchId,
                    home_score: homeScore,
                    away_score: awayScore,
                    penalty_winner: penaltyWinner
                }, { onConflict: 'user_id, match_id' });

            if (error) throw error;

            predictions[matchId] = {
                ...predictions[matchId],
                user_id: currentUser.profile.id,
                match_id: matchId,
                home_score: homeScore,
                away_score: awayScore,
                penalty_winner: penaltyWinner
            };

            console.log('[SAVE] Prediction saved successfully');
            renderMatches();
            checkAchievements();

        } catch (err) {
            console.error('[SAVE] Error saving prediction:', err);
            alert('Error al guardar pronóstico.');
            if (btn) {
                btn.innerHTML = originalContent;
                btn.disabled = false;
            }
        }
    };

    console.log('[EVENTS] Event listeners set up');
}

async function loadRanking() {
    console.log('[RANKING] Loading ranking...');

    const rankingContainer = document.querySelector('.ranking-list');
    if (!rankingContainer) return;

    const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .order('points', { ascending: false });

    if (error) {
        console.error('[RANKING] Error loading ranking:', error);
        rankingContainer.innerHTML = '<p class="text-xs text-red-400 p-4">Error al cargar ranking.</p>';
        return;
    }

    const paidProfiles = profiles.filter(p => p.paid); // Filter unpaid users

    if (paidProfiles.length === 0) {
        rankingContainer.innerHTML = '<p class="text-xs text-slate-500 p-4 text-center">No hay usuarios activos aún.</p>';
        return;
    }

    const myRankIndex = paidProfiles.findIndex(p => p.id === currentUser.profile.id);
    const myRank = myRankIndex !== -1 ? myRankIndex + 1 : '-';

    const heroRank = document.getElementById('hero-rank');
    if (heroRank) heroRank.textContent = `#${myRank}`;

    if (myRank !== '-' && !window.appState_rankingModalShown) {
        window.appState_rankingModalShown = true;
        showRankingCelebration(myRank);
    }

    // Update ranking list rendering to use paidProfiles
    rankingContainer.innerHTML = paidProfiles.map((p, i) => {
        const isMe = p.id === currentUser.profile.id;
        const rank = i + 1;
        let rankColor = 'text-slate-400';
        if (rank === 1) rankColor = 'text-accent-gold';
        else if (rank === 2) rankColor = 'text-slate-200';
        else if (rank === 3) rankColor = 'text-orange-300';

        const bgClass = isMe ? 'bg-primary/10 border-primary/20' : 'hover:bg-white/5 border-transparent';
        const exactCount = p.exact_score_count || 0;

        return `
        <div onclick="showUserDetails('${p.id}', '${p.username || 'Usuario'}')" class="flex items-center gap-4 p-3 rounded-lg border ${bgClass} transition-colors cursor-pointer group hover:bg-white/5">
            <span class="w-6 text-center font-bold ${rankColor}">${rank}</span>
            <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between">
                    <p class="text-sm font-semibold truncate ${isMe ? 'text-primary' : 'text-slate-200'}">
                        ${p.username || 'Usuario'} ${isMe ? '(Tú)' : ''}
                        ${p.is_test ? '<span class="text-[8px] bg-slate-700 text-slate-400 px-1 rounded ml-1">TEST</span>' : ''}
                    </p>
                    <div class="flex items-center gap-1 bg-background-dark/50 px-2 py-0.5 rounded border border-white/5" title="Marcadores Exactos">
                        <span class="material-icons text-[10px] text-green-400">gps_fixed</span>
                        <span class="text-xs font-bold text-green-400">${exactCount}</span>
                    </div>
                </div>
                <div class="flex items-center gap-2 mt-1">
                     <p class="text-[10px] text-slate-500 font-medium">${p.points} pts</p>
                </div>
            </div>
            ${rank <= 3 ? '<span class="material-icons text-xs text-accent-gold">emoji_events</span>' : ''}
        </div>
    `}).join('');

    console.log('[RANKING] Ranking loaded');
}

// UI Toggles
window.toggleAchievements = () => {
    const modal = document.getElementById('achievements-modal');
    const container = document.getElementById('achievements-modal-list');

    if (!modal || !container) return;

    if (modal.classList.contains('hidden')) {
        modal.classList.remove('hidden');
        setTimeout(() => {
            modal.classList.remove('opacity-0');
            const modalDiv = modal.querySelector('div');
            if (modalDiv) {
                modalDiv.classList.remove('scale-95');
                modalDiv.classList.add('scale-100');
            }
        }, 10);

        container.innerHTML = '';
        const predsArray = Object.values(predictions);
        const heroRank = document.getElementById('hero-rank');
        const myRankText = heroRank ? heroRank.textContent.replace('#', '') : '999';
        const myRank = parseInt(myRankText) || 999;

        ALL_ACHIEVEMENTS.forEach(ach => {
            const unlocked = ach.condition(predsArray, myRank);
            renderAchievementCard(container, ach, unlocked);
        });

    } else {
        modal.classList.add('opacity-0');
        const modalDiv = modal.querySelector('div');
        if (modalDiv) {
            modalDiv.classList.remove('scale-100');
            modalDiv.classList.add('scale-95');
        }
        setTimeout(() => modal.classList.add('hidden'), 300);
    }
};

window.toggleUserDetails = () => {
    const modal = document.getElementById('user-details-modal');
    if (!modal) return;

    if (modal.classList.contains('hidden')) {
        modal.classList.remove('hidden');
        setTimeout(() => {
            modal.classList.remove('opacity-0');
            const modalDiv = modal.querySelector('div');
            if (modalDiv) {
                modalDiv.classList.remove('scale-95');
                modalDiv.classList.add('scale-100');
            }
        }, 10);
    } else {
        modal.classList.add('opacity-0');
        const modalDiv = modal.querySelector('div');
        if (modalDiv) {
            modalDiv.classList.remove('scale-100');
            modalDiv.classList.add('scale-95');
        }
        setTimeout(() => modal.classList.add('hidden'), 300);
    }
}

window.showUserDetails = async (userId, username) => {
    const modalTitle = document.getElementById('modal-user-name');
    const list = document.getElementById('modal-exact-matches');

    if (modalTitle) modalTitle.innerHTML = `<span class="material-icons text-accent-gold">emoji_events</span> ${username}`;
    if (list) list.innerHTML = '<div class="flex justify-center p-4"><span class="material-icons animate-spin">refresh</span></div>';

    window.toggleUserDetails();

    try {
        const { data: preds, error } = await supabase
            .from('predictions')
            .select(`
                *,
                matches (*)
            `)
            .eq('user_id', userId)
            .gte('points_earned', 5);

        if (error) throw error;

        const exactPreds = preds.filter(p => p.matches.status === 'f' && p.home_score === p.matches.home_score && p.away_score === p.matches.away_score);

        if (!exactPreds || exactPreds.length === 0) {
            list.innerHTML = '<p class="text-center text-slate-500 text-sm py-4">Sin marcadores exactos aún.</p>';
            return;
        }

        list.innerHTML = exactPreds.map(p => {
            const m = p.matches;
            return `
            <div class="flex items-center justify-between bg-white/5 p-3 rounded-lg border border-white/5">
                <div class="flex items-center gap-3">
                    <img src="${getFlagUrl(m.home_team)}" class="w-6 h-6 rounded-full object-cover">
                    <span class="text-sm font-bold text-slate-300 w-8 text-center">${m.home_score}</span>
                    <span class="text-xs text-slate-500">-</span>
                    <span class="text-sm font-bold text-slate-300 w-8 text-center">${m.away_score}</span>
                    <img src="${getFlagUrl(m.away_team)}" class="w-6 h-6 rounded-full object-cover">
                </div>
                <div class="flex flex-col items-end">
                    <span class="text-[10px] text-slate-500 uppercase tracking-wide">${m.home_team} vs ${m.away_team}</span>
                     <span class="text-xs font-bold text-green-400">+8 Pts</span>
                </div>
            </div>`;
        }).join('');

    } catch (err) {
        console.error("Error fetching details:", err);
        list.innerHTML = '<p class="text-red-400 text-sm">Error cargando datos.</p>';
    }
}

// Start
// --- Group Standings Logic ---

function renderGroupStandings() {
    const container = document.getElementById('groups-standings-container');
    if (!container) return;

    const groups = {};

    // Filter matches to only include Group Stage (Matchdays 1, 2, 3)
    const groupStageMatches = matches.filter(m => m.matchday <= 3);

    groupStageMatches.forEach(match => {
        const group = match.group_name || 'A';
        if (!groups[group]) groups[group] = {};

        // Ensure teams exist
        if (!groups[group][match.home_team]) groups[group][match.home_team] = { name: match.home_team, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, pts: 0 };
        if (!groups[group][match.away_team]) groups[group][match.away_team] = { name: match.away_team, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, pts: 0 };

        if (match.status === 'f' && match.home_score !== null && match.away_score !== null) {
            const h = groups[group][match.home_team];
            const a = groups[group][match.away_team];

            h.pj++; a.pj++;
            h.gf += match.home_score; h.gc += match.away_score;
            a.gf += match.away_score; a.gc += match.home_score;

            if (match.home_score > match.away_score) {
                h.pg++; h.pts += 3; a.pp++;
            } else if (match.home_score < match.away_score) {
                a.pg++; a.pts += 3; h.pp++;
            } else {
                h.pe++; h.pts += 1; a.pe++; a.pts += 1;
            }
        }
    });

    const sortedGroups = Object.keys(groups).sort();

    if (sortedGroups.length === 0) {
        container.innerHTML = '<p class="text-center text-slate-500 py-8 text-xs">No hay datos de grupos disponibles todavía.</p>';
        return;
    }

    const groupsHTML = sortedGroups.map(groupName => {
        const teams = Object.values(groups[groupName]).sort((a, b) => {
            if (b.pts !== a.pts) return b.pts - a.pts;
            const diffA = a.gf - a.gc;
            const diffB = b.gf - b.gc;
            if (diffB !== diffA) return diffB - diffA;
            return b.gf - a.gf;
        });

        return `
       <div class="px-4 py-4">
            <h4 class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 pl-2 border-l-2 border-primary">Grupo ${groupName}</h4>
            <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse min-w-[300px]">
                    <thead>
                        <tr class="text-[9px] text-slate-500 uppercase tracking-wider border-b border-white/5 text-center">
                            <th class="py-1 px-1 text-left w-24">Equipo</th>
                            <th class="py-1 px-1">PJ</th>
                            <th class="py-1 px-1">G</th>
                            <th class="py-1 px-1">E</th>
                            <th class="py-1 px-1">P</th>
                            <th class="py-1 px-1">GF</th>
                            <th class="py-1 px-1">GC</th>
                            <th class="py-1 px-1">Dif</th>
                            <th class="py-1 px-1 font-bold text-white">Pts</th>
                        </tr>
                    </thead>
                    <tbody class="text-[10px]">
                        ${teams.map((t, i) => `
                        <tr class="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors text-center text-slate-400">
                            <td class="py-2 px-1 text-left flex items-center gap-2">
                                <span class="text-[9px] font-bold w-3 ${i < 2 ? 'text-green-400' : 'text-slate-600'}">${i + 1}</span>
                                <img src="${getFlagUrl(t.name)}" class="w-4 h-4 rounded-full shadow-sm object-cover">
                                <span class="font-bold text-slate-200 truncate w-10">${t.name}</span>
                            </td>
                            <td class="py-2 px-1">${t.pj}</td>
                            <td class="py-2 px-1 text-slate-500">${t.pg}</td>
                            <td class="py-2 px-1 text-slate-500">${t.pe}</td>
                            <td class="py-2 px-1 text-slate-500">${t.pp}</td>
                            <td class="py-2 px-1 text-slate-500">${t.gf}</td>
                            <td class="py-2 px-1 text-slate-500">${t.gc}</td>
                            <td class="py-2 px-1">${t.gf - t.gc > 0 ? '+' : ''}${t.gf - t.gc}</td>
                            <td class="py-2 px-1 font-black text-white bg-white/5 rounded">${t.pts}</td>
                        </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
       </div>
       `;
    }).join('');

    // Removed Bracket HTML as requested
    container.innerHTML = groupsHTML;
}

function renderBracketHTML() {
    const knockoutMatches = matches.filter(m => m.matchday >= 4).sort((a, b) => a.matchday - b.matchday || a.id - b.id);
    if (knockoutMatches.length === 0) return '';

    const rounds = {
        4: { name: '16vos', matches: [] },
        5: { name: '8vos', matches: [] },
        6: { name: '4tos', matches: [] },
        7: { name: 'Semis', matches: [] },
        8: { name: 'Final', matches: [] }
    };

    knockoutMatches.forEach(m => {
        if (rounds[m.matchday]) rounds[m.matchday].matches.push(m);
    });

    let hasMatches = false;
    let columnsHtml = '';

    Object.keys(rounds).forEach(key => {
        const round = rounds[key];
        if (round.matches.length === 0) return;
        hasMatches = true;

        columnsHtml += `
            <div class="min-w-[220px] flex flex-col gap-4">
                <div class="px-3 py-1.5 rounded-full bg-slate-800 text-slate-400 text-[10px] font-bold uppercase tracking-widest text-center border border-white/5 mb-2 shadow-sm">
                    ${round.name}
                </div>
                <div class="flex flex-col gap-2 h-full justify-around py-4">
                    ${round.matches.map(m => {
            const isLive = m.status === 'a';
            const isFinal = m.status === 'f';
            const homeClass = m.home_score > m.away_score || (m.penalty_winner === 'home') ? 'text-white font-bold' : 'text-slate-400';
            const awayClass = m.away_score > m.home_score || (m.penalty_winner === 'away') ? 'text-white font-bold' : 'text-slate-400';
            const borderClass = isLive ? 'border-primary/30 shadow-primary/5' : 'border-white/5';

            return `
                        <div class="bg-background-dark/50 p-3 rounded-xl border ${borderClass} flex flex-col gap-2 relative group hover:bg-white/5 transition-colors">
                            ${isFinal ? `<div class="absolute top-1 right-2 text-[8px] text-green-400 font-bold uppercase tracking-wider">Final</div>` : ''}
                            
                            <div class="flex justify-between items-center">
                                <div class="flex items-center gap-2">
                                     <img src="${getFlagUrl(m.home_team)}" class="w-4 h-4 rounded-full object-cover">
                                     <span class="text-xs ${homeClass}">${m.home_team}</span>
                                </div>
                                <span class="text-xs font-mono font-bold text-white bg-black/20 px-1.5 rounded">${m.home_score ?? '-'}</span>
                            </div>
                            
                            <div class="flex justify-between items-center">
                                <div class="flex items-center gap-2">
                                     <img src="${getFlagUrl(m.away_team)}" class="w-4 h-4 rounded-full object-cover">
                                     <span class="text-xs ${awayClass}">${m.away_team}</span>
                                </div>
                                <span class="text-xs font-mono font-bold text-white bg-black/20 px-1.5 rounded">${m.away_score ?? '-'}</span>
                            </div>
                            
                            ${m.penalty_winner ? `
                                <div class="text-[9px] text-center text-slate-500 border-t border-white/5 pt-1 mt-0.5">
                                    Penales: <span class="text-slate-300 font-bold">${m.penalty_winner === 'home' ? m.home_team : m.away_team}</span>
                                </div>
                            ` : ''}
                        </div>
                        `;
        }).join('')}
                </div>
            </div>
        `;
    });

    if (!hasMatches) return '';

    return `
        <div class="pt-8 mt-6">
            <h3 class="text-white font-bold text-lg mb-6 pl-4 border-l-4 border-accent-gold flex items-center gap-2">
                <span class="material-icons text-accent-gold">emoji_events</span> Fase Final
            </h3>
            <div class="overflow-x-auto pb-6 px-4 custom-scrollbar">
                <div class="flex gap-8">
                    ${columnsHtml}
                </div>
            </div>
        </div>
    `;
}

window.showRankingCelebration = (rank) => {
    const modal = document.getElementById('ranking-celebration-modal');
    if (!modal) return;

    const rankText = document.getElementById('celebration-rank-text');
    const subtitle = document.getElementById('celebration-subtitle');
    const message = document.getElementById('celebration-message');
    const icon = document.getElementById('celebration-medal-icon');

    if (rankText) rankText.textContent = `#${rank}`;

    let isTop3 = rank <= 3;

    if (isTop3) {
        subtitle.textContent = "¡Estás en el TOP " + rank + "!";
        icon.textContent = "emoji_events";
        icon.classList.add('medal-glow', 'medal-shine');

        let colorClass = '';
        let particles = [];
        if (rank === 1) {
            colorClass = 'text-accent-gold'; // Gold
            message.textContent = "¡Eres el número 1 absoluto! Nadie te iguala.";
            particles = ['#f59e0b', '#ffffff', '#fbbf24'];
        } else if (rank === 2) {
            colorClass = 'text-slate-300'; // Silver
            message.textContent = "Medalla de Plata. ¡Estás muy cerca de la cima!";
            particles = ['#cbd5e1', '#ffffff', '#e2e8f0'];
        } else if (rank === 3) {
            colorClass = 'text-orange-400'; // Bronze
            message.textContent = "Medalla de Bronce. ¡Excelente trabajo manteniéndote en el podio!";
            particles = ['#fb923c', '#ffffff', '#fdba74'];
        }

        icon.className = `material-icons text-[100px] relative overflow-hidden medal-shine medal-glow ${colorClass}`;

        // Fire Confetti (fuegos artificiales)
        if (typeof confetti !== 'undefined') {
            const duration = 3 * 1000;
            const end = Date.now() + duration;

            (function frame() {
                confetti({
                    particleCount: 5,
                    angle: 60,
                    spread: 55,
                    origin: { x: 0 },
                    colors: particles,
                    zIndex: 200
                });
                confetti({
                    particleCount: 5,
                    angle: 120,
                    spread: 55,
                    origin: { x: 1 },
                    colors: particles,
                    zIndex: 200
                });

                if (Date.now() < end) {
                    requestAnimationFrame(frame);
                }
            }());
        }
    } else {
        subtitle.textContent = "Posición actual";
        message.textContent = "¡Sigue pronosticando para subir de nivel!";
        icon.textContent = "leaderboard";
        icon.className = `material-icons text-[80px] text-slate-400`;
    }

    // Show modal
    modal.classList.remove('hidden');
    setTimeout(() => {
        modal.classList.remove('opacity-0');
        const inner = modal.querySelector('div');
        if (inner) {
            inner.classList.remove('scale-50');
            inner.classList.add('scale-100');
        }
    }, 10);
};

console.log('[APP] Registering DOMContentLoaded listener');
document.addEventListener('DOMContentLoaded', init);
