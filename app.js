/* Fontaine Control Center — vanilla JS, no framework, no build step.
 * Snappy by design: the last data is saved on the tablet and drawn instantly; Google is only
 * asked in the background, and every tap changes the screen first and saves afterwards. */
'use strict';
const VERSION = '0.1.2';

// ---------------------------------------------------------------- config & storage
const qs = new URLSearchParams(location.search);
const store = {
  get(k, d) { try { const v = localStorage.getItem('fcc-' + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem('fcc-' + k, JSON.stringify(v)); } catch { /* full or blocked */ } },
};
if (qs.get('k')) store.set('key', qs.get('k'));
if (qs.get('api')) store.set('api', qs.get('api'));
const KEY = store.get('key', '');
const API = store.get('api', '') || window.FCC_API || '';
const DEMO = qs.has('demo') || !API || !KEY;

// Names are not in this public code: they come from the private Google script (S.people).
const P = {
  M: { n: 'Enfant 1', c: '#FF9F5A', bg: '#3B2416', fg: '#FFB27A' },
  F: { n: 'Enfant 2', c: '#5AB8FF', bg: '#13283B', fg: '#9ED2FF' },
  Pa: { n: 'Papa', c: '#5FD3A6', bg: '#143027', fg: '#8EE6C3' },
  Ma: { n: 'Maman', c: '#C9A0FF', bg: '#2A2140', fg: '#DCC4FF' },
  Fam: { n: 'Famille', c: '#E8C15A', bg: '#2A2615', fg: '#E8C15A' },
};
let COOK = {}, NAME_RE = /^$/;
function setPeople() {
  if (S && S.people) Object.keys(S.people).forEach((k) => { if (P[k]) P[k].n = S.people[k]; });
  COOK = {}; ['M', 'F', 'Pa', 'Ma'].forEach((k) => { COOK[P[k].n] = k; });
  COOK.Papa = 'Pa'; COOK.Maman = 'Ma';
  NAME_RE = new RegExp('\\b(' + ['M', 'F', 'Pa', 'Ma'].map((k) => P[k].n.replace(/[.*+?^${}()|[\]\\]/g, '')).join('|') + ')\\b', 'gi');
}

let S = store.get('state', null);
if (DEMO) S = window.FCC_DEMO();
setPeople();

// ---------------------------------------------------------------- small helpers
const NB = ' ';
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const monday = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
const hm = (ms) => { const d = new Date(ms); return d.getMinutes() ? `${d.getHours()}${NB}h${NB}${pad(d.getMinutes())}` : `${d.getHours()}${NB}h`; };
const DOW = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];
const DOWL = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MON = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const MONL = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const mins = (d) => d.getHours() * 60 + d.getMinutes();

const I = {
  back: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  chev: '<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="#9AA7B4" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
  check: (c = '#0E1116', s = 16) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`,
  mic: (c = '#14110A', s = 24) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>`,
  cal: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
  food: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3v18M5 3v5a2 2 0 0 0 4 0V3M17 21V3c-2 1-3 3.5-3 6.5 0 1.5 1 2.5 3 2.5"/></svg>',
  people: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.2"/><path d="M3 19c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5M16 4.8a3 3 0 0 1 0 6M18 13.8c1.8.6 3 2.4 3 4.7"/></svg>',
  home: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11l8-7 8 7v9H4z"/></svg>',
  clock: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9AA7B4" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  car: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFB27A" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 16V11l2-5h10l2 5v5M5 16h14M5 16v2M19 16v2"/></svg>',
  pin: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9AA7B4" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/></svg>',
  x: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
};
const av = (id, size) => `<span class="av" style="background:${P[id].c}${size ? `;width:${size}px;height:${size}px` : ''}">${id === 'Pa' || id === 'Ma' ? id : id}</span>`;

// ---------------------------------------------------------------- data from Google
let lastFetch = 0, fetching = false;
async function refresh(force) {
  if (DEMO || fetching) return;
  if (!force && Date.now() - lastFetch < 60000) return;
  fetching = true;
  try {
    await flush();
    const r = await fetch(`${API}?k=${encodeURIComponent(KEY)}&t=${Date.now()}`, { cache: 'no-store' });
    const s = await r.json();
    if (!s.error) {
      S = s; store.set('state', S); lastFetch = Date.now(); setPeople();
      reapplyOutbox();
      if (!busy()) render();
    }
  } catch { /* offline: keep the saved screen */ }
  fetching = false;
}

// Actions change the screen at once, then go to Google in the background (retried if offline).
let outbox = store.get('outbox', []);
function send(action) {
  outbox.push(action); store.set('outbox', outbox);
  flush();
}
let flushing = false;
async function flush() {
  if (DEMO || flushing) return;
  flushing = true;
  while (outbox.length) {
    try {
      const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ ...outbox[0], k: KEY }) });
      const j = await r.json();
      if (j.error && outbox[0].a === 'voice') { flushing = false; throw new Error(j.error); }
      outbox.shift(); store.set('outbox', outbox);
    } catch (e) { flushing = false; if (outbox[0] && outbox[0].a === 'voice') throw e; return; }
  }
  flushing = false;
}
// After a refresh, re-apply actions Google hasn't seen yet, so taps never "jump back".
function reapplyOutbox() { outbox.forEach((a) => APPLY[a.a] && APPLY[a.a](a)); }
const APPLY = {
  task(a) {
    const c = S.chores; const t = c.today;
    const i = c.done.findIndex((x) => x.d === t && x.who === a.who && x.task === a.task);
    if (a.done && i < 0) { c.done.push({ d: t, who: a.who, task: a.task }); c.points[a.who] += a.pts; c.week[a.who] += a.pts; }
    if (!a.done && i >= 0) { c.done.splice(i, 1); c.points[a.who] -= a.pts; c.week[a.who] -= a.pts; }
  },
  vote(a) {
    const v = S.vote.votes; const list = v[a.dish] || (v[a.dish] = []);
    const i = list.indexOf(a.who);
    if (a.on && i < 0) list.push(a.who);
    if (!a.on && i >= 0) list.splice(i, 1);
  },
  dish(a) { const m = S.menu.find((x) => x.date === a.date); if (m) { m.dish = a.dish; m.salade = false; } },
  seen(a) { S.messages = S.messages.filter((m) => m.id !== a.id); },
  message(a) { S.messages.push({ id: 'local' + Date.now(), at: Date.now(), from: a.from, to: a.to, text: a.text }); },
};
function act(a) { if (APPLY[a.a]) APPLY[a.a](a); if (!DEMO) store.set('state', S); send(a); render(); }

