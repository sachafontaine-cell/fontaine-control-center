/* Fontaine Control Center — vanilla JS, no framework, no build step.
 * Snappy by design: the last data is saved on the tablet and drawn instantly; Google is only
 * asked in the background, and every tap changes the screen first and saves afterwards. */
'use strict';
const VERSION = '0.3.6';

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
// The wall tablet (Fully Kiosk) is the only screen that goes dark at night and returns home by itself.
if (qs.has('wall')) store.set('wall', true);
const WALL = () => !!window.fully || store.get('wall', false);

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

// Fill in anything missing, so one broken part of the Google data never blanks the screen.
function normalize(s) {
  if (!s || typeof s !== 'object' || s.error) return null;
  ['events', 'school', 'messages', 'menu', 'recipes', 'rules', 'contacts', 'weather', 'sent'].forEach((k) => { if (!Array.isArray(s[k])) s[k] = []; });
  s.chores = Object.assign({ tasks: [], rewards: [], points: {}, week: {}, done: [] }, s.chores || {});
  if (!s.vote || !Array.isArray(s.vote.groups)) s.vote = null; else s.vote.votes = s.vote.votes || {};
  s.events = s.events.filter((e) => e && e.t && (e.s || e.sd));
  s.events.forEach((e) => { if (!P[e.who]) e.who = 'Fam'; if (!e.id) e.id = 'x' + Math.random().toString(36).slice(2); });
  return s;
}
let S = normalize(store.get('state', null)), badKey = false;
if (DEMO) S = window.FCC_DEMO();
let outbox = store.get('outbox', []);
setPeople();

// ---------------------------------------------------------------- small helpers
const NB = ' ';
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
// Weeks start on Sunday, as in the US.
const sunday = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - x.getDay()); return x; };
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
  cart: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 4h2.5l2.2 11h10.6l2-8H6.4"/><circle cx="9.5" cy="19" r="1.4"/><circle cx="17" cy="19" r="1.4"/></svg>',
  home: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 11l8-7 8 7v9H4z"/></svg>',
  clock: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9AA7B4" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  car: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#FFB27A" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 16V11l2-5h10l2 5v5M5 16h14M5 16v2M19 16v2"/></svg>',
  pin: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9AA7B4" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/></svg>',
  star: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/></svg>',
  search: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>',
  check2: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M8 12.5l3 3 5-6"/></svg>',
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
    const raw = await r.json();
    badKey = raw && raw.error ? (raw.error === 'key' ? 'Lien invalide — rouvrez le lien familial' : 'Google a renvoyé une erreur : ' + raw.error) : false;
    const s = normalize(raw);
    if (badKey && !S) render();
    if (s) {
      S = s; store.set('state', S); lastFetch = Date.now(); setPeople();
      reapplyOutbox();
      if (!busy()) render();
      if (!WX) weather();
    }
  } catch { /* offline: keep the saved screen */ }
  fetching = false;
}

// Actions change the screen at once, then go to Google in the background (retried if offline).
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
    const c = S.chores; const t = ymd(new Date());
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
  message(a) { const id = 'local' + a.at; if (!S.messages.some((m) => m.id === id)) S.messages.push({ id, at: a.at, from: a.from, to: a.to, text: a.text }); },
};
if (S && !DEMO) reapplyOutbox(); // taps not yet sent to Google are shown again at start
// Saving the whole screen takes a moment on a slow tablet, so it happens just after the tap is drawn.
let saveTimer;
const saveSoon = () => { clearTimeout(saveTimer); saveTimer = setTimeout(() => store.set('state', S), 1000); };
addEventListener('pagehide', () => { if (saveTimer && !DEMO) { clearTimeout(saveTimer); store.set('state', S); } });
function act(a) { if (APPLY[a.a]) APPLY[a.a](a); send(a); render(); if (!DEMO) saveSoon(); }

