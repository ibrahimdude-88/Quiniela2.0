// ================================================================
// BRACKET VISUALIZATION - FRESH BUILD v5
// Uses display:flex / display:none (not class.hidden) to match HTML
// All functions are global (no ES module scope issues)
// ================================================================

(function () {
    // ── State ────────────────────────────────────────────────────
    var bScale = 0.8;
    var bOX = 0, bOY = 0;
    var bDragging = false;
    var bStartX = 0, bStartY = 0;

    // ── Toggle Open / Close ─────────────────────────────────────
    window.toggleBracket = function () {
        var modal = document.getElementById('bracket-modal');
        if (!modal) { console.error('[BRACKET] Modal not found'); return; }

        var isOpen = modal.style.display === 'flex';
        if (isOpen) {
            modal.style.display = 'none';
        } else {
            modal.style.display = 'flex';
            bScale = 0.8; bOX = 0; bOY = 0;
            _applyTransform();
            _initDrag();
            // Show loading then render
            var c = document.getElementById('bracket-container');
            if (c) c.innerHTML = '<div style="color:#64748b;font-size:14px;padding:40px;">Cargando cuadro...</div>';
            setTimeout(_render, 80);
        }
    };

    // Escape key
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
            var m = document.getElementById('bracket-modal');
            if (m && m.style.display === 'flex') m.style.display = 'none';
        }
    });

    // ── Zoom Controls ────────────────────────────────────────────
    window.bracketZoomIn = function () { bScale = Math.min(3, bScale + 0.1); _applyTransform(); };
    window.bracketZoomOut = function () { bScale = Math.max(0.2, bScale - 0.1); _applyTransform(); };
    window.bracketFit = function () { bScale = 0.8; bOX = 0; bOY = 0; _applyTransform(); };

    // Legacy aliases used by old HTML
    window.zoomBracket = function (d) { bScale = Math.max(0.2, Math.min(3, bScale + d)); _applyTransform(); };
    window.resetBracketZoom = window.bracketFit;

    function _applyTransform() {
        var canvas = document.getElementById('bracket-canvas');
        if (canvas) {
            canvas.style.transform = 'translate(calc(-50% + ' + bOX + 'px), calc(-50% + ' + bOY + 'px)) scale(' + bScale + ')';
        }
        var lbl = document.getElementById('bracket-zoom-label');
        if (lbl) lbl.textContent = Math.round(bScale * 100) + '%';
    }

    // ── Drag (Pointer Events on Stage) ──────────────────────────
    function _initDrag() {
        var stage = document.getElementById('bracket-stage');
        if (!stage || stage._bInited) return;
        stage._bInited = true;

        stage.addEventListener('pointerdown', function (e) {
            if (e.target.tagName === 'BUTTON' || e.target.closest('button')) return;
            bDragging = true;
            bStartX = e.clientX;
            bStartY = e.clientY;
            stage.setPointerCapture(e.pointerId);
            stage.style.cursor = 'grabbing';
            e.preventDefault();
        });

        stage.addEventListener('pointermove', function (e) {
            if (!bDragging) return;
            bOX += e.clientX - bStartX;
            bOY += e.clientY - bStartY;
            bStartX = e.clientX;
            bStartY = e.clientY;
            _applyTransform();
        });

        stage.addEventListener('pointerup', function () {
            bDragging = false;
            stage.style.cursor = 'grab';
        });

        stage.addEventListener('pointercancel', function () {
            bDragging = false;
            stage.style.cursor = 'grab';
        });

        stage.addEventListener('wheel', function (e) {
            e.preventDefault();
            bScale = Math.max(0.2, Math.min(3, bScale + (e.deltaY > 0 ? -0.08 : 0.08)));
            _applyTransform();
        }, { passive: false });
    }

    // ── Render ───────────────────────────────────────────────────
    function _render() {
        var container = document.getElementById('bracket-container');
        if (!container) { console.error('[BRACKET] #bracket-container not found'); return; }

        var matches = window.matches;
        if (!matches || !matches.length) {
            container.innerHTML = '<div style="color:#f87171;padding:40px;">Sin datos de partidos. Por favor espera y vuelve a intentar.</div>';
            return;
        }

        var final = null;
        var third = null;
        for (var i = 0; i < matches.length; i++) {
            if (+matches[i].id === 104) final = matches[i];
            if (+matches[i].id === 103) third = matches[i];
        }

        if (!final) {
            container.innerHTML = '<div style="color:#f87171;padding:40px;">Partido Final (ID 104) no encontrado.</div>';
            return;
        }

        container.innerHTML = '';
        container.style.display = 'flex';
        container.style.alignItems = 'center';
        container.style.gap = '0';

        var leftId = 101;
        var rightId = 102;

        // Left branch
        if (leftId) {
            var leftEl = _buildBranch(leftId, 'left', 0);
            if (leftEl) container.appendChild(leftEl);
        }

        // Center column
        var center = document.createElement('div');
        center.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:20px;flex-shrink:0;padding:0 20px;';

        var trophy = document.createElement('div');
        trophy.style.cssText = 'text-align:center;margin-bottom:4px;';
        trophy.innerHTML = '<span class="material-icons" style="color:#eab308;font-size:32px;display:block;">emoji_events</span><div style="color:#eab308;font-size:10px;font-weight:900;letter-spacing:0.15em;text-transform:uppercase;">Gran Final</div>';

        center.appendChild(trophy);
        center.appendChild(_makeCard(final, true));

        if (third) {
            var thirdLabel = document.createElement('div');
            thirdLabel.style.cssText = 'color:#475569;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.1em;margin-top:12px;';
            thirdLabel.textContent = 'Tercer Lugar';
            center.appendChild(thirdLabel);
            center.appendChild(_makeCard(third, false));
        }

        container.appendChild(center);

        // Right branch
        if (rightId) {
            var rightEl = _buildBranch(rightId, 'right', 0);
            if (rightEl) container.appendChild(rightEl);
        }

        console.log('[BRACKET] Render done.');
    }

    // ── Tree Builder ─────────────────────────────────────────────
    function _buildBranch(matchId, side, depth) {
        if (depth > 4) return _makeLeaf('...', side);

        var match = null;
        var ms = window.matches || [];
        for (var i = 0; i < ms.length; i++) {
            if (+ms[i].id === +matchId) { match = ms[i]; break; }
        }
        if (!match) return _makeLeaf('#' + matchId, side);

        // HARDCODED TOURNAMENT STRUCTURE mapping matchId -> { homeSrc, awaySrc }
        var struct = {
            104: { homeSrc: 101, awaySrc: 102 },
            103: { homeSrc: 101, awaySrc: 102 },
            101: { homeSrc: 97, awaySrc: 98 },
            102: { homeSrc: 99, awaySrc: 100 },
            97: { homeSrc: 89, awaySrc: 90 },
            98: { homeSrc: 91, awaySrc: 92 },
            99: { homeSrc: 93, awaySrc: 94 },
            100: { homeSrc: 95, awaySrc: 96 },
            89: { homeSrc: 74, awaySrc: 77 },
            90: { homeSrc: 73, awaySrc: 75 },
            91: { homeSrc: 76, awaySrc: 78 },
            92: { homeSrc: 79, awaySrc: 80 },
            93: { homeSrc: 83, awaySrc: 84 },
            94: { homeSrc: 81, awaySrc: 82 },
            95: { homeSrc: 86, awaySrc: 88 },
            96: { homeSrc: 85, awaySrc: 87 }
        };

        var hSrc = struct[matchId] ? struct[matchId].homeSrc : null;
        var aSrc = struct[matchId] ? struct[matchId].awaySrc : null;

        var child1 = hSrc ? _buildBranch(hSrc, side, depth + 1) : _makeLeaf(match.home_team, side);
        var child2 = aSrc ? _buildBranch(aSrc, side, depth + 1) : _makeLeaf(match.away_team, side);

        // Children column
        var col = document.createElement('div');
        col.style.cssText = 'display:flex;flex-direction:column;gap:20px;';
        col.appendChild(child1);
        col.appendChild(child2);

        // Connector lines
        var conn = document.createElement('div');
        conn.style.cssText = 'width:20px;display:flex;flex-direction:column;align-self:stretch;';
        var ct = document.createElement('div');
        ct.style.cssText = 'flex:1;border-bottom:1px solid rgba(255,255,255,0.12);' + (side === 'left' ? 'border-right' : 'border-left') + ':1px solid rgba(255,255,255,0.12);';
        var cb = document.createElement('div');
        cb.style.cssText = 'flex:1;border-top:1px solid rgba(255,255,255,0.12);' + (side === 'left' ? 'border-right' : 'border-left') + ':1px solid rgba(255,255,255,0.12);';
        conn.appendChild(ct);
        conn.appendChild(cb);

        // Stump
        var stump = document.createElement('div');
        stump.style.cssText = 'width:12px;height:1px;background:rgba(255,255,255,0.12);flex-shrink:0;';

        // Card
        var card = _makeCard(match, false);

        // Row layout:
        //  LEFT:  [children-col] [conn] [stump] [card]   → card closest to center (right)
        //  RIGHT: [card] [stump] [conn] [children-col]   → card closest to center (left)
        // Both use flex-direction:row; DOM order gives the mirroring
        var row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;flex-direction:row;';

        if (side === 'left') {
            row.appendChild(col);
            row.appendChild(conn);
            row.appendChild(stump);
            row.appendChild(card);
        } else {
            row.appendChild(card);
            row.appendChild(stump);
            row.appendChild(conn);
            row.appendChild(col);
        }

        return row;
    }

    function _makeLeaf(name, side) {
        // Resolve W-codes in leaves too
        var resolved = _resolveTeam(name) || name;
        var isTBD = !resolved || /^[WL]\d/.test(String(resolved));
        var label = isTBD ? (resolved || 'TBD') : _name(resolved);

        var pill = document.createElement('div');
        pill.style.cssText = 'background:#1e293b;border:1px solid rgba(255,255,255,0.08);border-radius:999px;padding:5px 14px;font-size:11px;font-weight:700;color:#94a3b8;display:flex;align-items:center;gap:6px;min-width:90px;justify-content:center;white-space:nowrap;';

        if (!isTBD) {
            var img = document.createElement('img');
            img.src = _flag(resolved);
            img.style.cssText = 'width:14px;height:14px;border-radius:50%;object-fit:cover;';
            img.onerror = function () { this.remove(); };
            pill.appendChild(img);
        }
        var sp = document.createElement('span');
        sp.textContent = label;
        pill.appendChild(sp);

        var stub = document.createElement('div');
        stub.style.cssText = 'width:12px;height:1px;background:rgba(255,255,255,0.08);flex-shrink:0;';

        var w = document.createElement('div');
        w.style.cssText = 'display:flex;align-items:center;flex-direction:row;';
        // LEFT:  [pill] [stub →]  (stub connects to right/center)
        // RIGHT: [← stub] [pill]  (stub connects to left/center)
        if (side === 'left') {
            w.appendChild(pill);
            w.appendChild(stub);
        } else {
            w.appendChild(stub);
            w.appendChild(pill);
        }
        return w;
    }

    // ── Card ─────────────────────────────────────────────────────
    function _makeCard(match, large) {
        var fin = match.status === 'f';
        var live = match.status === 'a';
        var hs = match.home_score != null ? match.home_score : '-';
        var as_ = match.away_score != null ? match.away_score : '-';

        // Resolve W-codes to real team codes (winner of source match)
        var homeTeam = _resolveTeam(match.home_team) || match.home_team;
        var awayTeam = _resolveTeam(match.away_team) || match.away_team;

        var hc = '#94a3b8', ac = '#94a3b8';
        if (fin) {
            if (+match.home_score > +match.away_score || match.penalty_winner === 'home') { hc = '#4ade80'; ac = '#334155'; }
            else if (+match.away_score > +match.home_score || match.penalty_winner === 'away') { ac = '#4ade80'; hc = '#334155'; }
        }

        var w = large ? '200px' : '170px';
        var border = live ? '1px solid #22c55e' : '1px solid rgba(255,255,255,0.08)';

        var el = document.createElement('div');
        el.style.cssText = 'width:' + w + ';background:#1e293b;border:' + border + ';border-radius:10px;padding:8px 12px;font-family:ui-sans-serif,system-ui,sans-serif;flex-shrink:0;';
        el.innerHTML =
            '<div style="font-size:9px;color:#334155;font-family:monospace;border-bottom:1px solid rgba(255,255,255,0.05);padding-bottom:4px;margin-bottom:7px;display:flex;justify-content:space-between;">' +
            '<span>#' + match.id + '</span>' +
            (fin ? '<span style="color:#475569;">FIN</span>' : (live ? '<span style="color:#22c55e;">LIVE ●</span>' : '')) +
            '</div>' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">' +
            '<div style="display:flex;align-items:center;gap:6px;overflow:hidden;">' +
            '<img src="' + _flag(homeTeam) + '" style="width:18px;height:14px;border-radius:2px;object-fit:cover;flex-shrink:0;" onerror="this.src=\'https://flagcdn.com/w40/un.png\'">' +
            '<span style="font-size:11px;font-weight:700;color:' + hc + ';overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100px;">' + _name(homeTeam) + '</span>' +
            '</div>' +
            '<span style="font-family:monospace;font-size:14px;font-weight:900;color:' + hc + ';padding-left:8px;">' + hs + '</span>' +
            '</div>' +
            '<div style="display:flex;justify-content:space-between;align-items:center;">' +
            '<div style="display:flex;align-items:center;gap:6px;overflow:hidden;">' +
            '<img src="' + _flag(awayTeam) + '" style="width:18px;height:14px;border-radius:2px;object-fit:cover;flex-shrink:0;" onerror="this.src=\'https://flagcdn.com/w40/un.png\'">' +
            '<span style="font-size:11px;font-weight:700;color:' + ac + ';overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100px;">' + _name(awayTeam) + '</span>' +
            '</div>' +
            '<span style="font-family:monospace;font-size:14px;font-weight:900;color:' + ac + ';padding-left:8px;">' + as_ + '</span>' +
            '</div>' +
            (match.penalty_winner ? '<div style="font-size:9px;color:#475569;border-top:1px solid rgba(255,255,255,0.05);padding-top:4px;margin-top:5px;text-align:center;">Pen: <b style="color:#94a3b8;">' + (match.penalty_winner === 'home' ? _name(homeTeam) : _name(awayTeam)) + '</b></div>' : '');

        return el;
    }

    // ── Helpers ──────────────────────────────────────────────────

    // Resolves W{id} codes to the actual winner team code if match is finished
    function _resolveTeam(code) {
        if (!code) return null;
        var s = String(code);
        if (s.charAt(0) !== 'W') return code; // Already a real team code

        var matchId = parseInt(s.slice(1), 10);
        if (isNaN(matchId)) return code;

        var ms = window.matches || [];
        for (var i = 0; i < ms.length; i++) {
            var m = ms[i];
            if (+m.id === matchId && m.status === 'f') {
                // Determine actual winner
                if (m.penalty_winner === 'home') return m.home_team;
                if (m.penalty_winner === 'away') return m.away_team;
                if (m.home_score != null && m.away_score != null) {
                    if (+m.home_score > +m.away_score) return m.home_team;
                    if (+m.away_score > +m.home_score) return m.away_team;
                }
            }
        }
        return code; // Match not finished or not found – keep W-code
    }

    function _srcId(code) {
        if (!code) return null;
        var s = String(code);
        if (s.charAt(0) === 'W') {
            var n = parseInt(s.slice(1), 10);
            return isNaN(n) ? null : n;
        }
        return null;
    }

    function _name(code) {
        if (!code) return 'TBD';
        var map = {
            MEX: 'México', BRA: 'Brasil', ARG: 'Argentina', USA: 'EE.UU.', CAN: 'Canadá',
            ESP: 'España', FRA: 'Francia', GER: 'Alemania', ENG: 'Inglaterra', POR: 'Portugal',
            NED: 'Países Bajos', BEL: 'Bélgica', CRO: 'Croacia', URU: 'Uruguay', MAR: 'Marruecos',
            JPN: 'Japón', KOR: 'Corea', SEN: 'Senegal', SUI: 'Suiza', POL: 'Polonia', AUS: 'Australia',
            ITA: 'Italia', ECU: 'Ecuador', QAT: 'Qatar', IRN: 'Irán', KSA: 'Arabia S.',
            GHA: 'Ghana', CMR: 'Camerún', TUN: 'Túnez', SRB: 'Serbia', DEN: 'Dinamarca',
            COL: 'Colombia', PAN: 'Panamá', CRC: 'Costa Rica'
        };
        var s = String(code);
        if (/^[WL]\d/.test(s)) return s;
        return map[code] || code;
    }

    function _flag(code) {
        var map = {
            MEX: 'mx', BRA: 'br', ARG: 'ar', USA: 'us', CAN: 'ca', ESP: 'es', FRA: 'fr', GER: 'de',
            ENG: 'gb', POR: 'pt', NED: 'nl', BEL: 'be', CRO: 'hr', URU: 'uy', KOR: 'kr', JPN: 'jp',
            SEN: 'sn', MAR: 'ma', SUI: 'ch', GHA: 'gh', CMR: 'cm', ECU: 'ec', KSA: 'sa', IRN: 'ir',
            AUS: 'au', CRC: 'cr', POL: 'pl', TUN: 'tn', DEN: 'dk', SRB: 'rs', WAL: 'gb-wls',
            QAT: 'qa', RSA: 'za', PAR: 'py', SCO: 'gb-sct', CIV: 'ci', COL: 'co', ITA: 'it',
            PAN: 'pa', AUT: 'at', ALG: 'dz', BOL: 'bo', VEN: 've', CHI: 'cl', PER: 'pe'
        };
        if (!code) return 'https://flagcdn.com/w40/un.png';
        var s = String(code);
        if (/^[WL]/.test(s) || s.length > 3) return 'https://flagcdn.com/w40/un.png';
        return 'https://flagcdn.com/w40/' + (map[code] || 'un') + '.png';
    }

})(); // End IIFE