// ---------------------------------------------------------------- weather (Open-Meteo, free, no key)
let WX = store.get('wx', null);
async function weather() {
  if (!S || !S.weather) return;
  if (WX && Date.now() - WX.at < 3600000) return;
  try {
    const all = await Promise.all(S.weather.map(async (w) => {
      const u = `https://api.open-meteo.com/v1/forecast?latitude=${w.lat}&longitude=${w.lon}&hourly=temperature_2m,weather_code&timezone=America%2FLos_Angeles&forecast_days=2`;
      const j = await (await fetch(u)).json();
      return { who: w.who, label: w.label, h: j.hourly };
    }));
    WX = { at: Date.now(), list: all }; store.set('wx', WX);
    if (!busy()) render();
  } catch { /* keep last */ }
}
function wxFor(w, dayKey) {
  const at = (hh) => { const i = w.h.time.indexOf(`${dayKey}T${hh}:00`); return i < 0 ? null : { t: Math.round(w.h.temperature_2m[i]), c: w.h.weather_code[i] }; };
  return { a: at('08'), b: at('15') };
}
const COND = (c) => c == null ? ['', 'cloud'] : c === 0 ? ['Ensoleillé', 'sun'] : c <= 2 ? ['Quelques nuages', 'part'] : c === 3 ? ['Nuageux', 'cloud'] : c <= 48 ? ['Brouillard', 'cloud'] : c <= 67 || (c >= 80 && c <= 82) ? ['Pluie', 'rain'] : c <= 77 ? ['Neige', 'cloud'] : ['Orages', 'rain'];
const WXI = {
  sun: '<svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="#FFC857" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8"/></svg>',
  part: '<svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2.5V4M3 7.5h1.5M4.5 4l1 1M11.5 4l-1 1M5.4 10.6a3.5 3.5 0 1 1 6.2-3" stroke="#FFC857"/><path d="M8.5 20h9a3.5 3.5 0 0 0 .3-7 5 5 0 0 0-9.5 1.3A2.9 2.9 0 0 0 8.5 20z" stroke="#C9D3DD"/></svg>',
  cloud: '<svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="#C9D3DD" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 19h10a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.6 1.5A3.3 3.3 0 0 0 7 19z"/></svg>',
  rain: '<svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="#5AB8FF" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 15h10a4 4 0 0 0 .4-8 5.5 5.5 0 0 0-10.6 1.5A3.3 3.3 0 0 0 7 15z" stroke="#C9D3DD"/><path d="M9 18l-1 3M13 18l-1 3M17 18l-1 3"/></svg>',
};

// ---------------------------------------------------------------- calendar logic
const KEYWORDS_OFF = /school|école|ecole|instructional|holiday|congé|conge|vacances|break/i;
function itemsFor(key) {
  if (!S) return [];
  const evs = S.events.filter((e) => e.sd ? e.sd <= key && key < e.ed : ymd(new Date(e.s)) === key);
  const famOff = evs.some((e) => e.sd && !e.hol && KEYWORDS_OFF.test(e.t));
  const school = famOff ? [] : (S.school || []).filter((s) => s.sd <= key && key <= s.ed).map((s) => ({ id: 'sch' + s.sd, t: s.t, who: 'Fam', sd: s.sd, ed: ymd(addDays(parse(s.ed), 1)), school: true }));
  let list = school.length ? evs.filter((e) => !e.hol) : evs;
  list = school.concat(list);
  return list.sort((a, b) => (a.sd ? 0 : 1) - (b.sd ? 0 : 1) || (a.s || 0) - (b.s || 0));
}
function departure(e, now) {
  if (!e.s || e.s < now) return null;
  const dep = e.s - (e.travel || S.travelDefault || 25) * 60000;
  const left = Math.round((dep - now) / 60000);
  if (left > 60) return null;
  return left <= 0 ? { now: true, txt: 'Partez maintenant' } : { txt: `Départ : ${left}${NB}min` };
}
function evHtml(e, key, now) {
  const p = P[e.who] || P.Fam;
  const ini = e.who === 'Fam' ? '' : `${e.who} · `;
  const done = e.e && e.e < now;
  const multi = e.sd && parse(e.ed) - parse(e.sd) > 86400000;
  const until = multi ? ` <small>jusqu'au ${dayShort(addDays(parse(e.ed), -1))}</small>` : '';
  const dep = departure(e, now);
  const pill = dep ? `<span class="pill${dep.now ? ' now' : ''}">${dep.txt}</span>` : '';
  if (e.rec && e.s) {
    return `<button class="rec tap${done ? ' done' : ''}" data-ev="${esc(e.id)}"><span><span class="dot" style="background:${p.c}"></span>${ini}${esc(short(e.t))} ${hm(e.s)}</span>${pill}</button>`;
  }
  const sub = e.s ? `<small>${ini}${hm(e.s)}</small>` : !e.school && ini ? `<small>${P[e.who].n}</small>` : e.school ? '<small class="school">Calendrier SDUSD</small>' : '';
  return `<button class="chip tap${done ? ' done' : ''}" style="background:${p.bg};color:${p.fg}" data-ev="${esc(e.id)}">${esc(short(e.t))}${until}${sub}${pill}</button>`;
}
// Short names so a 125px day box stays readable (team-feed prefixes and people's names removed).
function short(t) {
  return String(t).replace(/^Fall\s+/i, '').replace(/Team\s*\d+\s*-\s*/i, '').replace(/\b(practice|entraînement|entrainement)\b/gi, 'Entr.')
    .replace(NAME_RE, '').replace(/\s+([—–-])\s*$/, '').replace(/\s+/g, ' ').trim().slice(0, 48);
}
const dayShort = (d) => `${d.getDate()} ${MON[d.getMonth()]}`;
function dayCell(d, now, opts) {
  const key = ymd(d), todayKey = ymd(new Date(now));
  const items = itemsFor(key);
  const cls = ['day'];
  if (key < todayKey) cls.push('past');
  else if (d.getDay() === 0 || d.getDay() === 6) cls.push('wknd');
  if (key === opts.focus) cls.push('focus');
  let label = `${DOW[d.getDay()]} ${d.getDate()}${d.getDate() === 1 ? ' ' + MON[d.getMonth()] : ''}`;
  if (key === todayKey) label += ' · auj.';
  else if (key === ymd(addDays(new Date(now), 1)) && opts.focus === key) label += ' · demain';
  const max = opts.max || 5;
  const shown = items.filter((e) => !(e.sd && e.sd < key && key !== opts.weekStart)); // multi-day: once per week
  const html = shown.slice(0, max).map((e) => evHtml(e, key, now)).join('');
  const more = shown.length > max ? `<span class="more">+${shown.length - max}</span>` : '';
  return `<div class="${cls.join(' ')}"><span class="dl">${label}</span>${html}${more}</div>`;
}
function weekRow(start, now, opts) {
  let h = '';
  for (let i = 0; i < 7; i++) h += dayCell(addDays(start, i), now, { ...opts, weekStart: ymd(start) });
  return `<div class="week">${h}</div>`;
}

