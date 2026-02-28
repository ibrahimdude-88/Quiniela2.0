
// --- BRACKET EDITOR LOGIC ---

let selectedBracketRound = 4; // Default to 16vos

window.loadBracketEditor = (round) => {
    selectedBracketRound = round;

    // Update active button state
    const buttons = document.querySelectorAll('#bracket-round-selector button');
    buttons.forEach(btn => {
        const roundNum = parseInt(btn.getAttribute('onclick').match(/\d+/)[0]);
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
    const container = document.getElementById('bracket-editor-container');
    if (!container) return;

    // Ensure we have standings for the dropdowns
    if (Object.keys(allGroupStandings).length === 0) {
        await calculateStandings();
    }

    const roundMatches = matches.filter(m => m.matchday === selectedBracketRound);

    if (roundMatches.length === 0) {
        container.innerHTML = `
            <div class="col-span-full py-12 text-center text-slate-500 bg-black/20 rounded-xl border border-white/5">
                <span class="material-icons text-4xl mb-2">event_busy</span>
                <p>No hay partidos definidos para esta fase.</p>
            </div>`;
        return;
    }

    // Grid columns adjustment based on number of matches
    // 16vos (16 matches) = 4 cols ? 
    // 8vos (8) = 4 cols
    // 4tos (4) = 4 cols
    // Semis (2) = 2 cols
    // Final (2) = 2 cols
    let gridCols = 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';
    if (roundMatches.length <= 2) gridCols = 'grid-cols-1 md:grid-cols-2';

    container.className = `grid ${gridCols} gap-4`;


    // Prepare Qualified Teams List for Dropdowns
    let qualifiedList = [];

    // add from standings
    Object.values(allGroupStandings).forEach(group => {
        if (group[0]) qualifiedList.push({ code: group[0].code, name: group[0].name });
        if (group[1]) qualifiedList.push({ code: group[1].code, name: group[1].name });
        // Add all 3rd places to be safe, or just qualified ones
        if (group[2]) qualifiedList.push({ code: group[2].code, name: group[2].name });
    });

    // Add teams currently in the bracket matches (in case of manual override or placeholders)
    roundMatches.forEach(m => {
        if (m.home_team && !qualifiedList.find(t => t.code === m.home_team)) {
            qualifiedList.push({ code: m.home_team, name: TEAM_NAMES[m.home_team] || m.home_team });
        }
        if (m.away_team && !qualifiedList.find(t => t.code === m.away_team)) {
            qualifiedList.push({ code: m.away_team, name: TEAM_NAMES[m.away_team] || m.away_team });
        }
    });

    // Sort
    qualifiedList.sort((a, b) => a.name.localeCompare(b.name));

    // Create Options HTML
    const optionsHtml = qualifiedList.map(t => `<option value="${t.code}">${t.name} (${t.code})</option>`).join('');
    // Add Plaheolder options (TBD, W#, etc)
    const placeholders = ['TBD', 'W49', 'W50', 'W51', 'W52', 'W53', 'W54', 'W55', 'W56']; // simplified
    const placeholderOptions = placeholders.map(p => `<option value="${p}">${p}</option>`).join('');


    container.innerHTML = roundMatches.map(m => {
        const homeScore = m.home_score !== null ? m.home_score : '-';
        const awayScore = m.away_score !== null ? m.away_score : '-';

        // Winner Logic Highlighting
        let homeClass = 'text-white';
        let awayClass = 'text-white';
        let homeBg = '';
        let awayBg = '';

        if (m.status === 'f') {
            const h = m.home_score;
            const a = m.away_score;
            let homeWin = false;
            let awayWin = false;

            if (h > a) homeWin = true;
            else if (a > h) awayWin = true;
            else {
                // Penalties
                if (m.penalty_winner === 'home') homeWin = true;
                if (m.penalty_winner === 'away') awayWin = true;
            }

            if (homeWin) {
                homeClass = 'text-green-400 font-black';
                homeBg = 'bg-green-500/10 border-green-500/30';
                awayClass = 'text-red-400 opacity-60';
            } else if (awayWin) {
                awayClass = 'text-green-400 font-black';
                awayBg = 'bg-green-500/10 border-green-500/30';
                homeClass = 'text-red-400 opacity-60';
            }
        }


        return `
        <div class="bg-background-dark p-3 rounded-xl border border-white/10 shadow-lg flex flex-col gap-3 relative group hover:border-white/30 transition-all">
            <div class="flex justify-between items-center border-b border-white/5 pb-2">
                <span class="text-[10px] font-bold text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded">#${m.id}</span>
                <span class="text-[10px] text-slate-500 truncate max-w-[120px]" title="${m.stadium || 'Estadio'}">${m.stadium || 'Estadio'}</span>
            </div>
            
            <!-- HOME -->
            <div class="flex items-center gap-2 p-1.5 rounded-lg transition-colors ${homeBg}">
                <img src="${getFlagUrl(m.home_team)}" class="w-6 h-6 rounded-full bg-slate-700 shadow-sm flex-shrink-0">
                <div class="flex-1 min-w-0">
                    <select onchange="updateMatchTeam(${m.id}, 'home', this.value); loadBracketEditor(${selectedBracketRound})" 
                        class="w-full bg-transparent border-none p-0 text-xs focus:ring-0 cursor-pointer ${homeClass} font-bold truncated-select">
                        <option value="TBD">-- Seleccionar --</option>
                        ${placeholderOptions.replace(`value="${m.home_team}"`, `value="${m.home_team}" selected`)}
                        <optgroup label="Clasificados">
                            ${optionsHtml.replace(`value="${m.home_team}"`, `value="${m.home_team}" selected`)}
                        </optgroup>
                    </select>
                </div>
                <span class="text-sm font-black ${homeClass} min-w-[20px] text-center bg-black/20 rounded px-1">${homeScore}</span>
            </div>

            <!-- VS Divider -->
             <div class="h-px w-full bg-white/5 relative">
             </div>

            <!-- AWAY -->
            <div class="flex items-center gap-2 p-1.5 rounded-lg transition-colors ${awayBg}">
                <img src="${getFlagUrl(m.away_team)}" class="w-6 h-6 rounded-full bg-slate-700 shadow-sm flex-shrink-0">
                <div class="flex-1 min-w-0">
                    <select onchange="updateMatchTeam(${m.id}, 'away', this.value); loadBracketEditor(${selectedBracketRound})" 
                        class="w-full bg-transparent border-none p-0 text-xs focus:ring-0 cursor-pointer ${awayClass} font-bold truncated-select">
                        <option value="TBD">-- Seleccionar --</option>
                        ${placeholderOptions.replace(`value="${m.away_team}"`, `value="${m.away_team}" selected`)}
                        <optgroup label="Clasificados">
                            ${optionsHtml.replace(`value="${m.away_team}"`, `value="${m.away_team}" selected`)}
                        </optgroup>
                    </select>
                </div>
                <span class="text-sm font-black ${awayClass} min-w-[20px] text-center bg-black/20 rounded px-1">${awayScore}</span>
            </div>
            
            <div class="text-[9px] text-center text-slate-600 pt-1 flex justify-between">
                <span>${new Date(m.date).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' })}</span>
                <span>${new Date(m.date).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
        </div>
        `;
    }).join('');
}

// Initial call to load 16vos
// document.addEventListener('DOMContentLoaded', () => loadBracketEditor(4)); // This might conflict with init(), handled implicitly or by user click
