#!/usr/bin/env node
/* Fontaine Control Center — end-to-end tests.
 * Runs the real app in Chromium against sample data (no family data, no Google access needed):
 *   node tests/run.js            all tests
 *   node tests/run.js phone      only tests whose name contains "phone"
 * The clock is controlled (day, night, idle timers), and the Google script and weather service are faked.
 */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');

const ROOT = path.join(__dirname, '..');
const TZ = 'America/Los_Angeles';
const DAY = '2026-11-13T10:00:00-08:00'; // a Friday morning
const EVENING = '2026-11-13T18:00:00-08:00'; // after 16:30: the home screen shows tomorrow
const NIGHT = '2026-11-13T21:00:00-08:00';
const FILTER = process.argv[2] || '';

// ---------------------------------------------------------------- static server for the app files
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml' };
function serve() {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (p.endsWith('/')) p += 'index.html';
      const f = path.join(ROOT, path.normalize(p));
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(res);
    });
    srv.listen(0, '127.0.0.1', () => resolve(srv));
  });
}

// ---------------------------------------------------------------- helpers
class Fail extends Error {}
const ok = (cond, msg) => { if (!cond) throw new Fail(msg); };
const eq = (a, b, msg) => { if (a !== b) throw new Fail(`${msg}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); };

// Fake hourly weather (rain in the morning) so the weather tiles render.
function weatherJson() {
  const time = [], t = [], code = [], pp = [];
  const d0 = new Date(DAY);
  for (let d = -1; d < 3; d++) {
    const x = new Date(d0.getTime() + d * 864e5);
    const k = x.toISOString().slice(0, 10);
    for (let h = 0; h < 24; h++) { time.push(`${k}T${String(h).padStart(2, '0')}:00`); t.push(15 + h / 4); code.push(h < 12 ? 61 : 3); pp.push(h < 12 ? 70 : 10); }
  }
  return { hourly: { time, temperature_2m: t, apparent_temperature: t, weather_code: code, precipitation_probability: pp, uv_index: t.map(() => 3), wind_speed_10m: t.map(() => 8) } };
}

let BASE;
const ctxs = [];
async function open(browser, o = {}) {
  const ctx = await browser.newContext({
    ...(o.device ? devices[o.device] : { viewport: o.viewport || { width: 1280, height: 800 } }),
    ...(o.screen ? { screen: o.screen } : {}),
    ...(o.touch ? { hasTouch: true, isMobile: true } : {}),
    timezoneId: TZ, locale: 'fr-CA', colorScheme: o.scheme || 'dark', serviceWorkers: 'block',
  });
  ctxs.push(ctx);
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  await page.clock.install({ time: new Date(o.time || DAY) });
  await ctx.route('**/api.open-meteo.com/**', (r) => r.fulfill({ json: weatherJson() }));
  if (o.api) await ctx.route('**/fake-google/**', o.api);
  if (o.storage) await page.addInitScript((s) => { for (const [k, v] of Object.entries(s)) localStorage.setItem('fcc-' + k, JSON.stringify(v)); }, o.storage);
  if (o.setup) await page.addInitScript(o.setup);
  await page.goto(BASE + (o.url ?? '?demo'));
  await page.waitForTimeout(250);
  return page;
}
const run = async (page, ms) => { await page.clock.runFor(ms); await page.waitForTimeout(30); };
const count = (page, sel) => page.locator(sel).count();
const text = (page, sel) => page.locator(sel).first().innerText();
const visible = (page, sel) => page.locator(sel).first().isVisible();

// No horizontal page scroll, and the listed elements do not overlap each other.
async function noOverlap(page, sels, label) {
  const r = await page.evaluate((sels) => {
    const W = document.documentElement.clientWidth;
    const sw = document.scrollingElement.scrollWidth;
    const boxes = [];
    sels.forEach((s) => document.querySelectorAll(s).forEach((e) => { const b = e.getBoundingClientRect(); if (b.width && b.height) boxes.push({ s, b: { l: b.left, r: b.right, t: b.top, bo: b.bottom } }); }));
    const hits = [];
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i].b, c = boxes[j].b;
      if (a.l < c.r - 1 && c.l < a.r - 1 && a.t < c.bo - 1 && c.t < a.bo - 1) hits.push(boxes[i].s + ' × ' + boxes[j].s);
    }
    return { W, sw, hits };
  }, sels);
  ok(r.sw <= r.W + 1, `${label}: page scrolls sideways (${r.sw} > ${r.W})`);
  eq(r.hits.join(', '), '', `${label}: overlapping elements`);
}

// ---------------------------------------------------------------- tests
const T = [];
const test = (name, fn) => T.push({ name, fn });

// ----- wall tablet
test('wall: home screen shows two weeks from Sunday, today, chores, messages, weather', async (b) => {
  const p = await open(b, { url: '?demo&wall' });
  ok(await visible(p, '.page.home'), 'home page');
  eq(await count(p, '.wgrid'), 2, 'two week rows');
  ok((await text(p, '.wgrid .day .dl')).startsWith('dim.'), 'week starts on Sunday');
  ok((await text(p, '.day.focus .dl')).includes('auj.'), 'today is outlined');
  eq(await count(p, '.tasks .kid'), 2, 'chores for both kids');
  ok(await visible(p, '.msgs .msg'), 'the message is shown');
  eq(await count(p, '.wxc'), 2, 'two weather tiles');
  ok((await text(p, '.wxc .cond')).includes('Parapluie'), 'weather says what to bring');
  eq(await p.evaluate(() => document.documentElement.classList.contains('ph')), false, 'not the phone layout');
});

test('wall: evening view shows tomorrow', async (b) => {
  const p = await open(b, { url: '?demo&wall', time: EVENING });
  ok(await visible(p, '.clock .tag'), '"Vue de demain" tag');
  ok((await text(p, '.day.focus .dl')).includes('demain'), 'tomorrow is outlined');
});

for (const [w, h] of [[1280, 800], [1024, 600], [960, 552], [1366, 768]]) {
  test(`wall: nothing overlaps at ${w}×${h}`, async (b) => {
    const p = await open(b, { url: '?demo&wall', viewport: { width: w, height: h } });
    await noOverlap(p, ['.clock', '.wxc', '.cal', '.side', '.foot .legend', '.foot .nav'], `${w}×${h} home`);
    await noOverlap(p, ['.foot .legend .pc', '.foot .nav .btn', '.foot .ver'], `${w}×${h} footer`);
    const side = await p.evaluate(() => { const s = document.querySelector('.side').getBoundingClientRect(); return [...document.querySelectorAll('.side > section')].every((e) => e.getBoundingClientRect().bottom <= s.bottom + 1); });
    ok(side, 'side tiles stay inside the right column');
    const clipped = await p.evaluate(() => [...document.querySelectorAll('.dcont')].filter((d) => d.scrollHeight > d.clientHeight + 1 && !d.querySelector('.more')).length);
    eq(clipped, 0, 'days that hide events without a "+N de plus"');
  });
}

test('wall: tablet held upright keeps the wall layout without overlaps', async (b) => {
  const p = await open(b, { url: '?demo&wall', viewport: { width: 800, height: 1280 }, screen: { width: 1200, height: 1920 }, touch: true });
  eq(await p.evaluate(() => document.documentElement.classList.contains('ph')), false, 'wall layout');
  await noOverlap(p, ['.foot .legend .pc', '.foot .nav .btn'], 'upright footer');
});

test('wall: ticking a chore adds points, unticking removes them', async (b) => {
  const p = await open(b, { url: '?demo&wall' });
  const pts = () => p.locator('.tasks .kid').first().locator('.kp').innerText();
  eq(await pts(), '42 pts', 'starting points');
  const off = p.locator('.tasks [data-task$="|1"]').first();
  const label = await off.innerText();
  await off.click();
  eq(await pts(), '52 pts', 'after ticking Piano (+10)');
  await p.locator('.task', { hasText: label.split('\n')[0] }).first().click();
  eq(await pts(), '42 pts', 'after unticking');
});

test('wall: "Vu" clears the message', async (b) => {
  const p = await open(b, { url: '?demo&wall' });
  await p.click('[data-seen]');
  ok((await text(p, '.msgs')).includes('Aucun nouveau message'), 'no message left');
});

test('wall: person filter on the home screen, cleared after 1 minute', async (b) => {
  const p = await open(b, { url: '?demo&wall' });
  const before = await count(p, '.wgrid [data-ev]');
  await p.click('.legend [data-cwho="M"]');
  const whos = await p.evaluate(() => [...document.querySelectorAll('.wgrid [data-ev]')].map((e) => (S.events.find((x) => x.id === e.dataset.ev) || { who: 'Fam' }).who));
  ok(whos.length > 0 && whos.every((w) => w === 'M'), 'only the chosen person: ' + whos.join(','));
  ok(whos.length < before, 'fewer events than before');
  await run(p, 61000);
  eq(await count(p, '.legend .pc.on'), 0, 'filter cleared after a minute');
  eq(await count(p, '.wgrid [data-ev]'), before, 'all events back');
});

test('wall: tapping an event opens its details, which close by themselves', async (b) => {
  const p = await open(b, { url: '?demo&wall' });
  await p.locator('.wgrid .chip[data-ev]').first().click();
  ok(await visible(p, '.modal .det'), 'details open');
  await run(p, 21000);
  eq(await count(p, '.modal .det'), 0, 'closed after 20 s');
});

test('wall: Bientôt shows only big or fun things', async (b) => {
  const p = await open(b, { url: '?demo&wall' });
  const r = await p.evaluate(() => {
    const ev = (t, o = {}) => ({ id: 'x' + Math.random(), t, who: 'Fam', ...o });
    return {
      practice: bigEvent(ev('Entraînement soccer', { s: 1 })),
      rec: bigEvent(ev('Birthday party', { s: 1, rec: true })),
      party: bigEvent(ev("Fête d'anniversaire", { s: 1 })),
      trip: bigEvent(ev('Voyage', { sd: '2026-12-01', ed: '2026-12-05' })),
      sitter: bigEvent(ev('Babysitter Emma', { s: 1, rec: true })),
      team: bigEvent(ev('Team game vs Rebels', { sd: '2026-12-01', ed: '2026-12-02', team: true })),
      tile: [...document.querySelectorAll('.soonp .snt > span')].map((e) => e.textContent),
    };
  });
  eq(r.practice, false, 'a practice'); eq(r.rec, false, 'a repeating event'); eq(r.team, false, 'a team schedule day');
  eq(r.party, true, 'a party'); eq(r.trip, true, 'a trip'); eq(r.sitter, true, 'the babysitter');
  ok(!r.tile.some((t) => /entr|soccer|piano|tutorat/i.test(t)), 'no routine in the tile: ' + r.tile.join(' | '));
});

test('wall: weather tiles shorten school names', async (b) => {
  const p = await open(b, { url: '?demo&wall' });
  eq(await p.evaluate(() => place('Torrey Pines Elementary')), 'TPES', 'Elementary → initials');
  eq(await p.evaluate(() => place('The Language Academy')), 'Language Academy', 'drops "The"');
});

test('wall: rules screensaver after 40 s untouched, touch dismisses it', async (b) => {
  const p = await open(b, { url: '?demo&wall' });
  await run(p, 41000);
  ok(await visible(p, '#saver'), 'screensaver shown');
  eq(await count(p, '#saver .svl li'), 7, 'all 7 rules');
  await p.click('#saver');
  eq(await visible(p, '#saver'), false, 'dismissed');
});

test('wall: no screensaver while someone is on another page', async (b) => {
  const p = await open(b, { url: '?demo&wall#repas' });
  await run(p, 41000);
  eq(await visible(p, '#saver'), false, 'no screensaver');
});

test('wall: back to the home screen after 90 s untouched', async (b) => {
  const p = await open(b, { url: '?demo&wall#cal' });
  ok(await visible(p, '.calp'), 'calendar page');
  await run(p, 91000);
  ok(await visible(p, '.page.home'), 'home again');
});

test('wall: night — black screen, a tap brings the home screen until 90 s untouched', async (b) => {
  const p = await open(b, { url: '?demo&wall', time: NIGHT });
  ok(await visible(p, '#night'), 'night screen');
  await p.click('#night');
  eq(await visible(p, '#night'), false, 'home screen after a tap');
  ok(await visible(p, '.page.home'), 'home page shown');
  await run(p, 60000);
  await p.locator('.tasks [data-task]').first().click(); // someone uses it
  await run(p, 60000);
  eq(await visible(p, '#night'), false, 'still on: touched 60 s ago');
  await run(p, 31000);
  ok(await visible(p, '#night'), 'black again after 90 s untouched');
  await p.click('#night');
  eq(await visible(p, '#night'), false, 'a second tap works too');
});

test('wall: phone-sized device that opened the wall link gets the phone layout', async (b) => {
  const p = await open(b, { url: '?demo&wall', device: 'Pixel 7', storage: { me: 'Pa' } });
  eq(await p.evaluate(() => document.documentElement.classList.contains('ph')), true, 'phone layout');
  eq(await p.evaluate(() => WALL()), false, 'not the wall');
});

test('wall: ?wall=0 turns wall mode off', async (b) => {
  const p = await open(b, { url: '?demo&wall=0', time: NIGHT, storage: { wall: true } });
  eq(await visible(p, '#night'), false, 'no night screen');
});

test('computer: no night screen, no return home', async (b) => {
  const p = await open(b, { url: '?demo#cal', viewport: { width: 1440, height: 900 }, time: NIGHT });
  eq(await visible(p, '#night'), false, 'no night screen');
  await run(p, 91000);
  ok(await visible(p, '.calp'), 'stays on the calendar');
});

// ----- calendar page
test('calendar: starts this week, search, person filter, cleared when leaving', async (b) => {
  const p = await open(b, { url: '?demo&wall#cal' });
  ok((await text(p, '.wk .wl')).startsWith('Cette semaine'), 'first week is this week');
  ok((await text(p, '.wk .day .dl')).startsWith('dim.'), 'starts on Sunday');
  await p.fill('#cq', 'soccer');
  ok(/\d+ résultats?/.test(await text(p, '#calbody .hint')), 'result count');
  ok((await count(p, '.results .prow')) > 0, 'results listed');
  ok(await p.evaluate(() => document.activeElement.id === 'cq'), 'keyboard stays in the search box');
  await p.fill('#cq', 'zzzz');
  ok((await text(p, '#calbody')).includes('Rien trouvé'), 'nothing found');
  await p.fill('#cq', '');
  await p.click('.ctools [data-cwho="F"]');
  const whos = await p.evaluate(() => [...document.querySelectorAll('#calbody [data-ev]')].map((e) => (S.events.find((x) => x.id === e.dataset.ev) || { who: 'Fam' }).who));
  ok(whos.length && whos.every((w) => w === 'F'), 'only Hugo');
  await p.evaluate(() => { location.hash = ''; }); await p.waitForTimeout(50);
  await p.evaluate(() => { location.hash = 'cal'; }); await p.waitForTimeout(50);
  eq(await count(p, '.ctools .pc.on'), 0, 'filter cleared after leaving');
});

test('calendar: search clears itself after 1 minute', async (b) => {
  const p = await open(b, { url: '?demo&wall#cal' });
  await p.fill('#cq', 'piano');
  await p.locator('#cq').blur();
  await run(p, 61000);
  eq(await p.inputValue('#cq'), '', 'search emptied');
});

// ----- meals
test('repas: dish picker filters by cuisine, picks, and "Pas encore décidé" clears', async (b) => {
  const p = await open(b, { url: '?demo&wall#repas' });
  eq(await count(p, '.mrow'), 7, 'a week of dinners');
  ok((await text(p, '.mrow .md')).startsWith('dim.'), 'dinner week starts on Sunday');
  const row = p.locator('.mrow').nth(3);
  await row.locator('[data-dish]').click();
  ok(await visible(p, '.picker'), 'picker open');
  await p.click('[data-pf="cui|Asiatique"]');
  eq(await text(p, '#pcount'), '3 plats', 'three Asian dishes');
  await p.click('[data-pf="prot|Poisson"]');
  eq(await text(p, '#pcount'), '1 plat', 'Asian and fish');
  await p.click('[data-pclear]');
  await p.fill('#pq', 'kafta');
  eq(await count(p, '.picker .list [data-pick]'), 1, 'search finds one dish');
  await p.click('[data-pick="Kafta"]');
  eq(await count(p, '.picker'), 0, 'picker closed');
  ok((await row.innerText()).includes('Kafta'), 'dinner changed');
  await row.locator('[data-dish]').click();
  await p.click('[data-pnone]');
  ok((await row.innerText()).includes('À choisir'), 'dinner cleared');
});

test('repas: a kid cooking gets kid-friendly dishes first', async (b) => {
  const p = await open(b, { url: '?demo&wall#repas' });
  await p.locator('.mrow', { hasText: 'Hugo' }).locator('[data-dish]').click();
  ok(await p.locator('[data-pf="more|kid"].on').count(), '"Facile enfants" preselected');
});

test('repas: ingredients go to Cozi, kids must say who they are, a second send warns', async (b) => {
  const p = await open(b, { url: '?demo&wall#repas' });
  await p.locator('[data-czdish]').first().click();
  await p.waitForSelector('.czi');
  ok(await p.locator('.czi.off', { hasText: 'salt' }).count(), 'salt starts unticked');
  ok(await p.locator('.czi:not(.off)', { hasText: 'Chicken' }).count(), 'chicken ticked');
  await p.click('[data-czsend]');
  ok((await text(p, '#toast')).includes('votre nom'), 'asks who first');
  await p.click('[data-czwho="M"]');
  await p.click('[data-czsend]');
  eq(await count(p, '.czbox'), 0, 'sheet closes at once');
  ok((await text(p, '#toast')).includes('Cozi'), 'sending message');
  await run(p, 1000);
  ok((await text(p, '#toast')).includes('✓'), 'sent');
  ok((await text(p, '[data-czdish]')).includes('✓'), 'dinner marked as sent');
  await p.locator('[data-czdish]').first().click();
  await p.waitForSelector('.czwarn');
  ok((await text(p, '.czwarn')).includes('Déjà envoyé'), 'warns before sending twice');
});

test('repas: votes need a name and allow 3 per parent', async (b) => {
  const p = await open(b, { url: '?demo&wall#votes' });
  await p.locator('[data-vote]').first().click();
  ok((await text(p, '.whos')).includes("Touchez d'abord votre nom"), 'asks who votes');
  await p.click('[data-voter="Pa"]'); // Papa has no vote yet in the first group
  const tiles = p.locator('.grp').first().locator('[data-vote]');
  for (let i = 0; i < 4; i++) await tiles.nth(i).click();
  ok((await text(p, '.whos')).includes('Maximum 3'), 'limit of 3');
  ok((await text(p, '.grp .gc')).includes('3/3'), 'count shows 3/3');
});

// ----- groceries, chores, rules, contacts, voice
test('courses: typed items go to Cozi, kept when switching store', async (b) => {
  const p = await open(b, { url: '?demo&wall' });
  await p.click('.foot [data-cz]');
  await p.fill('#czq', 'lait, pain');
  await p.click('[data-czadd]');
  eq(await count(p, '.czi'), 2, 'two items from one line');
  await p.fill('#czq', 'beurre');
  await p.click('[data-czstore="Costco"]');
  eq(await p.inputValue('#czq'), 'beurre', 'typed text kept');
  await p.click('[data-czwho="F"]');
  await p.click('[data-czsend]');
  await run(p, 1000);
  ok((await text(p, '#toast')).includes('Costco'), 'sent to Costco');
});

test('tâches: week grid starts on Sunday, rewards listed', async (b) => {
  const p = await open(b, { url: '?demo&wall#taches' });
  eq(await text(p, '.grid7 .h'), 'dim.', 'Sunday first');
  ok((await count(p, '.reward')) >= 3, 'rewards');
});

test('règles and contacts pages', async (b) => {
  const p = await open(b, { url: '?demo&wall#regles' });
  eq(await count(p, '.rl'), 7, 'seven rules');
  await p.evaluate(() => { location.hash = 'contacts'; }); await p.waitForTimeout(50);
  eq(await count(p, '.contact'), 6, 'six contacts');
  eq(await count(p, '.contact.urgent'), 2, 'two emergency numbers');
});

test('voice page says who gets the message', async (b) => {
  const p = await open(b, { url: '?demo&wall#voix' });
  ok(await visible(p, '.vbtn'), 'record button');
  ok((await text(p, '.vcard')).includes('Papa'), 'names who gets it');
});

test('text boxes keep the keyboard open when the screen shrinks', async (b) => {
  const p = await open(b, { url: '?demo&wall#cal', viewport: { width: 1100, height: 640 }, touch: true, setup: () => { Element.prototype.requestFullscreen = () => Promise.resolve(); } });
  await p.tap('#cq');
  await p.setViewportSize({ width: 1100, height: 340 }); await p.waitForTimeout(100);
  await p.keyboard.type('la');
  eq(await p.inputValue('#cq'), 'la', 'typing still works');
});

// ----- phone
test('phone: asks who you are once, then the parents home', async (b) => {
  const p = await open(b, { device: 'Pixel 7' });
  ok(await visible(p, '.pwho'), 'who are you?');
  await p.click('[data-me="Ma"]');
  ok((await text(p, '.pgreet')).includes('Maman'), 'greets Maman');
  eq(await count(p, '.pnav a'), 5, 'five tabs');
  await p.reload(); await p.waitForTimeout(200);
  ok(await visible(p, '.pgreet'), 'remembered after reload');
});

for (const scheme of ['light', 'dark']) {
  test(`phone (${scheme}): every tab fits the screen`, async (b) => {
    const p = await open(b, { device: 'Pixel 7', scheme, storage: { me: 'Pa' } });
    for (const h of ['', 'cal', 'repas', 'votes', 'taches', 'regles', 'contacts']) {
      await p.evaluate((h) => { location.hash = h; }, h); await p.waitForTimeout(80);
      await noOverlap(p, ['.pnav'], `phone #${h}`);
    }
  });
}