// ---------------------------------------------------------------- screen schedule
// 7:00–20:30 normal (Fully Kiosk turns the screen off when idle and on when someone walks by),
// 20:30–22:00 and 5:45–7:00 black (a touch shows the night clock), 22:00–5:45 Fully sleeps.
function mode(d = new Date()) {
  const m = mins(d);
  if (m >= 420 && m < 1230) return 'day';
  if (m >= 1320 || m < 345) return 'sleep';
  return 'dim';
}
let peekUntil = 0, lastMode = null;
function applyMode() {
  const m = PHONE() ? 'day' : mode();
  if (m !== lastMode) {
    lastMode = m;
    try { if (window.fully) window.fully.setBooleanSetting('motionDetection', m === 'day'); } catch { /* not in Fully */ }
    if (m !== 'day') go('');
  }
  const n = $('#night');
  if (m === 'day') { n.hidden = true; return; }
  n.hidden = false;
  if (Date.now() < peekUntil) {
    const d = new Date();
    const tomorrow = ymd(addDays(d, mins(d) < 720 ? 0 : 1));
    const first = itemsFor(tomorrow).filter((e) => !e.rec).slice(0, 2).map((e) => esc(short(e.t)) + (e.s ? ' ' + hm(e.s) : '')).join(' · ');
    n.innerHTML = `<div class="nt num">${d.getHours()}${NB}h${NB}${pad(d.getMinutes())}</div><div class="nd">${DOWL[d.getDay()]} ${d.getDate()} ${MONL[d.getMonth()]}</div>${first ? `<div class="nn"><b>${mins(d) < 720 ? "Aujourd'hui" : 'Demain'}</b> · ${first}</div>` : ''}<div class="nf">S'éteint dans 15${NB}s</div>`;
  } else n.innerHTML = '';
}
$('#night').addEventListener('click', () => { peekUntil = Date.now() + 15000; applyMode(); setTimeout(applyMode, 15100); });

// ---------------------------------------------------------------- routing
const PHONE = () => innerWidth < 760;
let route = location.hash.slice(1);
let modal = null; // {kind, ...}
function go(r) { if (route === r) { render(); return; } location.hash = r; }
addEventListener('hashchange', () => { route = location.hash.slice(1); modal = null; voice.reset(); render(); });
const busy = () => !!modal || voice.state === 'rec' || (document.activeElement && document.activeElement.tagName === 'INPUT');

let idleTimer;
function touched() {
  clearTimeout(idleTimer);
  // Back to the home screen after 90 s without a touch.
  idleTimer = setTimeout(() => { if (!PHONE() && voice.state !== 'rec') { modal = null; go(''); } }, 90000);
}
addEventListener('pointerdown', touched, { passive: true });

// ---------------------------------------------------------------- render
function render() {
  if (!S) { $('#app').innerHTML = `<div class="boot">${DEMO ? 'Famille Fontaine' : 'Chargement…'}</div>`; return; }
  const r = route.split('/')[0];
  const view = { '': PHONE() ? phoneHome : home, cal: calPage, repas: repasPage, votes: votesPage, taches: tachesPage, regles: reglesPage, contacts: contactsPage, voix: voicePage }[r] || home;
  $('#app').innerHTML = view();
  $('#modal').innerHTML = modal ? MODALS[modal.kind]() : '';
  applyMode();
}