// ---------------------------------------------------------------- weather (Open-Meteo, free, no key)
let WX = store.get('wx2', null);
async function weather() {
  if (!S || !S.weather) return;
  if (WX && Date.now() - WX.at < 3600000) return;
  try {
    const all = await Promise.all(S.weather.map(async (w) => {
      const u = `https://api.open-meteo.com/v1/forecast?latitude=${w.lat}&longitude=${w.lon}&hourly=temperature_2m,apparent_temperature,precipitation_probability,weather_code,uv_index,wind_speed_10m&timezone=America%2FLos_Angeles&forecast_days=2`;
      const j = await (await fetch(u)).json();
      return { who: w.who, label: w.label, h: j.hourly };
    }));
    WX = { at: Date.now(), list: all }; store.set('wx2', WX);
    if (!busy()) render();
  } catch { /* keep last */ }
}
function wxFor(w, dayKey) {
  const at = (hh) => { const i = w.h.time.indexOf(`${dayKey}T${hh}:00`); return i < 0 ? null : { t: Math.round(w.h.temperature_2m[i]), c: w.h.weather_code[i] }; };
  return { a: at('08'), b: at('15') };
}
// What to bring: looks at school hours (school days) and the child's own events that day.
const RAINY = (c) => c != null && ((c >= 51 && c <= 67) || (c >= 80 && c <= 82) || c >= 95);
function advice(w, key) {
  const h = w.h, kid = w.who, d = parse(key), items = itemsFor(key);
  const off = items.some((e) => e.school || e.hol || (e.sd && KEYWORDS_OFF.test(e.t)));
  const wins = [];
  if (d.getDay() >= 1 && d.getDay() <= 5 && !off) wins.push({ a: 8, b: 15, school: true });
  items.filter((e) => e.s && e.e && e.who === kid).forEach((e) => {
    const a = new Date(e.s).getHours(), b = Math.max(a + 1, new Date(e.e).getHours() + (new Date(e.e).getMinutes() ? 1 : 0));
    if (a >= 6 && a <= 21) wins.push({ a, b, at: e.s });
  });
  if (!wins.length) wins.push({ a: 9, b: 18 });
  const hour = (hh) => { const i = h.time.indexOf(`${key}T${pad(hh)}:00`); return i < 0 ? null : { f: (h.apparent_temperature || h.temperature_2m)[i], p: (h.precipitation_probability || [])[i] || 0, c: h.weather_code[i], uv: (h.uv_index || [])[i] || 0, ws: (h.wind_speed_10m || [])[i] || 0 }; };
  const tips = {}; // tip -> windows that need it
  const add = (k, win, hh) => (tips[k] = tips[k] || []).push({ win, hh });
  wins.forEach((win) => {
    for (let hh = win.a; hh < win.b; hh++) {
      const x = hour(hh); if (!x) continue;
      if (x.p >= 40 || RAINY(x.c)) add('rain', win, hh);
      if (x.f <= 10) add('coat', win, hh); else if (x.f <= 16) add('pull', win, hh);
      if (x.uv >= 7) add('sun', win, hh);
      if (x.f >= 29) add('hot', win, hh);
      if (x.ws >= 35) add('wind', win, hh);
    }
  });
  if (tips.coat) delete tips.pull;
  const when = (list) => {
    if (list.every((t) => t.win.school && t.hh < 10)) return ' le matin';
    if (list.every((t) => !t.win.school && t.win.at)) return ` à ${hm(list[0].win.at)}`;
    return '';
  };
  const NAMES = { rain: '☂️ Parapluie', coat: '🧥 Manteau', pull: '🧶 Pull', sun: '🧴 Crème solaire', hot: '🧢 Casquette + gourde', wind: '🌬️ Coupe-vent' };
  return ['rain', 'coat', 'pull', 'sun', 'hot', 'wind'].filter((k) => tips[k]).slice(0, 2).map((k) => NAMES[k] + when(tips[k])).join(' · ');
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
// Events grouped by day once per data load (fast on a slow tablet).
let IDX = null, IDX_OF = null;
function dayIndex() {
  if (IDX_OF === S) return IDX;
  IDX = new Map(); IDX_OF = S;
  const put = (k, e) => { let l = IDX.get(k); if (!l) IDX.set(k, l = []); l.push(e); };
  for (const e of S.events) {
    if (!e.sd) { put(ymd(new Date(e.s)), e); continue; }
    for (let x = parse(e.sd), n = 0; ymd(x) < e.ed && n < 400; x = addDays(x, 1), n++) put(ymd(x), e);
  }
  return IDX;
}
function itemsFor(key) {
  if (!S) return [];
  const seen = new Set();
  const evs = (dayIndex().get(key) || [])
    .filter((e) => { const k = `${e.t.trim().toLowerCase()}|${e.sd || e.s}`; if (seen.has(k)) return false; seen.add(k); return true; }); // same event in two calendars
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
    return `<button class="rec tap${done ? ' done' : ''}" data-ev="${esc(e.id)}"><span><span class="dot" style="background:${p.c}"></span><span class="ct">${ini}${esc(short(e.t))} ${hm(e.s)}</span></span>${pill}</button>`;
  }
  const sub = e.s ? `<small>${ini}${hm(e.s)}</small>` : !e.school && ini ? `<small>${P[e.who].n}</small>` : e.school ? '<small class="school">Calendrier SDUSD</small>' : '';
  return `<button class="chip tap${done ? ' done' : ''}" style="background:${p.bg};color:${p.fg};--c:${p.c}" data-ev="${esc(e.id)}"><span class="ct">${esc(short(e.t))}</span>${until}${sub}${pill}</button>`;
}
// Short names so a 125px day box stays readable (team-feed prefixes and people's names removed).
function short(t) {
  return String(t).replace(/\s*\b\d{1,2}(:\d{2})?\s*(am|pm)\b/gi, '').replace(/^Fall\s+/i, '').replace(/Team\s*\d+\s*-\s*/i, '').replace(/\b(practice|entraînement|entrainement)\b/gi, 'Entr.')
    .replace(NAME_RE, '').replace(/\s+([—–-])\s*$/, '').replace(/\s+/g, ' ').trim().slice(0, 48);
}
const dayShort = (d) => `${d.getDate()} ${MON[d.getMonth()]}`;
function dayCell(d, now, opts) {
  const key = ymd(d), todayKey = ymd(new Date(now));
  const items = viewItems(key, opts);
  const cls = ['day'];
  if (key < todayKey) cls.push('past');
  else if (d.getDay() === 0 || d.getDay() === 6) cls.push('wknd');
  if (key === opts.focus) cls.push('focus');
  let label = `${DOW[d.getDay()]} ${d.getDate()}${d.getDate() === 1 ? ' ' + MON[d.getMonth()] : ''}`;
  if (key === todayKey) label += ' · auj.';
  else if (key === ymd(addDays(new Date(now), 1)) && opts.focus === key) label += ' · demain';
  const shown = items.filter((e) => !(e.sd && e.sd < key && key !== opts.weekStart && key !== todayKey)); // multi-day: once per week, and on today
  const html = shown.slice(0, PHONE() ? 99 : 7).map((e) => evHtml(e, key, now)).join(''); // a box never fits more than ~6
  return `<div class="${cls.join(' ')}" data-key="${key}" data-n="${shown.length}"><span class="dl">${label}</span>${html}</div>`;
}
// After drawing: a day with more than fits shows "+N", which opens the whole day.
function fitDays() {
  if (PHONE()) return;
  // Countdowns only use space the chores and messages don't need.
  // Chores come first: countdowns give up rows (down to one), then disappear, until every chore fits.
  const sp = $('.soonp'), tk = $('.tasks');
  if (sp) {
    const items = [...sp.querySelectorAll('.sn')], over = () => tk && tk.scrollHeight > tk.clientHeight + 1;
    while (items.length > 1 && (over() || sp.scrollHeight > sp.clientHeight + 1)) items.pop().remove();
    if (over()) sp.remove();
  }
  const cut = [];
  document.querySelectorAll('.dcont:not([data-fit])').forEach((d) => { // read pass (one layout)
    d.dataset.fit = 1;
    const items = [...d.querySelectorAll('.chip, .rec')], total = +d.dataset.n || items.length;
    if (d.scrollHeight <= d.clientHeight + 1 && total === items.length) return;
    const room = d.clientHeight - 8 - 40; // bottom padding + the "+N" line
    let keep = 0;
    while (keep < items.length && items[keep].offsetTop + items[keep].offsetHeight <= room) keep++;
    cut.push([d, items, keep, total]);
  });
  cut.forEach(([d, items, keep, total]) => { // write pass
    items.slice(keep).forEach((x) => x.remove());
    const more = document.createElement('button');
    more.className = 'more tap'; more.dataset.day = d.dataset.key; more.textContent = `+${total - keep} de plus`;
    d.appendChild(more);
  });
}
const MULTI = (e) => e.sd && Math.round((parse(e.ed) - parse(e.sd)) / 864e5) > 1;
function weekRow(start, now, opts) {
  if (PHONE()) {
    let h = '';
    for (let i = 0; i < 7; i++) h += dayCell(addDays(start, i), now, { ...opts, weekStart: ymd(start) });
    return `<div class="week">${h}</div>`;
  }
  const s0 = parse(ymd(start)), todayKey = ymd(new Date(now)), tomorrowKey = ymd(addDays(new Date(now), 1));
  const keys = [0, 1, 2, 3, 4, 5, 6].map((i) => ymd(addDays(s0, i)));
  const lists = keys.map((k) => viewItems(k, opts));
  const col = (k) => Math.round((parse(k) - s0) / 864e5);
  // Bars: one per multi-day event, in up to 3 lanes; extra ones fall back to a box on their first day.
  const seen = new Set(), bars = [];
  lists.forEach((l) => l.forEach((e) => { if (MULTI(e) && !seen.has(e.id)) { seen.add(e.id); bars.push({ e, a: Math.max(0, col(e.sd)), b: Math.min(7, col(e.ed)) }); } }));
  bars.sort((x, y) => x.a - y.a || (y.b - y.a) - (x.b - x.a));
  const lanes = [], spill = new Set();
  bars.forEach((x) => { let i = lanes.findIndex((end) => end <= x.a); if (i < 0 && lanes.length < 3) { i = lanes.length; lanes.push(0); } if (i < 0) { spill.add(x.e.id); x.lane = -1; return; } lanes[i] = x.b; x.lane = i; });
  const L = lanes.length;
  let h = '';
  keys.forEach((key, i) => {
    const d = parse(key), cls = ['day'];
    if (key < todayKey) cls.push('past'); else if (d.getDay() === 0 || d.getDay() === 6) cls.push('wknd');
    if (key === opts.focus) cls.push('focus');
    let label = `${DOW[d.getDay()]} ${d.getDate()}${d.getDate() === 1 ? ' ' + MON[d.getMonth()] : ''}`;
    if (key === todayKey) label += ' · auj.'; else if (key === tomorrowKey && opts.focus === key) label += ' · demain';
    h += `<div class="${cls.join(' ')}" style="grid-column:${i + 1};grid-row:1/-1"><span class="dl">${label}</span></div>`;
  });
  bars.filter((x) => x.lane >= 0).forEach(({ e, a, b, lane }) => {
    const p = P[e.who] || P.Fam;
    const more = parse(e.ed) > addDays(s0, 7) ? ` <small>→ ${dayShort(addDays(parse(e.ed), -1))}</small>` : '';
    const sub = e.school ? ' <small>SDUSD</small>' : e.who !== 'Fam' ? ` <small>${e.who}</small>` : '';
    h += `<button class="chip bar tap" data-ev="${esc(e.id)}" style="grid-column:${a + 1}/${b + 1};grid-row:${lane + 2};background:${p.bg};color:${p.fg};--c:${p.c}"><span class="bt">${esc(short(e.t))}</span>${sub}${more}</button>`;
  });
  keys.forEach((key, i) => {
    const list = lists[i].filter((e) => !MULTI(e) || (spill.has(e.id) && (col(e.sd) === i || (i === 0 && col(e.sd) < 0))));
    h += `<div class="dcont" data-key="${key}" data-n="${list.length}" style="grid-column:${i + 1};grid-row:${L + 2}">${list.slice(0, 7).map((e) => evHtml(e, key, now)).join('')}</div>`;
  });
  return `<div class="week wgrid" style="grid-template-rows:24px ${'auto '.repeat(L)}minmax(0,1fr)">${h}</div>`;
}

// ---------------------------------------------------------------- screen schedule
// 7:00–20:30 normal (Fully Kiosk turns the screen off when idle and on when someone walks by),
// 20:30–22:00 and 5:45–7:00 black (a touch shows the night clock), 22:00–5:45 Fully sleeps.
function mode(d = new Date()) {
  if (!WALL()) return 'day';
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
  if (saverOn) hideSaver();
  n.hidden = false;
  if (Date.now() < peekUntil) {
    const d = new Date();
    const tomorrow = ymd(addDays(d, mins(d) < 720 ? 0 : 1));
    const first = itemsFor(tomorrow).filter((e) => !e.rec).slice(0, 2).map((e) => esc(short(e.t)) + (e.s ? ' ' + hm(e.s) : '')).join(' · ');
    n.innerHTML = `<div class="nt num">${d.getHours()}${NB}h${NB}${pad(d.getMinutes())}</div><div class="nd">${DOWL[d.getDay()]} ${d.getDate()} ${MONL[d.getMonth()]}</div>${first ? `<div class="nn"><b>${mins(d) < 720 ? "Aujourd'hui" : 'Demain'}</b> · ${first}</div>` : ''}<div class="nf">S'éteint dans 15${NB}s</div>`;
  } else n.innerHTML = '';
}
$('#night').addEventListener('click', () => { peekUntil = Date.now() + 15000; applyMode(); setTimeout(applyMode, 15100); });

