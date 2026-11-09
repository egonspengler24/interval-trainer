(() => {
  'use strict';

  // ---------- Music data ----------
  const SHARP = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
  const FLAT  = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
  const BLACK = new Set([1, 3, 6, 8, 10]);

  const INTERVALS = [
    { semi: 1,  abbr: 'm2', name: 'Minor 2nd' },
    { semi: 2,  abbr: 'M2', name: 'Major 2nd' },
    { semi: 3,  abbr: 'm3', name: 'Minor 3rd' },
    { semi: 4,  abbr: 'M3', name: 'Major 3rd' },
    { semi: 5,  abbr: 'P4', name: 'Perfect 4th' },
    { semi: 6,  abbr: 'TT', name: 'Tritone' },
    { semi: 7,  abbr: 'P5', name: 'Perfect 5th' },
    { semi: 8,  abbr: 'm6', name: 'Minor 6th' },
    { semi: 9,  abbr: 'M6', name: 'Major 6th' },
    { semi: 10, abbr: 'm7', name: 'Minor 7th' },
    { semi: 11, abbr: 'M7', name: 'Major 7th' },
    { semi: 12, abbr: 'P8', name: 'Octave' },
  ];
  const BY_SEMI = Object.fromEntries(INTERVALS.map(i => [i.semi, i]));

  const PRESETS = {
    all: INTERVALS.map(i => i.semi),
    none: [],
    consonant: [3, 4, 5, 7, 8, 9, 12],
    dissonant: [1, 2, 6, 10, 11],
  };

  // Two octaves: C3 (48) up to C5 (72) — 25 keys.
  const LOW = 48;
  const HIGH = 72;

  const $ = s => document.querySelector(s);
  const rand = arr => arr[Math.floor(Math.random() * arr.length)];

  // ---------- Audio (synthesised, no samples) ----------
  let ctx = null;
  let master = null;

  function audio() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.35;
      const comp = ctx.createDynamicsCompressor();
      master.connect(comp);
      comp.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  const freq = m => 440 * Math.pow(2, (m - 69) / 12);

  function playNote(midi, when = 0, dur = 1.6) {
    if (!$('#opt-sound').checked) return;
    const c = audio();
    const t = c.currentTime + when;
    const env = c.createGain();
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(5000, t);
    filter.frequency.exponentialRampToValueAtTime(900, t + dur);
    env.connect(filter);
    filter.connect(master);

    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.7, t + 0.008);
    env.gain.exponentialRampToValueAtTime(0.25, t + 0.35);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);

    const f = freq(midi);
    [[1, 1, 'triangle'], [2, 0.4, 'sine'], [3, 0.18, 'sine'], [4, 0.08, 'sine']].forEach(([h, amp, type]) => {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type;
      o.frequency.value = f * h;
      g.gain.value = amp;
      o.connect(g);
      g.connect(env);
      o.start(t);
      o.stop(t + dur + 0.05);
    });
  }

  // ---------- Helpers ----------
  const spelling = () => ($('#opt-spelling').value === 'flat' ? FLAT : SHARP);
  const noteName = m => spelling()[m % 12];
  const octaveOf = m => Math.floor(m / 12) - 1;

  function intervalLabel(diff) {
    const abs = Math.abs(diff);
    if (abs === 0) return 'Unison';
    if (abs <= 12) return BY_SEMI[abs].name;
    const simple = abs - 12;
    return `${BY_SEMI[simple].name} + an octave`;
  }

  // ---------- Keyboard ----------
  const keyEls = {};

  function buildKeyboard() {
    const kb = $('#keyboard');
    kb.innerHTML = '';
    let whiteCount = 0;
    for (let m = LOW; m <= HIGH; m++) if (!BLACK.has(m % 12)) whiteCount++;
    const W = 100 / whiteCount;

    let wi = 0;
    for (let m = LOW; m <= HIGH; m++) {
      const black = BLACK.has(m % 12);
      const el = document.createElement('button');
      el.className = 'key ' + (black ? 'black' : 'white');
      el.dataset.midi = m;
      if (black) {
        el.style.left = `${wi * W - W * 0.3}%`;
        el.style.width = `${W * 0.6}%`;
      } else {
        el.style.left = `${wi * W}%`;
        el.style.width = `${W}%`;
        wi++;
      }
      el.innerHTML = '<span class="marker"></span><span class="label"></span>';
      el.addEventListener('pointerdown', e => {
        e.preventDefault();
        onKey(m);
      });
      // Keyboard (Tab + Enter/Space) access: click with detail 0 means not a pointer.
      el.addEventListener('click', e => {
        if (e.detail === 0) onKey(m);
      });
      kb.appendChild(el);
      keyEls[m] = el;
    }
    updateLabels();
  }

  function updateLabels() {
    const mode = $('#opt-labels').value;
    for (let m = LOW; m <= HIGH; m++) {
      const label = keyEls[m].querySelector('.label');
      const name = noteName(m);
      if (mode === 'all') label.textContent = name;
      else if (mode === 'c' && m % 12 === 0) label.textContent = `C${octaveOf(m)}`;
      else label.textContent = '';
      keyEls[m].setAttribute('aria-label', `${name}${octaveOf(m)}`);
    }
  }

  function clearMarkers() {
    Object.values(keyEls).forEach(el => el.classList.remove('root', 'answer', 'hint'));
  }

  function flash(m, cls) {
    const el = keyEls[m];
    el.classList.remove('flash-good', 'flash-bad');
    void el.offsetWidth; // restart animation
    el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), 450);
  }

  // ---------- Settings UI ----------
  function buildIntervalList() {
    const list = $('#interval-list');
    INTERVALS.forEach(iv => {
      const label = document.createElement('label');
      label.innerHTML =
        `<input type="checkbox" class="iv-check" value="${iv.semi}"${iv.semi === 7 ? ' checked' : ''}>` +
        `<span class="abbr">${iv.abbr}</span><span>${iv.name}</span>` +
        `<span class="semis">${iv.semi} st</span>`;
      list.appendChild(label);
    });

    document.querySelectorAll('[data-preset]').forEach(btn => {
      btn.addEventListener('click', () => {
        const set = new Set(PRESETS[btn.dataset.preset]);
        document.querySelectorAll('.iv-check').forEach(c => { c.checked = set.has(+c.value); });
      });
    });

    const rootSel = $('#opt-root');
    for (let pc = 0; pc < 12; pc++) {
      const o = document.createElement('option');
      o.value = pc;
      o.textContent = SHARP[pc] === FLAT[pc] ? SHARP[pc] : `${SHARP[pc]} / ${FLAT[pc]}`;
      rootSel.appendChild(o);
    }
  }

  const selectedIntervals = () =>
    [...document.querySelectorAll('.iv-check:checked')].map(c => +c.value);

  // ---------- Game state ----------
  const state = {
    running: false,
    root: null,
    rootUses: 0,
    q: null,
    prevSemi: null,
    wrong: 0,
    hinted: false,
    locked: false,
    asked: 0,
    first: 0,
    streak: 0,
    best: 0,
    times: [],
    stats: {},
    advanceTimer: null,
  };

  function resetScore() {
    Object.assign(state, {
      root: null, rootUses: 0, q: null, prevSemi: null,
      asked: 0, first: 0, streak: 0, best: 0, times: [], stats: {},
    });
    renderScore();
  }

  function directionsFor(root, semi, dir) {
    const out = [];
    if (dir !== 'down' && root + semi <= HIGH) out.push('up');
    if (dir !== 'up' && root - semi >= LOW) out.push('down');
    return out;
  }

  const rootFits = (root, sel, dir) => sel.every(s => directionsFor(root, s, dir).length > 0);

  function pickRoot(sel, dir) {
    const fixed = $('#opt-root').value;
    let cands = [];
    for (let m = LOW; m <= HIGH; m++) {
      if (fixed !== 'random' && m % 12 !== +fixed) continue;
      if (rootFits(m, sel, dir)) cands.push(m);
    }
    if (fixed === 'random' && state.root != null) {
      const fresh = cands.filter(m => m % 12 !== state.root % 12);
      if (fresh.length) cands = fresh;
    }
    return cands.length ? rand(cands) : null;
  }

  function setFeedback(text, cls = 'info') {
    const fb = $('#feedback');
    fb.className = 'feedback ' + cls;
    fb.innerHTML = text || '&nbsp;';
  }

  function setPrompt(html) {
    $('#prompt').innerHTML = html;
  }

  function renderPrompt() {
    const q = state.q;
    const rootName = `<span class="root">${noteName(q.root)}</span>`;
    const arrow = q.dir === 'up' ? '↑' : '↓';
    const word = q.dir === 'up' ? 'above' : 'below';
    if ($('#opt-earmode').checked && !q.revealedName) {
      setPrompt(`Listen <span class="dir">${arrow}</span> — which note was played ${word} ${rootName}?`);
    } else {
      const iv = BY_SEMI[q.semi];
      setPrompt(`Find the <span class="iv">${iv.name} (${iv.abbr})</span> <span class="dir">${arrow}</span> ${word} ${rootName}`);
    }
  }

  function start() {
    const sel = selectedIntervals();
    if (!sel.length) {
      setFeedback('Tick at least one interval to start.', 'bad');
      return;
    }
    audio();
    closeSummary();
    resetScore();
    state.running = true;
    $('#btn-start').innerHTML = 'Stop <kbd>Esc</kbd>';
    $('#btn-start').classList.remove('primary');
    ['#btn-replay', '#btn-hint', '#btn-skip'].forEach(s => { $(s).disabled = false; });
    nextQuestion();
  }

  function stop(message) {
    state.running = false;
    clearTimeout(state.advanceTimer);
    state.q = null;
    clearMarkers();
    $('#btn-start').innerHTML = 'Start <kbd>Enter</kbd>';
    $('#btn-start').classList.add('primary');
    ['#btn-replay', '#btn-hint', '#btn-skip'].forEach(s => { $(s).disabled = true; });
    $('#btn-hint').classList.remove('pulse');
    setPrompt(message || 'Choose your intervals and press <strong>Start</strong>.');
    setFeedback('');
  }

  function nextQuestion() {
    if (!state.running) return;
    const limit = +$('#opt-length').value;
    if (limit && state.asked >= limit) {
      endSession();
      return;
    }

    const sel = selectedIntervals();
    if (!sel.length) {
      stop('No intervals selected — tick some and press <strong>Start</strong>.');
      return;
    }
    const dir = $('#opt-dir').value;
    const reps = Math.max(1, Math.floor(+$('#opt-reps').value) || 1);
    const fixed = $('#opt-root').value;

    const needNewRoot =
      state.root == null ||
      state.rootUses >= reps ||
      !rootFits(state.root, sel, dir) ||
      (fixed !== 'random' && state.root % 12 !== +fixed);

    if (needNewRoot) {
      const r = pickRoot(sel, dir);
      if (r == null) {
        stop('That root note can\'t fit those intervals on two octaves — try another root or direction.');
        return;
      }
      state.root = r;
      state.rootUses = 0;
    }

    let pool = sel;
    if (pool.length > 1 && state.prevSemi != null) pool = pool.filter(s => s !== state.prevSemi);
    const semi = rand(pool);
    const dirChoice = rand(directionsFor(state.root, semi, dir));
    const target = state.root + (dirChoice === 'up' ? semi : -semi);

    state.q = { root: state.root, semi, dir: dirChoice, target, revealedName: false };
    state.rootUses++;
    state.prevSemi = semi;
    state.wrong = 0;
    state.hinted = false;
    state.locked = false;
    state.qStart = performance.now();
    $('#btn-hint').classList.remove('pulse');

    clearMarkers();
    keyEls[state.root].classList.add('root');
    renderPrompt();

    const limitText = limit ? ` · Question ${state.asked + 1} of ${limit}` : '';
    setFeedback(`Root ${state.rootUses} of ${reps}${limitText}`, 'info');
    playQuestionAudio();
  }

  function playQuestionAudio() {
    const q = state.q;
    if (!q) return;
    playNote(q.root);
    if ($('#opt-earmode').checked) playNote(q.target, 0.7);
  }

  function recordResult(firstTry) {
    const s = (state.stats[state.q.semi] ||= { asked: 0, first: 0 });
    s.asked++;
    state.asked++;
    if (firstTry) {
      s.first++;
      state.first++;
      state.streak++;
      state.best = Math.max(state.best, state.streak);
    } else {
      state.streak = 0;
    }
    renderScore();
  }

  function onKey(m) {
    playNote(m, 0, 1.2);
    const q = state.q;
    if (!state.running || !q || state.locked) return;

    if (m === q.root) {
      setFeedback(`That's the root (${noteName(m)}). Find the interval from it.`, 'info');
      return;
    }

    const anyOct = $('#opt-anyoct').checked;
    const correct = anyOct ? m % 12 === q.target % 12 : m === q.target;

    if (correct) {
      state.locked = true;
      const firstTry = state.wrong === 0 && !state.hinted;
      state.times.push((performance.now() - state.qStart) / 1000);
      recordResult(firstTry);
      flash(m, 'flash-good');
      keyEls[m].classList.add('answer');
      q.revealedName = true;
      renderPrompt();

      const iv = BY_SEMI[q.semi];
      const tries = state.wrong === 0 ? (state.hinted ? ' (with a hint)' : ' — first try!') : ` after ${state.wrong} wrong ${state.wrong === 1 ? 'guess' : 'guesses'}`;
      setFeedback(`✓ ${noteName(m)} is a ${iv.name} ${q.dir === 'up' ? 'above' : 'below'} ${noteName(q.root)}${tries}`, 'good');

      let delay = 1100;
      if ($('#opt-playback').checked && $('#opt-sound').checked) {
        playNote(q.root, 0.45, 1.4);
        playNote(m, 0.9, 1.4);
        playNote(q.root, 1.5, 1.6);
        playNote(m, 1.5, 1.6);
        delay = 2600;
      }
      state.advanceTimer = setTimeout(nextQuestion, delay);
    } else {
      state.wrong++;
      flash(m, 'flash-bad');
      const diff = m - q.root;
      const where = diff > 0 ? 'above' : 'below';
      setFeedback(`✗ ${noteName(m)} is a ${intervalLabel(diff)} ${where} ${noteName(q.root)} — try again`, 'bad');
      if (state.wrong >= 3 && !state.hinted) $('#btn-hint').classList.add('pulse');
    }
  }

  function hint() {
    const q = state.q;
    if (!state.running || !q || state.locked) return;
    state.hinted = true;
    $('#btn-hint').classList.remove('pulse');
    if ($('#opt-earmode').checked && !q.revealedName) {
      // First hint in ear mode: reveal the interval name.
      q.revealedName = true;
      renderPrompt();
      setFeedback('Hint: interval name revealed. Press H again to show the key.', 'info');
      return;
    }
    keyEls[q.target].classList.add('hint');
    playNote(q.root);
    playNote(q.target, 0.6);
    setFeedback(`Hint: it's the key with the dashed gold circle (${noteName(q.target)}).`, 'info');
  }

  function skip() {
    const q = state.q;
    if (!state.running || !q || state.locked) return;
    state.locked = true;
    state.times.push((performance.now() - state.qStart) / 1000);
    recordResult(false);
    keyEls[q.target].classList.add('answer');
    q.revealedName = true;
    renderPrompt();
    const iv = BY_SEMI[q.semi];
    setFeedback(`The answer was ${noteName(q.target)} — a ${iv.name} ${q.dir === 'up' ? 'above' : 'below'} ${noteName(q.root)}.`, 'bad');
    playNote(q.root, 0);
    playNote(q.target, 0.5);
    state.advanceTimer = setTimeout(nextQuestion, 2200);
  }

  // ---------- Score rendering ----------
  function renderScore() {
    $('#s-correct').textContent = state.first;
    $('#s-asked').textContent = state.asked;
    $('#s-acc').textContent = state.asked ? `${Math.round((100 * state.first) / state.asked)}%` : '–';
    $('#s-streak').textContent = state.streak;
    $('#s-best').textContent = state.best;
    const avg = state.times.length ? state.times.reduce((a, b) => a + b, 0) / state.times.length : null;
    $('#s-time').textContent = avg == null ? '–' : `${avg.toFixed(1)}s`;
    renderBreakdown();
  }

  function renderBreakdown() {
    const tbody = $('#breakdown tbody');
    const rows = INTERVALS.filter(iv => state.stats[iv.semi]);
    if (!rows.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="muted">No questions yet.</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map(iv => {
      const s = state.stats[iv.semi];
      const pct = Math.round((100 * s.first) / s.asked);
      const colour = pct >= 80 ? 'var(--green)' : pct >= 50 ? 'var(--gold)' : 'var(--red)';
      return `<tr><td>${iv.abbr} · ${iv.name}</td><td>${s.asked}</td><td>${pct}%</td>` +
        `<td><div class="bar"><div style="width:${pct}%;background:${colour}"></div></div></td></tr>`;
    }).join('');
  }

  function endSession() {
    const acc = state.asked ? Math.round((100 * state.first) / state.asked) : 0;
    const avg = state.times.length ? state.times.reduce((a, b) => a + b, 0) / state.times.length : 0;
    let weakest = null;
    INTERVALS.forEach(iv => {
      const s = state.stats[iv.semi];
      if (!s) return;
      const r = s.first / s.asked;
      if (r < 1 && (!weakest || r < weakest.r)) weakest = { iv, r };
    });
    $('#summary-body').innerHTML =
      `<div class="big">${acc}%</div>` +
      `<p>${state.first} of ${state.asked} correct first time</p>` +
      `<p>Best streak: ${state.best} · Average time: ${avg.toFixed(1)}s</p>` +
      (weakest ? `<p class="muted">Most practice needed: ${weakest.iv.name} (${weakest.iv.abbr})</p>`
               : `<p class="muted">Perfect session!</p>`);
    stop('Session complete — press <strong>Start</strong> to go again.');
    $('#summary').classList.remove('hidden');
  }

  function closeSummary() {
    $('#summary').classList.add('hidden');
  }

  // ---------- Wiring ----------
  function init() {
    buildIntervalList();
    buildKeyboard();

    $('#btn-start').addEventListener('click', () => (state.running ? stop() : start()));
    $('#btn-replay').addEventListener('click', playQuestionAudio);
    $('#btn-hint').addEventListener('click', hint);
    $('#btn-skip').addEventListener('click', skip);
    $('#btn-again').addEventListener('click', start);
    $('#btn-close').addEventListener('click', closeSummary);

    $('#opt-labels').addEventListener('change', updateLabels);
    $('#opt-spelling').addEventListener('change', () => {
      updateLabels();
      if (state.q) renderPrompt();
    });
    $('#opt-earmode').addEventListener('change', () => { if (state.q) renderPrompt(); });

    document.addEventListener('keydown', e => {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (e.target.classList && e.target.classList.contains('key')) return; // let keys handle Enter/Space
      if (e.key === 'Enter') {
        e.preventDefault();
        if (!$('#summary').classList.contains('hidden')) start();
        else if (!state.running) start();
      } else if (e.key === 'Escape') {
        if (!$('#summary').classList.contains('hidden')) closeSummary();
        else if (state.running) stop();
      } else if (e.key === ' ') {
        e.preventDefault();
        if (state.running) playQuestionAudio();
      } else if (e.key === 'h' || e.key === 'H') {
        hint();
      } else if (e.key === 's' || e.key === 'S') {
        skip();
      }
    });
  }

  init();
})();