function home() {
  const now = Date.now(), d = new Date(now);
  const evening = mins(d) >= 990; // 16:30
  const focusDay = evening ? addDays(d, 1) : d;
  const wkStart = monday(d);
  const focus = ymd(focusDay);
  return `<div class="page home">
  <header class="head">
    <div class="clock"><div class="t num">${d.getHours()}${NB}h${NB}${pad(d.getMinutes())}</div>
      <div>${evening ? '<div class="tag">VUE DE DEMAIN</div>' : ''}<div class="d1">${DOWL[focusDay.getDay()]}</div><div class="d2">${focusDay.getDate()} ${MONL[focusDay.getMonth()]}</div></div></div>
    <div class="wx">${wxCards(focus, evening)}</div>
  </header>
  <section class="cal" aria-label="Calendrier, 2 semaines">
    ${weekRow(wkStart, now, { focus, max: 5 })}
    ${weekRow(addDays(wkStart, 7), now, { focus, max: 4 })}
  </section>
  <aside class="side">
    ${tasksTile()}
    ${messagesTile()}
  </aside>
  ${footer()}
</div>`;
}
function wxCards(key, tomorrow) {
  if (!WX) return '';
  return WX.list.map((w) => {
    const x = wxFor(w, key);
    if (!x.a || !x.b) return '';
    const [label, icon] = COND(Math.max(x.a.c, x.b.c));
    return `<div class="wxc panel">${WXI[icon]}<div><div class="who"><span class="dot" style="background:${P[w.who].c}"></span>${P[w.who].n} · ${tomorrow ? 'demain' : esc(w.label.replace(/ Elementary| Academy/, ''))}</div><div class="tt num">${x.a.t}° <span style="color:var(--muted);font-weight:400">→</span> ${x.b.t}°</div><div class="cond">${label} · 8${NB}h → 15${NB}h</div></div></div>`;
  }).join('');
}
function tasksTile() {
  const c = S.chores;
  const kid = (who) => {
    const list = c.tasks.filter((t) => t.who === who);
    if (!list.length) return '';
    return `<div class="kid"><div class="kh"><span class="kn">${av(who)}${P[who].n}</span><span class="kp num" style="color:${P[who].c}">${c.points[who] || 0} pts</span></div>
      ${list.map((t) => {
        const on = c.done.some((x) => x.d === c.today && x.who === who && x.task === t.task);
        return `<button class="task tap${on ? ' on' : ''}" data-task="${esc(who)}|${esc(t.task)}|${t.pts}|${on ? 0 : 1}"><span class="box" style="${on ? 'background:' + P[who].c : ''}">${on ? I.check() : ''}</span><span style="flex:1">${esc(t.task)}</span><span class="tp">+${t.pts}</span></button>`;
      }).join('')}</div>`;
  };
  return `<section class="tasks panel"><a class="hd label tap" href="#taches">Tâches · points ${I.chev}</a>${kid('M')}${kid('F')}</section>`;
}
function messagesTile() {
  const m = S.messages.slice().sort((a, b) => b.at - a.at)[0];
  const who = m && (COOK[m.from] || 'Pa');
  const body = m ? `<div class="msg"><div class="mt"><span class="mf"><span class="dot" style="background:${P[who].c}"></span>${esc(m.from)} · ${hm(m.at)}${m.to && m.to !== 'Tous' ? ' · pour ' + esc(m.to) : ''}</span><span class="tx">${esc(m.text)}</span></div><button class="seen tap" data-seen="${esc(m.id)}">Vu</button></div>` : '<div class="none">Aucun nouveau message</div>';
  return `<section class="msgs panel"><div class="label">Messages${S.messages.length > 1 ? ` · ${S.messages.length}` : ''}</div>${body}<a class="voice tap" href="#voix"><span class="mic">${I.mic()}</span>Message aux parents</a></section>`;
}
function footer() {
  const rules = S.rules && S.rules.length ? S.rules : [];
  const rule = rules.length ? rules[Math.floor(Date.now() / 600000) % rules.length] : null;
  return `<footer class="foot">
    <a class="rule tap" href="#regles"><span class="label">Règle</span>${rule ? `<span>${esc(rule.t)} — ${esc(rule.d)}</span>` : '<span>Règles de la maison</span>'}${I.chev}</a>
    <nav class="nav">
      <a class="btn tap" href="#cal">${I.cal}Calendrier</a>
      <a class="btn tap" href="#repas">${I.food}Repas</a>
      <a class="btn tap" href="#contacts">${I.people}Contacts</a>
      <button class="ver tap" data-update>v${VERSION}${DEMO ? ' · démo' : ''} ↻</button>
    </nav>
  </footer>`;
}
const topBar = (title, sub, right = '') => `<header class="top"><a class="btn back tap" href="#">${I.back}Accueil</a><div><h1>${title}</h1>${sub ? `<div class="sub">${sub}</div>` : ''}</div>${right}</header>`;

// ---------------------------------------------------------------- calendrier page
function calPage() {
  const now = Date.now(), d = new Date(now);
  const start = addDays(monday(d), PHONE() ? 0 : 14); // the home screen already shows the first two weeks
  const end = addDays(monday(d), 7 * 14);
  // Bientôt: the next big one-off things after the home screen's two weeks.
  const seen = new Set(), soon = [];
  for (let x = new Date(start); x < end && soon.length < 3; x = addDays(x, 1)) {
    for (const e of itemsFor(ymd(x))) {
      if (e.rec || seen.has(e.t) || (e.sd && e.sd !== ymd(x))) continue;
      seen.add(e.t); soon.push({ e, day: new Date(x) }); if (soon.length === 3) break;
    }
  }
  const countdown = (day) => { const n = Math.round((day - new Date(ymd(d) + 'T00:00')) / 86400000); return n < 14 ? `Dans ${n} jours` : `Dans ${Math.round(n / 7)} sem.`; };
  const soonHtml = soon.map((s) => `<span><span class="when">${countdown(s.day)}</span> ${esc(short(s.e.t))}</span>`).join('<span class="sep">·</span>');
  let weeks = '';
  for (let w = new Date(start); w < end; w = addDays(w, 7)) {
    weeks += `<div class="wk"><div class="wl">${dayShort(w)} – ${dayShort(addDays(w, 6))}</div>${weekRow(w, now, { focus: '', max: 4 })}</div>`;
  }
  return `<div class="page">${topBar('Calendrier', PHONE() ? '' : "Les semaines après celles de l'accueil")}
    ${soon.length ? `<div class="soon panel"><span class="label">Bientôt</span>${soonHtml}</div>` : ''}
    <div class="scroll">${weeks}</div></div>`;
}