test('phone: message to the wall, install card can be hidden', async (b) => {
  const p = await open(b, { device: 'Pixel 7', storage: { me: 'Pa' } });
  await p.fill('#msg', 'Piano annulé');
  await p.click('.seg [data-to="Hugo"]');
  await p.click('[data-send]');
  ok((await text(p, '#toast')).includes('Envoyé au mur'), 'confirmation');
  ok(await p.evaluate(() => S.messages.some((m) => m.text === 'Piano annulé' && m.to === 'Hugo')), 'message stored');
  ok(await visible(p, '.pinst'), 'install card');
  await p.click('[data-noinstall]');
  eq(await count(p, '.pinst'), 0, 'install card hidden');
  await p.reload(); await p.waitForTimeout(200);
  eq(await count(p, '.pinst'), 0, 'stays hidden');
});

test('phone: agenda tab has search and a Google Agenda button', async (b) => {
  const p = await open(b, { device: 'Pixel 7', storage: { me: 'Pa' } });
  await p.click('.pnav a[href="#cal"]');
  await p.waitForSelector('.calp');
  ok(await visible(p, '.gcal'), 'Google Agenda button');
  await p.fill('#cq', 'piano');
  ok((await count(p, '.results .prow')) > 0, 'results');
});

test('phone: a parent changes who cooks, the wall does not offer it', async (b) => {
  const posts = [];
  const p = await open(b, { device: 'Pixel 7', storage: { me: 'Pa' }, url: '?demo#repas' });
  const row = p.locator('.mrow:not(.past)').last();
  const before = await row.locator('.mc').innerText();
  await row.locator('[data-cook]').click();
  ok(await visible(p, '.cookl'), 'cook choices');
  eq(await count(p, '.cookl [data-setcook]'), 4, 'four people');
  const other = (await p.locator('.cookl [data-setcook]:not(.on)').first().getAttribute('data-setcook'));
  await p.click(`.cookl [data-setcook="${other}"]`);
  ok((await row.locator('.mc').innerText()).includes(other), `now ${other} (was ${before})`);
  ok((await text(p, '#toast')).includes('Cuisinier'), 'confirmation');
  const w = await open(b, { url: '?demo&wall#repas' });
  eq(await count(w, '[data-cook]'), 0, 'not on the wall');
});

