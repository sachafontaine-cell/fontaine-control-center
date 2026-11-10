// Sample data for ?demo — a made-up family, so the public preview shows no real people.
window.FCC_DEMO = function () {
  const pad = (n) => String(n).padStart(2, '0');
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const now = new Date();
  const mon = new Date(now); mon.setHours(0, 0, 0, 0); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
  const day = (i) => { const d = new Date(mon); d.setDate(d.getDate() + i); return d; };
  const at = (i, h, m = 0) => { const d = day(i); d.setHours(h, m, 0, 0); return d.getTime(); };
  const ev = [];
  let n = 0;
  const add = (o) => ev.push({ id: 'd' + (n++), notes: '', loc: '', rec: false, ...o });
  for (let w = 0; w < 14; w++) {
    [1, 3].forEach((dd) => {
      const i = w * 7 + dd;
      add({ t: 'Entraînement soccer Léa', who: 'M', s: at(i, 16, 30), e: at(i, 18), rec: true, loc: 'Parc municipal, 100 Main St, San Diego, CA', travel: 15, notes: 'Apporter les protège-tibias et une gourde.' });
      add({ t: 'Entraînement soccer Hugo', who: 'F', s: at(i, 17), e: at(i, 18, 15), rec: true, loc: 'Terrain sportif, 200 Oak Ave, San Diego, CA', travel: 12 });
    });
    add({ t: 'Tutorat maths Léa', who: 'M', s: at(w * 7 + 1, 17, 45), e: at(w * 7 + 1, 18, 30), rec: true });
    add({ t: 'Piano Hugo', who: 'F', s: at(w * 7 + 5, 9), e: at(w * 7 + 5, 9, 45), rec: true });
  }
  add({ t: 'Dentiste Maman', who: 'Ma', s: at(1, 12, 30), e: at(1, 13, 15) });
  add({ t: 'Match soccer Léa', who: 'M', s: at(5, 10), e: at(5, 11, 30), loc: 'Stade du quartier, 300 Pine St, San Diego, CA' });
  add({ t: "Spectacle de l'école Léa", who: 'M', s: at(10, 18), e: at(10, 19) });
  add({ t: 'Match soccer Hugo', who: 'F', s: at(12, 9), e: at(12, 10) });
  add({ t: 'Photo de classe Hugo', who: 'F', sd: ymd(day(16)), ed: ymd(day(17)) });
  add({ t: "Concert d'hiver Hugo", who: 'F', s: at(25, 18), e: at(25, 19) });
  add({ t: 'Visite des grands-parents', who: 'Fam', sd: ymd(day(30)), ed: ymd(day(34)) });
  add({ t: "Fête d'anniversaire de Léa", who: 'M', s: at(20, 14), e: at(20, 17) });
  add({ t: 'Voyage à la montagne', who: 'Fam', sd: ymd(day(38)), ed: ymd(day(41)) });
  const school = [
    { sd: ymd(day(2)), ed: ymd(day(2)), t: "Veterans Day — pas d'école" },
    { sd: ymd(day(14)), ed: ymd(day(16)), t: "Pas d'école" },
    { sd: ymd(day(17)), ed: ymd(day(18)), t: "Thanksgiving — pas d'école" },
    { sd: ymd(day(42)), ed: ymd(day(53)), t: 'Vacances de Noël' },
  ];
  const cooks = ['Papa', 'Maman', 'Papa', 'Maman', 'Papa', 'Hugo', 'Maman'];
  const dishes = ['Salmon Fried Rice', 'Butter Chicken (Instant Pot)', 'Ancho Chicken Salad', 'Swedish Meatballs (Shortcut)', 'Cantonese Fried Noodles (Crispy Chow Mein)', 'Cheesy Smoked Rib Quesadillas', 'Tom Yum Noodle Soup with Shrimp, Coconut Cream & Lime'];
  const salad = { 'Butter Chicken (Instant Pot)': 1, 'Swedish Meatballs (Shortcut)': 1, 'Cheesy Smoked Rib Quesadillas': 1 };
  const t = ymd(now);
  return {
    v: 1, now: Date.now(), events: ev, school, travelDefault: 25,
    chores: {
      tasks: [{ task: 'Ranger pour 10 minutes', who: 'M', pts: 7 }, { task: 'Piano', who: 'M', pts: 10 }, { task: 'Ranger pour 10 minutes', who: 'F', pts: 7 }, { task: 'Piano', who: 'F', pts: 10 }],
      rewards: [{ name: 'Choisir le souper', cost: 30 }, { name: 'Sortie de ton choix', cost: 100 }, { name: 'Yes Day', cost: 250 }],
      today: t, points: { M: 42, F: 35 }, week: { M: 24, F: 17 },
      done: [{ d: ymd(day(0)), who: 'M', task: 'Ranger pour 10 minutes' }, { d: ymd(day(0)), who: 'M', task: 'Piano' }, { d: ymd(day(0)), who: 'F', task: 'Ranger pour 10 minutes' }, { d: t, who: 'M', task: 'Ranger pour 10 minutes' }, { d: t, who: 'F', task: 'Piano' }],
    },
    messages: [{ id: 'm1', at: Date.now() - 95 * 60000, from: 'Maman', to: 'Hugo', text: "N'oublie pas tes protège-tibias !" }],
    menu: cooks.map((c, i) => ({ date: ymd(day(i)), cook: c, dish: dishes[i], salade: !!salad[dishes[i]] })),
    vote: {
      week: ymd(day(7)), closes: at(3, 19), kid: 'Léa',
      groups: [
        { group: 'Papa', max: 3, dishes: ['Shrimp Tacos', 'Thai Green Curry', 'Brown Butter Shrimp with Spicy Greens', 'Beef Shawarma Wrap', 'Chicken Satay Bake', 'Roasted Lemon Chicken'].map((d) => ({ dish: d, salade: d === 'Chicken Satay Bake' })) },
        { group: 'Maman', max: 3, dishes: ['Boeuf Bourguignon', 'Chicken and Rice with Roasted Nuts', 'Chili (Instant Pot)', 'Couscous Royale', 'Cassoulet (Instant Pot Style)', 'Baked Enchiladas with Yogurt & Beans'].map((d) => ({ dish: d, salade: /Bourguignon|Chicken and Rice|Cassoulet/.test(d) })) },
        { group: 'Enfant', max: 1, dishes: ['Breakfast Burritos', 'Homemade Pizza (Toppings Guide)', 'Hamburgers'].map((d) => ({ dish: d, salade: d !== 'Breakfast Burritos' })) },
      ],
      votes: { 'Thai Green Curry': ['M', 'Ma'], 'Shrimp Tacos': ['F'], 'Chicken Satay Bake': ['F', 'M'], 'Chili (Instant Pot)': ['Pa'], 'Couscous Royale': ['Ma'], 'Homemade Pizza (Toppings Guide)': ['M', 'Pa'], 'Breakfast Burritos': ['F'] },
    },
    recipes: [
      ['Ancho Chicken Salad', 'Poulet', 'Mexicain', 'Salade, Rapide', 3], ['Beef Shawarma Wrap', 'Bœuf', 'Libanais', 'Sandwich', 20], ['Boeuf Bourguignon', 'Bœuf', 'Français', 'Mijoté', 45],
      ['Butter Chicken (Instant Pot)', 'Poulet', 'Indien', 'Instant Pot, Mijoté', 12], ['Chili (Instant Pot)', 'Bœuf', 'Américain', 'Instant Pot, Mijoté', 0], ['Couscous Royale', 'Autre', 'Méditerranéen', 'Mijoté', 60],
      ['Frittatas', 'Sans viande', 'Italien', 'Four, Rapide', 0, 1], ['Homemade Pizza (Toppings Guide)', 'Autre', 'Italien', 'Four', 9, 1], ['Kafta', 'Bœuf', 'Libanais', 'Grill', 30],
      ['Salmon Fried Rice', 'Poisson', 'Asiatique', 'Riz, Rapide', 7], ['Shrimp Tacos', 'Poisson', 'Mexicain', 'Rapide', 0, 1], ['Thai Green Curry', 'Poulet', 'Asiatique', 'Mijoté', 25],
      ['Pad Kra Pao (Pork and Thai Basil Stir-fry)', 'Porc', 'Asiatique', 'Rapide', 40], ['Lentil Soup', 'Sans viande', 'Libanais', 'Soupe', 15], ['Hamburgers', 'Bœuf', 'Américain', 'Grill', 5, 1],
    ].map(([t, prot, cui, style, a, kid]) => ({ t, prot, cui, style: style.split(', '), kid: !!kid, salade: false, last: a ? ymd(day(-a)) : '', n: a ? 1 + (a % 4) : 0 })),
    rules: [
      { t: 'On parle avec respect', d: "Pas de cris, pas d'insultes." },
      { t: 'On aime soi-même et les autres', d: 'Encouragements, entraide, gentillesse.' },
      { t: 'On range après soi', d: 'Jouets, chambre, projets.' },
      { t: 'On aide à la maison', d: 'Mettre et desservir la table, « comment je peux aider ? ».' },
      { t: "On respecte le temps d'écran", d: 'Utiliser ses minutes gagnées.' },
      { t: 'On fait son travail/devoir avant de jouer', d: 'Avant les écrans, les récompenses.' },
      { t: 'On participe aux repas en famille', d: 'On partage, on mange le plat préparé, on attend que les autres terminent.' },
    ],
    contacts: [
      { name: 'Emergency', role: 'Police, fire, ambulance', phone: '911', kind: 'urgent' },
      { name: 'Poison Control', role: 'If someone swallowed something', phone: '1-800-222-1222', kind: 'urgent' },
      { name: 'Dad', role: 'Parent', phone: '555-0100', kind: 'parent' },
      { name: 'Mom', role: 'Parent', phone: '555-0101', kind: 'parent' },
      { name: 'Neighbor', role: 'Trusted neighbor', phone: '555-0102', kind: 'help' },
      { name: 'Vet', role: 'Animal clinic', phone: '555-0103', kind: 'help' },
    ],
    voiceTo: 'Papa', weather: [{ who: 'M', label: 'École A', lat: 32.85, lon: -117.2 }, { who: 'F', label: 'École B', lat: 32.75, lon: -117.1 }],
    people: { M: 'Léa', F: 'Hugo', Pa: 'Papa', Ma: 'Maman' },
  };
};