// ---------------------------------------------------------------- repas
const tabs = (on) => `<nav class="tabs"><a class="tap${on === 1 ? ' on' : ''}" href="#repas">Cette semaine</a><a class="tap${on === 2 ? ' on' : ''}" href="#votes">Semaine prochaine · votes</a></nav>`;
function repasPage() {
  const todayKey = ymd(new Date());
  const rows = S.menu.map((m) => {
    const d = parse(m.date), id = COOK[m.cook] || 'Pa';
    const cls = m.date < todayKey ? ' past' : m.date === todayKey ? ' today' : '';
    return `<div class="mrow${cls}"><span class="md">${DOW[d.getDay()]} ${d.getDate()}</span><span class="mc">${av(id)}${esc(m.cook)}</span>
      <button class="dish tap" data-dish="${m.date}|${esc(m.cook)}"><span>${m.dish ? esc(m.dish) : '<span style="color:var(--dim)">À choisir</span>'}</span>${m.salade ? '<span class="tag">+ salade</span>' : ''}</button>
      <span class="hint">${m.date === todayKey ? 'Ce soir' : ''}</span></div>`;
  }).join('');
  return `<div class="page">${topBar('Repas', '', tabs(1))}<div class="scroll" style="gap:8px">${rows}<div class="hint">Le cuisinier touche son plat pour le changer.</div></div></div>`;
}
let voter = null, voterTimer, flash = '';
function votesPage() {
  const v = S.vote;
  const closes = new Date(v.closes);
  const mon = parse(v.week);
  const who = ['M', 'F', 'Pa', 'Ma'].map((id) => `<button class="who tap" data-voter="${id}" style="${voter === id ? `border-color:${P[id].c};background:var(--panel2)` : ''}">${av(id)}${P[id].n}</button>`).join('');
  const NIGHTS = { Papa: 'lun. · mer. · ven.', Maman: 'mar. · jeu. · dim.', Enfant: `sam. ${addDays(mon, 5).getDate()} ${MON[addDays(mon, 5).getMonth()]}` };
  const groups = v.groups.map((g) => {
    const mine = g.dishes.filter((x) => (v.votes[x.dish] || []).includes(voter)).length;
    const title = g.group === 'Enfant' ? v.kid : g.group;
    const gid = COOK[title] || 'Pa';
    const tiles = g.dishes.map((x) => {
      const vs = v.votes[x.dish] || [];
      const on = voter && vs.includes(voter);
      return `<button class="tile tap" data-vote="${esc(g.group)}|${esc(x.dish)}" style="${on ? `border-color:${P[voter].c};background:var(--panel2)` : ''}"><span class="tn">${esc(x.dish)}</span>${x.salade ? '<span class="tag" style="align-self:flex-start">+ salade</span>' : ''}<span class="tv">${vs.map((p) => av(p, 22)).join('')}</span></button>`;
    }).join('');
    return `<div class="grp"><div class="gh"><span class="dot" style="background:${P[gid].c};width:12px;height:12px"></span>${esc(title)}<span class="gs">${NIGHTS[g.group]} — ${g.max === 1 ? '1 vote' : '3 votes max'}</span><span class="gc">${voter ? `${P[voter].n} : ${mine}/${g.max}` : ''}</span></div><div class="tiles">${tiles}</div></div>`;
  }).join('');
  return `<div class="page">${topBar('Repas', '', tabs(2))}
    <div class="whos"><span class="hint" style="font-size:17px">Qui vote ?</span>${who}<span class="hint ${flash ? 'flash' : ''}" style="margin-left:auto">${flash || `Semaine du ${mon.getDate()} ${MON[mon.getMonth()]} · ferme ${DOW[closes.getDay()]} ${hm(closes.getTime())}`}</span></div>
    <div class="scroll">${groups}</div></div>`;
}

// ---------------------------------------------------------------- tâches
function tachesPage() {
  const c = S.chores, d = new Date(), mon = monday(d), todayKey = ymd(d);
  const kid = (who) => {
    const list = c.tasks.filter((t) => t.who === who);
    const head = '<span></span>' + [0, 1, 2, 3, 4, 5, 6].map((i) => { const x = addDays(mon, i); return `<span class="h${ymd(x) === todayKey ? ' t' : ''}">${DOW[x.getDay()]}</span>`; }).join('');
    const rows = list.map((t) => `<span style="font-size:17px">${esc(t.task)} <span style="color:var(--muted);font-size:14px">+${t.pts}</span></span>` + [0, 1, 2, 3, 4, 5, 6].map((i) => {
      const k = ymd(addDays(mon, i));
      const on = c.done.some((x) => x.d === k && x.who === who && x.task === t.task);
      return on ? `<span class="mk" style="background:${P[who].c}">${I.check('#0E1116', 17)}</span>` : k === todayKey ? '<span class="mk today"></span>' : k < todayKey ? '<span class="mk miss"></span>' : '<span class="mk fut"></span>';
    }).join('')).join('');
    return `<section class="kidp panel"><div style="display:flex;align-items:center;justify-content:space-between"><span class="kn" style="display:flex;align-items:center;gap:12px;font-size:26px;font-weight:700">${av(who, 42)}${P[who].n}</span><span style="text-align:right"><div class="big num" style="color:${P[who].c}">${c.points[who] || 0}</div><div class="hint">points · +${c.week[who] || 0} cette semaine</div></span></div><div class="label">Cette semaine</div><div class="grid7">${head}${rows}</div></section>`;
  };
  const rewards = (c.rewards || []).map((r) => {
    const st = (who) => (c.points[who] || 0) >= r.cost ? `<span style="color:${P[who].c}">${P[who].n} ✓</span>` : `<span>${P[who].n} : encore ${r.cost - (c.points[who] || 0)}</span>`;
    return `<div class="reward"><div class="rn"><span>${esc(r.name)}</span><span class="num" style="color:var(--gold)">${r.cost}${NB}pts</span></div><div class="rk">${st('M')}${st('F')}</div></div>`;
  }).join('');
  return `<div class="page">${topBar('Tâches', "Les points et la semaine de chacun · on coche sur l'accueil")}
    <div class="scroll"><div class="two">${kid('M')}${kid('F')}</div>
    ${rewards ? `<section class="panel" style="padding:18px 22px;display:flex;flex-direction:column;gap:12px"><div class="label">Ce que valent les points</div><div class="rewards">${rewards}</div></section>` : ''}</div></div>`;
}