test('épicerie: named Épicerie on the wall and the phone', async (b) => {
  const w = await open(b, { url: '?demo&wall' });
  ok((await text(w, '.foot [data-cz]')).includes('Épicerie'), 'wall button');
  await w.click('.foot [data-cz]');
  eq(await text(w, '.czbox .pk-t'), 'Épicerie', 'sheet title');
  const p = await open(b, { device: 'Pixel 7', storage: { me: 'Ma' } });
  ok((await text(p, '.pnav [data-cz]')).includes('Épicerie'), 'phone tab');
});

test('wall: footer buttons in order, Tâches after Calendrier', async (b) => {
  const p = await open(b, { url: '?demo&wall' });
  const labels = (await p.locator('.foot .nav .btn').allInnerTexts()).map((x) => x.trim());
  eq(labels.join(' · '), 'Calendrier · Tâches · Repas · Épicerie · Règles · Contacts', 'buttons');
  await p.click('.foot a[href="#taches"]');
  await p.waitForTimeout(100);
  const r = await p.evaluate(() => location.hash + ' ' + !!document.querySelector('.grid7'));
  eq(r, '#taches true', 'opens Tâches');
});

test('phone: Épicerie tab opens the Cozi sheet without asking who', async (b) => {
  const p = await open(b, { device: 'Pixel 7', storage: { me: 'Pa' } });
  await p.click('.pnav [data-cz]');
  ok(await visible(p, '.czbox'), 'sheet open');
  eq(await count(p, '[data-czwho]'), 0, 'no who buttons on a parent phone');
});