// ---------------------------------------------------------------- rule screensaver (wall only)
// After 40 s without a touch on the home screen, all the house rules fill the screen.
// When someone walks up and the screen wakes, they see them for a few seconds, then home.
if (!$('#saver')) document.body.insertAdjacentHTML('beforeend', '<div id="saver" hidden></div>');
let saverOn = false, saverTimer, saverHide;
function armSaver() {
  clearTimeout(saverTimer);
  if (!WALL()) return;
  saverTimer = setTimeout(showSaver, 40000);
}
function showSaver() {
  const rules = (S && S.rules) || [];
  if (!rules.length || route !== '' || busy() || mode() !== 'day' || !$('#night').hidden) { armSaver(); return; }
  const el = $('#saver');
  el.innerHTML = `<div class="sv"><div class="label">Règles de la maison</div><ol class="svl">${rules.map((r, i) => `<li><span class="svn">${i + 1}</span><span><b>${esc(r.t)}</b><span>${esc(r.d)}</span></span></li>`).join('')}</ol></div><div class="svf">Touchez pour revenir</div>`;
  el.hidden = false; saverOn = true;
}
function hideSaver() { clearTimeout(saverHide); $('#saver').hidden = true; saverOn = false; armSaver(); }
$('#saver').addEventListener('click', hideSaver);

// ---------------------------------------------------------------- routing
const PHONE = () => innerWidth < 760 || (innerHeight < 500 && matchMedia('(pointer: coarse)').matches);
let route = location.hash.slice(1);
let modal = null; // {kind, ...}
function go(r) { if (route === r) { render(); return; } location.hash = r; }
addEventListener('hashchange', () => { route = location.hash.slice(1); modal = null; voice.reset(); CF = { q: '', who: '' }; clearTimeout(cfTimer); render(); });
const busy = () => !!modal || voice.state === 'rec' || (document.activeElement && document.activeElement.tagName === 'INPUT');

let idleTimer;
function touched() {
  clearTimeout(idleTimer);
  // Back to the home screen after 90 s without a touch.
  idleTimer = setTimeout(() => { if (WALL() && voice.state !== 'rec') { modal = null; go(''); } }, 90000);
  if (!saverOn) armSaver();
}
addEventListener('pointerdown', touched, { passive: true });

// ---------------------------------------------------------------- render
function render() {
  if (!S) { $('#app').innerHTML = `<div class="boot">${DEMO ? 'Famille Fontaine' : badKey ? esc(badKey) : 'Chargement…'}</div>`; return; }
  const r = route.split('/')[0];
  // Home-screen shortcut "Courses": opens the Cozi sheet straight away.
  if (r === 'courses') { history.replaceState(null, '', location.pathname + location.search); route = ''; if (!S.cozi) { location.href = COZI(); return; } render(); openCozi(''); return; }
  const view = { '': PHONE() ? phoneHome : home, cal: calPage, repas: repasPage, votes: votesPage, taches: tachesPage, regles: reglesPage, contacts: contactsPage, voix: voicePage }[r] || home;
  document.documentElement.classList.toggle('ph', PHONE());
  $('#app').innerHTML = view() + (PHONE() && ME && r !== 'voix' ? phoneTabs(r) : '');
  renderModal();
  fitDays();
  applyMode();
}

