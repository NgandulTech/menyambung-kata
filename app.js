// ========== SAMBUNG KATA PRO — APP.JS ==========
(function () {
    'use strict';

    let allWords = [];
    let startFreq = {};
    let endingFreq = {};
    let totalWords = 0;
    let prefixMap = {};
    let suffixMap = {};
    let alphaCounts = {};

    const LS_HIDDEN = 'skpro_hidden';
    const LS_CUSTOM = 'skpro_custom';
    let hiddenWords = new Set();
    let customWords = [];

    const MAX_RESULTS = 200;
    let debounceTimer = null;

    const $ = id => document.getElementById(id);

    // ===== LOCALSTORAGE =====
    function loadLocalData() {
        try { const h = localStorage.getItem(LS_HIDDEN); if (h) hiddenWords = new Set(JSON.parse(h)); } catch (e) { }
        try { const c = localStorage.getItem(LS_CUSTOM); if (c) customWords = JSON.parse(c); } catch (e) { }
    }
    function saveHidden() { localStorage.setItem(LS_HIDDEN, JSON.stringify([...hiddenWords])); }
    function saveCustom() { localStorage.setItem(LS_CUSTOM, JSON.stringify(customWords)); }

    // ===== LOAD =====
    async function loadData() {
        try {
            $('loading-status').textContent = 'Mengunduh kamus (±15MB)...';
            $('progress-fill').style.width = '10%';
            const resp = await fetch('kbbi_words.json');
            if (!resp.ok) throw new Error('Gagal memuat data');
            $('loading-status').textContent = 'Memproses data...';
            $('progress-fill').style.width = '50%';
            const data = await resp.json();
            allWords = data.words;
            startFreq = data.startFreq || {};
            endingFreq = data.endingFreq || {};
            totalWords = data.totalWords || allWords.length;
            loadLocalData();
            mergeCustomWords();
            $('loading-status').textContent = 'Membangun indeks...';
            $('progress-fill').style.width = '70%';
            buildIndexes();
            $('progress-fill').style.width = '100%';
            $('loading-status').textContent = 'Selesai!';
            setTimeout(() => {
                $('loading-screen').classList.add('fade-out');
                $('app').classList.remove('hidden');
                updateWordCount();
                buildAlphabetBar();
            }, 400);
        } catch (err) {
            $('loading-status').textContent = 'Error: ' + err.message;
            $('progress-fill').style.background = 'var(--accent-danger)';
        }
    }

    function updateWordCount() {
        const c = allWords.length;
        $('word-count').textContent = `${c.toLocaleString('id-ID')} kata siap` + (customWords.length ? ` (${customWords.length} custom)` : '');
        $('total-words-stat').textContent = c.toLocaleString('id-ID');
    }

    function mergeCustomWords() {
        const existing = new Set(allWords.map(w => w.w));
        for (const cw of customWords) {
            if (!existing.has(cw.w)) {
                allWords.push({ w: cw.w, m: cw.m || '(Custom)', s: cw.s || 0, custom: true });
                existing.add(cw.w);
            }
        }
        allWords.sort((a, b) => a.w.localeCompare(b.w));
    }

    function buildIndexes() {
        prefixMap = {}; suffixMap = {}; alphaCounts = {};
        for (let i = 0; i < allWords.length; i++) {
            const w = allWords[i].w;
            alphaCounts[w.charAt(0)] = (alphaCounts[w.charAt(0)] || 0) + 1;
            for (let len = 1; len <= Math.min(4, w.length); len++) {
                const pre = w.substring(0, len);
                if (!prefixMap[pre]) prefixMap[pre] = [];
                prefixMap[pre].push(i);
                const suf = w.substring(w.length - len);
                if (!suffixMap[suf]) suffixMap[suf] = [];
                suffixMap[suf].push(i);
            }
        }
    }

    function addCustomWord(word) {
        word = word.toLowerCase().trim();
        if (!word || word.length < 2) return { ok: false, msg: 'Minimal 2 huruf' };
        if (!/^[a-z]+$/.test(word)) return { ok: false, msg: 'Hanya huruf a-z' };
        if (allWords.find(w => w.w === word)) return { ok: false, msg: `"${word}" sudah ada` };
        const s = startFreq[word.substring(word.length - 2)] || 0;
        allWords.push({ w: word, m: '(Custom)', s, custom: true });
        allWords.sort((a, b) => a.w.localeCompare(b.w));
        customWords.push({ w: word, m: '(Custom)', s });
        saveCustom(); buildIndexes(); updateWordCount(); buildAlphabetBar();
        return { ok: true, msg: `"${word}" ✓` };
    }

    window.hideWord = function (w, e) { e.stopPropagation(); hiddenWords.add(w); saveHidden(); doSearch(); };
    window.unhideWord = function (w, e) { e.stopPropagation(); hiddenWords.delete(w); saveHidden(); doSearch(); };

    // ===== ALPHABET =====
    function buildAlphabetBar() {
        const bar = $('alphabet-bar');
        bar.innerHTML = 'abcdefghijklmnopqrstuvwxyz'.split('').map(l => {
            const c = alphaCounts[l] || 0;
            return `<button class="alpha-btn" data-letter="${l}" ${c === 0 ? 'disabled style="opacity:0.3"' : ''}>${l.toUpperCase()}<span class="alpha-count">${c}</span></button>`;
        }).join('');
        bar.addEventListener('click', (e) => {
            const btn = e.target.closest('.alpha-btn');
            if (!btn || btn.disabled) return;
            const l = btn.dataset.letter, was = btn.classList.contains('active');
            bar.querySelectorAll('.alpha-btn').forEach(b => b.classList.remove('active'));
            if (!was) { btn.classList.add('active'); $('prefix-input').value = l; } else { $('prefix-input').value = ''; }
            doSearch();
        });
    }

    // ===== INDEX HELPERS =====
    function getByPrefix(prefix) {
        if (!prefix) return null;
        if (prefix.length <= 4 && prefixMap[prefix]) return new Set(prefixMap[prefix]);
        let k = prefix.substring(0, Math.min(4, prefix.length));
        while (k.length > 0 && !prefixMap[k]) k = k.substring(0, k.length - 1);
        return k ? new Set(prefixMap[k].filter(i => allWords[i].w.startsWith(prefix))) : new Set();
    }

    function getBySuffix(suffix) {
        if (!suffix) return null;
        if (suffix.length <= 4 && suffixMap[suffix]) return new Set(suffixMap[suffix]);
        let k = suffix.substring(suffix.length - Math.min(4, suffix.length));
        while (k.length > 0 && !suffixMap[k]) k = k.substring(1);
        return k ? new Set(suffixMap[k].filter(i => allWords[i].w.endsWith(suffix))) : new Set();
    }

    function filterSort(indices, minLen, maxLen, sortMode) {
        let vis = [], hid = [];
        for (const i of indices) {
            const w = allWords[i];
            if (w.w.length < minLen || w.w.length > maxLen) continue;
            (hiddenWords.has(w.w) ? hid : vis).push(i);
        }
        return { visible: doSort(vis, sortMode), hidden: doSort(hid, sortMode) };
    }

    function doSort(arr, mode) {
        const a = [...arr];
        switch (mode) {
            case 'alpha': a.sort((x, y) => allWords[x].w.localeCompare(allWords[y].w)); break;
            case 'length-asc': a.sort((x, y) => allWords[x].w.length - allWords[y].w.length || allWords[x].w.localeCompare(allWords[y].w)); break;
            case 'length-desc': a.sort((x, y) => allWords[y].w.length - allWords[x].w.length || allWords[x].w.localeCompare(allWords[y].w)); break;
            case 'strategy': a.sort((x, y) => allWords[x].s - allWords[y].s || allWords[x].w.localeCompare(allWords[y].w)); break;
        }
        return a;
    }

    // ===== MAIN SEARCH =====
    function doSearch() {
        const prefix = ($('prefix-input').value || '').toLowerCase().trim();
        const suffix = ($('suffix-input').value || '').toLowerCase().trim();
        const minLen = parseInt($('search-minlen').value) || 2;
        const maxLen = parseInt($('search-maxlen').value) || 30;
        const sortMode = $('search-sort').value;

        $('prefix-clear').classList.toggle('visible', prefix.length > 0);
        $('suffix-clear').classList.toggle('visible', suffix.length > 0);
        $('alphabet-bar').querySelectorAll('.alpha-btn').forEach(b => b.classList.toggle('active', prefix.length === 1 && b.dataset.letter === prefix));

        // Hide all
        $('section-combined').style.display = 'none';
        $('section-prefix').style.display = 'none';
        $('section-single').style.display = 'none';
        $('results-container').classList.remove('dual-mode');

        if (!prefix && !suffix) {
            $('section-single').style.display = 'block';
            $('results-single').innerHTML = `<div class="empty-state"><div class="empty-icon">🔍</div><h3>Ketik awalan, akhiran, atau keduanya!</h3><p>Contoh: awalan "ko" + akhiran "ks"</p></div>`;
            $('search-info').innerHTML = '';
            updateHidden([], '', '');
            return;
        }

        let allHidden = [];

        if (prefix && suffix) {
            // ===== DUAL MODE: 2 sections side-by-side =====
            $('results-container').classList.add('dual-mode');
            const preIdx = getByPrefix(prefix);
            const sufIdx = getBySuffix(suffix);

            // Section 1: Combined (prefix AND suffix)
            const combinedSet = new Set();
            for (const i of preIdx) { if (sufIdx.has(i)) combinedSet.add(i); }
            const combined = filterSort(combinedSet, minLen, maxLen, sortMode);
            $('section-combined').style.display = 'block';
            $('section-combined-title').textContent = `Awalan "${prefix}" + Akhiran "${suffix}"`;
            $('section-combined-count').textContent = `${combined.visible.length} kata`;
            renderPills($('results-combined'), combined.visible.slice(0, MAX_RESULTS).map(i => allWords[i]), prefix, suffix, sortMode === 'strategy', false);
            allHidden.push(...combined.hidden.map(i => allWords[i]));

            // Section 2: Prefix only (all prefix matches)
            const prefOnly = filterSort(preIdx, minLen, maxLen, sortMode);
            $('section-prefix').style.display = 'block';
            $('section-prefix-title').textContent = `Semua awalan "${prefix}"`;
            $('section-prefix-count').textContent = `${prefOnly.visible.length} kata`;
            renderPills($('results-prefix'), prefOnly.visible.slice(0, MAX_RESULTS).map(i => allWords[i]), prefix, null, sortMode === 'strategy', false);

        } else {
            // ===== SINGLE MODE =====
            const indices = prefix ? getByPrefix(prefix) : getBySuffix(suffix);
            const filtered = filterSort(indices, minLen, maxLen, sortMode);
            $('section-single').style.display = 'block';
            const total = filtered.visible.length;
            $('search-info').innerHTML = `<span>Ditemukan <span class="count">${total.toLocaleString('id-ID')}</span> kata${total > MAX_RESULTS ? ` (${MAX_RESULTS} ditampilkan)` : ''}${filtered.hidden.length ? ` · ${filtered.hidden.length} tersembunyi` : ''}</span>`;
            renderPills($('results-single'), filtered.visible.slice(0, MAX_RESULTS).map(i => allWords[i]), prefix, suffix, sortMode === 'strategy', false);
            allHidden.push(...filtered.hidden.map(i => allWords[i]));
        }

        updateHidden(allHidden, prefix, suffix);
    }

    // ===== RENDER PILL CARDS =====
    function renderPills(container, results, prefix, suffix, showStrategy, isHidden) {
        if (!results.length) {
            container.innerHTML = `<div class="no-results" style="width:100%;text-align:center;padding:16px;color:var(--text-muted)">Tidak ada kata</div>`;
            return;
        }
        container.innerHTML = results.map(w => {
            let wh = '';
            if (prefix && suffix) {
                const pL = prefix.length, sL = suffix.length;
                if (pL + sL >= w.w.length) wh = `<span class="highlight">${esc(w.w)}</span>`;
                else wh = `<span class="highlight">${esc(w.w.substring(0, pL))}</span>${esc(w.w.substring(pL, w.w.length - sL))}<span class="highlight-suffix">${esc(w.w.substring(w.w.length - sL))}</span>`;
            } else if (prefix) {
                wh = `<span class="highlight">${esc(w.w.substring(0, prefix.length))}</span>${esc(w.w.substring(prefix.length))}`;
            } else if (suffix) {
                wh = `${esc(w.w.substring(0, w.w.length - suffix.length))}<span class="highlight-suffix">${esc(w.w.substring(w.w.length - suffix.length))}</span>`;
            } else wh = esc(w.w);

            let st = '';
            if (showStrategy) {
                const sc = w.s <= 5 ? 'killer' : w.s <= 20 ? 'good' : w.s <= 50 ? 'meh' : 'bad';
                st = `<span class="strategy-score ${sc}">${w.s}</span>`;
            }
            const cb = w.custom ? '<span class="custom-badge">C</span>' : '';
            const ha = isHidden ? `onclick="window.unhideWord('${esc(w.w)}',event)" title="Tampilkan"` : `onclick="window.hideWord('${esc(w.w)}',event)" title="Sembunyikan"`;
            const hi = isHidden ? '👁' : '✕';
            const cc = isHidden ? 'word-card hidden-word' : 'word-card';

            return `<div class="${cc}"><button class="hide-btn" ${ha}>${hi}</button><div class="word-text" onclick="window.showWordDetail('${esc(w.w)}')">${wh}</div><div class="word-meta"><span class="length-badge">${w.w.length}h</span>${cb}${st}</div></div>`;
        }).join('');
    }

    function updateHidden(list, prefix, suffix) {
        $('hidden-count').textContent = list.length;
        if (!list.length) { $('hidden-section').style.display = 'none'; return; }
        $('hidden-section').style.display = 'block';
        renderPills($('hidden-results'), list.slice(0, 100), prefix, suffix, false, true);
    }

    function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

    // ===== MODAL =====
    window.showWordDetail = function (word) {
        const entry = allWords.find(w => w.w === word);
        if (!entry) return;
        const e2 = word.substring(word.length - 2), opts = startFreq[e2] || 0;
        const sc = opts <= 5 ? 'killer' : opts <= 20 ? 'good' : opts <= 50 ? 'meh' : 'bad';
        $('modal-content').innerHTML = `
      <div class="modal-word">${esc(word)}</div>
      ${entry.custom ? '<div style="margin-bottom:8px"><span class="custom-badge">CUSTOM</span></div>' : ''}
      ${hiddenWords.has(word) ? '<div style="margin-bottom:8px;color:var(--accent-warning);font-size:0.85rem">⚠️ Disembunyikan</div>' : ''}
      <div class="modal-section"><div class="modal-section-label">Arti</div><div class="modal-section-content">${entry.m ? esc(entry.m) : '<em>—</em>'}</div></div>
      <div class="modal-section"><div class="modal-section-label">Sambung Kata</div><div class="modal-badges"><span class="modal-badge">📏 ${word.length} huruf</span><span class="modal-badge">🔤 ${word.substring(0, 2)}</span><span class="modal-badge">🔡 ${e2}</span></div></div>
      <div class="modal-section"><div class="modal-section-label">Strategi</div><div class="modal-section-content">Akhiran "<strong>${e2}</strong>" → lawan punya <span class="strategy-score ${sc}" style="display:inline-block">${opts} kata</span><br>${opts <= 5 ? '🔥 Lawan kesulitan!' : opts <= 20 ? '✅ Cukup bagus.' : opts <= 50 ? '⚠️ Lumayan.' : '❌ Kurang strategis.'}</div></div>`;
        $('modal-overlay').classList.add('active');
    };

    // ===== SYLLABLE =====
    function getLastSyllables(word, count) {
        const v = 'aiueo'; const ch = word.toLowerCase().split(''); const sy = []; let cu = '';
        for (let i = 0; i < ch.length; i++) {
            cu += ch[i];
            if (v.includes(ch[i])) {
                if (i + 1 < ch.length && v.includes(ch[i + 1])) { sy.push(cu); cu = ''; }
                else if (i + 1 >= ch.length) { sy.push(cu); cu = ''; }
            } else if (cu.length > 1 && i + 1 < ch.length && v.includes(ch[i + 1])) {
                sy.push(cu.substring(0, cu.length - 1)); cu = ch[i];
            }
        }
        if (cu) sy.push(cu);
        return sy.slice(-count).join('');
    }

    // ===== STRATEGY =====
    function doStrategy() {
        const val = $('strategy-input').value;
        $('strategy-clear').classList.toggle('visible', val.length > 0);
        if (val.length < 2) {
            $('strategy-results').innerHTML = `<div class="empty-state"><div class="empty-icon">⚔️</div><h3>Masukkan kata terakhir lawan</h3></div>`;
            $('strategy-info').innerHTML = ''; $('strategy-analysis').innerHTML = ''; return;
        }
        const syl = document.querySelector('.syl-btn.active')?.dataset.syl || '1';
        const cc = parseInt($('strategy-charcount').value) || 2;
        const opp = val.toLowerCase().trim();
        const searchKey = syl === 'custom' ? opp.substring(opp.length - cc) : getLastSyllables(opp, parseInt(syl));
        if (!searchKey) return;

        const idx = getByPrefix(searchKey);
        const filtered = [...idx].filter(i => !hiddenWords.has(allWords[i].w));
        const sorted = filtered.sort((a, b) => allWords[a].s - allWords[b].s);
        const total = sorted.length;
        const results = sorted.slice(0, MAX_RESULTS).map(i => allWords[i]);

        let kw = 0;
        for (const w of results) { if (w.s <= 5) kw++; }
        const es = {};
        for (const w of results) { const e = w.w.substring(w.w.length - 2), o = startFreq[e] || 0; if (!es[e]) es[e] = { c: 0, o }; es[e].c++; }
        const be = Object.entries(es).sort((a, b) => a[1].o - b[1].o).slice(0, 5);

        $('strategy-analysis').innerHTML = `
      <div class="analysis-card"><div class="analysis-label">Sambungan</div><div class="analysis-value">"${esc(searchKey)}"</div></div>
      <div class="analysis-card"><div class="analysis-label">Total</div><div class="analysis-value">${total.toLocaleString('id-ID')}</div></div>
      <div class="analysis-card"><div class="analysis-label">Killer 🔥</div><div class="analysis-value">${kw}</div></div>
      <div class="analysis-card"><div class="analysis-label">Mematikan</div><div class="analysis-value">${be.length ? '"' + be[0][0] + '"' : '—'}</div></div>`;
        $('strategy-info').innerHTML = `<span><span class="count">${total.toLocaleString('id-ID')}</span> kata</span>`;
        renderPills($('strategy-results'), results, searchKey, null, true, false);
    }

    // ===== EVENTS =====
    function setupEvents() {
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
                tab.classList.add('active'); $('panel-' + tab.dataset.tab).classList.add('active');
            });
        });

        function trigger() { clearTimeout(debounceTimer); debounceTimer = setTimeout(doSearch, 80); }
        $('prefix-input').addEventListener('input', trigger);
        $('suffix-input').addEventListener('input', trigger);
        $('search-minlen').addEventListener('input', trigger);
        $('search-maxlen').addEventListener('input', trigger);
        $('search-sort').addEventListener('change', trigger);
        $('prefix-clear').addEventListener('click', () => { $('prefix-input').value = ''; doSearch(); $('prefix-input').focus(); });
        $('suffix-clear').addEventListener('click', () => { $('suffix-input').value = ''; doSearch(); $('suffix-input').focus(); });

        // Add word
        $('add-word-input').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const v = $('add-word-input').value.trim();
                if (!v) return;
                const r = addCustomWord(v);
                $('add-hint').textContent = r.msg;
                $('add-hint').className = 'add-hint ' + (r.ok ? 'success' : 'error');
                if (r.ok) { $('add-word-input').value = ''; doSearch(); }
                setTimeout(() => { $('add-hint').textContent = ''; $('add-hint').className = 'add-hint'; }, 2500);
            }
        });

        // Hidden toggle
        $('hidden-toggle').addEventListener('click', () => {
            $('hidden-results').classList.toggle('open');
            $('toggle-arrow').classList.toggle('open');
        });

        // Strategy
        document.querySelectorAll('.syl-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.syl-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                $('strategy-charcount').classList.toggle('hidden', btn.dataset.syl !== 'custom');
                doStrategy();
            });
        });
        $('strategy-input').addEventListener('input', () => { clearTimeout(debounceTimer); debounceTimer = setTimeout(doStrategy, 120); });
        $('strategy-charcount').addEventListener('input', doStrategy);
        $('strategy-clear').addEventListener('click', () => { $('strategy-input').value = ''; doStrategy(); $('strategy-input').focus(); });

        // Modal
        $('modal-close').addEventListener('click', () => $('modal-overlay').classList.remove('active'));
        $('modal-overlay').addEventListener('click', (e) => { if (e.target === $('modal-overlay')) $('modal-overlay').classList.remove('active'); });
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') $('modal-overlay').classList.remove('active'); });

        doSearch();
    }

    loadData().then(() => setupEvents());
})();