test('phone: held sideways keeps the phone layout', async (b) => {
  const p = await open(b, { device: 'Pixel 7 landscape', storage: { me: 'Pa' } });
  eq(await p.evaluate(() => document.documentElement.classList.contains('ph')), true, 'phone layout');
});

// ----- real mode against a fake Google script
// The sample family, built at the test clock's date, served as if it came from the Google script.
const STATE = () => {
  const now = new Date(DAY).getTime();
  class FixedDate extends Date { constructor(...a) { if (a.length) super(...a); else super(now); } static now() { return now; } }
  const sb = { window: {}, Date: FixedDate };
  require('vm').runInNewContext(fs.readFileSync(path.join(ROOT, 'demo.js'), 'utf8'), sb);
  return JSON.parse(JSON.stringify(sb.window.FCC_DEMO()));
};
function fakeGoogle(state, posts) {
  return (route) => {
    const req = route.request();
    if (req.method() === 'POST') { posts.push(JSON.parse(req.postData())); return route.fulfill({ json: { ok: true, added: [{ list: 'Aldi', n: 1 }] } }); }
    return route.fulfill({ json: typeof state === 'function' ? state() : state });
  };
}
const REAL = { key: 'testkey', api: 'http://127.0.0.1:1/fake-google/exec' };

test('family link: loads the family data and sends taps to Google', async (b) => {
  const posts = [];
  const p = await open(b, { url: '?wall', storage: REAL, api: fakeGoogle(STATE, posts) });
  await p.waitForSelector('.page.home');
  ok(!(await text(p, '.ver')).includes('démo'), 'not the sample data');
  await p.locator('.tasks [data-task$="|1"]').first().click();
  await p.waitForTimeout(300);
  ok(posts.some((x) => x.a === 'task' && x.k === 'testkey'), 'chore sent to Google with the key');
});