function home() {
  const now = Date.now(), d = new Date(now);
  const evening = mins(d) >= 990; // 16:30
  const focusDay = evening ? addDays(d, 1) : d;
  const wkStart = sunday(d);
  const focus = ymd(focusDay);
  return `<div class="page home">
  <header class="head">
    <div class="clock"><div class="t num">${d.getHours()}${NB}h${NB}${pad(d.getMinutes())}</div>
      <div>${evening ? '<div class="tag">VUE DE DEMAIN</div>' : ''}<div class="d1">${DOWL[focusDay.getDay()]}</div><div class="d2">${focusDay.getDate()} ${MONL[focusDay.getMonth()]}</div></div></div>
    <div class="wx">${wxCards(focus, evening)}</div>
  </header>
  <section class="cal" aria-label="Calendrier, 2 semaines">
    ${weekRow(wkStart, now, { focus, max: 5, filter: true })}
    ${weekRow(addDays(wkStart, 7), now, { focus, max: 4, filter: true })}
  </section>
  <aside class="side">
    ${tasksTile()}
    ${messagesTile()}
    ${soonTile()}
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
    const tip = advice(w, key);
    return `<div class="wxc panel">${WXI[icon]}<div><div class="who"><span class="dot" style="background:${P[w.who].c}"></span>${P[w.who].n} · ${tomorrow ? 'demain' : esc(place(w.label))}</div><div class="tt num">${x.a.t}° <span style="color:var(--muted);font-weight:400">→</span> ${x.b.t}° <span class="cl">${label}</span></div><div class="cond${tip ? ' tip' : ''}">${tip || `8${NB}h → 15${NB}h`}</div></div></div>`;
  }).join('');
}
// "Oak Hill Elementary" → "OHES", "The Music Academy" → "Music Academy".
const place = (l) => String(l || '').replace(/^The\s+/i, '').replace(/^(.+?)\s+Elementary(\s+School)?$/i, (_, n) => n.split(/\s+/).map((w) => w[0]).join('').toUpperCase() + 'ES');
function tasksTile() {
  const c = S.chores;
  const kid = (who) => {
    const list = c.tasks.filter((t) => t.who === who);
    if (!list.length) return '';
    return `<div class="kid"><div class="kh"><span class="kn">${av(who)}${P[who].n}</span><span class="kp num" style="color:${P[who].c}">${c.points[who] || 0} pts</span></div>
      ${list.map((t) => {
        const on = c.done.some((x) => x.d === ymd(new Date()) && x.who === who && x.task === t.task);
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
// The house rules now come up as a screensaver (see "rule screensaver"); the footer keeps the color key.
function footer() {
  return `<footer class="foot">
    <div class="legend">${['M', 'F', 'Pa', 'Ma', 'Fam'].map((k) => `<button class="pc tap${CF.who === k ? ' on' : ''}" data-cwho="${k}" style="${CF.who === k ? `border-color:${P[k].c}` : ''}"><span class="dot" style="background:${P[k].c}"></span>${P[k].n}</button>`).join('')}</div>
    <nav class="nav">
      <a class="btn tap" href="#cal">${I.cal}Calendrier</a>
      <a class="btn tap" href="#repas">${I.food}Repas</a>
      ${coziLink('btn tap')}
      <a class="btn tap" href="#regles">${I.star}Règles</a>
      <a class="btn tap" href="#contacts">${I.people}Contacts</a>
      <button class="ver tap" data-update>v${VERSION}${DEMO ? ' · démo' : ''} ↻</button>
    </nav>
  </footer>`;
}
// On the phone the tab bar replaces the "Accueil" button.
const topBar = (title, sub, right = '') => `<header class="top">${PHONE() && ME ? '' : `<a class="btn back tap" href="#">${I.back}Accueil</a>`}<div><h1>${title}</h1>${sub ? `<div class="sub">${sub}</div>` : ''}</div>${right}</header>`;

// ---------------------------------------------------------------- countdowns ("Bientôt")
// Only big or fun things: trips, days off, holidays, birthdays, parties, shows, tournaments.
// Never practices, lessons, games of a team's weekly schedule or anything that repeats.
const ROUTINE = /practice|entra[iî]nement|\bentr\.|training|tutor|lesson|le[çc]on|\bcours\b|clean|m[ée]nage|check-in|medicine|m[ée]dicament|wash ?& ?go|rehearsal|r[ée]p[ée]tition|meeting|r[ée]union|poker/i;
const FUN = /anniv|birthday|\bb-?day|f[êe]te|party|soir[ée]e|trip|voyage|vacances|holiday|break|\bcamp\b|concert|spectacle|show|r[ée]cital|festival|gala|tournament|tournoi|\bcup\b|coupe|parade|disney|\bzoo\b|aquarium|mus[ée]e|museum|visit|celebrat|c[ée]l[ée]bration|wedding|mariage|graduation|thanksgiving|no[ëe]l|christmas|halloween|diwali|sleepover|pyjama|sortie|movie|cin[ée]ma|block party|discovery|field day|pas d'[ée]cole|no school/i;
let SERIES = null, SERIES_OF = null;
const head3 = (t) => fold(t).replace(/[^a-z0-9 ]/g, ' ').trim().split(/\s+/).slice(0, 3).join(' ');
function series(e) { // a title family that shows up 4+ times (a team's schedule, a weekly class)
  if (SERIES_OF !== S) { SERIES = new Map(); SERIES_OF = S; S.events.forEach((x) => SERIES.set(head3(x.t), (SERIES.get(head3(x.t)) || 0) + 1)); }
  return (SERIES.get(head3(e.t)) || 0) >= 4;
}
// The babysitter coming always counts, even when it repeats.
const SITTER = /baby-?sit|sitter|nanny|gardienne|gardiennage/i;
const bigEvent = (e) => SITTER.test(e.t) || !e.rec && !e.hol && !ROUTINE.test(e.t) && (FUN.test(e.t) || (!!e.sd && !e.team && !series(e)));
function soonList(from, max) {
  const out = [], seen = new Set(), end = addDays(from, 120);
  for (let x = new Date(from); x < end && out.length < max; x = addDays(x, 1)) {
    const k = ymd(x);
    for (const e of itemsFor(k)) {
      if (out.length >= max || seen.has(e.t) || (e.sd && e.sd !== k && ymd(from) !== k) || !bigEvent(e)) continue;
      seen.add(e.t);
      out.push({ e, day: new Date(x) });
    }
  }
  return out;
}
const countdown = (day) => { const n = Math.round((day - parse(ymd(new Date()))) / 864e5); return n <= 0 ? "Aujourd'hui" : n === 1 ? 'Demain' : `Dans ${n}${NB}jours`; };
function soonTile() {
  const from = addDays(sunday(new Date()), 14); // after the two weeks shown on the calendar
  const list = soonList(from, 3);
  if (!list.length) return '';
  return `<section class="soonp panel"><div class="label">Bientôt</div>${list.map(({ e, day }) => {
    const n = Math.round((day - parse(ymd(new Date()))) / 864e5);
    const p = P[e.who] || P.Fam;
    return `<button class="sn tap" data-ev="${esc(e.id)}"><span class="snn num" style="color:${p.c}">${n}<small>${NB}j</small></span><span class="snt"><span>${esc(short(e.t))}</span><small>${DOW[day.getDay()]} ${dayShort(day)}</small></span></button>`;
  }).join('')}</section>`;
}

// ---------------------------------------------------------------- calendrier page
// Search and "whose events": cleared when leaving the calendar or after 1 minute without a change.
let CF = { q: '', who: '' }, cfTimer;
const cfOn = () => !!(CF.q.trim() || CF.who);
function cfTouch() {
  clearTimeout(cfTimer);
  cfTimer = setTimeout(() => { CF = { q: '', who: '' }; if ((route === 'cal' || route === '') && !modal) render(); }, 60000);
}
function cfMatch(e) {
  if (CF.who && (e.who || 'Fam') !== CF.who) return false;
  const q = fold(CF.q.trim());
  return !q || fold(`${e.t} ${e.loc || ''} ${e.notes || ''} ${(P[e.who] || P.Fam).n}`).includes(q);
}
// The calendar page shows only what matches; the home screen always shows everything.
const viewItems = (key, opts) => (opts && opts.filter && cfOn() ? itemsFor(key).filter(cfMatch) : itemsFor(key));

function calPage() {
  const d = new Date();
  const ph = PHONE();
  // Phone only: the countdowns (on the tablet they are on the home screen).
  const soon = ph && !cfOn() ? soonList(addDays(parse(ymd(d)), 7), 3) : [];
  const soonHtml = soon.map((s) => `<span><span class="when">${countdown(s.day)}</span> ${esc(short(s.e.t))}</span>`).join('<span class="sep">·</span>');
  const who = ['M', 'F', 'Pa', 'Ma', 'Fam'].map((k) => `<button class="pc tap${CF.who === k ? ' on' : ''}" data-cwho="${k}" style="${CF.who === k ? `border-color:${P[k].c}` : ''}"><span class="dot" style="background:${P[k].c}"></span>${P[k].n}</button>`).join('');
  const tools = `<div class="ctools"><label class="csearch">${I.search}<input id="cq" type="search" placeholder="Chercher…" autocomplete="off" value="${esc(CF.q)}"></label><div class="cwho">${who}</div>${cfOn() ? '<button class="pc tap clr" data-cclear>Effacer</button>' : ''}</div>`;
  const gcal = ph ? `<a class="btn tap gcal" href="https://calendar.google.com/calendar/r/week" target="_blank" rel="noopener">${I.cal}Google Agenda</a>` : '';
  return `<div class="page calp">${topBar('Calendrier', ph ? '' : 'Agenda Google de la famille · à partir de cette semaine', gcal)}
    ${tools}
    ${soon.length ? `<div class="soon panel"><span class="label">Bientôt</span>${soonHtml}</div>` : ''}
    <div class="scroll" id="calbody">${calBody()}</div></div>`;
}
function calBody() {
  const now = Date.now(), d = new Date(now);
  const start = sunday(d), end = addDays(start, 7 * 15);
  if (CF.q.trim()) { // a search shows a plain list of what matches, by day
    let h = '', n = 0;
    for (let x = parse(ymd(d)); x < end; x = addDays(x, 1)) {
      const k = ymd(x), list = viewItems(k, { filter: true }).filter((e) => !(e.sd && e.sd < k && k !== ymd(d)));
      if (!list.length) continue;
      n += list.length;
      h += `<div class="pday">${DOWL[x.getDay()]} ${x.getDate()} ${MONL[x.getMonth()]}</div>` + list.map((e) => `<button class="prow tap" data-ev="${esc(e.id)}"><span class="dot" style="background:${(P[e.who] || P.Fam).c}"></span><span class="pt num">${e.s ? hm(e.s) : 'Journée'}</span><span class="ptt">${esc(e.t)}</span></button>`).join('');
    }
    return n ? `<div class="hint">${n} résultat${n > 1 ? 's' : ''}</div><div class="results panel">${h}</div>` : '<div class="none" style="padding:20px 4px">Rien trouvé — essayez un autre mot</div>';
  }
  const wk = (w) => `<div class="wk"><div class="wl">${w.getTime() === start.getTime() ? 'Cette semaine · ' : ''}${dayShort(w)} – ${dayShort(addDays(w, 6))}</div>${weekRow(w, now, { focus: ymd(d), filter: true })}</div>`;
  let weeks = '', n = 0;
  for (let w = new Date(start); w < end; w = addDays(w, 7), n++) {
    if (n === 3) { weeks += '<div id="calrest"></div>'; const from = new Date(w); setTimeout(() => { const el = $('#calrest'); if (!el) return; let h = ''; for (let x = from; x < end; x = addDays(x, 7)) h += wk(x); el.outerHTML = h; fitDays(); }, 30); break; }
    weeks += wk(w);
  }
  return weeks;
}
// Typing in the search only redraws the weeks, so the keyboard stays open.
document.addEventListener('input', (e) => {
  if (e.target.id !== 'cq') return;
  CF.q = e.target.value; cfTouch();
  const b = $('#calbody'); if (b) { b.innerHTML = calBody(); fitDays(); }
  const t = $('.ctools'); if (t && !t.querySelector('[data-cclear]') && cfOn()) t.insertAdjacentHTML('beforeend', '<button class="pc tap clr" data-cclear>Effacer</button>');
});

// ---------------------------------------------------------------- repas
const tabs = (on) => `<nav class="tabs"><a class="tap${on === 1 ? ' on' : ''}" href="#repas">Cette semaine</a><a class="tap${on === 2 ? ' on' : ''}" href="#votes">Semaine prochaine · votes</a></nav>`;
function repasPage() {
  const todayKey = ymd(new Date());
  const rows = S.menu.map((m) => {
    const d = parse(m.date), id = COOK[m.cook] || 'Pa';
    const cls = m.date < todayKey ? ' past' : m.date === todayKey ? ' today' : '';
    return `<div class="mrow${cls}"><span class="md">${DOW[d.getDay()]} ${d.getDate()}</span><span class="mc">${av(id)}${esc(m.cook)}</span>
      <button class="dish tap" data-dish="${m.date}|${esc(m.cook)}"><span>${m.dish ? esc(m.dish) : '<span style="color:var(--dim)">À choisir</span>'}</span>${m.salade ? '<span class="tag">+ salade</span>' : ''}</button>
      <span class="macts">${m.dish && m.date >= todayKey ? `<a class="btn tap mcart" href="${chefLuc(m.dish)}">${I.food}Cuisiner</a>` : ''}${S.cozi && m.dish && m.date >= todayKey ? `<button class="btn tap mcart${sentFor(m.date, m.dish) ? ' sent' : ''}" data-czdish="${m.date}|${esc(m.dish)}">${I.cart}Ingrédients${sentFor(m.date, m.dish) ? ' ✓' : ''}</button>` : `<span class="hint">${m.date === todayKey && !m.dish ? 'Ce soir' : ''}</span>`}</span></div>`;
  }).join('');
  return `<div class="page">${topBar('Repas', '', tabs(1))}<div class="scroll" style="gap:8px">${rows}<div class="hint">Le cuisinier touche son plat pour le changer.</div></div></div>`;
}
let voter = null, voterTimer, flash = '';
function votesPage() {
  const v = S.vote;
  if (!v) return `<div class="page">${topBar('Repas', '', tabs(2))}<div class="none" style="padding:20px 4px">Pas de vote en cours.</div></div>`;
  if (PHONE() && ME) voter = ME;
  const closes = new Date(v.closes);
  const mon = parse(v.week);
  const who = ['M', 'F', 'Pa', 'Ma'].map((id) => `<button class="who tap" data-voter="${id}" style="${voter === id ? `border-color:${P[id].c};background:var(--panel2)` : ''}">${av(id)}${P[id].n}</button>`).join('');
  const NIGHTS = { Papa: 'lun. · mer. · ven.', Maman: 'mar. · jeu. · dim.', Enfant: `sam. ${addDays(mon, 5).getDate()} ${MON[addDays(mon, 5).getMonth()]}` };
  const rmap = new Map(RCP().map((r) => [r.t, r]));
  const groups = v.groups.map((g) => {
    const mine = g.dishes.filter((x) => (v.votes[x.dish] || []).includes(voter)).length;
    const title = g.group === 'Enfant' ? v.kid : g.group;
    const gid = COOK[title] || 'Pa';
    const tiles = g.dishes.map((x) => {
      const vs = v.votes[x.dish] || [];
      const on = voter && vs.includes(voter);
      const r = rmap.get(x.dish), meta = r ? [r.cui, r.prot].filter(Boolean).join(' · ') : '';
      return `<button class="tile tap" data-vote="${esc(g.group)}|${esc(x.dish)}" style="${on ? `border-color:${P[voter].c};background:var(--panel2)` : ''}"><span class="tn">${esc(x.dish)}</span>${meta ? `<span class="tm">${esc(meta)}</span>` : ''}${x.salade ? '<span class="tag" style="align-self:flex-start">+ salade</span>' : ''}<span class="tv">${vs.map((p) => av(p, 22)).join('')}</span></button>`;
    }).join('');
    return `<div class="grp"><div class="gh"><span class="dot" style="background:${P[gid].c};width:12px;height:12px"></span>${esc(title)}<span class="gs">${NIGHTS[g.group]} — ${g.max === 1 ? '1 vote' : '3 votes max'}</span><span class="gc">${voter ? `${P[voter].n} : ${mine}/${g.max}` : ''}</span></div><div class="tiles">${tiles}</div></div>`;
  }).join('');
  return `<div class="page">${topBar('Repas', '', tabs(2))}
    <div class="whos">${PHONE() && ME ? `<span class="hint" style="font-size:15px">Vous votez : ${P[ME].n}</span>` : `<span class="hint" style="font-size:17px">Qui vote ?</span>${who}`}<span class="hint ${flash ? 'flash' : ''}" style="margin-left:auto">${flash || `Semaine du ${mon.getDate()} ${MON[mon.getMonth()]} · ferme ${DOW[closes.getDay()]} ${hm(closes.getTime())}`}</span></div>
    <div class="scroll">${groups}</div></div>`;
}

// ---------------------------------------------------------------- tâches
function tachesPage() {
  const c = S.chores, d = new Date(), mon = sunday(d), todayKey = ymd(d);
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
const voiceTo = () => (S && S.voiceTo) || 'Papa et Maman';
function voicePage() {
  const v = voice;
  let body;
  if (v.state === 'rec') {
    const s = Math.floor((Date.now() - v.t0) / 1000);
    body = `<button class="vbtn rec" data-voice>${I.mic('#fff', 72)}</button><div class="vt num">0:${pad(s)}</div><div class="vh">Relâchez pour envoyer</div><div class="vs">Glissez le doigt hors du bouton pour annuler · 60${NB}s max</div>`;
  } else if (v.state === 'sending') {
    body = `<div class="vicon" style="background:#263040">${I.mic('#C9D3DD', 64)}</div><div class="vh">Envoi…</div>`;
  } else if (v.state === 'sent') {
    body = `<div class="vicon" style="background:#1E3A31">${I.check('#5FD3A6', 72)}</div><div class="vh">Envoyé à ${esc(voiceTo())}</div><div class="vs">Par courriel</div>`;
  } else if (v.state === 'fail') {
    body = `<div class="vicon" style="background:#3B2E14"><svg width="72" height="72" viewBox="0 0 24 24" fill="none" stroke="#F2C14E" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 8v5M12 16.5v.01"/><path d="M10.3 3.9L2.6 17.2A2 2 0 0 0 4.3 20h15.4a2 2 0 0 0 1.7-2.8L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg></div><div class="vh">Pas encore envoyé</div><div class="vs">${esc(v.err)}</div>${v.blob ? '<button class="btn gold tap" data-retry>Réessayer</button>' : ''}`;
  } else {
    body = `<button class="vbtn" data-voice>${I.mic('#14110A', 80)}</button><div class="vh">Maintenez pour parler</div><div class="vs">Le message va à ${esc(voiceTo())}</div>`;
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
  day() {
    const d = parse(modal.key), now = Date.now();
    const list = viewItems(modal.key, { filter: modal.filter }).map((e) => evHtml(e, modal.key, now)).join('');
    return `<div class="modal" data-close><section class="det panel dayall"><div class="dh"><span style="font-size:24px;font-weight:700">${DOWL[d.getDay()]} ${d.getDate()} ${MONL[d.getMonth()]}</span><button class="btn tap" data-close>${I.x}Fermer</button></div><div class="dlist">${list}</div></section></div>`;
  },
  dish() {
    const d = parse(modal.date), all = RCP(), n = pickFiltered().length;
    const group = (key, label, vals) => {
      vals = vals.filter((v) => all.some((r) => facet(r, key).includes(v)));
      if (!vals.length) return '';
      return `<div class="pgrp"><span class="pgl">${label}</span><div class="pchips">${vals.map((v) => `<button class="tap${pick.f[key].includes(v) ? ' on' : ''}" data-pf="${key}|${esc(v)}">${esc(v)}</button>`).join('')}</div></div>`;
    };
    const extra = [['kid', 'Facile enfants'], ['salade', '+ salade'], ['old', 'Pas fait depuis 1 mois']]
      .filter(([k]) => k !== 'salade' || all.some((r) => r.salade)).filter(([k]) => k !== 'kid' || all.some((r) => r.kid))
      .map(([k, l]) => `<button class="tap${pick.f.more.includes(k) ? ' on' : ''}" data-pf="more|${k}">${l}</button>`).join('');
    const sorts = [['old', 'Pas fait depuis longtemps'], ['az', 'A–Z'], ['fav', 'Le plus fait']].map(([k, l]) => `<button class="tap${pick.sort === k ? ' on' : ''}" data-psort="${k}">${l}</button>`).join('');
    const any = pick.q || PICK_KEYS.some((k) => pick.f[k].length);
    return `<div class="picker"><section class="box panel"><div class="pk-h"><div><div class="pk-t">${DOWL[d.getDay()]} ${d.getDate()} · ${esc(modal.cook)}</div><div class="hint">Choisissez le plat</div></div><span class="pk-r">${S.menu.some((m) => m.date === modal.date && m.dish) ? '<button class="btn tap" data-pnone>Pas encore décidé</button>' : ''}<button class="btn tap" data-close>${I.x}Fermer</button></span></div>
      <div class="ptools"><input id="pq" type="search" placeholder="Chercher un plat, un ingrédient…" autocomplete="off" value="${esc(pick.q)}"><button class="btn tap" data-prand>🎲 Au hasard</button></div>
      <div class="pfilters">
        ${group('prot', 'Protéine', PROTS)}
        ${group('cui', 'Cuisine', [...CUISINES, ...new Set(all.map((r) => r.cui).filter((c) => c && !CUISINES.includes(c)))])}
        ${group('style', 'Style', [...STYLES, ...new Set(all.flatMap((r) => facet(r, 'style')).filter((c) => !STYLES.includes(c)))])}
        ${extra ? `<div class="pgrp"><span class="pgl">Aussi</span><div class="pchips">${extra}</div></div>` : ''}
      </div>
      <div class="psort"><span class="pcount" id="pcount">${n} plat${n > 1 ? 's' : ''}</span>${sorts}${any ? '<button class="tap clr" data-pclear>Tout effacer</button>' : ''}</div>
      <div class="list">${pickList()}</div></section></div>`;
  },
};
// ---------------------------------------------------------------- Chef Luc (the cooking app, same address)
// Opens the dish's recipe in Chef Luc. A dinner whose ingredients already went to Cozi, from either
// app, is marked so they are not added twice.
const chefLuc = (dish) => `/Chef-Luc/#/d/${encodeURIComponent(dish)}`;
const foldName = (t) => String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const sentFor = (date, dish) => (S.sent || []).find((x) => x.date === date && foldName(x.dish) === foldName(dish));

// ---------------------------------------------------------------- groceries → Cozi
// Kids' items get their name in brackets; a dinner's ingredients (from Chef Luc) go in together.
const STORES = ['Auto', 'Aldi', 'Costco', 'Balboa/99Ranch/TJ'];
const PANTRY = /\b(salt|sel|pepper|poivre|olive oil|oil|huile|water|eau|sugar|sucre|flour|farine|garlic powder|onion powder|paprika|cumin|cinnamon|cannelle|oregano|origan|baking (soda|powder)|vanilla|honey|miel|vinegar|vinaigre|soy sauce|ketchup|mustard|moutarde|mayonnaise|chili flakes|bay lea|thyme|thym|spice|[ée]pice)\b/i;
let cz = null;
function openCozi(dish, date) {
  cz = { who: PHONE() && ME ? ME : '', store: 'Auto', items: [], dish: dish || '', date: date || '', loading: !!dish, sending: false };
  openModal({ kind: 'cozi' });
  if (!dish) return;
  const done = (list) => { if (!cz || cz.dish !== dish) return; cz.loading = false; cz.items = list.map((t) => ({ t, on: !PANTRY.test(t) })); renderModal(); };
  if (DEMO) setTimeout(() => done(['Chicken breast 600 g', 'Cherry tomatoes 190 g', 'Avocado 2 small', 'Cilantro 75 g', 'Fine salt 7 g', 'Olive oil 20 g']), 300);
  else fetch(`${API}?k=${encodeURIComponent(KEY)}&a=ing&t=${encodeURIComponent(dish)}`, { cache: 'no-store' }).then((r) => r.json()).then((j) => done(j.items || [])).catch(() => done([]));
}
function czAddTyped() {
  const i = $('#czq'); const v = i && i.value.trim(); if (!v) return;
  v.split(/[,\n]/).map((x) => x.trim()).filter(Boolean).forEach((t) => cz.items.push({ t, on: true }));
  cz.q = '';
  renderModal(); const n = $('#czq'); if (n) n.focus();
}
// Snappy: the sheet closes at once and the items go to Cozi in the background (a few seconds).
// If Cozi refuses, a "Réessayer" button reopens the sheet with the same items.
async function czSend() {
  const items = cz.items.filter((x) => x.on).map((x) => x.t);
  if (!items.length) return;
  // Already sent from either app: a second tap confirms.
  if (cz.dish && cz.date && sentFor(cz.date, cz.dish) && !cz.confirm) { cz.confirm = true; renderModal(); return; }
  if (!cz.who) { toast("Touchez d'abord votre nom"); return; }
  const sent = { ...cz, items: cz.items.map((x) => ({ ...x })), sending: false };
  cz = null; modal = null; renderModal();
  toast(`${items.length} article${items.length > 1 ? 's' : ''} → Cozi…`);
  try {
    let j = { ok: true, added: [{ list: sent.store === 'Auto' ? 'Aldi' : sent.store, n: items.length }] };
    if (DEMO) await new Promise((r) => setTimeout(r, 800));
    else j = await (await fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ a: 'cozi', k: KEY, who: sent.who, store: sent.store, items, dish: sent.dish, date: sent.date, by: 'Control Center' }) })).json();
    if (j.error) throw new Error(j.error);
    if (sent.dish && sent.date) { S.sent = [...(S.sent || []), { date: sent.date, dish: sent.dish, at: Date.now(), by: 'Control Center' }]; render(); }
    toast(`Ajouté à Cozi ✓ ${j.added.map((a) => `${a.n} → ${a.list}`).join(' · ')}`);
  } catch (e) {
    toast(`Pas envoyé à Cozi · ${String(e.message || 'pas de connexion').slice(0, 40)}`, { label: 'Réessayer', run: () => { $('#toast').hidden = true; cz = sent; openModal({ kind: 'cozi' }); } });
  }
}
MODALS.cozi = () => {
  const n = cz.items.filter((x) => x.on).length;
  const was = cz.dish && cz.date ? sentFor(cz.date, cz.dish) : null;
  const warn = was ? `<div class="czwarn">Déjà envoyé à Cozi ${new Date(was.at).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}${was.by ? ` (${esc(was.by)})` : ''}. Renvoyer ajoutera les articles une 2e fois.</div>` : '';
  const who = PHONE() && ME ? '' : `<div class="pgrp"><span class="pgl">Qui ?</span><div class="pchips">${['M', 'F', 'Pa', 'Ma'].map((k) => `<button class="tap${cz.who === k ? ' on' : ''}" data-czwho="${k}"><span class="dot" style="background:${P[k].c}"></span> ${P[k].n}</button>`).join('')}</div></div>`;
  const stores = `<div class="pgrp"><span class="pgl">Magasin</span><div class="pchips">${STORES.map((st) => `<button class="tap${cz.store === st ? ' on' : ''}" data-czstore="${esc(st)}">${st === 'Auto' ? 'Auto (Aldi · spécialités → Balboa/99Ranch/TJ)' : esc(st)}</button>`).join('')}</div></div>`;
  const list = cz.loading ? '<div class="none">Ingrédients de Chef Luc…</div>'
    : cz.items.length ? cz.items.map((x, i) => `<div class="czi${x.on ? '' : ' off'}"><button class="tap czt" data-czon="${i}"><span class="ck">${x.on ? I.check('#14110A') : ''}</span>${esc(x.t)}</button><button class="tap czx" data-czdel="${i}" aria-label="Retirer">${I.x}</button></div>`).join('')
    : `<div class="none">${cz.dish ? "Pas d'ingrédients trouvés pour ce plat — ajoutez-les ici." : 'Écrivez un article, puis Ajouter.'}</div>`;
  return `<div class="picker"><section class="box panel czbox"><div class="pk-h"><div><div class="pk-t">${cz.dish ? 'Ingrédients' : 'Courses'}</div><div class="hint">${cz.dish ? esc(cz.dish) + ' · décochez ce que vous avez déjà' : 'Va directement dans Cozi'}</div></div><button class="btn tap" data-close>${I.x}Fermer</button></div>
    ${warn}<div class="pfilters">${who}${stores}</div>
    <div class="ptools"><input id="czq" type="text" placeholder="Ex. : lait, pain" autocomplete="off" enterkeyhint="done" value="${esc(cz.q || '')}"><button class="btn tap" data-czadd>Ajouter</button></div>
    <div class="czl">${list}</div>
    <div class="czf"><a class="hint" href="${COZI()}" target="_blank" rel="noopener">Ouvrir Cozi ›</a><button class="btn gold tap" data-czsend ${n ? '' : 'disabled'}>${cz.sending ? 'Envoi…' : was ? (cz.confirm ? `Confirmer : renvoyer ${n} article${n > 1 ? 's' : ''}` : `Renvoyer ${n} article${n > 1 ? 's' : ''}…`) : `Envoyer ${n} article${n > 1 ? 's' : ''} à Cozi`}</button></div></section></div>`;
};
document.addEventListener('input', (e) => { if (e.target.id === 'czq' && cz) cz.q = e.target.value; });
document.addEventListener('keydown', (e) => { if (e.target.id === 'czq' && e.key === 'Enter') { e.preventDefault(); czAddTyped(); } });

function renderModal() { $('#modal').innerHTML = modal ? MODALS[modal.kind]() : ''; }
// ---------------------------------------------------------------- dish picker: search, filter, sort
const RCP = () => (S.recipes || []).map((r) => (typeof r === 'string' ? { t: r } : r));
const fold = (x) => String(x).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const IPOT = /instant pot|pressure/i;
const PROTS = ['Poulet', 'Bœuf', 'Porc', 'Agneau', 'Dinde', 'Poisson', 'Sans viande', 'Autre'];
const CUISINES = ['Libanais', 'Méditerranéen', 'Français', 'Italien', 'Américain', 'Mexicain', 'Latino', 'Asiatique', 'Indien'];
const STYLES = ['Rapide', 'Instant Pot', 'Grill', 'Four', 'Mijoté', 'Soupe', 'Salade', 'Sandwich', 'Pâtes', 'Riz', 'Nouilles'];
const PICK_KEYS = ['prot', 'cui', 'style', 'more'];
const emptyF = () => ({ prot: [], cui: [], style: [], more: [] });
// What a dish can be filtered on (Instant Pot also comes from the name, for older data).
function facet(r, key) {
  if (key === 'prot') return r.prot ? [r.prot] : [];
  if (key === 'cui') return r.cui ? [r.cui] : [];
  const st = (r.style || []).slice();
  if (IPOT.test(r.t) && !st.includes('Instant Pot')) st.push('Instant Pot');
  return st;
}
let pick = { q: '', f: emptyF(), sort: 'old', hi: '' };
const ago = (k) => (k ? Math.round((parse(ymd(new Date())) - parse(k)) / 864e5) : null);
// Within a group, any choice matches (Poulet or Porc); across groups, all must match (Poulet and Asiatique).
function pickFiltered() {
  const q = fold(pick.q.trim()), f = pick.f;
  return RCP().filter((r) => (!q || fold(`${r.t} ${r.prot || ''} ${r.cui || ''} ${facet(r, 'style').join(' ')}`).includes(q))
    && ['prot', 'cui', 'style'].every((k) => !f[k].length || facet(r, k).some((v) => f[k].includes(v)))
    && (!f.more.includes('kid') || r.kid) && (!f.more.includes('salade') || r.salade)
    && (!f.more.includes('old') || !r.last || ago(r.last) >= 30));
}
function pickList() {
  const l = pickFiltered(), A = (r) => (r.last ? ago(r.last) : 99999);
  l.sort(pick.sort === 'az' ? (a, b) => a.t.localeCompare(b.t) : pick.sort === 'fav' ? (a, b) => (b.n || 0) - (a.n || 0) || a.t.localeCompare(b.t) : (a, b) => A(b) - A(a) || a.t.localeCompare(b.t));
  if (!l.length) return '<div class="none">Aucun plat — enlevez un filtre</div>';
  return l.map((r) => {
    const a = r.last ? ago(r.last) : null;
    const when = r.last === undefined ? '' : a == null ? 'jamais fait' : a === 0 ? "fait aujourd'hui" : `fait il y a ${a}${NB}j`;
    const meta = [r.cui, r.prot, when, r.salade ? '+ salade' : ''].filter(Boolean).join(' · ');
    return `<button class="tap${pick.hi === r.t ? ' hi' : ''}${a != null && a <= 10 ? ' recent' : ''}" data-pick="${esc(r.t)}"><span>${esc(r.t)}</span>${meta ? `<small>${esc(meta)}</small>` : ''}</button>`;
  }).join('');
}
document.addEventListener('input', (e) => {
  if (e.target.id !== 'pq') return;
  pick.q = e.target.value; pick.hi = '';
  const l = $('.picker .list'); if (l) l.innerHTML = pickList();
  const c = $('#pcount'), n = pickFiltered().length; if (c) c.textContent = `${n} plat${n > 1 ? 's' : ''}`;
});
function openModal(m, ttl) { modal = m; clearTimeout(modalTimer); if (ttl) modalTimer = setTimeout(() => { modal = null; renderModal(); }, ttl); renderModal(); }

// ---------------------------------------------------------------- phone (parents)
// Cozi: opens the Cozi app on Android, the Cozi website elsewhere (or if the app isn't installed).
const COZI = () => /Android/i.test(navigator.userAgent)
  ? 'intent://#Intent;action=android.intent.action.MAIN;category=android.intent.category.LAUNCHER;package=com.cozi.androidfree;S.browser_fallback_url=https%3A%2F%2Fmy.cozi.com%2F;end'
  : 'https://my.cozi.com/';
function coziLink(cls) {
  if (S && S.cozi) return `<button class="${cls}" data-cz>${I.cart}Courses</button>`;
  if (window.fully && window.fully.startApplication) return `<button class="${cls}" data-cozi>${I.cart}Courses</button>`;
  return `<a class="${cls}" href="${COZI()}" target="_blank" rel="noopener">${I.cart}Courses</a>`;
}
// The phone asks once "Papa or Maman?" and remembers it (tap the name to change).
let ME = store.get('me', null), phoneTo = 'Tous', draft = '';
document.addEventListener('input', (e) => { if (e.target.id === 'msg') draft = e.target.value; });
function phoneWho() {
  return `<div class="page phone pwho"><div class="pwq">Qui êtes-vous ?</div>
    ${['Pa', 'Ma'].map((id) => `<button class="pwb tap" data-me="${id}" style="border-color:${P[id].c}">${av(id, 44)}${P[id].n}</button>`).join('')}
    <button class="ver tap" data-update>v${VERSION}${DEMO ? ' · démo' : ''} ↻</button></div>`;
}
// "Add to home screen": Chrome on Android offers a real install button.
let installEvt = null;
addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); installEvt = e; if (PHONE() && !busy()) render(); });
addEventListener('appinstalled', () => { installEvt = null; store.set('installed', true); if (PHONE()) render(); });
const INSTALLED = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true || store.get('installed', false);
function installCard() {
  if (INSTALLED() || store.get('noInstall', false)) return '';
  return `<section class="card panel pinst"><img src="icons/icon-192.png" alt="" width="48" height="48"><span class="grow"><b>L'icône sur votre téléphone</b><span class="hint">Ouvre l'app d'un toucher, en plein écran</span></span><button class="btn gold tap" data-install>Ajouter</button><button class="tap pinx" data-noinstall aria-label="Plus tard">${I.x}</button></section>`;
}
function phoneTabs(r) {
  const on = (x) => (x.includes(r) ? ' class="on"' : '');
  return `<nav class="pnav"><a${on([''])} href="#">${I.home}Accueil</a><a${on(['cal'])} href="#cal">${I.cal}Agenda</a><a${on(['repas', 'votes'])} href="#repas">${I.food}Repas</a><a${on(['taches'])} href="#taches">${I.check2}Tâches</a>${S.cozi ? `<a href="#" data-cz>${I.cart}Courses</a>` : `<a href="${COZI()}">${I.cart}Courses</a>`}</nav>`;
}
function phoneHome() {
  if (!ME) return phoneWho();
  const d = new Date(), todayKey = ymd(d), c = S.chores;
  const m = S.menu.find((x) => x.date === todayKey);
  const voted = S.vote && Object.values(S.vote.votes).some((l) => l.includes(ME));
  let days = '', shown = 0;
  for (let i = 0; i < 7 && shown < 14; i++) {
    const x = addDays(d, i), k = ymd(x), items = itemsFor(k).filter((e) => !(e.e && e.e < Date.now()) && !(e.sd && e.sd < k && i > 0));
    if (!items.length) continue;
    shown += items.length;
    days += `<div class="pday">${i === 0 ? "Aujourd'hui" : i === 1 ? 'Demain' : DOWL[x.getDay()] + ' ' + x.getDate()}</div>` + items.map((e) => `<button class="prow tap${e.rec ? ' dim' : ''}" data-ev="${esc(e.id)}"><span class="dot" style="background:${(P[e.who] || P.Fam).c}"></span><span class="pt num">${e.s ? hm(e.s) : 'Journée'}</span><span class="ptt">${esc(short(e.t))}</span></button>`).join('');
  }
  const kids = ['M', 'F'].filter((k) => c.tasks.some((t) => t.who === k)).map((k) => {
    const list = c.tasks.filter((t) => t.who === k), done = list.filter((t) => c.done.some((x) => x.d === todayKey && x.who === k && x.task === t.task)).length;
    return `<a class="pkid tap" href="#taches">${av(k, 36)}<span class="grow"><b>${P[k].n}</b><span class="hint">${done}/${list.length} aujourd'hui</span></span><span class="num pkp" style="color:${P[k].c}">${c.points[k] || 0}<small> pts</small></span></a>`;
  }).join('');
  const cook = m ? COOK[m.cook] || 'Pa' : null;
  return `<div class="page phone">
    <header class="phead"><div><h1 class="pgreet">${d.getHours() >= 17 ? 'Bonsoir' : 'Bonjour'} ${esc(P[ME].n)}</h1><div class="hint">${DOWL[d.getDay()]} ${d.getDate()} ${MONL[d.getMonth()]}</div></div><button class="tap pme" data-switch aria-label="Changer de personne">${av(ME, 40)}</button></header>
    ${DEMO && !qs.has('demo') ? '<section class="card panel"><b>Famille d\'exemple</b><div class="hint">Ouvrez une fois votre lien famille (…/?k=…) dans ce navigateur pour voir vos vraies données.</div></section>' : ''}
    ${installCard()}
    ${m && m.dish ? `<a class="card panel prow tap" href="${chefLuc(m.dish)}"><span>${I.food}<b>Cuisiner ce soir</b> avec Chef Luc</span><span class="hint">›</span></a>` : ''}
    <a class="card panel pdin tap" href="#repas"><span class="label">Ce soir</span><span class="pdish">${m && m.dish ? esc(m.dish) : 'À choisir'}${m && m.salade ? ' <span class="tag">+ salade</span>' : ''}</span>${m ? `<span class="hint"><span class="dot" style="background:${P[cook].c}"></span>${esc(m.cook)} cuisine</span>` : ''}</a>
    ${S.vote ? `<a class="card panel prow pvote tap" href="#votes"><span>${voted ? 'Votes de la semaine prochaine · fait ✓' : '<b>Votez</b> pour les repas de la semaine prochaine'}</span><span class="hint">ferme ${DOW[new Date(S.vote.closes).getDay()]} ${hm(S.vote.closes)} ›</span></a>` : ''}
    <section class="card panel"><div class="label">Au programme</div>${days || '<div class="none">Rien cette semaine</div>'}<a class="hint more2" href="#cal">Tout l'agenda ›</a></section>
    ${kids ? `<section class="card panel"><div class="label">Les enfants</div>${kids}</section>` : ''}
    <section class="card panel"><label class="label" for="msg">Message pour le mur</label>
      <input id="msg" type="text" maxlength="200" placeholder="Ex. : Piano annulé ce soir" autocomplete="off" value="${esc(draft)}">
      <div class="seg">${['Tous', P.M.n, P.F.n].map((t) => `<button class="tap${phoneTo === t ? ' on' : ''}" data-to="${t}">${t}</button>`).join('')}</div>
      <button class="btn gold tap" data-send style="justify-content:center">Envoyer au mur</button></section>
    <div class="plinks"><a href="#regles">Règles</a><span>·</span><a href="#contacts">Contacts</a><span>·</span><button class="ver tap" data-update>v${VERSION}${DEMO ? ' · démo' : ''} ↻</button></div>
  </div>`;
}