// ---------------------------------------------------------------- règles & contacts
function reglesPage() {
  const list = (S.rules || []).map((r, i) => `<div class="rl panel"><span class="n">${i + 1}</span><span style="display:flex;flex-direction:column;gap:3px"><span class="rt">${esc(r.t)}</span><span class="rd">${esc(r.d)}</span></span></div>`).join('');
  return `<div class="page">${topBar('Règles de la maison', 'Pour une famille en harmonie')}<div class="rules">${list}</div></div>`;
}
function contactsPage() {
  const card = (c) => `<div class="contact panel ${c.kind === 'urgent' ? 'urgent' : ''}"><span style="display:flex;flex-direction:column;gap:3px"><span class="cn">${esc(c.name)}</span><span class="cr">${esc(c.role)}</span></span><span class="ph num">${esc(c.phone)}</span></div>`;
  const by = (k) => S.contacts.filter((c) => c.kind === k).map(card).join('');
  return `<div class="page" lang="en"><header class="top"><a class="btn back tap" href="#">${I.back}Home</a><div><h1>Contacts</h1><div class="sub">Numbers to read — calls can't be made from this screen</div></div></header>
    <div class="scroll"><div class="cgrid">${by('urgent')}</div><div class="label">Parents</div><div class="cgrid">${by('parent')}</div><div class="label">Nearby help</div><div class="cgrid">${by('help')}</div></div></div>`;
}

// ---------------------------------------------------------------- voice notes (hold to record, release to send)
const voice = {
  state: 'idle', rec: null, chunks: [], t0: 0, tick: null, err: '',
  reset() { if (this.rec && this.state === 'rec') { this.cancelled = true; try { this.rec.stop(); } catch { /* */ } } this.state = 'idle'; clearInterval(this.tick); },
  async start() {
    if (this.state === 'rec') return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const type = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find((t) => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || '';
      this.rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
      this.chunks = []; this.cancelled = false;
      this.rec.ondataavailable = (e) => e.data.size && this.chunks.push(e.data);
      this.rec.onstop = () => { stream.getTracks().forEach((t) => t.stop()); if (!this.cancelled) this.upload(); };
      this.rec.start();
      this.state = 'rec'; this.t0 = Date.now();
      this.tick = setInterval(() => { if (Date.now() - this.t0 > 60000) this.stop(); else render(); }, 500);
      render();
    } catch { this.state = 'fail'; this.err = 'Le micro n\'est pas autorisé sur la tablette.'; render(); }
  },
  stop() { if (this.state !== 'rec') return; clearInterval(this.tick); if (Date.now() - this.t0 < 800) { this.cancelled = true; this.state = 'idle'; } else this.state = 'sending'; try { this.rec.stop(); } catch { /* */ } render(); },
  cancel() { if (this.state !== 'rec') return; this.cancelled = true; clearInterval(this.tick); this.state = 'idle'; try { this.rec.stop(); } catch { /* */ } render(); },
  async upload() {
    const blob = new Blob(this.chunks, { type: this.rec.mimeType || 'audio/webm' });
    this.blob = blob;
    try {
      if (DEMO) { await new Promise((r) => setTimeout(r, 600)); }
      else {
        const b64 = await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1]); fr.readAsDataURL(blob); });
        const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ a: 'voice', k: KEY, audio: b64, mime: blob.type }) });
        const j = await r.json(); if (j.error) throw new Error(j.error);
      }
      this.state = 'sent'; render();
      setTimeout(() => { if (this.state === 'sent' && route === 'voix') go(''); }, 5000);
    } catch { this.state = 'fail'; this.err = 'Le Wi-Fi est coupé · le message est gardé'; render(); }
  },
};
function voicePage() {
  const v = voice;
  let body;
  if (v.state === 'rec') {
    const s = Math.floor((Date.now() - v.t0) / 1000);
    body = `<button class="vbtn rec" data-voice>${I.mic('#fff', 72)}</button><div class="vt num">0:${pad(s)}</div><div class="vh">Relâchez pour envoyer</div><div class="vs">Glissez le doigt hors du bouton pour annuler · 60${NB}s max</div>`;
  } else if (v.state === 'sending') {
    body = `<div class="vicon" style="background:#263040">${I.mic('#C9D3DD', 64)}</div><div class="vh">Envoi…</div>`;
  } else if (v.state === 'sent') {
    body = `<div class="vicon" style="background:#1E3A31">${I.check('#5FD3A6', 72)}</div><div class="vh">Envoyé à Papa et Maman</div><div class="vs">Ils le reçoivent par courriel</div>`;
  } else if (v.state === 'fail') {
    body = `<div class="vicon" style="background:#3B2E14"><svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="#F2C14E" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8v5M12 16.5v.01"/><path d="M10.3 3.9L2.6 17.2A2 2 0 0 0 4.3 20h15.4a2 2 0 0 0 1.7-2.8L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg></div><div class="vh">Pas encore envoyé</div><div class="vs">${esc(v.err)}</div>${v.blob ? '<button class="btn gold tap" data-retry>Réessayer</button>' : ''}`;
  } else {
    body = `<button class="vbtn" data-voice>${I.mic('#14110A', 80)}</button><div class="vh">Maintenez pour parler</div><div class="vs">Le message va à Papa et Maman</div>`;
  }
  return `<div class="page">${topBar('Message aux parents', '')}<div class="vwrap"><div class="vcard panel">${body}</div></div></div>`;
}