test('family link: a wrong key says so', async (b) => {
  const p = await open(b, { url: '', storage: REAL, api: (r) => r.fulfill({ json: { error: 'key' } }) });
  await p.waitForTimeout(300);
  const shown = await text(p, '#app');
  ok(shown.includes('Lien invalide'), 'clear message, got: ' + shown);
});

test('family link: offline, the last data still shows and taps wait', async (b) => {
  const posts = [];
  let online = true;
  const p = await open(b, { url: '?wall', storage: REAL, api: (r) => (online ? fakeGoogle(STATE, posts)(r) : r.abort()) });
  await p.waitForSelector('.page.home');
  online = false;
  await p.reload(); await p.waitForTimeout(300);
  ok(await visible(p, '.page.home'), 'saved screen shown offline');
  await p.click('[data-seen]');
  eq(await p.evaluate(() => JSON.parse(localStorage.getItem('fcc-outbox')).length), 1, 'tap kept for later');
  online = true;
  await p.evaluate(() => dispatchEvent(new Event('online')));
  for (let i = 0; i < 20 && !posts.some((x) => x.a === 'seen'); i++) await p.waitForTimeout(100);
  ok(posts.some((x) => x.a === 'seen'), 'sent when back online');
});

test('family link: older or broken data never blanks the screen', async (b) => {
  const s = STATE();
  s.recipes = ['Kafta', 'Tacos']; // old format
  delete s.vote; s.weather = null; s.chores = { tasks: [] }; s.events.push({ t: 'No date' }); s.sent = undefined;
  const p = await open(b, { url: '?wall#repas', storage: REAL, api: fakeGoogle(s, []) });
  await p.waitForSelector('.mrow');
  await p.locator('[data-dish]').first().click();
  eq(await count(p, '.picker .list [data-pick]'), 2, 'old recipes listed');
  await p.evaluate(() => { location.hash = 'votes'; }); await p.waitForTimeout(50);
  ok((await text(p, '#app')).includes('Pas de vote'), 'no vote in progress');
  await p.evaluate(() => { location.hash = ''; }); await p.waitForTimeout(50);
  ok(await visible(p, '.page.home'), 'home still drawn');
});