// ---------------------------------------------------------------- taps (one listener for everything)
document.addEventListener('click', (ev) => {
  const t = ev.target.closest('[data-cz],[data-czdish],[data-czwho],[data-czstore],[data-czon],[data-czdel],[data-czadd],[data-czsend],[data-pnone],[data-install],[data-noinstall],[data-cwho],[data-cclear],[data-cozi],[data-pf],[data-pclear],[data-psort],[data-prand],[data-day],[data-task],[data-seen],[data-ev],[data-close],[data-dish],[data-pick],[data-voter],[data-vote],[data-update],[data-me],[data-switch],[data-to],[data-send],[data-retry]');
  if (!t) return;
  const ds = t.dataset;
  if ('cz' in ds) { ev.preventDefault(); openCozi(''); return; }
  if (ds.czdish) { const i = ds.czdish.indexOf('|'); openCozi(ds.czdish.slice(i + 1), ds.czdish.slice(0, i)); return; }
  if (ds.czwho) { cz.who = ds.czwho; renderModal(); return; }
  if (ds.czstore) { cz.store = ds.czstore; renderModal(); return; }
  if (ds.czon) { const x = cz.items[+ds.czon]; x.on = !x.on; renderModal(); return; }
  if (ds.czdel) { cz.items.splice(+ds.czdel, 1); renderModal(); return; }
  if ('czadd' in ds) { czAddTyped(); return; }
  if ('czsend' in ds) { czSend(); return; }
  if ('pnone' in ds) { act({ a: 'dish', date: modal.date, cook: modal.cook, dish: '' }); modal = null; render(); return; }
  if ('install' in ds) {
    if (installEvt) { installEvt.prompt(); installEvt.userChoice.then(() => { installEvt = null; render(); }); }
    else toast("Menu ⋮ de Chrome puis « Installer l'application »");
    return;
  }
  if ('noinstall' in ds) { store.set('noInstall', true); render(); return; }
  if (ds.cwho) { CF.who = CF.who === ds.cwho ? '' : ds.cwho; cfTouch(); render(); return; }
  if ('cclear' in ds) { CF = { q: '', who: '' }; clearTimeout(cfTimer); render(); return; }
  if ('cozi' in ds) { try { window.fully.startApplication('com.cozi.androidfree'); } catch { location.href = 'https://my.cozi.com/'; } return; }
  if (ds.day) { openModal({ kind: 'day', key: ds.day, filter: route === 'cal' }, 30000); return; }
  if (ds.task) { const [who, task, pts, done] = ds.task.split('|'); act({ a: 'task', who, task, pts: +pts, done: done === '1' }); }
  else if (ds.seen) act({ a: 'seen', id: ds.seen });
  else if (ds.ev) { const e = S.events.find((x) => x.id === ds.ev) || itemsFor(ds.ev.slice(3)).find((x) => x.id === ds.ev); if (e) openModal({ kind: 'ev', e }, PHONE() ? 0 : 20000); }
  else if ('close' in ds) { if (ev.target.closest('.det') && !t.matches('button')) return; modal = null; renderModal(); }
  else if (ds.dish) { const [date, cook] = ds.dish.split('|'); pick = { q: '', f: emptyF(), sort: 'old', hi: '' }; if (['M', 'F'].includes(COOK[cook]) && RCP().some((r) => r.kid)) pick.f.more.push('kid'); openModal({ kind: 'dish', date, cook }); }
  else if (ds.pf) { const [k, v] = ds.pf.split('|'), l = pick.f[k], i = l.indexOf(v); if (i < 0) l.push(v); else l.splice(i, 1); pick.hi = ''; renderModal(); }
  else if ('pclear' in ds) { pick.q = ''; pick.f = emptyF(); pick.hi = ''; renderModal(); }
  else if (ds.psort) { pick.sort = ds.psort; renderModal(); }
  else if ('prand' in ds) { const l = pickFiltered(); if (l.length) { pick.hi = l[Math.floor(Math.random() * l.length)].t; renderModal(); const el = $('.picker .hi'); if (el) el.scrollIntoView({ block: 'center' }); } }
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
  else if (ds.me) { ME = ds.me; store.set('me', ME); render(); }
  else if ('switch' in ds) { ME = null; store.set('me', null); render(); }
  else if (ds.to) { phoneTo = ds.to; render(); }
  else if ('send' in ds) { const i = $('#msg'); const text = i && i.value.trim(); if (text) { draft = ''; act({ a: 'message', from: P[ME].n, to: phoneTo, text, at: Date.now() }); toast('Envoyé au mur'); } }
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
    let found = !!(reg && (reg.installing || reg.waiting)) || updateReady;
    if (manual && !found) {
      // Safety net: if GitHub has another version than the one running, start fresh.
      const txt = await (await fetch('sw.js?t=' + Date.now(), { cache: 'no-store' })).text();
      const live = (txt.match(/VERSION = '([^']+)'/) || [])[1];
      if (live && live !== VERSION) { found = true; await hardReset(reg); }
    }
    if (manual) toast(found ? 'Mise à jour…' : `À jour · v${VERSION}`);
    if (found && manual) setTimeout(() => location.reload(), 1200);
  } catch { if (manual) toast('Pas de connexion'); }
}
async function hardReset(reg) {
  await Promise.all((await caches.keys()).map((k) => caches.delete(k)));
  await reg?.unregister();
  await Promise.all(['index.html', 'app.css', 'app.js', 'config.js', 'demo.js', 'sw.js'].map((u) => fetch(u, { cache: 'reload' }).catch(() => {})));
}
if ('serviceWorker' in navigator && !DEMO_LOCAL()) {
  let had = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js').catch(() => {});
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!had) { had = true; return; } // first install: nothing to reload
    if (updateReady) return;
    updateReady = true;
    if (route === '' && !busy()) location.reload();
    else toast('Nouvelle version', { label: 'Recharger', run: () => location.reload() });
  });
}
function DEMO_LOCAL() { return location.protocol === 'file:'; }

// ---------------------------------------------------------------- wake, clock, refresh
function wake() {
  touched(); refresh(); weather(); checkUpdate(false); applyMode();
  if (saverOn) { clearTimeout(saverHide); saverHide = setTimeout(hideSaver, 8000); } // a look at the rule, then home
}
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