// ---------------------------------------------------------------- modals: event details, dish picker
let modalTimer;
const MODALS = {
  ev() {
    const e = modal.e, p = P[e.who] || P.Fam, now = Date.now();
    const when = e.s ? `${DOWL[new Date(e.s).getDay()]} ${new Date(e.s).getDate()} ${MONL[new Date(e.s).getMonth()]} · ${hm(e.s)} → ${hm(e.e)}` : `${DOWL[parse(e.sd).getDay()]} ${parse(e.sd).getDate()} ${MONL[parse(e.sd).getMonth()]}${parse(e.ed) - parse(e.sd) > 86400000 ? ` → ${dayShort(addDays(parse(e.ed), -1))}` : ''} · toute la journée`;
    const dep = e.s && e.s > now ? `<div class="r">${I.car}<span><b style="color:var(--amber)">Départ ${hm(e.s - (e.travel || S.travelDefault) * 60000)}</b> <span style="color:var(--muted)">· ${e.travel || S.travelDefault}${NB}min de route${e.travel ? ' (Google Maps)' : ''}</span></span></div>` : '';
    const [place, ...rest] = String(e.loc || '').split(',');
    const loc = e.loc ? `<div class="r">${I.pin}<span style="display:flex;flex-direction:column;gap:4px"><span>${esc(place)}</span>${rest.length ? `<span class="addr">${esc(rest.join(',').trim())}</span>` : ''}</span></div>` : '';
    const open = PHONE() && !e.school ? `<a class="btn gold" href="https://calendar.google.com/calendar/r/day/${(e.sd || ymd(new Date(e.s))).replace(/-/g, '/')}" target="_blank" rel="noopener">Ouvrir dans Google Agenda</a>` : '';
    return `<div class="modal" data-close><section class="det panel"><div class="dh"><span style="display:flex;align-items:center;gap:10px;font-size:18px;font-weight:700;color:${p.fg}">${e.who === 'Fam' ? '<span class="dot" style="background:var(--gold);width:14px;height:14px"></span>' : av(e.who, 32)}${p.n}</span><button class="btn tap" data-close>${I.x}Fermer</button></div>
      <div class="dt">${esc(e.t)}</div><div class="rows"><div class="r">${I.clock}<span>${when}</span></div>${dep}${loc}</div>
      ${e.notes ? `<div class="notes">${esc(e.notes)}</div>` : ''}${e.school ? '<div class="notes">Selon le calendrier SDUSD — pas encore dans l\'agenda familial.</div>' : ''}${open}
      ${PHONE() ? '' : '<div class="fine">Se ferme tout seul dans 20 s · touchez n\'importe où pour fermer</div>'}</section></div>`;
  },
  dish() {
    const list = (S.recipes || []).map((r) => `<button class="tap" data-pick="${esc(r)}">${esc(r)}</button>`).join('');
    const d = parse(modal.date);
    return `<div class="picker"><section class="box panel"><div style="display:flex;align-items:center;justify-content:space-between"><div><div style="font-size:24px;font-weight:700">${DOWL[d.getDay()]} ${d.getDate()} · ${esc(modal.cook)}</div><div class="hint">Choisissez le plat</div></div><button class="btn tap" data-close>${I.x}Fermer</button></div><div class="list">${list}</div></section></div>`;
  },
};
function openModal(m, ttl) { modal = m; clearTimeout(modalTimer); if (ttl) modalTimer = setTimeout(() => { modal = null; render(); }, ttl); render(); }

// ---------------------------------------------------------------- phone (parents)
let phoneFrom = store.get('from', 'Papa'), phoneTo = 'Tous';
function phoneHome() {
  const d = new Date(), todayKey = ymd(d);
  const m = S.menu.find((x) => x.date === todayKey);
  const voted = S.vote && Object.values(S.vote.votes).some((l) => l.includes(COOK[phoneFrom]));
  let days = '';
  for (let i = 0; i < 7; i++) {
    const x = addDays(d, i), items = itemsFor(ymd(x));
    if (!items.length) continue;
    days += `<div class="pday">${i === 0 ? "AUJOURD'HUI" : i === 1 ? 'DEMAIN' : (DOWL[x.getDay()] + ' ' + x.getDate()).toUpperCase()}</div>` + items.map((e) => `<button class="prow tap" data-ev="${esc(e.id)}"><span class="dot" style="background:${(P[e.who] || P.Fam).c}"></span><span class="pt num">${e.s ? hm(e.s) : 'Journée'}</span><span style="text-align:left">${esc(short(e.t))}</span></button>`).join('');
  }
  return `<div class="page phone">
    <header style="display:flex;justify-content:space-between;align-items:center;height:44px"><span style="font-size:22px;font-weight:700">Famille Fontaine</span><span class="hint">${DOW[d.getDay()]} ${d.getDate()} ${MON[d.getMonth()]}</span></header>
    <section class="card panel"><label class="label" for="msg">Message pour le mur</label>
      <div class="seg">${['Papa', 'Maman'].map((f) => `<button class="tap${phoneFrom === f ? ' on' : ''}" data-from="${f}">De ${f}</button>`).join('')}</div>
      <input id="msg" type="text" maxlength="200" placeholder="Ex. : Piano annulé ce soir" autocomplete="off">
      <div class="seg">${['Tous', P.M.n, P.F.n].map((t) => `<button class="tap${phoneTo === t ? ' on' : ''}" data-to="${t}">${t}</button>`).join('')}</div>
      <button class="btn gold tap" data-send style="justify-content:center">Envoyer au mur</button></section>
    <section class="card panel"><a href="#repas" style="display:flex;flex-direction:column;gap:4px"><span class="label">Ce soir${m ? ' · ' + esc(m.cook) : ''}</span><span style="font-size:17px;font-weight:700">${m && m.dish ? esc(m.dish) : 'À choisir'} ${m && m.salade ? '<span class="tag">+ salade</span>' : ''}</span></a>
      <a href="#votes" class="prow" style="justify-content:space-between;border-top:1px solid #263040;padding-top:8px"><span>Votes · ${voted ? 'vous avez voté' : '<span style="color:var(--gold)">pas encore voté</span>'}</span><span class="hint">${S.vote ? DOW[new Date(S.vote.closes).getDay()] + ' ' + hm(S.vote.closes) : ''} ›</span></a></section>
    <section class="card panel">${days || '<div class="none">Rien cette semaine</div>'}</section>
    <nav class="pnav"><a class="on" href="#">${I.home}Accueil</a><a href="#repas">${I.food}Repas</a><a href="#cal">${I.cal}Calendrier</a></nav>
  </div>`;
}

