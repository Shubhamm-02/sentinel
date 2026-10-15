(() => {
  'use strict';

  // ───────────────────────── Constants ─────────────────────────
  const SUSPICIOUS = /apts-billing|tax-help/i;
  const COACH_KEY = 'sentinel.walkthrough.seen.v1';
  const TERMS = {
    intent: 'ArmorIQ’s signed receipt for this exact plan, which every action must trace back to.',
    hash: 'A fingerprint of the planned tool list, so the plan can’t be quietly changed after signing.',
    policy: 'Rules your organization set on the ArmorIQ platform, which apply even to tools that are in the plan.',
    mcp: 'Model Context Protocol, the standard way the agent talks to tool servers like this sandbox inbox and bank.',
  };
  const RAIL_IDLE = {
    1: ['current', 'Type, speak or pick a scenario'],
    2: ['todo', 'ArmorIQ seals the plan'],
    3: ['todo', 'Each action gets a verdict'],
    4: ['todo', 'Spoken back to you'],
  };
  const COACH = [
    { target: '#request-zone', title: 'Ask', text: 'Type or speak a request, or click a scenario below. Scenario 1 is a safe place to start.' },
    { target: '#col-center', title: 'Watch the gate', text: 'Sentinel first declares a plan and ArmorIQ signs it. Every action the agent then tries is allowed or blocked here, live.' },
    { target: '.col-right', title: 'Check the result', text: 'This is the sandbox bank account and inbox. Blocked actions leave it untouched.' },
  ];
  const ICON = {
    check: '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    checkDraw: '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path class="draw" pathLength="1" d="M3.5 8.5l3 3 6-7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    block: '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.8"/><path d="M3.8 12.2l8.4-8.4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    hold: '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M6 4v8M10 4v8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    shield: '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 1.8l5 1.9v3.7c0 3.2-2.1 5.6-5 6.9-2.9-1.3-5-3.7-5-6.9V3.7z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M5.8 8l1.6 1.6 3-3.2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    warn: '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 2l6.5 11.5h-13z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M8 6.5v3.2M8 11.6v.1" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    undo: '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M6 4L3 7l3 3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M3.5 7H10a3 3 0 010 6H8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    out: '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M5 11l6-6M6 5h5v5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    pay: '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="2" y="4" width="12" height="8.5" rx="2" stroke="currentColor" stroke-width="1.4"/><path d="M2 7h12" stroke="currentColor" stroke-width="1.4"/></svg>',
    mail: '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="2" y="3.5" width="12" height="9" rx="2" stroke="currentColor" stroke-width="1.4"/><path d="M2.5 4.5L8 8.6l5.5-4.1" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/></svg>',
    clock: '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="6" stroke="currentColor" stroke-width="1.4"/><path d="M8 4.8V8l2.2 1.4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
    stop: '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="4.5" y="4.5" width="7" height="7" rx="1.5" fill="currentColor"/></svg>',
    retry: '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M13 8a5 5 0 11-1.5-3.6M13 2.5v3.2H9.8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  };

  // ───────────────────────── Utilities ─────────────────────────
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const RM = window.matchMedia('(prefers-reduced-motion: reduce)');
  const reduced = () => RM.matches;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
  const isMac = /Mac|iPhone|iPad/i.test((navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '');
  const short = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

  /** Builds DOM safely: strings always become text nodes, never HTML. */
  function h(tag, attrs, ...kids) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v == null || v === false) continue;
        if (k === 'class') node.className = v;
        else if (k === 'text') node.textContent = v;
        else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
        else node.setAttribute(k, v === true ? '' : String(v));
      }
    }
    for (const kid of kids.flat()) {
      if (kid == null || kid === false) continue;
      node.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    }
    return node;
  }
  /** Parses one of the constant icon strings above. Never called with server data. */
  function icon(markup) {
    const t = document.createElement('template');
    t.innerHTML = markup.trim();
    return t.content.firstElementChild;
  }
  function tpl(id) { return document.getElementById(id).content.firstElementChild.cloneNode(true); }

  // ───────────────────────── Motion ─────────────────────────
  const LINEAR_OK = (() => { try { return CSS.supports('transition-timing-function', 'linear(0, 0.5, 1)'); } catch { return false; } })();
  /** Simulates a damped spring and returns it as a CSS linear() easing plus its settle time. */
  function spring(stiffness, damping) {
    const dt = 1 / 120;
    let x = 0, v = 0, t = 0;
    const pts = [0];
    for (let i = 0; i < 240; i++) {
      const a = -stiffness * (x - 1) - damping * v;
      v += a * dt; x += v * dt; t += dt;
      pts.push(x);
      if (Math.abs(x - 1) < 0.002 && Math.abs(v) < 0.02) break;
    }
    const duration = Math.round(t * 1000);
    if (!LINEAR_OK) return { easing: 'cubic-bezier(.22, 1.2, .36, 1)', duration };
    const step = Math.max(1, Math.ceil(pts.length / 40));
    const sampled = pts.filter((_, i) => i % step === 0);
    sampled.push(1);
    return { easing: `linear(${sampled.map((p) => +p.toFixed(4)).join(', ')})`, duration };
  }
  const SPRING = spring(380, 30);        // interface
  const SPRING_SOFT = spring(240, 27);   // large surfaces, odometer
  const SPRING_STAMP = spring(560, 25);  // seal and stamp impact
  document.documentElement.style.setProperty('--spring', SPRING.easing);
  const EASE_OUT = 'cubic-bezier(.2, .7, .2, 1)';

  let backlog = 0; // queued server events; animations speed up when events pile up
  const pace = () => (backlog > 1 ? 0.55 : 1);

  /**
   * Plays a WAAPI animation and commits its end state. With reduced motion the
   * `calm` keyframes (opacity only) run instead; `calm: false` skips the motion entirely.
   */
  function animate(node, frames, opts = {}) {
    if (!node || typeof node.animate !== 'function') return Promise.resolve();
    let { duration = 300, easing = EASE_OUT, delay = 0, calm, calmDuration = 160 } = opts;
    let kf = frames;
    if (reduced()) {
      if (calm === false) return Promise.resolve();
      kf = calm || [{ opacity: 0 }, { opacity: 1 }];
      duration = calmDuration; delay = 0; easing = 'linear';
    } else {
      duration *= pace(); delay *= pace();
    }
    let a;
    try { a = node.animate(kf, { duration, delay, easing, fill: 'both' }); } catch { return Promise.resolve(); }
    return a.finished.then(() => { try { a.commitStyles(); } catch { /* not rendered */ } a.cancel(); }, () => {});
  }

  /** Reveals text character by character, like a cipher resolving. */
  function scramble(node, finalText, duration = 520, delay = 0) {
    if (reduced()) { node.textContent = finalText; return Promise.resolve(); }
    const glyphs = '0123456789abcdef';
    return new Promise((resolve) => {
      setTimeout(() => {
        const start = performance.now();
        const frame = (now) => {
          const p = Math.min(1, (now - start) / (duration * pace()));
          const shown = Math.floor(p * finalText.length);
          let out = finalText.slice(0, shown);
          for (let i = shown; i < finalText.length; i++) out += /[\s.…]/.test(finalText[i]) ? finalText[i] : glyphs[(Math.random() * 16) | 0];
          node.textContent = out;
          if (p < 1) requestAnimationFrame(frame); else { node.textContent = finalText; resolve(); }
        };
        requestAnimationFrame(frame);
      }, delay * pace());
    });
  }

  /** Types text out with a caret. */
  function typeOut(node, text, msPerChar = 16) {
    if (!node) return Promise.resolve();
    if (reduced() || !text) { node.textContent = text; return Promise.resolve(); }
    const total = Math.min(text.length * msPerChar, 650) * pace();
    node.textContent = '';
    node.classList.add('typing');
    return new Promise((resolve) => {
      const start = performance.now();
      const frame = (now) => {
        const p = Math.min(1, (now - start) / total);
        node.textContent = text.slice(0, Math.ceil(p * text.length));
        if (p < 1) requestAnimationFrame(frame);
        else { node.classList.remove('typing'); resolve(); }
      };
      requestAnimationFrame(frame);
    });
  }

  // ───────────────────────── State & elements ─────────────────────────
  const S = {
    running: false, resetting: false, terminal: false, errored: false,
    prompt: '', scenario: -1, started: 0, stoppedAt: 0, lastEvent: 0, timer: 0,
    counts: { allow: 0, block: 0, hold: 0 },
    ledger: null, expiryTimer: 0,
    voiceToken: 0, audio: null,
    listening: false, heard: false, rec: null,
    interacted: false,
  };
  const el = {
    composer: $('#composer'), composerBox: $('#composer-box'), run: $('#run'), runLabel: $('#run .btn-label'),
    mic: $('#mic'), micLabel: $('#mic-label'), busy: $('#busy-msg'), leftBody: $('#left-body'),
    cards: $$('.scenario'), answer: $('#answer-slot'), reset: $('#reset'), resetLabel: $('#reset .reset-label'),
    chips: $('#chips'), help: $('#help'), center: $('#col-center'),
    timeline: $('#timeline'), stage: $('#stage'), rows: $('#rows'), rowsInner: $('#rows-inner'), rowsList: $('#rows-list'),
    edge: $('#edge-pulse'), statusText: $('#status-text'), elapsed: $('#elapsed'), slow: $('#slow-note'),
    ledgerError: $('#ledger-error'), ledgerContent: $('#ledger-content'),
    balanceCard: $('#balance-card'), balance: $('#balance'), balanceSr: $('#balance-sr'), balanceMeta: $('#balance-meta'),
    txList: $('#tx-list'), txCount: $('#tx-count'), outList: $('#out-list'), outCount: $('#out-count'), outWrap: $('#out-wrap'),
    inList: $('#in-list'), inCount: $('#in-count'),
    toast: $('#toast'), tooltip: $('#tooltip'), announcer: $('#announcer'), tipDefs: $('#tip-defs'),
    coach: $('#coach'), coachSpot: $('#coach-spot'), coachCard: $('#coach-card'),
  };
  let ghost = null;

  // ───────────────────────── Tooltips & terms ─────────────────────────
  const tipIds = new Map();
  /** Mirrors a tooltip into an off-screen description so screen readers get it too. */
  function describe(node) {
    const text = node.getAttribute('data-tip');
    if (!text) return node;
    let id = tipIds.get(text);
    if (!id) {
      id = `tipdef-${tipIds.size + 1}`;
      tipIds.set(text, id);
      el.tipDefs.append(h('span', { id, text }));
    }
    node.setAttribute('aria-describedby', id);
    return node;
  }
  function term(label, key) {
    return describe(h('span', { class: 'term', tabindex: '0', 'data-tip': TERMS[key] }, label));
  }
  let tipFor = null;
  function showTip(target) {
    const text = target.getAttribute('data-tip');
    if (!text) return;
    tipFor = target;
    const t = el.tooltip;
    t.textContent = text;
    t.style.left = '0px'; t.style.top = '0px';
    const r = target.getBoundingClientRect();
    const tw = t.offsetWidth, th = t.offsetHeight;
    let top = r.bottom + 8;
    if (top + th > innerHeight - 8) top = r.top - th - 8;
    t.style.left = `${clamp(r.left + r.width / 2 - tw / 2, 8, innerWidth - tw - 8)}px`;
    t.style.top = `${Math.max(8, top)}px`;
    t.classList.add('is-on');
  }
  function hideTip() { tipFor = null; el.tooltip.classList.remove('is-on'); }
  function setupTooltips() {
    $$('[data-term]').forEach((n) => { n.setAttribute('data-tip', TERMS[n.dataset.term]); describe(n); });
    $$('[data-tip]').forEach(describe);
    document.addEventListener('pointerover', (e) => {
      const t = e.target.closest && e.target.closest('[data-tip]');
      if (t && t !== tipFor) showTip(t);
    });
    document.addEventListener('pointerout', (e) => {
      const t = e.target.closest && e.target.closest('[data-tip]');
      if (t && !(e.relatedTarget && t.contains(e.relatedTarget))) hideTip();
    });
    document.addEventListener('focusin', (e) => {
      const t = e.target.closest && e.target.closest('[data-tip]');
      if (t) showTip(t); else hideTip();
    });
    document.addEventListener('focusout', () => hideTip());
    window.addEventListener('scroll', hideTip, true);
    window.addEventListener('resize', hideTip);
  }

  // ───────────────────────── Small UI pieces ─────────────────────────
  function announce(text) {
    el.announcer.textContent = '';
    setTimeout(() => { el.announcer.textContent = text; }, 30);
  }
  let toastTimer = 0;
  function toast(text, kind = 'ok') {
    clearTimeout(toastTimer);
    el.toast.dataset.kind = kind;
    el.toast.replaceChildren(icon(kind === 'ok' ? ICON.shield : ICON.warn), h('span', { text }));
    el.toast.classList.add('is-on');
    toastTimer = setTimeout(() => el.toast.classList.remove('is-on'), 2400);
  }
  function setStatus(text, run) {
    if (run) el.center.dataset.run = run;
    const box = el.statusText;
    const cur = box.lastElementChild;
    if (cur && cur.textContent === text) return;
    const next = h('span', { text });
    box.append(next);
    animate(next, [{ opacity: 0, transform: 'translateY(9px)' }, { opacity: 1, transform: 'none' }], { duration: 280 });
    if (cur) {
      animate(cur, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-9px)' }], { duration: 200, calm: [{ opacity: 1 }, { opacity: 0 }] })
        .then(() => cur.remove());
    }
  }
  function renderRail(spec) {
    for (const [n, [state, sub]] of Object.entries(spec)) {
      $$(`[data-rail] .step[data-step="${n}"]`).forEach((step) => {
        step.dataset.state = state;
        if (state === 'current') step.setAttribute('aria-current', 'step'); else step.removeAttribute('aria-current');
        if (sub != null) $('.step-sub', step).textContent = sub;
      });
    }
  }
  function railCurrentTo(state, sub) {
    const cur = $('.col-center [data-rail] .step[data-state="current"]');
    if (cur) renderRail({ [cur.dataset.step]: [state, sub] });
  }
  function countsText() {
    const c = S.counts;
    return [`${c.allow} allowed`, `${c.block} blocked`, c.hold ? `${c.hold} held` : ''].filter(Boolean).join(' · ');
  }
  function fmtSecs(ms) { return `${(ms / 1000).toFixed(1)}s`; }
  function timeOf(iso) {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  function splitTool(name) {
    const s = String(name || '');
    const i = s.indexOf('__');
    return i === -1 ? ['tools', s] : [s.slice(0, i), s.slice(i + 2)];
  }

  // ───────────────────────── Plain-English translations ─────────────────────────
  function explainReason(reason) {
    const r = String(reason || '');
    if (/tool-not-in-plan/i.test(r)) return 'Not part of the plan you approved';
    if (/^tool_denied/i.test(r)) return 'Forbidden by policy';
    if (/no_matching_policy/i.test(r)) return 'No policy allows this action';
    if (/token-expired/i.test(r)) return 'The signed plan has expired';
    if (/token-signature-invalid/i.test(r)) return 'The plan’s signature didn’t verify';
    if (/fail-closed|enforce-unavailable/i.test(r)) return 'ArmorIQ couldn’t be reached, so it was blocked to be safe';
    return r || 'Blocked by ArmorIQ';
  }
  function explainError(msg) {
    const m = String(msg || '');
    if (/Missing required env vars/i.test(m)) return 'Sentinel isn’t configured yet. Add your keys to .env, then restart npm run dev.';
    if (/Cannot reach MCP server/i.test(m)) return 'Sentinel couldn’t reach its MCP servers. Is npm run dev running?';
    if (/LLM request failed \(429\)/i.test(m)) return 'The free AI model is rate-limiting requests. Wait a minute, then retry.';
    if (/LLM request failed/i.test(m)) return 'The AI model didn’t respond properly.';
    if (/rejected the plan/i.test(m)) return 'ArmorIQ refused to sign this plan.';
    if (/Planner produced no usable tools/i.test(m)) return 'Sentinel couldn’t turn that request into a plan. Try rephrasing it.';
    if (/intent token|Token issuance|ArmorIQ/i.test(m)) return 'ArmorIQ couldn’t issue an intent token for this plan.';
    if (/Can’t reach the Sentinel server|Failed to fetch|NetworkError|Load failed/i.test(m)) return 'Can’t reach the Sentinel server. Is npm run dev running?';
    if (/connection to the server/i.test(m)) return 'The connection to the server closed before the agent finished.';
    return 'The run stopped unexpectedly.';
  }

  // ───────────────────────── Header chips ─────────────────────────
  function chip(state, k, v, tip) {
    return describe(h('span', { class: 'chip', 'data-state': state, tabindex: '0', 'data-tip': tip },
      h('span', { class: 'led', 'aria-hidden': 'true' }), h('span', { class: 'chip-k', text: k }), h('span', { class: 'chip-v', text: v })));
  }
  function renderChips(info) {
    const mode = String(info.armoriqMode || 'sdk');
    const chips = [
      chip(info.armoriqConfigured ? 'ok' : 'bad', 'ArmorIQ', info.armoriqConfigured ? `${mode} mode` : 'not configured',
        info.armoriqConfigured ? `Enforcement is on. In “${mode}” mode ArmorIQ decides every tool call.` : 'Add ARMORIQ_API_KEY, USER_ID and AGENT_ID to .env, then restart.'),
      chip(info.llmConfigured ? 'ok' : 'bad', 'LLM', String(info.model || 'unknown'),
        info.llmConfigured ? 'The language model that plans and acts, on a free tier.' : 'Add LLM_API_KEY to .env, then restart.'),
      chip(info.elevenlabs ? 'ok' : 'neutral', 'Voice', info.elevenlabs ? 'ElevenLabs' : 'Browser',
        info.elevenlabs ? 'Answers are spoken with ElevenLabs.' : 'No ElevenLabs key, so answers use your browser’s built-in voice.'),
    ];
    el.chips.replaceChildren(...chips);
    chips.forEach((c, i) => animate(c, [{ opacity: 0, transform: 'translateY(-4px)' }, { opacity: 1, transform: 'none' }], { ...SPRING, delay: i * 70 }));
  }
  function loadError(onRetry) {
    return h('span', { class: 'load-error', role: 'alert' }, icon(ICON.warn),
      h('span', {}, 'Can’t reach the Sentinel server. Is ', h('code', { text: 'npm run dev' }), ' running?'),
      h('button', { class: 'btn-ghost', type: 'button', onclick: onRetry }, icon(ICON.retry), 'Retry'));
  }

  // ───────────────────────── Ledger ─────────────────────────
  const odo = { str: '', slots: [] };
  function buildOdometer(str) {
    odo.str = str; odo.slots = [];
    const parts = [...str].map((ch) => {
      if (/\d/.test(ch)) {
        const strip = h('span', { class: 'odo-strip', style: `transform: translateY(${-Number(ch) * 10}%)` },
          ...'0123456789'.split('').map((d) => h('span', { text: d })));
        const slot = h('span', { class: 'odo-d' }, strip);
        odo.slots.push({ strip });
        return slot;
      }
      odo.slots.push({ strip: null, node: null });
      const s = h('span', { class: 'odo-s', text: ch });
      odo.slots[odo.slots.length - 1].node = s;
      return s;
    });
    el.balance.replaceChildren(...parts);
  }
  function setBalance(value, animated) {
    const str = money.format(value);
    el.balanceSr.textContent = `Balance ${str}`;
    if (!animated || str.length !== odo.str.length || reduced()) {
      buildOdometer(str);
      if (animated) animate(el.balance, [{ opacity: 0.25 }, { opacity: 1 }], { duration: 320, calm: [{ opacity: 0.25 }, { opacity: 1 }], calmDuration: 320 });
      return;
    }
    let order = 0;
    for (let i = str.length - 1; i >= 0; i--) {
      const slot = odo.slots[i];
      if (slot.strip) {
        const delay = order++ * 55;
        slot.strip.style.transition = `transform ${SPRING_SOFT.duration + 140}ms ${SPRING_SOFT.easing} ${delay}ms`;
        slot.strip.style.transform = `translateY(${-Number(str[i]) * 10}%)`;
      } else if (slot.node && slot.node.textContent !== str[i]) {
        slot.node.textContent = str[i];
      }
    }
    odo.str = str;
  }
  function collapse(node, delay = 0) {
    const hgt = node.offsetHeight;
    return animate(node, [
      { height: `${hgt}px`, opacity: 1, paddingTop: getComputedStyle(node).paddingTop, paddingBottom: getComputedStyle(node).paddingBottom },
      { height: '0px', opacity: 0, paddingTop: '0px', paddingBottom: '0px' },
    ], { duration: 260, delay, easing: 'cubic-bezier(.4, 0, .2, 1)', calm: [{ opacity: 1 }, { opacity: 0 }] });
  }
  /** Keyed list sync: new rows slide in, removed rows collapse. Returns the number of new rows. */
  function syncList(list, items, keyOf, render, renderEmpty, anim) {
    const old = new Map($$(':scope > li[data-key]', list).map((li) => [li.dataset.key, li]));
    const nodes = [], added = [];
    for (const it of items) {
      const k = keyOf(it);
      let li = old.get(k);
      if (!li) { li = render(it); li.dataset.key = k; added.push(li); }
      old.delete(k);
      nodes.push(li);
    }
    const removed = [...old.values()];
    const commit = () => {
      list.replaceChildren(...(nodes.length ? nodes : [renderEmpty()]));
      if (anim) added.forEach((li, i) => animate(li, [{ opacity: 0, transform: 'translateY(-12px)' }, { opacity: 1, transform: 'none' }], { ...SPRING, delay: 80 + i * 60 }));
    };
    if (anim && removed.length) Promise.all(removed.reverse().map((li, i) => collapse(li, i * 45))).then(commit);
    else commit();
    return added.length;
  }
  function renderTx(t) {
    const ext = Boolean(t.external);
    return h('li', { class: ext ? 'is-external' : '' },
      h('span', { class: 'li-ico', 'aria-hidden': 'true' }, icon(ext ? ICON.warn : ICON.pay)),
      h('span', { class: 'li-main' },
        h('span', { class: 'li-title' }, h('span', { text: String(t.payee) }), ext ? h('span', { class: 'ext-tag', text: 'external account' }) : null),
        h('span', { class: 'li-sub', text: [t.memo, timeOf(t.at)].filter(Boolean).join(' · ') })),
      h('span', { class: 'amt', text: `−${money.format(Number(t.amount) || 0)}` }));
  }
  function renderOut(o) {
    return h('li', { class: 'is-out' },
      h('span', { class: 'li-ico', 'aria-hidden': 'true' }, icon(ICON.out)),
      h('span', { class: 'li-main' },
        h('span', { class: 'li-title' }, h('span', { text: `Email ${o.emailId} → ${o.to}` })),
        h('span', { class: 'li-sub', text: timeOf(o.at) })),
      h('span', { class: 'out-tag', text: 'left inbox' }));
  }
  function renderEmail(e) {
    const sus = SUSPICIOUS.test(String(e.from));
    return h('li', { class: sus ? 'is-sus' : '' },
      h('span', { class: 'li-ico', 'aria-hidden': 'true' }, icon(ICON.mail)),
      h('span', { class: 'li-main' },
        h('span', { class: 'li-title', title: String(e.subject) }, h('span', { text: String(e.subject) })),
        h('span', { class: 'li-sub', text: String(e.from) })),
      sus ? h('span', { class: 'sus-flag' }, icon(ICON.warn), 'Suspicious') : null);
  }
  const emptyLi = (text, ico) => () => h('li', { class: 'empty-li' }, ico ? icon(ico) : null, h('span', { text }));
  function renderLedger(st, { animate: anim = true } = {}) {
    const prev = S.ledger;
    S.ledger = st;
    el.ledgerError.hidden = true;
    el.ledgerContent.hidden = false;
    const balanceChanged = prev ? Math.abs(prev.balance - st.balance) > 0.001 : false;
    setBalance(Number(st.balance) || 0, anim && Boolean(prev) && balanceChanged);
    if (prev && balanceChanged) {
      const d = st.balance - prev.balance;
      el.balanceMeta.textContent = `${d < 0 ? '−' : '+'}${money.format(Math.abs(d))} just now`;
    } else if (!prev) {
      el.balanceMeta.textContent = '';
    }
    const live = anim && Boolean(prev);
    const txs = [...(st.transactions || [])].reverse();
    const outs = [...(st.outbox || [])].reverse();
    const newTx = syncList(el.txList, txs, (t) => String(t.id), renderTx, emptyLi('No payments yet.'), live);
    const newOut = syncList(el.outList, outs, (o) => `${o.emailId}|${o.to}|${o.at}`, renderOut, emptyLi('Nothing has left your inbox.', ICON.shield), live);
    syncList(el.inList, st.emails || [], (e) => String(e.id), renderEmail, emptyLi('Inbox is empty.'), false);
    el.txCount.textContent = txs.length ? String(txs.length) : '';
    el.outCount.textContent = outs.length ? String(outs.length) : '';
    el.inCount.textContent = (st.emails || []).length ? String(st.emails.length) : '';
    return { balanceChanged, newTx, newOut };
  }
  async function getJSON(url) {
    const r = await fetch(url, { cache: 'no-store' });
    if (!r.ok) throw new Error(`${url} returned ${r.status}`);
    return r.json();
  }
  async function refreshState() {
    try { return renderLedger(await getJSON('/api/state'), { animate: true }); } catch { return null; }
  }
  /** A brief shield glint: proof the ledger did not change. */
  function glint(scope) {
    const g = $('.glint', scope), badge = $('.untouched', scope);
    animate(g, [{ transform: 'translateX(-110%)' }, { transform: 'translateX(110%)' }], { duration: 950, easing: 'cubic-bezier(.4, 0, .2, 1)', calm: false });
    animate(badge, [
      { opacity: 0, transform: 'translateY(4px)' },
      { opacity: 1, transform: 'none', offset: 0.14 },
      { opacity: 1, transform: 'none', offset: 0.86 },
      { opacity: 0, transform: 'none' },
    ], { duration: 2400, calm: [{ opacity: 0 }, { opacity: 1, offset: 0.1 }, { opacity: 1, offset: 0.9 }, { opacity: 0 }], calmDuration: 2400 });
  }

  // ───────────────────────── Initial load ─────────────────────────
  function showLoadingSkeletons() {
    el.chips.replaceChildren(...[0, 1, 2].map(() => h('span', { class: 'skel chip-skel' })));
    el.ledgerError.hidden = true;
    el.ledgerContent.hidden = false;
  }
  async function loadAll(openCoachIfNew) {
    const [info, state] = await Promise.allSettled([getJSON('/api/info'), getJSON('/api/state')]);
    const retry = () => { showLoadingSkeletons(); loadAll(false); };
    if (info.status === 'fulfilled') renderChips(info.value);
    else el.chips.replaceChildren(loadError(retry));
    if (state.status === 'fulfilled') renderLedger(state.value, { animate: false });
    else {
      el.ledgerContent.hidden = true;
      el.ledgerError.hidden = false;
      el.ledgerError.replaceChildren(loadError(retry));
    }
    if (openCoachIfNew && !coachSeen()) setTimeout(() => { if (!S.interacted) openCoach(0); }, 450);
  }

  // ───────────────────────── Timeline stage ─────────────────────────
  async function swapStage(node, { mode } = {}) {
    if (mode) el.timeline.dataset.mode = mode;
    const old = el.stage.firstElementChild;
    if (old && old !== node) {
      await animate(old, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-6px)' }], { duration: 150, calm: [{ opacity: 1 }, { opacity: 0 }] });
    }
    el.stage.replaceChildren(node);
    animate(node, [{ opacity: 0, transform: 'translateY(8px)' }, { opacity: 1, transform: 'none' }], { ...SPRING });
  }
  function explainerNode() {
    const node = tpl('tpl-explainer');
    const btn = $('[data-action="try1"]', node);
    btn.addEventListener('click', () => runScenario(0));
    magnetic(btn);
    return node;
  }
  function showExplainer(animated) {
    const node = explainerNode();
    if (animated) swapStage(node, { mode: 'idle' });
    else { el.timeline.dataset.mode = 'idle'; el.stage.replaceChildren(node); }
  }
  function phaseOf(text) {
    if (/regist/i.test(text)) return 'register';
    if (/connect/i.test(text)) return 'connect';
    if (/plan/i.test(text)) return 'plan';
    return null;
  }
  async function onStatus(text) {
    setStatus(text, 'running');
    const phase = phaseOf(text);
    if (phase === 'connect') {
      renderRail({ 2: ['current', 'Connecting to tools…'] });
      await swapStage(tpl('tpl-connect'), { mode: 'phase' });
    } else if (phase === 'plan') {
      renderRail({ 2: ['current', 'Drafting the plan…'] });
      // The server only moves on once both MCP servers answered, so they really are connected now.
      const loader = $('.loader-connect', el.stage);
      if (loader) { loader.classList.add('is-connected'); $('.phase-caption', loader).textContent = 'Connected to both MCP servers'; await sleep(260 * pace()); }
      await swapStage(tpl('tpl-skeleton'), { mode: 'phase' });
    } else if (phase === 'register') {
      renderRail({ 2: ['current', 'Sealing with ArmorIQ…'] });
      let sk = $('.contract-skel', el.stage);
      if (!sk) { sk = tpl('tpl-skeleton'); await swapStage(sk, { mode: 'phase' }); }
      sk.classList.add('is-sealing');
      $('.seal-caption', sk).textContent = 'Sealing';
    }
  }

  // ───────────────────────── The contract (plan event) ─────────────────────────
  function sealSvg() {
    return icon(`<svg class="seal" viewBox="0 0 132 132" aria-hidden="true">
      <defs><path id="seal-path" d="M66,66 m-50,0 a50,50 0 1,1 100,0 a50,50 0 1,1 -100,0"/></defs>
      <circle class="ring-outer" cx="66" cy="66" r="63"/>
      <circle class="ring-mid" cx="66" cy="66" r="59" stroke-dasharray="1.5 3"/>
      <g class="seal-spin"><text><textPath href="#seal-path" textLength="312" lengthAdjust="spacing">ARMORIQ • INTENT SIGNED • ARMORIQ • INTENT SIGNED •</textPath></text></g>
      <circle class="ring-inner" cx="66" cy="66" r="36"/>
      <path class="seal-glyph" d="M66 47l14 5.2v9.9c0 8.8-5.8 15.2-14 18.8-8.2-3.6-14-10-14-18.8v-9.9z"/>
      <path class="seal-glyph" d="M59.5 64.5l4.6 4.6 8.4-9.2"/>
    </svg>`);
  }
  function groupTools(tools) {
    const groups = new Map();
    for (const name of tools || []) {
      const [srv, act] = splitTool(name);
      if (!groups.has(srv)) groups.set(srv, []);
      groups.get(srv).push({ name: String(name), act });
    }
    return groups;
  }
  function buildContract(e) {
    const receipt = e.receipt || {};
    const tokenId = String(receipt.tokenId || '');
    const planHash = String(receipt.planHash || '');
    const groups = groupTools(e.tools);
    return h('article', { class: 'contract', 'aria-label': 'The signed plan' },
      h('div', { class: 'contract-head' },
        h('span', { class: 'eyebrow' }, 'The contract · signed by ArmorIQ'),
        h('span', { class: 'expiry', id: 'expiry' }, icon(ICON.clock), h('span', { class: 'expiry-v', text: '' }))),
      h('div', { class: 'contract-grid' },
        h('div', { class: 'contract-main' },
          h('h3', { class: 'goal', text: String(e.goal || 'Agent task') }),
          h('div', { class: 'manifest', 'aria-label': 'Tools the agent declared' },
            ...[...groups].map(([srv, tools]) => h('div', { class: 'mgroup' },
              h('span', { class: 'mserver' }, `${srv} `, term('MCP', 'mcp')),
              h('ul', { class: 'mtools' }, ...tools.map((t) => h('li', { class: 'mtool', 'data-tool': t.name },
                h('span', { text: t.act }), h('span', { class: 'use', 'aria-hidden': 'true' })))))))),
        h('div', { class: 'seal-wrap' }, sealSvg(), h('span', { class: 'shock', 'aria-hidden': 'true' }))),
      h('div', { class: 'contract-foot' },
        h('span', { class: 'kv' }, h('span', { class: 'k' }, term('intent token', 'intent')), h('span', { class: 'v', 'data-final': tokenId, title: tokenId, text: '' })),
        h('span', { class: 'kv' }, h('span', { class: 'k' }, term('plan hash', 'hash')), h('span', { class: 'v', 'data-final': short(planHash, 26), title: planHash, text: '' }))));
  }
  async function revealContract(card) {
    const old = el.stage.firstElementChild;
    if (old) await animate(old, [{ opacity: 1 }, { opacity: 0 }], { duration: 120, calm: [{ opacity: 1 }, { opacity: 0 }] });
    el.timeline.dataset.mode = 'contract';
    el.stage.replaceChildren(card);
    const goal = $('.goal', card), tools = $$('.mtool', card), seal = $('.seal', card), shock = $('.shock', card);
    seal.style.opacity = '0';
    const unfold = animate(card, [
      { opacity: 0, transform: 'translateY(10px)', clipPath: 'inset(0 0 100% 0 round 16px)' },
      { opacity: 1, transform: 'none', clipPath: 'inset(0 0 0% 0 round 16px)' },
    ], { ...SPRING_SOFT });
    animate(goal, [{ opacity: 0, transform: 'translateY(8px)', filter: 'blur(6px)' }, { opacity: 1, transform: 'none', filter: 'blur(0px)' }], { duration: 440, delay: 110 });
    tools.forEach((t, i) => animate(t, [{ opacity: 0, transform: 'translateY(6px) scale(0.96)' }, { opacity: 1, transform: 'none' }], { ...SPRING, delay: 200 + i * 60 }));
    await sleep(reduced() ? 0 : 230 * pace());
    await animate(seal, [{ opacity: 0, transform: 'scale(2.1) rotate(-38deg)' }, { opacity: 1, transform: 'scale(1) rotate(0deg)' }], { ...SPRING_STAMP });
    seal.style.opacity = '1';
    animate(shock, [{ opacity: 0.75, transform: 'scale(0.92)' }, { opacity: 0, transform: 'scale(1.75)' }], { duration: 540, calm: false });
    animate(card, [{ transform: 'translateY(0)' }, { transform: 'translateY(1.5px)' }, { transform: 'translateY(0)' }], { duration: 220, calm: false });
    $$('.v[data-final]', card).forEach((v, i) => scramble(v, v.getAttribute('data-final'), 520, i * 90));
    await unfold;
  }
  function startExpiry(expiresAt) {
    stopExpiry();
    const tick = () => {
      const box = document.getElementById('expiry');
      if (!box) return stopExpiry();
      const left = Math.round(Number(expiresAt) - Date.now() / 1000);
      const v = $('.expiry-v', box);
      if (!Number.isFinite(left)) { v.textContent = ''; return stopExpiry(); }
      if (left <= 0) { v.textContent = 'expired'; box.dataset.state = 'expired'; return stopExpiry(); }
      v.textContent = `expires in ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
      box.dataset.state = left < 60 ? 'soon' : 'ok';
    };
    tick();
    S.expiryTimer = setInterval(tick, 1000);
  }
  function stopExpiry() { clearInterval(S.expiryTimer); S.expiryTimer = 0; }
  async function onPlan(e) {
    await revealContract(buildContract(e));
    el.timeline.classList.add('has-contract');
    const n = (e.tools || []).length;
    renderRail({ 2: ['done', `${n} tool${n === 1 ? '' : 's'} · sealed`], 3: ['current', 'Waiting for the first action…'] });
    setStatus('Plan signed. Every action is now checked against it.');
    announce(`Plan signed by ArmorIQ with ${n} tools.`);
    startExpiry(e.receipt && e.receipt.expiresAt);
    if (backlog <= 1) showGhost();
  }

  // ───────────────────────── Tool rows ─────────────────────────
  function showGhost() {
    if (ghost && ghost.isConnected) return;
    ghost = h('li', { class: 'ghost', 'aria-hidden': 'true' },
      h('span', { class: 'node' }),
      h('div', { class: 'ghost-card' }, 'Agent is choosing its next action', h('span', { class: 'dots' }, h('i', { text: '.' }), h('i', { text: '.' }), h('i', { text: '.' }))));
    el.rowsList.append(ghost);
    animate(ghost, [{ opacity: 0 }, { opacity: 1 }], { duration: 240 });
    scrollToRow(ghost);
    setStatus('Waiting for the agent’s next action…');
  }
  function hideGhost() {
    const g = ghost;
    ghost = null;
    if (g && g.isConnected) g.remove();
  }
  function argsEl(args) {
    const entries = Object.entries(args && typeof args === 'object' ? args : {});
    if (!entries.length) return null;
    return h('div', { class: 'args' }, ...entries.map(([k, v]) => {
      const val = typeof v === 'string' ? v : JSON.stringify(v);
      return h('span', { class: 'pill', title: `${k}: ${val}` }, h('span', { class: 'pill-k', text: k }), h('span', { class: 'pill-v', text: short(String(val), 60) }));
    }));
  }
  function reasonEl(kind, v) {
    const raw = String(v.reason || '');
    const plain = kind === 'hold' ? 'Awaiting your approval' : explainReason(raw);
    let policyLine = null;
    if (v.matchedPolicy) {
      policyLine = h('span', { class: 'reason-policy' }, term('Policy', 'policy'), h('span', { class: 'typed', 'data-final': ` · ${v.matchedPolicy}` }));
    } else if (kind === 'hold') {
      policyLine = h('span', { class: 'reason-policy' }, h('span', { class: 'typed', 'data-final': 'A reviewer can approve it in the ArmorIQ dashboard' }));
    } else if (/tool-not-in-plan/i.test(raw)) {
      policyLine = h('span', { class: 'reason-policy' }, h('span', { class: 'typed', 'data-final': 'Checked against · the signed plan' }));
    }
    return h('div', { class: `reason reason-${kind}` },
      h('span', { class: 'reason-plain', 'data-final': plain }),
      policyLine,
      raw && raw !== plain ? h('code', { class: 'reason-raw', text: raw }) : null);
  }
  function srText(kind, srv, act, v, e) {
    const label = kind === 'allow' ? 'Allowed' : kind === 'hold' ? 'Held for approval' : 'Blocked';
    let s = `${label}: ${act} on the ${srv} server.`;
    if (kind === 'block') s += ` ${explainReason(v.reason)}.`;
    if (v.matchedPolicy && kind !== 'allow') s += ` Policy ${v.matchedPolicy}.`;
    if (kind === 'allow' && e.failed) s += ' The server refused it.';
    return s;
  }
  function buildRow(e, kind) {
    const [srv, act] = splitTool(e.name);
    const v = e.verdict || {};
    const nodeIcon = kind === 'allow' ? ICON.checkDraw : kind === 'hold' ? ICON.hold : ICON.block;
    return h('li', { class: 'row is-pending', 'data-kind': kind },
      h('span', { class: 'node', 'aria-hidden': 'true' }, h('span', { class: 'gate gate-l' }), h('span', { class: 'gate gate-r' }), icon(nodeIcon)),
      h('div', { class: 'card' },
        kind === 'block' ? h('span', { class: 'barrier', 'aria-hidden': 'true' }) : null,
        h('div', { class: 'row-top' },
          h('span', { class: 'srv', text: srv }),
          h('span', { class: 'act', text: act, title: String(e.name) }),
          kind === 'block' ? null : h('span', { class: `badge ${kind}`, 'aria-hidden': 'true' }, icon(kind === 'allow' ? ICON.check : ICON.hold), kind === 'allow' ? 'Allowed' : 'Held')),
        argsEl(e.args),
        kind === 'allow'
          ? (e.failed ? h('div', { class: 'note' }, icon(ICON.undo), h('span', {}, h('b', { text: 'Allowed by ArmorIQ, refused by the server. ' }), h('span', { text: short(String(e.result || ''), 180) }))) : null)
          : reasonEl(kind, v),
        kind === 'block' ? h('span', { class: 'stamp', 'aria-hidden': 'true' }, icon(ICON.block), 'Blocked') : null),
      h('span', { class: 'sr-only', text: srText(kind, srv, act, v, e) }));
  }
  function waitScrollEnd(target, max) {
    return new Promise((resolve) => {
      let done = false;
      const fin = () => { if (!done) { done = true; target.removeEventListener('scrollend', fin); resolve(); } };
      target.addEventListener('scrollend', fin, { once: true });
      setTimeout(fin, max * pace());
    });
  }
  function scrollToRow(row) {
    const sc = el.rows;
    const behavior = reduced() ? 'auto' : 'smooth';
    const inner = getComputedStyle(sc).overflowY !== 'visible' && sc.scrollHeight > sc.clientHeight + 1;
    if (inner) {
      const target = sc.scrollHeight - sc.clientHeight;
      if (Math.abs(sc.scrollTop - target) < 2) return Promise.resolve();
      sc.scrollTo({ top: target, behavior });
      return waitScrollEnd(sc, 420);
    }
    const r = row.getBoundingClientRect();
    if (r.bottom > innerHeight - 12 || r.top < 0) {
      row.scrollIntoView({ behavior, block: 'nearest' });
      return sleep(reduced() ? 0 : 320);
    }
    return Promise.resolve();
  }
  /** A thin line of light from the contract down to the new row: the call being traced to the signed intent. */
  async function beam(row) {
    if (reduced()) return;
    const node = $('.node', row);
    const startY = Math.max(0, el.rows.scrollTop - 6);
    const endY = row.offsetTop + node.offsetTop + node.offsetHeight / 2;
    if (endY - startY < 10) return;
    const b = h('span', { class: 'beam', 'aria-hidden': 'true', style: `top:${startY}px;height:${endY - startY}px` });
    el.rowsInner.append(b);
    await animate(b, [
      { transform: 'scaleY(0)', opacity: 1 },
      { transform: 'scaleY(1)', opacity: 1, offset: 0.78 },
      { transform: 'scaleY(1)', opacity: 0 },
    ], { duration: 360, easing: 'cubic-bezier(.45, 0, .2, 1)' });
    b.remove();
  }
  function edgePulse() {
    if (reduced()) {
      el.edge.classList.add('calm');
      animate(el.edge, [{ opacity: 0 }, { opacity: 0.9 }, { opacity: 0 }], { calm: [{ opacity: 0 }, { opacity: 0.9 }, { opacity: 0 }], calmDuration: 700 })
        .then(() => el.edge.classList.remove('calm'));
      return;
    }
    animate($('i', el.edge), [
      { transform: 'translateY(0)', opacity: 0 },
      { opacity: 1, offset: 0.2 },
      { opacity: 1, offset: 0.7 },
      { transform: 'translateY(330%)', opacity: 0 },
    ], { duration: 640, easing: 'cubic-bezier(.4, 0, .2, 1)' });
  }
  async function typeReason(row) {
    const plain = $('.reason-plain', row);
    await typeOut(plain, plain.getAttribute('data-final'));
    const typed = $('.reason-policy .typed', row);
    if (typed) await typeOut(typed, typed.getAttribute('data-final'), 14);
    const raw = $('.reason-raw', row);
    if (raw) animate(raw, [{ opacity: 0 }, { opacity: 1 }], { duration: 260 });
  }
  async function revealVerdict(row, kind) {
    row.classList.remove('is-pending');
    row.classList.add('is-revealed', `is-${kind}`);
    const [gl, gr] = $$('.gate', row);
    const node = $('.node', row), badge = $('.badge', row), pills = $$('.pill', row);
    if (kind === 'allow') {
      animate(gl, [{ transform: 'none', opacity: 1 }, { transform: 'translateX(-7px)', opacity: 0 }], { duration: 260, calm: [{ opacity: 1 }, { opacity: 0 }] });
      animate(gr, [{ transform: 'none', opacity: 1 }, { transform: 'translateX(7px)', opacity: 0 }], { duration: 260, calm: [{ opacity: 1 }, { opacity: 0 }] });
      animate(node, [{ transform: 'scale(0.82)' }, { transform: 'scale(1)' }], { ...SPRING_STAMP, calm: false });
      animate($('.draw', row), [{ strokeDashoffset: 1 }, { strokeDashoffset: 0 }], { duration: 320, delay: 90, easing: 'cubic-bezier(.65, 0, .35, 1)', calm: [{ strokeDashoffset: 0, opacity: 0 }, { strokeDashoffset: 0, opacity: 1 }] });
      animate(badge, [{ opacity: 0, transform: 'translateX(8px)' }, { opacity: 1, transform: 'none' }], { ...SPRING, delay: 120 });
      pills.forEach((p, i) => animate(p, [{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { duration: 260, delay: 170 + i * 45 }));
      const note = $('.note', row);
      if (note) { animate(note, [{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: 260 }); scrollToRow(row); }
      await sleep(reduced() ? 0 : 340 * pace());
      return;
    }
    if (kind === 'block') {
      pills.forEach((p) => { p.style.opacity = '1'; });
      edgePulse();
      await animate($('.barrier', row), [{ transform: 'scaleY(0)' }, { transform: 'scaleY(1.04)', offset: 0.78 }, { transform: 'scaleY(1)' }], { duration: 210, easing: 'cubic-bezier(.7, 0, .84, 0)' });
      animate(row, [
        { transform: 'translateX(0)' }, { transform: 'translateX(-9px)' }, { transform: 'translateX(7px)' },
        { transform: 'translateX(-4px)' }, { transform: 'translateX(2px)' }, { transform: 'translateX(0)' },
      ], { duration: 360, easing: 'cubic-bezier(.36, .07, .19, .97)', calm: false });
      animate(node, [{ transform: 'scale(1.18)' }, { transform: 'scale(1)' }], { ...SPRING_STAMP, calm: false });
      const stamped = animate($('.stamp', row), [{ opacity: 0, transform: 'rotate(-4deg) scale(1.7)' }, { opacity: 1, transform: 'rotate(-4deg) scale(1)' }], { ...SPRING_STAMP, delay: 90 });
      await scrollToRow(row);
      await stamped;
      await typeReason(row);
      return;
    }
    // hold
    pills.forEach((p) => { p.style.opacity = '1'; });
    animate(badge, [{ opacity: 0, transform: 'translateX(8px)' }, { opacity: 1, transform: 'none' }], { ...SPRING });
    await scrollToRow(row);
    await typeReason(row);
  }
  function markManifest(name, kind) {
    const chipEl = el.stage.querySelector(`.mtool[data-tool="${CSS.escape(String(name))}"]`);
    if (!chipEl) return;
    if (kind === 'allow') {
      const n = (Number(chipEl.dataset.uses) || 0) + 1;
      chipEl.dataset.uses = String(n);
      chipEl.classList.add('is-used');
      $('.use', chipEl).textContent = `×${n}`;
      animate(chipEl, [{ transform: 'scale(1)' }, { transform: 'scale(1.08)' }, { transform: 'scale(1)' }], { duration: 300, calm: false });
    } else if (kind === 'block' && !chipEl.classList.contains('is-denied')) {
      chipEl.classList.add('is-denied');
      chipEl.prepend(icon(ICON.block));
    }
  }
  async function onTool(e) {
    hideGhost();
    if (el.timeline.dataset.mode !== 'contract') el.timeline.dataset.mode = 'contract';
    const v = e.verdict || {};
    const kind = v.action === 'hold' ? 'hold' : v.allowed ? 'allow' : 'block';
    if (!el.timeline.classList.contains('has-rows')) {
      el.timeline.classList.add('has-rows');
      const c = $('.contract', el.stage);
      if (c) c.classList.add('is-compact');
    }
    const row = buildRow(e, kind);
    el.rowsList.append(row);
    setStatus(`Verdict received for ${splitTool(e.name)[1]}.`);
    const enter = animate(row, [{ opacity: 0, transform: 'translateX(-14px)' }, { opacity: 1, transform: 'none' }], { ...SPRING });
    await scrollToRow(row);
    await beam(row);
    await revealVerdict(row, kind);
    await enter;
    S.counts[kind] += 1;
    markManifest(e.name, kind);
    renderRail({ 3: ['current', countsText()] });
    const [srv, act] = splitTool(e.name);
    announce(srText(kind, srv, act, v, e));
    const diff = await refreshState();
    if (kind !== 'allow' && diff && !diff.balanceChanged && !diff.newTx && !diff.newOut) {
      glint(srv === 'inbox' ? el.outWrap : el.balanceCard);
    }
    if (S.running && !S.terminal && backlog <= 1) showGhost();
  }

  // ───────────────────────── Answer, voice, errors ─────────────────────────
  function voiceEl() {
    return h('div', { class: 'voice', id: 'voice', 'data-state': 'idle' },
      h('span', { class: 'vbars', 'aria-hidden': 'true' }, h('i'), h('i'), h('i'), h('i')),
      h('span', { class: 'voice-label', text: '' }),
      h('button', { class: 'btn-link voice-stop', type: 'button', hidden: true, onclick: stopVoice }, 'Stop voice'));
  }
  function setVoice(state) {
    const v = document.getElementById('voice');
    if (!v) return;
    v.dataset.state = state;
    $('.voice-label', v).textContent = state === 'loading' ? 'Preparing voice…' : state === 'speaking' ? 'Speaking' : '';
    $('.voice-stop', v).hidden = state === 'idle';
  }
  async function speak(text) {
    stopVoice();
    const token = ++S.voiceToken;
    setVoice('loading');
    try {
      const res = await fetch('/api/tts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
      if (token !== S.voiceToken) return;
      if (res.status === 200) {
        const url = URL.createObjectURL(await res.blob());
        if (token !== S.voiceToken) { URL.revokeObjectURL(url); return; }
        const audio = new Audio(url);
        S.audio = audio;
        const done = () => { URL.revokeObjectURL(url); if (S.audio === audio) { S.audio = null; if (token === S.voiceToken) setVoice('idle'); } };
        audio.addEventListener('ended', done);
        audio.addEventListener('error', done);
        await audio.play();
        setVoice('speaking');
        return;
      }
    } catch {
      if (token !== S.voiceToken) return;
      S.audio = null;
    }
    if ('speechSynthesis' in window && token === S.voiceToken) {
      const u = new SpeechSynthesisUtterance(text);
      u.onend = u.onerror = () => { if (token === S.voiceToken) setVoice('idle'); };
      speechSynthesis.cancel();
      speechSynthesis.speak(u);
      setVoice('speaking');
    } else {
      setVoice('idle');
    }
  }
  function stopVoice() {
    S.voiceToken += 1;
    if (S.audio) { S.audio.pause(); S.audio = null; }
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    setVoice('idle');
  }
  async function streamWords(p, text) {
    if (reduced()) { p.textContent = text; return; }
    const parts = text.split(/(\s+)/).filter(Boolean);
    p.replaceChildren(...parts.map((part) => (/^\s+$/.test(part) ? document.createTextNode(part) : h('span', { class: 'w', text: part }))));
    const words = $$('.w', p);
    const step = Math.min(36, 1300 / Math.max(words.length, 1));
    words.forEach((w, i) => animate(w, [{ opacity: 0, transform: 'translateY(6px)', filter: 'blur(4px)' }, { opacity: 1, transform: 'none', filter: 'blur(0px)' }], { duration: 380, delay: i * step }));
    await sleep(words.length * step + 200);
  }
  function revealSlot(card) {
    el.answer.replaceChildren(card);
    animate(card, [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { ...SPRING });
    setTimeout(() => card.scrollIntoView({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' }), 60);
  }
  async function onAnswer(text) {
    hideGhost();
    S.terminal = true;
    stopClock();
    renderRail({ 3: ['done', countsText()], 4: ['done', 'Answered'] });
    setStatus(`Finished in ${fmtSecs(S.stoppedAt - S.started)}.`, 'done');
    const p = h('p', { class: 'answer-text' });
    const card = h('div', { class: 'answer' }, h('div', { class: 'answer-head' }, h('span', { class: 'eyebrow', text: 'Sentinel says' }), voiceEl()), p);
    revealSlot(card);
    speak(text);
    announce(`Sentinel says: ${text}`);
    await streamWords(p, text);
  }
  function onError(message) {
    hideGhost();
    S.terminal = true;
    S.errored = true;
    stopClock();
    railCurrentTo('error', 'Stopped');
    setStatus('Stopped. See the message on the left.', 'error');
    if (el.timeline.dataset.mode === 'phase') showExplainer(true);
    const retry = h('button', { class: 'btn-secondary', type: 'button', onclick: () => run(S.prompt) }, icon(ICON.retry), 'Retry');
    const card = h('div', { class: 'answer is-error', role: 'alert' },
      h('div', { class: 'answer-head' }, h('span', { class: 'eyebrow err-eyebrow' }, icon(ICON.warn), 'Run stopped')),
      h('p', { class: 'err-text', text: explainError(message) }),
      h('code', { class: 'err-raw', text: String(message) }),
      retry);
    revealSlot(card);
  }

  // ───────────────────────── Running a request ─────────────────────────
  let chain = Promise.resolve();
  function enqueue(fn) {
    chain = chain.then(fn).catch((err) => console.error('[sentinel]', err));
    return chain;
  }
  function dispatch(ev) {
    S.lastEvent = performance.now();
    el.slow.classList.remove('is-on');
    backlog += 1;
    enqueue(async () => {
      try {
        switch (ev.type) {
          case 'status': await onStatus(String(ev.text || '')); break;
          case 'plan': await onPlan(ev); break;
          case 'tool': await onTool(ev); break;
          case 'answer': await onAnswer(String(ev.text || '')); break;
          case 'error': onError(String(ev.message || 'Unknown error')); break;
          default: break; // "done": the run is finished once the stream closes
        }
      } finally {
        backlog -= 1;
      }
    });
  }
  async function readStream(body) {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      let cut;
      while ((cut = buf.indexOf('\n\n')) !== -1) {
        const chunk = buf.slice(0, cut);
        buf = buf.slice(cut + 2);
        for (const line of chunk.split('\n')) {
          if (!line.startsWith('data: ')) continue;
          let ev;
          try { ev = JSON.parse(line.slice(6)); } catch { continue; }
          dispatch(ev);
        }
      }
    }
  }
  function tick() {
    const now = performance.now();
    el.elapsed.textContent = fmtSecs((S.stoppedAt || now) - S.started);
    if (S.running && !S.stoppedAt && now - S.lastEvent > 15000) el.slow.classList.add('is-on');
  }
  function stopClock() {
    if (!S.stoppedAt) S.stoppedAt = performance.now();
    clearInterval(S.timer);
    tick();
    el.slow.classList.remove('is-on');
  }
  function setPrimary(state) {
    el.run.dataset.state = state;
    el.run.disabled = state === 'running';
    el.runLabel.textContent = state === 'running' ? 'Running…' : state === 'after' ? 'Try another scenario' : 'Run';
  }
  function setLocked(locked) {
    el.cards.forEach((c) => { c.disabled = locked; });
    el.reset.disabled = locked;
  }
  function clearNext() { el.cards.forEach((c) => c.classList.remove('is-next')); }
  function scenarioIndexOf(prompt) { return el.cards.findIndex((c) => c.dataset.prompt === prompt); }
  function showBusy() {
    el.busy.textContent = 'The agent is already working on a request. Wait for it to finish.';
    animate(el.busy, [{ opacity: 0 }, { opacity: 1 }], { duration: 220 });
  }
  function nudgeComposer() {
    el.busy.textContent = 'Type a request first, or pick a scenario below.';
    el.composerBox.classList.remove('is-nudge');
    void el.composerBox.offsetWidth;
    if (!reduced()) el.composerBox.classList.add('is-nudge');
    el.composer.focus();
  }
  async function clearRunSurface() {
    hideGhost();
    stopExpiry();
    const rows = $$('.row', el.rowsList).reverse();
    await Promise.all(rows.map((r, i) => animate(r, [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-6px)' }], { duration: 150, delay: i * 22, calm: [{ opacity: 1 }, { opacity: 0 }] })));
    el.rowsList.replaceChildren();
    el.timeline.classList.remove('has-rows', 'has-contract');
    el.rows.scrollTop = 0;
    const answer = el.answer.firstElementChild;
    if (answer) {
      await animate(answer, [{ opacity: 1 }, { opacity: 0 }], { duration: 140, calm: [{ opacity: 1 }, { opacity: 0 }] });
      el.answer.replaceChildren();
    }
  }
  function finishRun() {
    if (!S.running) return;
    if (!S.terminal) onError('The connection to the server closed before the agent finished.');
    S.running = false;
    stopClock();
    hideGhost();
    el.center.dataset.run = S.errored ? 'error' : 'done';
    setLocked(false);
    setPrimary(S.errored ? 'idle' : 'after');
    if (document.activeElement === document.body) el.run.focus({ preventScroll: true });
    refreshState();
  }
  async function run(rawPrompt) {
    const prompt = String(rawPrompt == null ? '' : rawPrompt).trim();
    if (S.running) { showBusy(); return; }
    if (S.resetting) return;
    if (!prompt) { nudgeComposer(); return; }
    closeCoach();
    stopListening();
    stopVoice();
    hideTip();
    clearNext();
    el.busy.textContent = '';
    el.composer.value = prompt;
    S.prompt = prompt;
    S.scenario = scenarioIndexOf(prompt);
    S.running = true; S.terminal = false; S.errored = false;
    S.counts = { allow: 0, block: 0, hold: 0 };
    setPrimary('running');
    setLocked(true);
    S.started = performance.now();
    S.stoppedAt = 0;
    S.lastEvent = S.started;
    clearInterval(S.timer);
    S.timer = setInterval(tick, 100);
    setStatus('Sending your request…', 'running');
    renderRail({ 1: ['done', `“${short(prompt, 42)}”`], 2: ['current', 'Starting…'], 3: ['todo', 'Each action gets a verdict'], 4: ['todo', 'Spoken back to you'] });

    let res;
    try {
      res = await fetch('/api/run', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }) });
    } catch {
      await clearRunSurface();
      onError('Can’t reach the Sentinel server (Failed to fetch).');
      finishRun();
      return;
    }
    if (res.status === 409) {
      S.running = false;
      clearInterval(S.timer);
      setLocked(false);
      setPrimary('idle');
      renderRail(RAIL_IDLE);
      setStatus('Ready when you are.', 'idle');
      showBusy();
      return;
    }
    if (!res.ok || !res.body) {
      let msg = `Server error (${res.status})`;
      try { msg = (await res.json()).error || msg; } catch { /* not JSON */ }
      await clearRunSurface();
      onError(msg);
      finishRun();
      return;
    }
    await clearRunSurface();
    try {
      await readStream(res.body);
    } catch {
      enqueue(() => { if (!S.terminal) onError('The connection to the server was interrupted.'); });
    }
    enqueue(finishRun);
  }
  function runScenario(i) {
    const card = el.cards[i];
    if (!card || card.disabled) { if (S.running) showBusy(); return; }
    animate(card, [{ transform: 'scale(1)' }, { transform: 'scale(0.98)' }, { transform: 'scale(1)' }], { duration: 220, calm: false });
    run(card.dataset.prompt);
  }
  function highlightNext() {
    const next = S.scenario >= 0 ? (S.scenario + 1) % el.cards.length : 0;
    clearNext();
    const card = el.cards[next];
    card.classList.add('is-next');
    el.composer.value = card.dataset.prompt;
    setPrimary('idle');
    card.focus({ preventScroll: true });
    card.scrollIntoView({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' });
    animate(card, [{ transform: 'scale(1)' }, { transform: 'scale(1.025)' }, { transform: 'scale(1)' }], { duration: 440, easing: SPRING.easing, calm: [{ opacity: 0.6 }, { opacity: 1 }] });
  }

  // ───────────────────────── Reset ─────────────────────────
  async function doReset() {
    if (S.running || S.resetting) return;
    S.resetting = true;
    stopVoice();
    clearNext();
    el.reset.classList.add('is-busy');
    el.resetLabel.textContent = 'Resetting…';
    setLocked(true);
    el.run.disabled = true;
    const req = fetch('/api/reset', { method: 'POST' }).then((r) => { if (!r.ok) throw new Error(String(r.status)); });
    hideGhost();
    stopExpiry();
    const rows = $$('.row', el.rowsList).reverse();
    await Promise.all(rows.map((r, i) => collapse(r, i * 45)));
    el.rowsList.replaceChildren();
    el.timeline.classList.remove('has-rows', 'has-contract');
    const contract = $('.contract', el.stage);
    if (contract) {
      await animate(contract, [
        { opacity: 1, transform: 'none', clipPath: 'inset(0 0 0% 0 round 16px)' },
        { opacity: 0, transform: 'translateY(-6px)', clipPath: 'inset(0 0 100% 0 round 16px)' },
      ], { duration: 280, easing: 'cubic-bezier(.4, 0, .2, 1)', calm: [{ opacity: 1 }, { opacity: 0 }] });
    }
    const answer = el.answer.firstElementChild;
    if (answer) { await animate(answer, [{ opacity: 1 }, { opacity: 0 }], { duration: 160, calm: [{ opacity: 1 }, { opacity: 0 }] }); el.answer.replaceChildren(); }
    showExplainer(true);
    renderRail(RAIL_IDLE);
    setStatus('Ready when you are.', 'idle');
    el.elapsed.textContent = '0.0s';
    let ok = true;
    try { await req; } catch { ok = false; }
    if (ok) { if (!(await refreshState())) ok = false; }
    el.reset.classList.remove('is-busy');
    el.resetLabel.textContent = 'Reset sandbox';
    setLocked(false);
    setPrimary('idle');
    S.resetting = false;
    toast(ok ? 'Sandbox restored' : 'Couldn’t reset. Is npm run dev running?', ok ? 'ok' : 'bad');
  }

  // ───────────────────────── Voice input ─────────────────────────
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const meter = { ctx: null, stream: null, raf: 0 };
  async function startMeter() {
    if (reduced() || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!S.listening) { stream.getTracks().forEach((t) => t.stop()); return; }
      meter.stream = stream;
      meter.ctx = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = meter.ctx.createAnalyser();
      analyser.fftSize = 512;
      meter.ctx.createMediaStreamSource(stream).connect(analyser);
      const data = new Uint8Array(analyser.fftSize);
      const bars = $$('.bars i', el.mic);
      el.mic.classList.add('has-meter');
      const loop = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (const v of data) { const x = (v - 128) / 128; sum += x * x; }
        const level = Math.min(1, Math.sqrt(sum / data.length) * 5);
        el.mic.style.setProperty('--level', level.toFixed(3));
        const t = performance.now() / 140;
        bars.forEach((b, i) => b.style.setProperty('--b', Math.min(1, 0.12 + level * (0.5 + 0.5 * Math.abs(Math.sin(t + i * 1.3)))).toFixed(3)));
        meter.raf = requestAnimationFrame(loop);
      };
      loop();
    } catch { /* the CSS listening animation stays on */ }
  }
  function stopMeter() {
    cancelAnimationFrame(meter.raf);
    if (meter.stream) meter.stream.getTracks().forEach((t) => t.stop());
    if (meter.ctx) meter.ctx.close().catch(() => {});
    meter.stream = null; meter.ctx = null;
    el.mic.classList.remove('has-meter');
    el.mic.style.setProperty('--level', '0');
  }
  function startListening() {
    if (S.running || S.resetting) { showBusy(); return; }
    stopVoice();
    let rec;
    try { rec = new Recognition(); } catch { return; }
    S.rec = rec;
    S.heard = false;
    rec.lang = 'en-US';
    rec.interimResults = true;
    rec.continuous = false;
    rec.onstart = () => {
      S.listening = true;
      el.mic.setAttribute('aria-pressed', 'true');
      el.micLabel.textContent = 'Listening… tap to stop';
      startMeter();
    };
    rec.onresult = (ev) => {
      let text = '';
      for (const r of ev.results) text += r[0].transcript;
      S.heard = text.trim().length > 0;
      el.composer.value = text;
      if (el.run.dataset.state === 'after') setPrimary('idle');
    };
    rec.onerror = (ev) => {
      el.micLabel.textContent = ev.error === 'not-allowed' || ev.error === 'service-not-allowed' ? 'Microphone blocked'
        : ev.error === 'no-speech' ? 'Didn’t catch that' : 'Voice error';
    };
    rec.onend = () => {
      const heard = S.heard;
      S.listening = false;
      S.rec = null;
      el.mic.setAttribute('aria-pressed', 'false');
      stopMeter();
      setTimeout(() => { if (!S.listening && el.mic.getAttribute('aria-disabled') !== 'true') el.micLabel.textContent = 'Tap to speak'; }, 1800);
      if (heard && el.composer.value.trim()) run(el.composer.value);
    };
    try { rec.start(); } catch { S.rec = null; }
  }
  function stopListening() {
    if (S.rec) { try { S.rec.stop(); } catch { /* already stopped */ } }
  }
  function setupMic() {
    if (!Recognition) {
      el.mic.setAttribute('aria-disabled', 'true');
      el.mic.setAttribute('data-tip', 'Voice input needs the Web Speech API, which Chrome and Edge provide. You can still type.');
      describe(el.mic);
      el.micLabel.textContent = 'Voice unavailable';
    }
    el.mic.addEventListener('click', () => {
      if (el.mic.getAttribute('aria-disabled') === 'true') { showTip(el.mic); return; }
      if (S.listening) stopListening(); else startListening();
    });
  }

  // ───────────────────────── Walkthrough ─────────────────────────
  let coachIdx = 0;
  let coachReturn = null;
  function coachSeen() { try { return localStorage.getItem(COACH_KEY) === '1'; } catch { return false; } }
  function markCoachSeen() { try { localStorage.setItem(COACH_KEY, '1'); } catch { /* storage unavailable */ } }
  function placeCoach() {
    const target = $(COACH[coachIdx].target);
    if (!target) return;
    const r = target.getBoundingClientRect();
    const pad = 8;
    const top = Math.max(8, r.top - pad), left = Math.max(8, r.left - pad);
    const bottom = Math.min(innerHeight - 8, r.bottom + pad), right = Math.min(innerWidth - 8, r.right + pad);
    Object.assign(el.coachSpot.style, { top: `${top}px`, left: `${left}px`, width: `${right - left}px`, height: `${bottom - top}px` });
    const cw = el.coachCard.offsetWidth, ch = el.coachCard.offsetHeight, gap = 18;
    let x, y;
    if (right + gap + cw <= innerWidth - 12) { x = right + gap; y = top + 24; }
    else if (left - gap - cw >= 12) { x = left - gap - cw; y = top + 24; }
    else { x = (left + right) / 2 - cw / 2; y = bottom + gap; if (y + ch > innerHeight - 12) y = top - gap - ch; }
    el.coachCard.style.left = `${clamp(x, 12, innerWidth - cw - 12)}px`;
    el.coachCard.style.top = `${clamp(y, 12, innerHeight - ch - 12)}px`;
  }
  function showCoachStep(i) {
    coachIdx = i;
    const step = COACH[i];
    $('#coach-count').textContent = `Step ${i + 1} of ${COACH.length}`;
    $('#coach-title').textContent = step.title;
    $('#coach-text').textContent = step.text;
    $$('.coach-dots i').forEach((d, j) => d.classList.toggle('on', j === i));
    $('#coach-back').disabled = i === 0;
    $('#coach-next').textContent = i === COACH.length - 1 ? 'Got it' : 'Next';
    const target = $(step.target);
    if (target && innerWidth < 1000) target.scrollIntoView({ block: 'center' });
    placeCoach();
  }
  function openCoach(i = 0) {
    if (S.running || S.resetting) return;
    coachReturn = document.activeElement;
    el.coach.hidden = false;
    showCoachStep(i);
    animate(el.coachCard, [{ opacity: 0, transform: 'translateY(8px) scale(0.98)' }, { opacity: 1, transform: 'none' }], { ...SPRING });
    animate(el.coachSpot, [{ opacity: 0 }, { opacity: 1 }], { duration: 260 });
    $('#coach-next').focus();
  }
  function closeCoach() {
    if (el.coach.hidden) return;
    el.coach.hidden = true;
    markCoachSeen();
    const back = coachReturn && coachReturn !== document.body && coachReturn.isConnected ? coachReturn : el.composer;
    back.focus({ preventScroll: true });
  }
  function setupCoach() {
    $('#coach-skip').addEventListener('click', closeCoach);
    $('#coach-back').addEventListener('click', () => { if (coachIdx > 0) showCoachStep(coachIdx - 1); });
    $('#coach-next').addEventListener('click', () => { if (coachIdx < COACH.length - 1) showCoachStep(coachIdx + 1); else closeCoach(); });
    el.coach.addEventListener('click', (e) => { if (!el.coachCard.contains(e.target)) closeCoach(); });
    el.help.addEventListener('click', () => openCoach(0));
    window.addEventListener('resize', () => { if (!el.coach.hidden) placeCoach(); });
  }
  function trapCoachFocus(e) {
    const f = $$('button:not([disabled])', el.coachCard);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    else if (!el.coachCard.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
  }

  // ───────────────────────── Micro-interactions ─────────────────────────
  function magnetic(btn) {
    btn.addEventListener('pointermove', (e) => {
      if (reduced() || btn.disabled) return;
      const r = btn.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
      btn.style.setProperty('--mx', `${clamp(dx * 0.12, -6, 6).toFixed(1)}px`);
      btn.style.setProperty('--my', `${clamp(dy * 0.22, -5, 5).toFixed(1)}px`);
    });
    btn.addEventListener('pointerleave', () => { btn.style.setProperty('--mx', '0px'); btn.style.setProperty('--my', '0px'); });
  }
  function lightFollow(card) {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--lx', `${e.clientX - r.left}px`);
      card.style.setProperty('--ly', `${e.clientY - r.top}px`);
    });
  }

  // ───────────────────────── Wiring ─────────────────────────
  function setupKeyboard() {
    document.addEventListener('keydown', (e) => {
      if (!el.coach.hidden) {
        if (e.key === 'Escape') { e.preventDefault(); closeCoach(); }
        else if (e.key === 'ArrowRight') $('#coach-next').click();
        else if (e.key === 'ArrowLeft' && coachIdx > 0) showCoachStep(coachIdx - 1);
        else if (e.key === 'Tab') trapCoachFocus(e);
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); run(el.composer.value); return; }
      if (e.key === 'Escape') {
        hideTip();
        if (S.listening) stopListening(); else stopVoice();
        return;
      }
      const t = e.target;
      const typing = t && (t.tagName === 'TEXTAREA' || t.tagName === 'INPUT' || t.isContentEditable);
      if (!typing && !e.metaKey && !e.ctrlKey && !e.altKey && /^[123]$/.test(e.key)) {
        e.preventDefault();
        runScenario(Number(e.key) - 1);
      }
    });
  }
  function init() {
    const noteInteraction = (e) => { if (!el.coach.contains(e.target)) S.interacted = true; };
    document.addEventListener('pointerdown', noteInteraction, true);
    document.addEventListener('keydown', noteInteraction, true);
    $$('[data-mod]').forEach((k) => { k.textContent = isMac ? '⌘' : 'Ctrl'; });
    $('#rail-mobile').append($('#rail').cloneNode(true));
    $('#rail-mobile .rail').removeAttribute('id');
    setupTooltips();
    setupMic();
    setupCoach();
    setupKeyboard();
    magnetic(el.run);
    el.cards.forEach((c) => { lightFollow(c); c.addEventListener('click', () => runScenario(Number(c.dataset.idx))); });
    el.run.addEventListener('click', () => { if (el.run.dataset.state === 'after') highlightNext(); else run(el.composer.value); });
    el.composer.addEventListener('input', () => {
      if (el.run.dataset.state === 'after') setPrimary('idle');
      clearNext();
      el.busy.textContent = '';
    });
    el.reset.addEventListener('click', doReset);
    RM.addEventListener && RM.addEventListener('change', () => document.documentElement.classList.toggle('rm', reduced()));
    showExplainer(false);
    renderRail(RAIL_IDLE);
    setStatus('Ready when you are.', 'idle');
    el.composer.focus({ preventScroll: true });
    loadAll(true);
  }
  init();
})();