// ----- files
test('release files: versions match, every app file exists', async () => {
  const v = (f, re) => (fs.readFileSync(path.join(ROOT, f), 'utf8').match(re) || [])[1];
  const app = v('app.js', /const VERSION = '([^']+)'/), sw = v('sw.js', /const VERSION = '([^']+)'/);
  eq(sw, app, 'sw.js version = app.js version');
  ok(fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8').includes(`v${app} ↻`), 'README shows the version');
  const shell = JSON.parse(v('sw.js', /const SHELL = (\[[^\]]+\])/).replace(/'/g, '"'));
  shell.filter((f) => f !== './').forEach((f) => ok(fs.existsSync(path.join(ROOT, f)), 'missing ' + f));
  JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.webmanifest'), 'utf8'));
  const pub = ['app.js', 'app.css', 'index.html', 'demo.js', 'README.md', 'config.js'].map((f) => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n');
  ok(!/[?&]k=[0-9a-f]{16,}/i.test(pub) && !/@gmail\.com/i.test(pub), 'no family link key or email in the public files');
});

// ---------------------------------------------------------------- runner
(async () => {
  const srv = await serve();
  BASE = `http://127.0.0.1:${srv.address().port}/`;
  REAL.api = BASE + 'fake-google/exec';
  const browser = await chromium.launch();
  let pass = 0; const fails = [];
  for (const t of T.filter((x) => x.name.includes(FILTER))) {
    try {
      await t.fn(browser);
      const errs = (await Promise.all(ctxs.map((c) => c.pages()))).flat().flatMap((pg) => pg.errors || []);
      if (errs.length) throw new Fail('JavaScript error: ' + errs[0]);
      pass++; console.log('  ✓ ' + t.name);
    } catch (e) {
      fails.push(t.name); console.log('  ✗ ' + t.name + '\n      ' + (e instanceof Fail ? e.message : e.stack.split('\n').slice(0, 3).join('\n      ')));
    }
    await Promise.all(ctxs.splice(0).map((c) => c.close()));
  }
  await browser.close(); srv.close();
  console.log(`\n${pass} passed, ${fails.length} failed`);
  process.exit(fails.length ? 1 : 0);
})();