// ---------------------------------------------------------------- taps (one listener for everything)
document.addEventListener('click', (ev) => {
  const t = ev.target.closest('[data-task],[data-seen],[data-ev],[data-close],[data-dish],[data-pick],[data-voter],[data-vote],[data-update],[data-from],[data-to],[data-send],[data-retry]');
  if (!t) return;
  const ds = t.dataset;
  if (ds.task) { const [who, task, pts, done] = ds.task.split('|'); act({ a: 'task', who, task, pts: +pts, done: done === '1' }); }
  else if (ds.seen) act({ a: 'seen', id: ds.seen });
  else if (ds.ev) { const e = S.events.find((x) => x.id === ds.ev) || itemsFor(ds.ev.slice(3)).find((x) => x.id === ds.ev); if (e) openModal({ kind: 'ev', e }, PHONE() ? 0 : 20000); }
  else if ('close' in ds) { if (ev.target.closest('.det') && !t.matches('button')) return; modal = null; render(); }
  else if (ds.dish) { const [date, cook] = ds.dish.split('|'); openModal({ kind: 'dish', date, cook }); }
  else if (ds.pick) { act({ a: 'dish', date: modal.date, cook: modal.cook, dish: ds.pick }); modal = null; render(); }
  else if (ds.voter) { voter = ds.voter; flash = ''; clearTimeout(voterTimer); voterTimer = setTimeout(() => { voter = null; render(); }, 120000); render(); }
  else if (ds.vote) {
    if (!voter) { flash = "Touchez d'abord votre nom"; render(); return; }
    const [group, dish] = ds.vote.split('|');
    const g = S.vote.groups.find((x) => x.group === group);
    const on = !(S.vote.votes[dish] || []).includes(voter);
    if (on && g.max === 1) g.dishes.forEach((x) => { if ((S.vote.votes[x.dish] || []).includes(voter)) act({ a: 'vote', week: S.vote.week, dish: x.dish, who: voter, on: false }); });
    else if (on && g.dishes.filter((x) => (S.vote.votes[x.dish] || []).includes(voter)).length >= g.max) { flash = `Maximum ${g.max} plats — touchez un plat choisi pour le retirer`; render(); return; }
    flash = ''; act({ a: 'vote', week: S.vote.week, dish, who: voter, on });
  }
  else if ('update' in ds) checkUpdate(true);
  else if (ds.from) { phoneFrom = ds.from; store.set('from', phoneFrom); render(); }
  else if (ds.to) { phoneTo = ds.to; render(); }
  else if ('send' in ds) { const i = $('#msg'); const text = i && i.value.trim(); if (text) { act({ a: 'message', from: phoneFrom, to: phoneTo, text }); toast('Envoyé au mur'); } }
  else if ('retry' in ds) { voice.state = 'sending'; render(); voice.upload(); }
});
// Hold-to-record: press starts, release sends, sliding off cancels.
document.addEventListener('pointerdown', (e) => { if (e.target.closest('[data-voice]')) { e.preventDefault(); voice.start(); } });
document.addEventListener('pointerup', () => { if (voice.state === 'rec') voice.stop(); });
document.addEventListener('pointercancel', () => voice.cancel());
document.addEventListener('pointermove', (e) => { if (voice.state === 'rec' && !document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-voice]')) voice.cancel(); });

let toastTimer;
function toast(text, action) {
  const t = $('#toast');
  t.innerHTML = esc(text) + (action ? `<button>${esc(action.label)}</button>` : '');
  t.hidden = false;
  if (action) t.querySelector('button').onclick = action.run;
  clearTimeout(toastTimer);
  if (!action) toastTimer = setTimeout(() => { t.hidden = true; }, 2500);
}

// ---------------------------------------------------------------- updates (same idea as the wardrobe app)
// The tablet checks for a new version when someone walks up and every 30 min. A new version
// installs in the background and applies on the home screen; the ↻ button checks right away.
let updateReady = false;
async function checkUpdate(manual) {
  if (manual) toast('Recherche…');
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    await reg?.update();
    const found = !!(reg && (reg.installing || reg.waiting)) || updateReady;
    if (manual) toast(found ? 'Mise à jour…' : `À jour · v${VERSION}`);
    if (found && manual) setTimeout(() => location.reload(), 1200);
  } catch { if (manual) toast('Pas de connexion'); }
}
if ('serviceWorker' in navigator && !DEMO_LOCAL()) {
  const had = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js').catch(() => {});
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!had || updateReady) return;
    updateReady = true;
    if (route === '' && !busy()) location.reload();
    else toast('Nouvelle version', { label: 'Recharger', run: () => location.reload() });
  });
}
function DEMO_LOCAL() { return location.protocol === 'file:'; }

// ---------------------------------------------------------------- wake, clock, refresh
function wake() { touched(); refresh(); weather(); checkUpdate(false); applyMode(); }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') wake(); });
try { if (window.fully) { window.fully.bind('screenOn', 'window.__fccWake && window.__fccWake()'); window.fully.bind('onMotion', 'window.__fccWake && window.__fccWake()'); } } catch { /* */ }
window.__fccWake = wake;

// Clock and countdowns update every 30 s on the tablet itself (no network).
setInterval(() => { if (!busy() && document.visibilityState === 'visible') render(); else applyMode(); }, 30000);
// Data: every 15 min by day, every hour at night. Updates: every 30 min.
setInterval(() => { if (mode() === 'day' || PHONE()) refresh(true); }, 15 * 60000);
setInterval(() => { if (mode() !== 'day') refresh(true); }, 60 * 60000);
setInterval(() => checkUpdate(false), 30 * 60000);
addEventListener('online', () => flush().then(() => refresh(true)));

addEventListener('resize', () => render());
render();
weather();
refresh(true);
touched();
