const themes = {
  explorer: { label: 'L’esprit grand départ', code: 'GO', accent: '#5546a5', dark: '#342965', soft: '#f0ecff', highlight: '#ffb382', art: 'landscape' },
  portugal: { label: 'Azulejos & soleil doré', code: 'PT', accent: '#17685e', dark: '#164a46', soft: '#e9f4ee', highlight: '#ffb480', art: 'coast' },
  nordic: { label: 'Escapade nordique', code: 'SE', accent: '#315a99', dark: '#213a69', soft: '#eaf1fc', highlight: '#ffd45c', art: 'harbor' },
  desert: { label: 'Ocre, sable & horizons', code: 'JO', accent: '#9c4f36', dark: '#673a2c', soft: '#fff0e3', highlight: '#edbd69', art: 'desert' },
  france: { label: 'Flâneries à la française', code: 'FR', accent: '#4859a0', dark: '#29386a', soft: '#edf0fe', highlight: '#f9a9ac', art: 'tower' },
  japan: { label: 'Sakura & petits détours', code: 'JP', accent: '#a03f54', dark: '#653344', soft: '#fff0f2', highlight: '#eebfc9', art: 'sakura' },
  greece: { label: 'Bleu profond & lumière', code: 'GR', accent: '#216aa7', dark: '#194b77', soft: '#e9f5fe', highlight: '#efce80', art: 'coast' },
  italy: { label: 'Une parenthèse dolce vita', code: 'IT', accent: '#387153', dark: '#28513c', soft: '#eef4e5', highlight: '#edaf83', art: 'coast' },
  spain: { label: 'Soleil & couleurs chaudes', code: 'ES', accent: '#aa4d3e', dark: '#72372f', soft: '#fff1de', highlight: '#efc658', art: 'coast' },
  london: { label: 'Balades au fil de la ville', code: 'GB', accent: '#765162', dark: '#4e3947', soft: '#f7ecf2', highlight: '#e6bb80', art: 'harbor' }
};
const key = value => String(value || '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
const countries = { portugal: 'portugal', france: 'france', suede: 'nordic', sweden: 'nordic', sverige: 'nordic', norvege: 'nordic', norvegia: 'nordic', denmark: 'nordic', danemark: 'nordic', finlande: 'nordic', jordanie: 'desert', jordan: 'desert', maroc: 'desert', morocco: 'desert', egypte: 'desert', tunisie: 'desert', japon: 'japan', japan: 'japan', grece: 'greece', greece: 'greece', italie: 'italy', italy: 'italy', espagne: 'spain', spain: 'spain', monaco: 'france', 'royaume-uni': 'london', 'united kingdom': 'london' };
const cities = [
  ['portugal', /lisbonne|lisboa/, 'Lisbonne & les détours portugais'],
  ['portugal', /porto/, 'Porto, au fil du Douro', { accent: '#315b8c', dark: '#23466d', soft: '#eaf2f9', highlight: '#efb579' }],
  ['portugal', /sintra/, 'Sintra, entre jardins & palais', { accent: '#6c548e', dark: '#4c3b66', soft: '#f1ecf7', highlight: '#dfb1c3' }],
  ['portugal', /cascais/, 'Cascais, l’océan en chemin', { accent: '#237f83', dark: '#175458', soft: '#e9f6f2', highlight: '#ebc587' }],
  ['nordic', /stockholm/, 'Stockholm, côté archipel'],
  ['france', /paris/, 'Paris, au gré des flâneries'],
  ['desert', /amman|petra|wadi/, 'Jordanie, entre pierre & désert'],
  ['japan', /kyoto/, 'Kyoto, au rythme des jardins'],
  ['japan', /tokyo/, 'Tokyo, énergie & petits détours', { accent: '#6553a2', dark: '#403469', soft: '#f0ecfc', highlight: '#f3b0c4' }],
  ['italy', /venise|venezia/, 'Venise, au fil des canaux', { accent: '#3b7788', dark: '#285462', soft: '#eaf4f5', highlight: '#dfb58d' }],
  ['italy', /rome|roma/, 'Rome, la douceur des ruelles', { accent: '#a05c43', dark: '#703f31', soft: '#fff0e4', highlight: '#e6b376' }]
];

export function destinationTheme(trip = {}) {
  const id = countries[key(trip.country)] || 'explorer';
  const theme = { id, ...themes[id] };
  const variants = {
    norvege: { code: 'NO', accent: '#a9434e', dark: '#283e69', soft: '#f0f3fb', highlight: '#eaa1a5', label: 'Fjords & lumière du Nord' },
    danemark: { code: 'DK', accent: '#a83d43', dark: '#682e34', soft: '#fff1ed', highlight: '#e9bd8e', label: 'Petits ports & douceur de vivre' },
    denmark: { code: 'DK' }, finlande: { code: 'FI', highlight: '#b5d5ec', label: 'Lacs & grands espaces' },
    maroc: { code: 'MA', label: 'Terre ocre & détours dans les médinas' }, morocco: { code: 'MA' }, egypte: { code: 'EG' }, tunisie: { code: 'TN' },
    monaco: { code: 'MC', accent: '#a9434a', dark: '#6e3038', soft: '#fff0ec', highlight: '#e9be9c', art: 'coast', label: 'Riviera & douceur méditerranéenne' }
  };
  Object.assign(theme, variants[key(trip.country)] || {});
  const text = key([trip.name, ...((trip.places || []).map(p => p.city))].join(' '));
  const city = cities.find(([candidate, pattern]) => candidate === id && theme.code === themes[candidate].code && pattern.test(text));
  if (city) { theme.label = city[2]; Object.assign(theme, city[3] || {}); }
  return theme;
}

export function themeStyle(theme) {
  return `--destination-accent:${theme.accent};--destination-dark:${theme.dark};--destination-soft:${theme.soft};--destination-pop:${theme.highlight}`;
}

export function themeIllustration(theme) {
  const { accent: ink, highlight: pop, soft: sky, dark } = theme;
  const house = (x, y, color, height = 70) => `<path d="M${x} ${y}v-${height}l22-20 22 20v${height}z" fill="${color}"/><path d="M${x + 9} ${y - 42}h8v13h-8zm18 0h8v13h-8z" fill="${sky}"/><path d="M${x + 17} ${y}v-22h12v22" fill="${dark}"/>`;
  let drawing;
  if (theme.art === 'desert') drawing = `<path d="M0 165Q100 105 220 173T600 145V270H0" fill="${pop}"/><path d="M0 205Q170 155 300 218T600 185V270H0" fill="${ink}" opacity=".5"/><path d="M250 210V100l50-25 50 25v110h-28v-65q-22-35-44 0v65z" fill="${dark}"/><path d="M270 104h60M268 118h64" stroke="${pop}" stroke-width="5"/>`;
  else if (theme.art === 'tower') drawing = `<path d="M285 215l25-155 25 155m-40-65h30m-36 36h42M274 215h72" stroke="${dark}" stroke-width="9" fill="none"/>${house(100, 220, pop, 65)}${house(145, 220, ink, 83)}${house(410, 220, pop, 90)}<path d="M0 222q150-35 300 5t300-4v47H0" fill="${ink}" opacity=".25"/>`;
  else if (theme.art === 'sakura') drawing = `<path d="M160 225q0-90 60-170m-40 95 95-40m-75-10-45-30" fill="none" stroke="${dark}" stroke-width="8"/>${[[217,65],[175,86],[251,105],[274,108],[188,130],[155,68]].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="21" fill="${pop}"/>`).join('')}<path d="M370 220V125h8v95m90 0v-95h8v95M350 124h145m-135-19q65 22 125 0" fill="none" stroke="${ink}" stroke-width="12"/>`;
  else if (theme.art === 'coast' || theme.art === 'harbor') drawing = `<path d="M0 206q80-14 160 0t160 0 160 0 160 0v64H0" fill="${ink}" opacity=".24"/>${house(85,200,ink,80)}${house(132,200,pop,105)}${house(179,200,dark,65)}${house(226,200,pop,85)}<path d="M420 120v90m-6-80-55 66h55zm9 13 43 53h-43z" fill="${sky}" stroke="${dark}" stroke-width="3"/><path d="M355 209h120l-20 17h-80z" fill="${ink}"/>`;
  else drawing = `<path d="M0 215l120-100 100 80 100-140 130 140 70-55 80 70v60H0" fill="${ink}" opacity=".55"/><path d="M250 250q-60-65 20-80t30-50" stroke="${pop}" fill="none" stroke-width="10" stroke-dasharray="9 9"/><circle cx="300" cy="116" r="12" fill="${pop}"/>`;
  return `<svg class="destination-art" viewBox="0 0 600 270" aria-hidden="true" focusable="false"><rect width="600" height="270" fill="${sky}"/><circle cx="450" cy="73" r="42" fill="${pop}"/><path d="M48 72q20-25 40 0h42m205-20q14-17 28 0h30" stroke="white" stroke-width="13" stroke-linecap="round" fill="none"/>${drawing}<path d="M40 242h520" stroke="${dark}" opacity=".12" stroke-width="2"/></svg>`;
}
