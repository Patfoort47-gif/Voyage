import { CloudUI } from './cloud-ui.js';
import { MapsImport } from './maps-import-ui.js';
import { DayGroups } from './day-groups-ui.js';
import { tripTemplates, templateOrganizer } from './trip-templates.js';
import { setupPWA } from './pwa.js';
import { workspaceBackup, readBackup, prepareImportedBackup, itineraryCopy, downloadFile } from './backups.js';
import { tripInsights, stepTracker, taskList } from './trip-insights.js';
import { routeSnapshot } from './offline-routes.js';
import { documentFile, deleteUnusedDocument } from './travel-files.js';
import { Organizer, travelPages } from './organizer.js';
import { flagMarkup } from './country-flags.js';
import { destinationTheme, themeStyle, themeIllustration } from './destination-theme.js';
import { prepareDescription } from './descriptions.js';
import { TripMap } from './trip-map.js';
import { findPlaceArticles, automaticArticle, wikipediaLink } from './place-info.js';
import { findFreePlaces, computeFreeDay, formatFreeRoute, readServices, serviceURL, reverseFreePlace } from './free-maps.js';
import { createTrip, loadTrips, persistTrips, formatTripCreatedAt, remainingPlaces, updateTripPlace, routeSignature } from './trips.js';
import { coordinates, fromURL, importPlaces, planTrip, mapsLinks, savedMapsURL, demo } from './core.js';

const $ = s => document.querySelector(s);
const key = 'voyage.places.v1';
// Retire les anciens réglages payants sans toucher aux voyages sauvegardés.
try { localStorage.removeItem('voyage.maps.provider'); sessionStorage.removeItem('voyage.google.session'); } catch {}
$('#hero-art').innerHTML = themeIllustration(destinationTheme({ country: 'Portugal' }));
$('#global-notices').append($('#notice'));
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
let places = [];
let placeStorageReadable = true;
let trips = [];
let tripStorageReadable = true;
let pendingTemplate=null;
try{const value=JSON.parse(localStorage.getItem('voyage.template-draft.v1')||'null');if(value&&tripTemplates[value.profile]&&typeof value.country==='string'&&Number.isInteger(value.days)&&value.days>=1&&value.days<=30&&Number.isFinite(value.dailyLimit)&&value.dailyLimit>=0)pendingTemplate=value;}catch{}
let editingPlaces = [];
let currentRecord = null;
let cloudUI=null,applyingCloud=false;
const tripMap = new TripMap();
const organizer = new Organizer($('#trip-organizer-page'), {
  getTrip: id => trips.find(t => t.id === id),
  canEdit:id=>!sharedReadOnly(id),
  saveTrip: updated => {
    storeTrips(trips.map(t => t.id === updated.id ? updated : t));
    if (currentRecord?.id === updated.id) currentRecord = updated;
  }
});
let mapReady = Promise.resolve();
let articleOptions = [], articleSource = '', articleGeneration = 0;
let routeGeneration = 0;
const routeCache = new Map();
let displayedRouteKey = '', activeRouteKey = '';
const routeKeyFor = record => JSON.stringify([routeSignature(record), readServices()[record.mode]]);
let resolveQueue = [], resolveOptions = [], resolveTripId = null, resolveGeneration = 0;
let searchContext = { country: '', city: '' };
try { const saved = JSON.parse(localStorage.getItem('voyage.search.context') || '{}'); searchContext = { country: String(saved.country || ''), city: String(saved.city || '') }; } catch {}
let missingWorkflow = false;
let missingSkipped = new Set();
function notice(message) { $('#notice').textContent = message; }
try {
  const saved = JSON.parse(localStorage.getItem(key) || '[]');
  if (!Array.isArray(saved)) throw new Error();
  places = saved.filter(p => p && typeof p.name === 'string').map(p => ({ ...p, id: p.id || crypto.randomUUID(), country: String(p.country || ''), category: String(p.category || 'À visiter'), selected: p.selected !== false }));
} catch { placeStorageReadable=false;notice('Le carnet enregistré n’a pas pu être chargé. Vous pouvez importer une sauvegarde.'); }

try { trips = loadTrips(localStorage); }
catch { tripStorageReadable = false; notice('Les voyages enregistrés ne peuvent pas être lus. Leur sauvegarde est préservée ; vérifiez que le stockage du navigateur est accessible.'); }

function storeTrips(next) {
  if(!applyingCloud)cloudUI?.cloud.readOnlyGuard(next);
  const previous=trips;
  if (!tripStorageReadable) throw new Error('La sauvegarde des voyages est inaccessible. Rechargez la page après avoir vérifié le stockage du navigateur.');
  if(!applyingCloud)try{cloudUI?.cloud.changed(next,previous);}catch{notice('Synchronisation en attente : vérifiez le stockage du navigateur.');}
  try { persistTrips(localStorage, next); }
  catch { throw new Error('Impossible de sauvegarder les voyages dans ce navigateur. Libérez de l’espace ou autorisez le stockage du site. Aucune modification des voyages n’a été enregistrée.'); }
  trips = next;
  renderTrips();
  renderMissing();
}

function save() {
  try { localStorage.setItem(key, JSON.stringify(places)); }
  catch { notice('Le navigateur ne peut pas sauvegarder vos lieux. Exportez-les avant de fermer cette page.'); }
  $('#results').hidden = true;
  render();
}
const unique = field => [...new Set(places.map(p => p[field]).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));
const option = value => `<option value="${escape(value)}">${escape(value)}</option>`;
function filtered() {
  const search = $('#search').value.toLocaleLowerCase('fr');
  return places.filter(p => (!$('#category').value || p.category === $('#category').value) && `${p.name} ${p.country} ${p.category} ${p.tags || ''} ${p.note || ''}`.toLocaleLowerCase('fr').includes(search));
}
function candidates() { return places.filter(p => p.selected && p.country === $('#country').value); }
function renderStart() {
  const value = $('#start').value;
  $('#start').innerHTML = '<option value="">Premier lieu de la sélection</option>' + candidates().map(p => `<option value="${escape(p.id)}">${escape(p.name)}</option>`).join('');
  if ([...$('#start').options].some(o => o.value === value)) $('#start').value = value;
}
function render() {
  const country = $('#country').value, category = $('#category').value;
  $('#country').innerHTML = unique('country').map(option).join('') || '<option value="">Ajoutez d’abord un lieu avec un pays</option>';
  if (unique('country').includes(country)) $('#country').value = country;
  $('#category').innerHTML = '<option value="">Toutes les catégories</option>' + unique('category').map(option).join('');
  if (unique('category').includes(category)) $('#category').value = category;
  $('#countries').innerHTML = unique('country').map(option).join('');
  $('#categories').innerHTML = unique('category').map(option).join('');
  $('#place-count').textContent = places.length;
  const selected = places.filter(p => p.selected).length;
  $('#selection-count').textContent = `${selected} lieu${selected > 1 ? 'x' : ''} sélectionné${selected > 1 ? 's' : ''}`;
  $('#missing-summary').textContent = places.length ? `${places.filter(p => !p.country).length} lieu(x) sans pays · ${places.filter(p => !coordinates(p.lat, p.lng)).length} sans coordonnées. Cochez les lieux d’un même pays pour leur attribuer ce pays ensemble.` : '';
  $('#bulk-country-form').hidden = !places.length;
  $('#empty').hidden = places.length > 0;
  $('#export').disabled = !places.length;
  const visible = filtered();
  $('#delete-visible').disabled = !visible.length;
  $('#delete-visible').textContent = `Supprimer tous les lieux affichés (${visible.length})`;
  $('#places').innerHTML = visible.map(p => `<div class="place"><input type="checkbox" data-select="${escape(p.id)}" aria-label="Sélectionner ${escape(p.name)}" ${p.selected ? 'checked' : ''}><div class="place-icon" aria-hidden="true">${p.category === 'Nature' ? '♧' : '⌁'}</div><div class="place-info"><strong>${escape(p.name)}</strong><p>${escape(p.country || 'Pays à compléter')} · ${escape(p.category)}</p>${!coordinates(p.lat, p.lng) ? '<p class="missing">Sans coordonnées · répartition dans l’ordre disponible</p>' : ''}${p.tags ? `<p>Tags : ${escape(p.tags)}</p>` : ''}${p.note ? `<p class="place-note">${escape(p.note)}</p>` : ''}${savedMapsURL(p.url) ? `<a class="place-link" href="${escape(savedMapsURL(p.url))}" target="_blank" rel="noopener noreferrer">Voir le lieu dans Google Maps →</a>` : ''}</div><div class="place-actions"><button class="quiet" data-locate="${escape(p.id)}">Retrouver le lieu</button><button class="quiet" data-edit="${escape(p.id)}">Modifier</button><button class="quiet" data-delete="${escape(p.id)}" aria-label="Supprimer ${escape(p.name)}">✕</button></div></div>`).join('') || (places.length ? '<p class="muted">Aucun lieu ne correspond à cette recherche.</p>' : '');
  renderStart();
  renderMissing();
}

$('#search').addEventListener('input', render);
$('#category').addEventListener('change', render);
$('#country').addEventListener('change', () => { $('#results').hidden = true; renderStart(); });
for (const id of ['days', 'mode', 'start', 'file-order']) $(`#${id}`).addEventListener('change', () => { $('#results').hidden = true; });
$('#bulk-country-form').addEventListener('submit', e => {
  e.preventDefault();
  let country = $('#bulk-country').value.trim();
  if (!country) return;
  country = unique('country').find(c => c.toLocaleLowerCase('fr') === country.toLocaleLowerCase('fr')) || country;
  const selected = filtered().filter(p => p.selected);
  if (!selected.length) { notice('Cochez au moins un lieu dans cette vue.'); return; }
  const replacements = selected.filter(p => p.country && p.country !== country);
  if (replacements.length && !confirm(`Remplacer le pays de ${replacements.length} lieu(x) déjà renseigné(s) par « ${country} » ?`)) return;
  selected.forEach(p => { p.country = country; }); save();
  $('#country').value = country; renderStart();
  notice(`Pays « ${country} » attribué à ${selected.length} lieu(x). Les lieux masqués par les filtres n’ont pas été modifiés.`);
});
$('#select-all').addEventListener('click', () => {
  const visible = filtered(); const selected = !visible.every(p => p.selected);
  visible.forEach(p => { p.selected = selected; }); save();
});
$('#delete-visible').addEventListener('click', () => {
  const visible = filtered();
  if (!visible.length || !confirm(`Supprimer les ${visible.length} lieu(x) affichés du carnet, cochés ou non ? Les lieux masqués et les voyages sauvegardés seront conservés.`)) return;
  const ids = new Set(visible.map(p => p.id));
  places = places.filter(p => !ids.has(p.id));
  save(); notice(`${visible.length} lieu(x) supprimé(s) du carnet. Vos voyages sauvegardés sont conservés.`);
});
$('#places').addEventListener('change', e => {
  const p = places.find(p => p.id === e.target.dataset.select);
  if (p) { p.selected = e.target.checked; save(); }
});
$('#places').addEventListener('click', e => {
  const locate = e.target.closest('[data-locate]');
  if (locate) beginResolve([places.find(p => p.id === locate.dataset.locate)]);
  const edit = e.target.closest('[data-edit]'), remove = e.target.closest('[data-delete]');
  if (edit) openPlace(places.find(p => p.id === edit.dataset.edit));
  if (remove) {
    const p = places.find(p => p.id === remove.dataset.delete);
    if (p && confirm(`Supprimer « ${p.name} » de ce carnet ?`)) { places = places.filter(q => q.id !== p.id); save(); }
  }
});
function formCountryCode(country) {
  const old = $('#place-form').dataset.contextCountry;
  return old === country.trim() ? $('#place-form').dataset.countryCode || '' : '';
}
function openPlace(p, tripId = null) {
  const form = $('#place-form'); form.reset();
  for (const field of ['id', 'name', 'country', 'category', 'url', 'lat', 'lng', 'note', 'tags', 'description', 'address', 'practicalInfo', 'city', 'localName']) form.elements[field].value = p?.[field] ?? (field === 'category' ? 'À visiter' : '');
  form.elements.tripId.value = tripId || '';
  articleGeneration++; articleOptions = []; articleSource = p?.descriptionSource || '';
  $('#wiki-query').value = p?.localName || p?.name || '';
  $('#wiki-language').value = 'auto';
  $('#place-form').dataset.countryCode = p?.countryCode || '';
  $('#place-form').dataset.contextCountry = p?.country || '';
  $('#wiki-options').innerHTML = ''; $('#wiki-status').textContent = ''; $('#place-editor-error').textContent = '';
  $('#wiki-details').open = false;
  $('#place-dialog-title').textContent = tripId ? 'Modifier ce lieu du voyage' : p ? 'Modifier le lieu' : 'Ajouter un lieu';
  $('#place-dialog').showModal();
}
$('#add').addEventListener('click', () => openPlace());
document.querySelectorAll('.close').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));
$('#place-form').addEventListener('submit', e => {
  e.preventDefault();
  const fields = Object.fromEntries(new FormData(e.target));
  const name = fields.name.trim(), country = fields.country.trim();
  if (!name || !country) { alert('Indiquez un nom de lieu et un pays.'); return; }
  const point = coordinates(fields.lat, fields.lng) || fromURL(fields.url);
  if ((fields.lat !== '' || fields.lng !== '') && !coordinates(fields.lat, fields.lng)) { alert('Renseignez une latitude et une longitude valides.'); return; }
  const normalize = (value, field) => unique(field).find(v => v.toLocaleLowerCase('fr') === value.toLocaleLowerCase('fr')) || value;
  const trip = fields.tripId ? trips.find(t => t.id === fields.tripId) : null;
  const old = (trip?.places || places).find(p => p.id === fields.id);
  const p = { ...old, id: old?.id || crypto.randomUUID(), name, country: normalize(country, 'country'), category: normalize(fields.category.trim() || 'À visiter', 'category'), url: fields.url, note: fields.note, tags: fields.tags.trim(), description: fields.description.trim(), address: fields.address.trim(), practicalInfo: fields.practicalInfo.trim(), city: fields.city.trim(), localName: fields.localName.trim(), countryCode: formCountryCode(fields.country), descriptionSource: articleSource, selected: old?.selected ?? true, ...(old?.googlePlaceId && point?.lat === old.lat && point?.lng === old.lng ? { googlePlaceId: old.googlePlaceId } : {}), ...(point || { lat: null, lng: null }) };
  if (old && (old.lat !== p.lat || old.lng !== p.lng || old.url !== p.url)) p.googlePlaceId = '';
  if (fields.tripId) {
    try {
      if (!trip) throw new Error('Ce voyage a été supprimé.');
      const updated = updateTripPlace(trip, fields.id, p);
      storeTrips(trips.map(t => t.id === trip.id ? updated : t));
      $('#place-dialog').close(); showTrip(updated); notice('Le lieu est enregistré. Les trajets sont conservés si sa localisation n’a pas changé.');
    } catch (error) { $('#place-editor-error').textContent = error.message; }
    return;
  }
  if (old) places[places.indexOf(old)] = p; else places.push(p);
  $('#place-dialog').close(); notice(''); save();
});
$('#import-open').addEventListener('click', () => $('#import-dialog').showModal());
$('#import-form').addEventListener('submit', async e => {
  e.preventDefault(); const form = e.target, file = form.elements.file.files[0];
  const button = form.querySelector('button.primary'); button.disabled = true;
  try {
    if (!file || file.size > 5 * 1024 * 1024) throw new Error('Choisissez un fichier de moins de 5 Mo.');
    const category = form.elements.category.value.trim() || file.name.replace(/\.(csv|geojson|json)$/i, '') || 'À visiter';
    const imported = importPlaces(await file.text(), file.name, form.elements.country.value.trim(), category);
    const identity = p => JSON.stringify([p.category.toLocaleLowerCase('fr'), p.url || [p.name.toLocaleLowerCase('fr'), p.country.toLocaleLowerCase('fr'), p.lat, p.lng]]);
    const known = new Set(places.map(identity)); let count = 0;
    for (const p of imported) {
      if (!known.has(identity(p))) { places.push({ ...p, id: crypto.randomUUID(), selected: true }); known.add(identity(p)); count++; }
    }
    $('#import-dialog').close(); save();
    const missingCountry = imported.filter(p => !p.country).length, missingCoordinates = imported.filter(p => !coordinates(p.lat, p.lng)).length;
    notice(`${count} lieu(x) ajouté(s) dans « ${category} », ${imported.length - count} doublon(s) ignoré(s). ${missingCountry ? 'Attribuez un pays aux lieux cochés avec le champ du carnet. ' : ''}${missingCoordinates ? 'Ce fichier ne contient pas toutes les coordonnées : cochez « Répartir dans l’ordre du carnet » pour préparer vos journées sans tri géographique.' : 'Vous pouvez organiser vos étapes par proximité.'}`);
  } catch (error) { alert(`Import impossible : ${error.message}`); }
  finally { button.disabled = false; }
});
$('#demo').addEventListener('click', () => { places = structuredClone(demo); save(); notice('Exemple chargé : 10 lieux au Portugal. Choisissez votre durée et créez le parcours.'); });
function setNav(view) {
  document.querySelectorAll('[data-nav]').forEach(link => {
    const active = link.dataset.nav === view;
    if (active) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current');
  });
}
function setDestination(theme) {
  for (const field of ['accent', 'dark', 'soft', 'highlight']) document.body.style.setProperty('--destination-' + (field === 'highlight' ? 'pop' : field), theme[field]);
  document.body.dataset.destination = theme.id;
}
function showTrip(record, page = 'route', scroll = true) {
  if (!Object.hasOwn(travelPages, page)) page = 'route';
  currentRecord = record;
  const theme = destinationTheme(record);
  setDestination(theme); setNav('trips');
  $('#trips-page').hidden = true;
  $('#trip-destination-banner').innerHTML = `<div class="destination-banner" style="${themeStyle(theme)}"><div class="destination-banner-copy"><span class="destination-chip">${flagMarkup(record.country)}${escape(record.country)}</span><h2>${escape(record.name)}</h2><p>${escape(theme.label)}</p><div class="destination-pills"><span>◷ ${record.days} jours</span><span>⌁ ${record.places.length} étape${record.places.length > 1 ? 's' : ''}</span><span>${record.mode === 'walking' ? 'À pied' : 'En voiture'}</span></div></div>${themeIllustration(theme)}</div>`;
  $('#trip-tools-nav').innerHTML = Object.entries(travelPages).map(([key, label]) => `<a href="#voyage=${encodeURIComponent(record.id)}&page=${key}" ${page === key ? 'aria-current="page"' : ''}>${label}</a>`).join('');
  $('#trip-route-page').hidden = page !== 'route';
  $('#trip-organizer-page').hidden = page === 'route';
  if (page !== 'route') organizer.mount(record, page); else organizer.leave();
  const key = routeKeyFor(record);
  if (displayedRouteKey !== key) routeGeneration++;
  displayedRouteKey = key;
  if (!routeCache.has(key)) routeCache.set(key, { days: [], attempted: false, status: '' });
  const cached = routeCache.get(key);
  $('#google-routes').disabled = activeRouteKey === key;
  $('#google-routes-status').textContent = `Calcul à la demande, hors visites. Liaison depuis la veille incluse ; aucun hébergement ni retour. Source : OpenStreetMap / OSRM. Estimation sans trafic en temps réel.`;
  const trip = planTrip(record.places, record.days, record.startId, record.fileOrder, record.dayGroups);
  $('#trip-insights').innerHTML=tripInsights(record);
  $('#reset-day-groups').hidden=!record.dayGroups;
  const mode = record.mode;
    $('#result-title').textContent = record.name;
    const km = trip.days.reduce((sum, day) => sum + day.km, 0);
    $('#result-summary').textContent = `${record.places.length} lieux · ${trip.days.length} jours avec des visites · ${trip.fileOrder ? 'Ordre du carnet conservé (sauf le premier lieu si vous en avez choisi un). Aucun tri par proximité ni calcul des distances ou temps de trajet. Google Maps recherchera les étapes par nom et pays si elles n’ont pas de coordonnées : vérifiez chaque correspondance.' : `${Math.round(km)} km à vol d’oiseau entre les étapes. ${trip.grouped?'Journées par zones et ordre des étapes confirmés':'Tri par proximité et 2-opt'}${trip.kmSaved>=0.1?` : environ ${trip.kmSaved.toFixed(1)} km de détours géographiques évités`:''}. Ce tri ne minimise pas les temps routiers.`} ${trip.unusedDays ? `${trip.unusedDays} jour(s) libre(s) pour prolonger les visites ou vous reposer.` : ''} Parcours indicatif, sans hébergement ni retour au point de départ.`;
    $('#day-cards').innerHTML = trip.days.map((day, i) => {
      const hours = day.stops.length * 1.5;
      return `<article class="day-card"><span class="day-number">JOUR ${String(i + 1).padStart(2, '0')}</span><h3>${escape(day.stops[0].name)}</h3><p class="google-day-metric" data-google-day="${i}">Trajet : kilomètres et durée non calculés</p><p class="muted">${day.stops.length} visite(s) · ${trip.fileOrder ? 'ordre du carnet' : `${Math.round(day.km)} km à vol d’oiseau`}</p>${day.previous ? `<p class="small muted">Départ du lien Maps : ${escape(day.previous.name)}, dernière étape de la veille.</p>` : ''}<ol>${day.stops.map(p => `<li><strong>${escape(p.name)}</strong><small>${escape(p.category)}</small><div class="place-details">${p.description ? `<p>${escape(p.description)}</p>` : '<p class="muted small">Descriptif non renseigné. Ajoutez une fiche ou vos informations.</p>'}${wikipediaLink(p.descriptionSource) ? `<a class="place-link" href="${escape(wikipediaLink(p.descriptionSource))}" target="_blank" rel="noopener noreferrer">Source : Wikipédia · CC BY-SA →</a>` : ''}${p.address ? `<p><strong>Adresse :</strong> ${escape(p.address)}</p>` : ''}${p.practicalInfo ? `<p><strong>À savoir :</strong> ${escape(p.practicalInfo)}</p>` : ''}<p data-place-note="${escape(p.id)}" ${p.note?'':'hidden'}><strong>Vos notes :</strong> <span>${escape(p.note||'')}</span></p>${stepTracker(p)}</div><div class="place-tools"><button type="button" class="quiet" data-folder-place="${escape(p.id)}">Modifier ce lieu / informations</button><button type="button" class="quiet" data-folder-locate="${escape(p.id)}">Corriger la localisation</button></div>${savedMapsURL(p.url) ? `<a class="place-link" href="${escape(savedMapsURL(p.url))}" target="_blank" rel="noopener noreferrer">Lien Maps enregistré →</a>` : ''}</li>`).join('')}</ol><p class="small muted">Visites seules : environ ${Math.ceil(hours)} h (hypothèse : 1 h 30 par lieu). Le temps de déplacement calculé s’ajoute à ce budget.</p>${hours > 8 || day.stops.length * 1.5 > 8 ? '<p class="warning">Journée probablement trop chargée. Ajoutez des jours ou retirez des lieux, puis vérifiez les vrais trajets.</p>' : ''}${mapsLinks(day, mode).map((url, j, links) => `<a class="secondary" href="${escape(url)}" target="_blank" rel="noopener noreferrer">Ouvrir dans Maps${links.length > 1 ? ` · partie ${j + 1}` : ''} →</a>`).join('')}</article>`;
    }).join('');

  $('#results').dataset.tripId = record.id;
  $('#results').hidden = false;
  document.body.dataset.view = 'trip';
  document.title = record.name + ' — Voyage';
  const hash = '#voyage=' + encodeURIComponent(record.id) + (page === 'route' ? '' : '&page=' + page);
  if (location.hash !== hash) history.pushState(null, '', hash);
  cached.days.forEach((day, i) => { const target = document.querySelector(`[data-google-day="${i}"]`); if (target) target.textContent = day.text; });
  if (cached.status) $('#google-routes-status').textContent = cached.status;
  if (page === 'route') mapReady = tripMap.show(trip).then(() => cached.days.forEach((day, i) => { if (day.result?.geometry) tripMap.setRoute(i, day.result.geometry); }));
  if (page === 'route' && !cached.attempted && activeRouteKey !== key) restoreRouteSnapshot(record,key,routeGeneration);
  updateTripAccess();
  if(scroll)$('#results').scrollIntoView({ behavior: 'smooth' });
}
$('#plan-form').addEventListener('submit', e => {
  e.preventDefault();
  try {
    const days = Number($('#days').value), country = $('#country').value;
    const record = createTrip({ name: $('#trip-name').value.trim() || `${country} · ${days} jours`, country, days,
      mode: $('#mode').value, startId: $('#start').value, fileOrder: $('#file-order').checked, ...(pendingTemplate?{organizer:templateOrganizer(pendingTemplate.profile,pendingTemplate.startDate,pendingTemplate.dailyLimit)}:{}), places: candidates() });
    storeTrips([record, ...trips]);
    pendingTemplate=null;try{localStorage.removeItem('voyage.template-draft.v1');}catch{}$('#template-active').textContent='';
    let cleanupFailed = false;
    try {
      const remaining = remainingPlaces(places, record);
      localStorage.setItem(key, JSON.stringify(remaining)); places = remaining;
      $('#search').value = ''; $('#category').value = ''; $('#trip-name').value = '';
      render();
    } catch { cleanupFailed = true; }
    showTrip(record);
    notice(`Le voyage « ${record.name} » est sauvegardé. ${cleanupFailed ? 'Le carnet n’a pas pu être remis à zéro : vos lieux y restent pour éviter une perte de données.' : 'Les lieux inclus ont été retirés du carnet et la sélection a été remise à zéro. Les autres lieux sont conservés.'}`);
  } catch (error) { notice(error.message); $('#notice').scrollIntoView({ behavior: 'smooth', block: 'center' }); }
});
$('#day-cards').addEventListener('click', e => {
  const edit = e.target.closest('[data-folder-place]'), locate = e.target.closest('[data-folder-locate]');
  if (!currentRecord) return;
  const id = edit?.dataset.folderPlace || locate?.dataset.folderLocate;
  const p = currentRecord.places.find(p => p.id === id);
  if (p && edit) openPlace(p, currentRecord.id);
  if (p && locate) beginResolve([p], currentRecord.id);
});
function articleContext() {
  const f = $('#place-form');
  return { name: f.elements.name.value.trim(), localName: f.elements.localName.value.trim(), city: f.elements.city.value.trim(), country: f.elements.country.value.trim(), countryCode: formCountryCode(f.elements.country.value), ...coordinates(f.elements.lat.value, f.elements.lng.value) };
}
async function fillArticleContext() {
  const context = articleContext(), generation = articleGeneration;
  const found = await reverseFreePlace(context);
  if (generation !== articleGeneration) return;
  const f = $('#place-form');
  f.elements.city.value = found.city;
  // Reverse geocoding may identify a neighbouring POI: never accept its name silently.
  $('#wiki-status').textContent = `Ville proposée : ${found.city || 'inconnue'}. Nom local au point : ${found.localName || 'non disponible'} — vérifiez qu’il s’agit bien du même lieu.`;
  if (found.localName) {
    const button = document.createElement('button'); button.type = 'button'; button.className = 'secondary'; button.textContent = `Utiliser le nom local « ${found.localName} »`;
    button.addEventListener('click', () => { f.elements.localName.value = found.localName; $('#wiki-query').value = found.localName; button.remove(); });
    $('#wiki-status').append(document.createElement('br'), button);
  }
}
$('#wiki-locate-context').addEventListener('click', async () => {
  try { $('#wiki-status').textContent = 'Recherche de la ville et du nom local…'; await fillArticleContext(); }
  catch (error) { $('#wiki-status').textContent = error.message; }
});
$('#place-form').elements.localName.addEventListener('input', e => { $('#wiki-query').value = e.target.value.trim() || $('#place-form').elements.name.value; });
$('#wiki-search').addEventListener('click', async () => {
  const generation = ++articleGeneration;
  $('#wiki-status').textContent = 'Recherche de fiches Wikipédia…'; $('#wiki-options').innerHTML = '';
  try {
    let context = articleContext();
    context.localName = context.localName || $('#wiki-query').value.trim();
    const prepared = $('#wiki-language').value === 'auto' ? await prepareDescription(context) : null;
    if (prepared) {
      context = prepared.context;
      const f = $('#place-form'); f.elements.city.value = context.city || ''; f.elements.localName.value = context.localName || '';
      $('#wiki-query').value = context.localName || context.name;
      if (!f.elements.country.value) f.elements.country.value = context.country || '';
    }
    const options = prepared ? prepared.options : await findPlaceArticles(context, $('#wiki-language').value);
    if (generation !== articleGeneration) return;
    articleOptions = options;
    const automatic = prepared ? prepared.automatic : automaticArticle(context, options);
    if (automatic) { $('#place-form').elements.description.value = automatic.description; articleSource = automatic.sourceURL; }
    $('#wiki-status').textContent = automatic ? 'Premier résultat concordant sélectionné : nom et position correspondent. Enregistrez le lieu.' : options.length ? 'Correspondance incertaine : choisissez la bonne fiche.' : prepared?.warning || 'Aucune fiche trouvée. Précisez le nom, la ville et le pays ou saisissez un descriptif.';
    $('#wiki-options').innerHTML = options.map((o, i) => `<article class="resolve-option"><strong>${escape(o.title)}</strong><p class="small muted">${escape(o.language || '')} · ${o.verifiedLocation ? `Position de la fiche à ${o.km.toFixed(1)} km du lieu validé` : 'Position de la fiche non vérifiée : contrôlez la ville et le pays'}</p><p class="small muted">${escape(o.description)}</p><a href="${escape(o.sourceURL)}" target="_blank" rel="noopener noreferrer">Lire la fiche Wikipédia →</a><button type="button" class="secondary" data-article="${i}">Utiliser ce descriptif</button></article>`).join('');
  } catch (error) { if (generation === articleGeneration) $('#wiki-status').textContent = error.message; }
});
$('#wiki-options').addEventListener('click', e => {
  const button = e.target.closest('[data-article]');
  const article = button && articleOptions[Number(button.dataset.article)];
  if (!article) return;
  $('#place-form').elements.description.value = article.description;
  articleSource = article.sourceURL;
  $('#wiki-status').textContent = 'Descriptif ajouté au formulaire. Enregistrez le lieu pour le conserver.';
});
$('#place-dialog').addEventListener('close', () => { articleGeneration++; });
$('#wiki-details').addEventListener('toggle', () => { if ($('#wiki-details').open && !$('#place-form').elements.description.value.trim() && !$('#wiki-status').textContent) $('#wiki-search').click(); });
$('#export').addEventListener('click', () => {
  const data = { type: 'FeatureCollection', features: places.map(p => ({ type: 'Feature', geometry: coordinates(p.lat, p.lng) ? { type: 'Point', coordinates: [p.lng, p.lat] } : null, properties: { name: p.name, country: p.country, category: p.category, note: p.note, tags: p.tags || '', googlePlaceId: p.googlePlaceId || '', description: p.description || '', city: p.city || '', localName: p.localName || '', countryCode: p.countryCode || '', descriptionSource: p.descriptionSource || '', address: p.address || '', practicalInfo: p.practicalInfo || '', url: p.url } })) };
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/geo+json' }));
  const a = document.createElement('a'); a.href = url; a.download = 'voyage-mes-lieux.geojson'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
});
function renderTrips() {
  $('#trip-count').textContent = trips.length;
  $('#no-trips').hidden = trips.length > 0;
  $('#nav-trip-count').textContent = trips.length;
  $('#trip-folders').innerHTML = trips.map(t => {
    const theme = destinationTheme(t);
    return `<article class="trip-folder" data-destination="${theme.id}" style="${themeStyle(theme)}"><div class="folder-cover">${themeIllustration(theme)}<span class="destination-chip">${flagMarkup(t.country)}${escape(t.country)}</span><span class="folder-cover-number">${t.days} jours d’évasion</span></div><div class="folder-body"><p class="folder-mood">${escape(theme.label)}</p><h3>${escape(t.name)}</h3><p class="trip-date small muted">${escape(formatTripCreatedAt(t.createdAt))}</p><div class="folder-stats"><span>⌁ ${t.places.length} lieu${t.places.length > 1 ? 'x' : ''}</span><span>${t.mode === 'walking' ? 'À pied' : 'En voiture'}</span><span>${t.fileOrder ? 'Ordre du carnet' : 'Par proximité'}</span></div><div class="folder-actions"><button class="secondary" data-trip-open="${escape(t.id)}">Consulter <span aria-hidden="true">→</span></button><button class="quiet" data-trip-edit="${escape(t.id)}" ${sharedReadOnly(t.id)?'disabled title="Accès en lecture seule"':''}>Modifier</button><button class="danger-button" data-trip-delete="${escape(t.id)}" ${sharedReadOnly(t.id)?'disabled title="Accès en lecture seule"':''}>Supprimer</button></div></div></article>`;
  }).join('');
}
function renderTripEditor() {
  const form = $('#trip-form'), currentStart = form.elements.startId.value;
  const selected = editingPlaces.filter(p => p.selected);
  form.elements.startId.innerHTML = '<option value="">Premier lieu de la sélection</option>' + selected.map(p => `<option value="${escape(p.id)}">${escape(p.name)}</option>`).join('');
  if (selected.some(p => p.id === currentStart)) form.elements.startId.value = currentStart;
  $('#edit-trip-places').innerHTML = editingPlaces.map(p => `<label class="trip-place"><input type="checkbox" data-trip-place="${escape(p.id)}" ${p.selected ? 'checked' : ''}><span>${escape(p.name)}</span></label>`).join('');
  const trip = trips.find(t => t.id === form.elements.id.value);
  const available = places.filter(p => p.country === trip.country && !editingPlaces.some(q => q.id === p.id || (q.url && q.url === p.url)));
  $('#trip-add-place').innerHTML = available.map(p => `<option value="${escape(p.id)}">${escape(p.name)}</option>`).join('') || '<option value="">Aucun autre lieu disponible</option>';
  $('#trip-add').disabled = !available.length;
}
$('#trip-folders').addEventListener('click', e => {
  const open = e.target.closest('[data-trip-open]'), edit = e.target.closest('[data-trip-edit]'), remove = e.target.closest('[data-trip-delete]');
  const id = open?.dataset.tripOpen || edit?.dataset.tripEdit || remove?.dataset.tripDelete;
  const trip = trips.find(t => t.id === id);
  if (!trip) return;
  try {
    if (open) { showTrip(trip); notice(''); }
    if (edit) {
      const form = $('#trip-form'); form.reset();
      for (const field of ['id', 'name', 'days', 'mode']) form.elements[field].value = trip[field];
      form.elements.fileOrder.checked = trip.fileOrder;
      $('#edit-trip-country').textContent = `Destination : ${trip.country}`;
      editingPlaces = structuredClone(trip.places).map(p => ({ ...p, selected: true }));
      renderTripEditor(); form.elements.startId.value = trip.startId;
      $('#trip-dialog').showModal();
    }
    if (remove && confirm(`Supprimer le dossier « ${trip.name} » ? Les lieux de votre carnet seront conservés.`)) {
      storeTrips(trips.filter(t => t.id !== id));
      for (const booking of trip.organizer?.bookings || []) if (booking.attachment) deleteUnusedDocument(booking.attachment.id).catch(() => {});
      if ($('#results').dataset.tripId === id) { $('#results').hidden = true; currentRecord = null; routeGeneration++; location.hash = '#voyages'; }
      notice(`Le voyage « ${trip.name} » a été supprimé.`);
    }
  } catch (error) { notice(error.message); }
});
$('#edit-trip-places').addEventListener('change', e => {
  const p = editingPlaces.find(p => p.id === e.target.dataset.tripPlace);
  if (p) { p.selected = e.target.checked; renderTripEditor(); }
});
$('#trip-add').addEventListener('click', () => {
  const p = places.find(p => p.id === $('#trip-add-place').value);
  if (p && !editingPlaces.some(q => q.id === p.id)) { editingPlaces.push({ ...structuredClone(p), selected: true }); renderTripEditor(); }
});
$('#trip-form').addEventListener('submit', e => {
  e.preventDefault();
  const form = e.target, previous = trips.find(t => t.id === form.elements.id.value);
  if (!previous) return;
  try {
    const record = createTrip({ name: form.elements.name.value, country: previous.country, days: form.elements.days.value,
      mode: form.elements.mode.value, startId: form.elements.startId.value, fileOrder: form.elements.fileOrder.checked,
      places: editingPlaces.filter(p => p.selected) }, previous);
    storeTrips(trips.map(t => t.id === record.id ? record : t));
    $('#trip-dialog').close(); showTrip(record); notice(`Le voyage « ${record.name} » a été mis à jour. Le calcul est actualisé uniquement si le parcours a changé.`);
  } catch (error) { alert(error.message); }
});
function resultLink(value) {
  if (savedMapsURL(value)) return savedMapsURL(value);
  try { const u = new URL(value); return u.protocol === 'https:' && u.hostname === 'www.openstreetmap.org' ? u.href : null; } catch { return null; }
}
const freeForm = $('#free-config-form');
for (const [name, value] of Object.entries(readServices())) freeForm.elements[name].value = value;
freeForm.addEventListener('submit', e => {
  e.preventDefault();
  try {
    const services = Object.fromEntries(['search', 'photon', 'driving', 'walking'].map(name => [name, serviceURL(freeForm.elements[name].value.trim())]));
    localStorage.setItem('voyage.free.services', JSON.stringify(services));
    notice('Serveurs gratuits enregistrés. Les recherches et coordonnées seront transmises à ces serveurs.');
  } catch (error) { notice(error.message); }
});
const serviceError = error => String(error?.message || 'Le service n’a pas répondu.');
function missingEntries() {
  return [
    ...places.filter(p => !coordinates(p.lat, p.lng)).map(place => ({ place, tripId: null, context: 'Carnet de lieux' })),
    ...trips.flatMap(trip => trip.places.filter(p => !coordinates(p.lat, p.lng)).map(place => ({ place, tripId: trip.id, context: trip.name })))
  ];
}
const missingKey = entry => JSON.stringify([entry.tripId || '', entry.place.id]);
function visibleMissing() {
  const search = $('#missing-search').value.trim().toLocaleLowerCase('fr');
  return missingEntries().filter(e => `${e.place.name} ${e.place.country || ''} ${e.context}`.toLocaleLowerCase('fr').includes(search));
}
function renderMissing() {
  const all = missingEntries(), visible = visibleMissing();
  $('#resolve-progress').textContent = `${all.length} localisation(s) restant à trouver au total · ${places.filter(p => !coordinates(p.lat, p.lng)).length} dans le carnet · ${all.filter(e => e.tripId).length} dans les voyages`;
  $('#remaining-total').textContent = `${all.length} localisation(s) restant à trouver · carnet et voyages sauvegardés`;
  $('#missing-locations').hidden = !all.length;
  $('#missing-count').textContent = all.length;
  $('#missing-visible').textContent = `${visible.length} lieu(x) affiché(s) sur ${all.length} à compléter`;
  $('#missing-review').disabled = !visible.length;
  $('#missing-list').innerHTML = visible.map(e => `<article class="missing-location"><div><strong>${escape(e.place.name)}</strong><p class="small muted">${escape(e.place.country || 'Pays à préciser')} · ${escape(e.context)}</p></div><button class="secondary" type="button" data-missing-id="${escape(e.place.id)}" data-missing-trip="${escape(e.tripId || '')}">Rechercher et valider</button></article>`).join('') || '<p class="muted">Aucun lieu ne correspond à ce filtre.</p>';
}
function renderSearchContext() {
  $('#search-context-country').value = searchContext.country;
  $('#search-context-city').value = searchContext.city;
  $('#search-context-status').textContent = searchContext.country || searchContext.city ? `Zone active : ${[searchContext.city, searchContext.country].filter(Boolean).join(', ')}` : 'Aucune zone commune. Le pays propre à chaque lieu sera utilisé.';
}
renderSearchContext();
$('#search-context-form').addEventListener('submit', e => {
  e.preventDefault();
  searchContext = { country: $('#search-context-country').value.trim(), city: $('#search-context-city').value.trim() };
  try { localStorage.setItem('voyage.search.context', JSON.stringify(searchContext)); }
  catch { notice('Zone appliquée pour cette session, mais non sauvegardée par le navigateur.'); }
  renderSearchContext();
});
$('#search-context-clear').addEventListener('click', () => {
  searchContext = { country: '', city: '' };
  try { localStorage.removeItem('voyage.search.context'); } catch {}
  renderSearchContext();
});
$('#missing-search').addEventListener('input', renderMissing);
$('#missing-review').addEventListener('click', () => {
  const first = visibleMissing()[0];
  if (first) beginResolve([first.place], first.tripId, true);
});
$('#missing-list').addEventListener('click', e => {
  const button = e.target.closest('[data-missing-id]');
  if (!button) return;
  const entry = missingEntries().find(item => item.place.id === button.dataset.missingId && (item.tripId || '') === button.dataset.missingTrip);
  if (entry) beginResolve([entry.place], entry.tripId, true);
});
async function beginResolve(list, tripId = null, reviewMissing = false) {
  const queue = list.filter(Boolean).slice(0, 1);
  if (!queue.length) { notice('Aucun lieu à rechercher. Cochez des lieux sans coordonnées dans la vue actuelle.'); return; }
  missingWorkflow = reviewMissing; missingSkipped = new Set();
  resolveQueue = structuredClone(queue); resolveTripId = tripId;
  $('#resolve-dialog').showModal();
  await resolveNext();
}
async function resolveNext(refineSearch = false) {
  const generation = ++resolveGeneration;
  resolveOptions = []; $('#resolve-candidates').innerHTML = '';
  if (!resolveQueue.length && missingWorkflow) {
    const next = visibleMissing().find(entry => !missingSkipped.has(missingKey(entry)));
    if (next) { resolveQueue = [structuredClone(next.place)]; resolveTripId = next.tripId; }
  }
  $('#resolve-skip').textContent = missingWorkflow ? 'Passer ce lieu et rechercher le suivant' : 'Passer au lieu suivant';
  if (!resolveQueue.length) {
    $('#resolve-dialog').close();
    if (resolveTripId) {
      const trip = trips.find(t => t.id === resolveTripId);
      if (trip) { showTrip(trip); }
    }
    notice('Recherche terminée. Les correspondances confirmées ont été enregistrées. Relancez pour traiter les autres lieux si nécessaire.');
    return;
  }
  const p = resolveQueue[0];
  if (!refineSearch) {
    $('#resolve-search-name').value = p.name;
    $('#resolve-search-city').value = searchContext.city;
    $('#resolve-search-country').value = searchContext.country || p.country || '';
    $('#resolve-search-engine').value = 'auto';
    $('#resolve-manual-form').reset();
    $('#resolve-manual-form').elements.country.value = searchContext.country || p.country || '';
    $('#resolve-manual').open = false;
  }
  const searchPlace = { ...p, searchName: $('#resolve-search-name').value.trim(), searchCity: $('#resolve-search-city').value.trim(), country: $('#resolve-search-country').value.trim(), searchEngine: $('#resolve-search-engine').value };
  if (refineSearch) searchPlace.url = '';
  $('#resolve-title').textContent = p.name;
  renderMissing();
  $('#resolve-original').hidden = !savedMapsURL(p.url);
  $('#resolve-original').href = savedMapsURL(p.url) || '#';
  $('#resolve-status').textContent = 'Recherche en cours…';
  try {
    const options = await findFreePlaces(searchPlace);
    if (generation !== resolveGeneration) return;
    resolveOptions = options;
    $('#resolve-status').textContent = options.length ? 'Confirmez la bonne correspondance avant de conserver les coordonnées.' : 'Aucun résultat trouvé. Précisez la ville et le pays ci-dessus, essayez Photon ou saisissez les coordonnées depuis le lien Maps.';
    $('#resolve-candidates').innerHTML = options.map((o, i) => `<article class="resolve-option"><strong>${escape(o.name)}</strong><p class="small muted">${escape(o.address)} · ${escape(o.country || 'Pays inconnu')}</p><p class="small muted">${o.lat.toFixed(6)}, ${o.lng.toFixed(6)}${o.exact ? ' · Identifiant Google identique au lien enregistré' : ''}</p>${resultLink(o.url) ? `<a class="place-link" href="${escape(resultLink(o.url))}" target="_blank" rel="noopener noreferrer">Vérifier le lieu · ${escape(o.source || 'Google Maps')} →</a>` : ''}<button class="secondary" type="button" data-resolve-choice="${i}">${missingWorkflow ? 'Confirmer et rechercher le suivant' : 'Confirmer ce lieu'}</button></article>`).join('');
  if (missingWorkflow) ($('#resolve-candidates button') || $('#resolve-skip')).focus();
  } catch (error) { if (generation === resolveGeneration) $('#resolve-status').textContent = `${serviceError(error)} Vérifiez la connexion et les réglages du service, ou précisez le pays et la ville dans le nom du lieu.`; }
}
$('#google-resolve').addEventListener('click', () => beginResolve(filtered().filter(p => p.selected && !coordinates(p.lat, p.lng))));
$('#google-resolve-trip').addEventListener('click', () => {
  if (currentRecord) beginResolve(currentRecord.places.filter(p => !coordinates(p.lat, p.lng)), currentRecord.id);
});
$('#resolve-skip').addEventListener('click', () => {
  if (missingWorkflow && resolveQueue[0]) missingSkipped.add(missingKey({ place: resolveQueue[0], tripId: resolveTripId }));
  resolveQueue.shift(); resolveNext();
});
$('#resolve-close').addEventListener('click', () => $('#resolve-dialog').close());
$('#resolve-dialog').addEventListener('close', () => { resolveGeneration++; resolveQueue = []; missingWorkflow = false; });
function confirmResolved(found) {
  const original = resolveQueue[0];
  if (!found || !original) return;
  const patch = { lat: found.lat, lng: found.lng, country: found.country || original.country, ...(found.city ? { city: found.city } : {}), ...(found.localName ? { localName: found.localName } : {}), ...(found.countryCode ? { countryCode: found.countryCode } : {}), googlePlaceId: found.placeId || '', ...(found.address ? { address: found.address } : {}), ...(original.descriptionSource && (original.lat !== found.lat || original.lng !== found.lng) ? { description: '', descriptionSource: '' } : {}) };
  try {
    if (resolveTripId) {
      const previous = trips.find(t => t.id === resolveTripId);
      if (!previous) throw new Error('Ce voyage a été supprimé.');
      const updated = { ...previous, places: previous.places.map(p => p.id === original.id ? { ...p, ...patch } : p), updatedAt: new Date().toISOString() };
      storeTrips(trips.map(t => t.id === updated.id ? updated : t));
      if (currentRecord?.id === updated.id) { currentRecord = updated; showTrip(updated); }
    } else {
      const next = places.map(p => p.id === original.id ? { ...p, ...patch } : p);
      localStorage.setItem(key, JSON.stringify(next)); places = next; render();
      $('#results').hidden = true;
    }
    resolveQueue.shift(); resolveNext();
  } catch (error) { $('#resolve-status').textContent = `Coordonnées non enregistrées : ${serviceError(error)}`; }
}
$('#resolve-search-form').addEventListener('submit', e => { e.preventDefault(); resolveNext(true); });
$('#resolve-candidates').addEventListener('click', e => {
  const button = e.target.closest('[data-resolve-choice]');
  if (button) confirmResolved(resolveOptions[Number(button.dataset.resolveChoice)]);
});
$('#resolve-manual-form').addEventListener('submit', e => {
  e.preventDefault();
  const form = e.target, point = coordinates(form.elements.lat.value, form.elements.lng.value);
  if (!point) { $('#resolve-status').textContent = 'Indiquez une latitude et une longitude valides.'; return; }
  confirmResolved({ ...point, country: form.elements.country.value.trim() || $('#resolve-search-country').value.trim() });
});
async function calculateRoutes(force = false) {
  if (!currentRecord || $('#google-routes').disabled) return;
  if(!navigator.onLine){notice('Hors ligne : les calculs déjà sauvegardés restent consultables. Reconnectez-vous pour calculer un nouveau trajet.');return;}
  const record = currentRecord, key = routeKeyFor(record), generation = routeGeneration;
  const cached = routeCache.get(key);
  if (!cached || (cached.attempted && !force)) return;
  cached.attempted = true; activeRouteKey = key;
  const trip = planTrip(record.places, record.days, record.startId, record.fileOrder, record.dayGroups);
  $('#google-routes').disabled = true;
  let passed = 0, failed = 0;
  try {
    await mapReady;
    if (generation !== routeGeneration) return;
    for (let i = 0; i < trip.days.length; i++) {
      if (generation !== routeGeneration) return;
      document.querySelector(`[data-google-day="${i}"]`).textContent = 'Calcul du trajet en cours…';
      try {
        const result = await computeFreeDay(trip.days[i], record.mode);
        if (generation !== routeGeneration) return;
        const text = formatFreeRoute(result);
        cached.days[i] = { text, result };
        document.querySelector(`[data-google-day="${i}"]`).textContent = text;
        await mapReady;
        if (generation !== routeGeneration) return;
        if (result.geometry) { tripMap.setRoute(i, result.geometry); $('#map-status').textContent = 'Traits pleins : routes calculées. Pointillés : liaisons schématiques non calculées.'; }
        passed++;
      } catch (error) {
        if (generation !== routeGeneration) return;
        const text = `Trajet indisponible : ${serviceError(error)}`;
        cached.days[i] = { text }; document.querySelector(`[data-google-day="${i}"]`).textContent = text; failed++;
      }
    }
    cached.status = `${passed} journée(s) calculée(s), ${failed} non calculée(s). OpenStreetMap / OSRM sans trafic. Temps de déplacement uniquement, hors visites ; liaison depuis la veille incluse. Résultats enregistrés pour consultation hors ligne ; estimation à la date du calcul.`;
    if(passed>0)await routeSnapshot(key,{days:cached.days,status:cached.status});
    $('#google-routes-status').textContent = cached.status;
  } catch (error) { if (generation === routeGeneration) { cached.status = serviceError(error); $('#google-routes-status').textContent = cached.status; } }
  finally {
    if (activeRouteKey === key) activeRouteKey = '';
    if (generation === routeGeneration) $('#google-routes').disabled = false;
    else cached.attempted = false;
  }
}
$('#google-routes').addEventListener('click', () => calculateRoutes(true));
let descriptionSession = null, descriptionVersion = 0;
function descriptionTrip() { return trips.find(t => t.id === descriptionSession?.tripId); }
function renderDescriptionMenu() {
  const trip = descriptionTrip(); if (!trip) return;
  const missing = trip.places.filter(p => !p.description?.trim());
  $('#description-progress').textContent = `${missing.length} descriptif(s) restant(s) · ${descriptionSession.saved} complété(s) pendant cette session`;
  $('#description-menu').innerHTML = missing.map(p => `<div class="description-menu-row"><span>${escape(p.name)} · ${escape(p.city || p.country)}</span><button type="button" class="quiet" data-description-place="${escape(p.id)}">Rechercher</button></div>`).join('') || '<p class="muted">Tous les lieux ont un descriptif.</p>';
  $('#description-run').disabled = !missing.length || Boolean(descriptionSession.queue.length);
}
$('#descriptions-start').addEventListener('click', () => {
  if (!currentRecord) return;
  descriptionSession = { tripId: currentRecord.id, queue: [], options: [], context: null, saved: 0 };
  descriptionVersion++; $('#description-current').hidden = true;
  renderDescriptionMenu(); $('#description-dialog').showModal();
});
async function descriptionStep(refined = null) {
  const version = ++descriptionVersion, session = descriptionSession;
  if (!session) return;
  const trip = descriptionTrip(), p = trip?.places.find(p => p.id === session.queue[0]);
  renderDescriptionMenu();
  if (!p) { $('#description-current').hidden = true; $('#description-run').disabled = !trip?.places.some(p => !p.description?.trim()); return; }
  $('#description-current').hidden = false; $('#description-title').textContent = p.name;
  $('#description-status').textContent = 'Recherche de la ville, du nom local et du descriptif…'; $('#description-options').innerHTML = '';
  const form = $('#description-refine');
  for (const field of ['name', 'localName', 'city', 'country']) form.elements[field].value = refined?.[field] || p[field] || '';
  try {
    const prepared = await prepareDescription({ ...p, ...refined });
    if (version !== descriptionVersion) return;
    session.context = prepared.context; session.options = prepared.options;
    for (const field of ['name', 'localName', 'city', 'country']) form.elements[field].value = prepared.context[field] || '';
    if (prepared.automatic) { saveBatchDescription(prepared.automatic); return; }
    $('#description-status').textContent = prepared.warning || (prepared.options.length ? 'Nom ou position incertains : choisissez la bonne fiche.' : 'Aucune fiche trouvée : précisez le nom et la ville ou passez au suivant.');
    $('#description-options').innerHTML = prepared.options.map((o, i) => `<article class="resolve-option"><strong>${escape(o.title)}</strong><p class="small muted">${escape(o.language)} · ${o.verifiedLocation ? `${o.km.toFixed(1)} km du lieu` : 'Position non vérifiée'}</p><p>${escape(o.description)}</p><a href="${escape(o.sourceURL)}" target="_blank" rel="noopener noreferrer">Vérifier la fiche →</a><button class="secondary" type="button" data-description-choice="${i}">Choisir et continuer</button></article>`).join('');
  } catch (error) { if (version === descriptionVersion) $('#description-status').textContent = error.message; }
}
function saveBatchDescription(article) {
  const session = descriptionSession, trip = descriptionTrip();
  if (!session || !trip || !session.context) return;
  try {
    const p = trip.places.find(p => p.id === session.queue[0]);
    const context = session.context;
    const updated = updateTripPlace(trip, p.id, { description: article.description, descriptionSource: article.sourceURL, city: context.city || p.city, localName: context.localName || p.localName, countryCode: context.countryCode || p.countryCode });
    storeTrips(trips.map(t => t.id === trip.id ? updated : t));
    if (currentRecord?.id === trip.id) currentRecord = updated;
    session.saved++; session.queue.shift(); renderDescriptionMenu(); descriptionStep();
  } catch (error) { $('#description-status').textContent = `Descriptif non enregistré : ${error.message}`; }
}
$('#description-run').addEventListener('click', () => {
  const trip = descriptionTrip(); if (!trip) return;
  descriptionSession.queue = trip.places.filter(p => !p.description?.trim()).map(p => p.id); descriptionStep();
});
$('#description-menu').addEventListener('click', e => {
  const button = e.target.closest('[data-description-place]');
  if (button && descriptionSession) { descriptionSession.queue = [button.dataset.descriptionPlace]; descriptionStep(); }
});
$('#description-options').addEventListener('click', e => {
  const button = e.target.closest('[data-description-choice]');
  if (button) saveBatchDescription(descriptionSession?.options[Number(button.dataset.descriptionChoice)]);
});
$('#description-refine').addEventListener('submit', e => { e.preventDefault(); descriptionStep(Object.fromEntries(new FormData(e.target))); });
$('#description-skip').addEventListener('click', () => { if (descriptionSession) { descriptionSession.queue.shift(); descriptionStep(); } });
$('#description-close').addEventListener('click', () => $('#description-dialog').close());
$('#description-dialog').addEventListener('close', () => {
  descriptionVersion++;
  const trip = descriptionTrip(); descriptionSession = null;
  if (trip && currentRecord?.id === trip.id) showTrip(trip);
});
function showHome(prepare = false) {
  organizer.leave();
  document.body.dataset.view = 'home'; $('#results').hidden = true; $('#trips-page').hidden = true;
  setDestination(destinationTheme()); setNav(prepare ? 'prepare' : 'home');
  document.title = 'Voyage — Vos envies, un itinéraire';
  if (prepare) $('#carnet').scrollIntoView({ behavior: 'smooth', block: 'start' }); else window.scrollTo({ top: 0 });
}
function showTrips() {
  organizer.leave();
  document.body.dataset.view = 'trips'; $('#results').hidden = true; $('#trips-page').hidden = false;
  setDestination(destinationTheme()); setNav('trips'); renderTrips();
  document.title = 'Mes voyages — Voyage'; window.scrollTo({ top: 0 });
}
function restorePage() {
  if (['#voyages', '#my-trips'].includes(location.hash)) { showTrips(); return; }
  if (location.hash === '#carnet') { showHome(true); return; }
  if (location.hash.startsWith('#voyage=')) {
    const params = new URLSearchParams(location.hash.slice(1));
    const trip = trips.find(t => t.id === params.get('voyage'));
    if (trip) { showTrip(trip, params.get('page') || 'route'); return; }
  }
  showHome();
}
window.addEventListener('hashchange', restorePage);
document.querySelectorAll('header a[href^="#"]').forEach(link => link.addEventListener('click', e => {
  e.preventDefault(); const hash = link.getAttribute('href');
  if (location.hash !== hash) history.pushState(null, '', hash);
  restorePage();
}));
renderTrips();
$('#print').addEventListener('click', () => window.print());
render();

restorePage();

async function restoreRouteSnapshot(record,key,generation) {
  const stored=await routeSnapshot(key),cached=routeCache.get(key);
  await mapReady;
  if(generation!==routeGeneration||currentRecord?.id!==record.id||displayedRouteKey!==key||!cached)return;
  if(stored?.days?.length) {
    cached.days=stored.days;cached.status=`Calcul sauvegardé le ${new Date(stored.savedAt).toLocaleString('fr-FR')}. ${stored.status}`;
    cached.days.forEach((day,i)=>{const target=document.querySelector(`[data-google-day="${i}"]`);if(target)target.textContent=day.text;if(day.result?.geometry)tripMap.setRoute(i,day.result.geometry);});
    $('#google-routes-status').textContent=cached.status;
    if(!navigator.onLine||Date.now()-Date.parse(stored.savedAt)<86400000){cached.attempted=true;return;}
  }
  if(navigator.onLine)calculateRoutes();else $('#google-routes-status').textContent='Hors ligne : aucun calcul routier enregistré pour ce parcours. Les liaisons pointillées sont schématiques.';
}
function saveStep(id,patch) {
  if(!currentRecord)throw new Error('Ouvrez d’abord un voyage.');
  const updated=updateTripPlace(currentRecord,id,patch);storeTrips(trips.map(t=>t.id===updated.id?updated:t));currentRecord=updated;
  const place=updated.places.find(p=>p.id===id);
  const progress=$('#visit-progress');if(progress)progress.textContent=`${updated.places.filter(p=>p.visited).length} / ${updated.places.length} lieu(x) visité(s)`;
  const list=[...document.querySelectorAll('[data-task-list]')].find(node=>node.dataset.taskList===id);if(list){list.innerHTML=taskList(place);const summary=list.closest('details').querySelector('summary');summary.textContent=`Ma note & mes tâches (${(place.tasks||[]).filter(t=>t.done).length}/${(place.tasks||[]).length})`;}
  return place;
}
$('#day-cards').addEventListener('change',event=>{
  const box=event.target;
  try {
    if(box.dataset.visited)saveStep(box.dataset.visited,{visited:box.checked});
    if(box.dataset.placeTask){const p=currentRecord.places.find(p=>p.id===box.dataset.placeTask);saveStep(p.id,{tasks:p.tasks.map(t=>t.id===box.dataset.taskId?{...t,done:box.checked}:t)});}
  }catch(error){box.checked=!box.checked;notice(error.message);}
});
$('#day-cards').addEventListener('submit',event=>{
  const form=event.target;if(!form.dataset.stepNote&&!form.dataset.stepTask)return;event.preventDefault();
  try {
    const values=new FormData(form);
    if(form.dataset.stepNote){const id=form.dataset.stepNote,p=saveStep(id,{note:String(values.get('note')||'').trim()});const node=[...document.querySelectorAll('[data-place-note]')].find(n=>n.dataset.placeNote===id);if(node){node.hidden=!p.note;node.querySelector('span').textContent=p.note;}}
    else {const p=currentRecord.places.find(p=>p.id===form.dataset.stepTask);saveStep(p.id,{tasks:[...(p.tasks||[]),{id:crypto.randomUUID(),text:String(values.get('text')).trim(),done:false}]});form.reset();}
    notice('Suivi du lieu enregistré. Le trajet est conservé.');
  }catch(error){notice(error.message);}
});
$('#day-cards').addEventListener('click',event=>{const button=event.target.closest('[data-delete-task]');if(!button)return;try{const p=currentRecord.places.find(p=>p.id===button.dataset.taskPlace);saveStep(p.id,{tasks:(p.tasks||[]).filter(t=>t.id!==button.dataset.deleteTask)});}catch(error){notice(error.message);}});
$('#backup-all').addEventListener('click',async event=>{event.target.disabled=true;notice('Préparation de la sauvegarde complète…');try{downloadFile(await workspaceBackup(trips,places),'voyage-sauvegarde-complete.json');notice('Sauvegarde complète exportée, billets inclus.');}catch(error){notice(error.message);}finally{event.target.disabled=false;}});
$('#backup-trip').addEventListener('click',async()=>{if(!currentRecord)return;try{await organizer.backup(currentRecord);notice('Dossier exporté avec ses documents.');}catch(error){notice(error.message);}});
$('#share-trip').addEventListener('click',async()=>{
  if(!currentRecord)return;
  try {const file=new File([JSON.stringify(itineraryCopy(currentRecord),null,2)],'voyage-itineraire-partage.json',{type:'application/json'});if(navigator.canShare?.({files:[file]}))await navigator.share({files:[file],title:currentRecord.name});else downloadFile(file,file.name);notice('Copie de l’itinéraire partagée, sans réservations ni billets. L’autre personne peut l’importer depuis « Sauvegarde & hors-ligne ».');}catch(error){if(error.name!=='AbortError')notice(error.message);}
});
$('#backup-import').addEventListener('change',async event=>{
  const input=event.target,file=input.files[0];if(!file)return;input.disabled=true;let imported,committed=false;
  try {
    if(!tripStorageReadable||!placeStorageReadable)throw new Error('Les données locales ne sont pas lisibles. Elles sont préservées ; réparez-les avant d’importer une copie.');
    const data=await readBackup(file);notice(`Import de ${data.trips.length} dossier(s) et ${data.places.length} lieu(x)…`);imported=await prepareImportedBackup(data);
    const nextTrips=[...imported.trips,...trips],nextPlaces=[...places,...imported.places],oldTrips=localStorage.getItem('voyage.trips.v1'),oldPlaces=localStorage.getItem(key);
    try {persistTrips(localStorage,nextTrips);localStorage.setItem(key,JSON.stringify(nextPlaces));}
    catch(error){try{oldTrips===null?localStorage.removeItem('voyage.trips.v1'):localStorage.setItem('voyage.trips.v1',oldTrips);oldPlaces===null?localStorage.removeItem(key):localStorage.setItem(key,oldPlaces);}catch{}throw new Error('Stockage insuffisant : import annulé. Vos dossiers précédents sont conservés.');}
    committed=true;trips=nextTrips;places=nextPlaces;renderTrips();render();location.hash='#voyages';notice(`${imported.trips.length} dossier(s) et ${imported.places.length} lieu(x) importés en copie. Aucun dossier existant remplacé.`);imported=null;
  }catch(error){if(imported&&!committed)await imported.rollback();notice('Import impossible : '+error.message);}finally{input.disabled=false;input.value='';}
});
setupPWA();

const mapsImporter=new MapsImport($('#maps-import-dialog'),{
  getPlaces:()=>places,
  addPlaces:added=>{if(!placeStorageReadable)throw new Error('Le carnet enregistré est illisible et est préservé.');const next=[...places,...added];localStorage.setItem(key,JSON.stringify(next));places=next;render();location.hash='#carnet';},notice
});
$('#maps-import-open').addEventListener('click',()=>mapsImporter.open());
const dayGroups=new DayGroups($('#day-groups-dialog'),{getTrip:id=>trips.find(t=>t.id===id),saveTrip:updated=>storeTrips(trips.map(t=>t.id===updated.id?updated:t)),showTrip,notice});
$('#propose-day-groups').addEventListener('click',()=>{if(currentRecord)dayGroups.open(currentRecord);});
$('#reset-day-groups').addEventListener('click',()=>{if(currentRecord){const updated={...currentRecord,dayGroups:null,updatedAt:new Date().toISOString()};storeTrips(trips.map(t=>t.id===updated.id?updated:t));showTrip(updated);notice('Tri automatique restauré.');}});
$('#template-profile').innerHTML=Object.entries(tripTemplates).map(([id,t])=>`<option value="${id}">${escape(t.name)}</option>`).join('');
function showTemplateDefaults(){const t=tripTemplates[$('#template-profile').value],form=$('#template-form');form.elements.days.value=t.days;form.elements.dailyLimit.value=t.dailyLimit;$('#template-description').textContent=t.description;}
$('#template-profile').addEventListener('change',showTemplateDefaults);
$('#template-open').addEventListener('click',()=>{showTemplateDefaults();$('#template-form').elements.country.value=$('#country').value||'';$('#template-dialog').showModal();});
$('#template-close').addEventListener('click',()=>$('#template-dialog').close());
function applyTemplateDraft() {
  if(!pendingTemplate)return;const t=tripTemplates[pendingTemplate.profile];
  if(![...$('#country').options].some(o=>o.value===pendingTemplate.country))$('#country').add(new Option(pendingTemplate.country,pendingTemplate.country));
  $('#country').value=pendingTemplate.country;$('#days').value=pendingTemplate.days;$('#mode').value=t.mode;$('#trip-name').value=pendingTemplate.name||`${pendingTemplate.country} · ${t.name}`;
  $('#file-order').checked=candidates().some(p=>!coordinates(p.lat,p.lng));renderStart();
  $('#template-active').textContent=`Modèle actif : ${t.name}. Budget de départ ${pendingTemplate.dailyLimit} € / jour. Ajoutez ou cochez vos lieux, puis créez le voyage.`;
}
$('#template-form').addEventListener('submit',event=>{event.preventDefault();const values=new FormData(event.target),profile=String(values.get('profile')),country=String(values.get('country')).trim(),days=Number(values.get('days')),dailyLimit=Number(values.get('dailyLimit')),startDate=String(values.get('startDate')||'');try{if(!tripTemplates[profile]||!country||!Number.isInteger(days)||days<1||days>30||!Number.isFinite(dailyLimit)||dailyLimit<0||dailyLimit>1e12)throw new Error('Vérifiez les paramètres du modèle.');pendingTemplate={profile,country,days,dailyLimit,startDate,name:String(values.get('name')||'').trim()};localStorage.setItem('voyage.template-draft.v1',JSON.stringify(pendingTemplate));applyTemplateDraft();$('#template-dialog').close();location.hash='#carnet';notice('Modèle préparé. Vos lieux et dossiers existants sont conservés.');}catch(error){notice(error.message);}});
applyTemplateDraft();

cloudUI=new CloudUI({root:$('#cloud-dialog'),getTrips:()=>trips,getCurrent:()=>currentRecord,notice,
 isBusy:()=>!!document.querySelector('dialog[open]')||document.hidden||!!document.activeElement?.closest('input,textarea,select,[contenteditable=true]'),
 applyTrips:async(incoming,{initial,previousIds})=>{
  if(!tripStorageReadable)throw new Error('La sauvegarde locale est illisible et doit être réparée avant la synchronisation.');
  const ids=new Set(incoming.map(t=>t.id)),previous=new Set(previousIds);
  const retained=trips.filter(t=>!previous.has(t.id)).flatMap(t=>{if(!ids.has(t.id))return [t];if(initial&&JSON.stringify(incoming.find(q=>q.id===t.id))!==JSON.stringify(t))return [{...structuredClone(t),id:crypto.randomUUID(),name:t.name+' (copie locale avant connexion)'}];return [];});
  applyingCloud=true;try{storeTrips([...incoming,...retained]);}finally{applyingCloud=false;}
  if(currentRecord){const updated=trips.find(t=>t.id===currentRecord.id);if(updated){const changed=JSON.stringify(currentRecord)!==JSON.stringify(updated);currentRecord=updated;const page=new URLSearchParams(location.hash.slice(1)).get('page')||'route';if(changed&&document.body.dataset.view==='trip'&&page==='route')showTrip(updated,page,false);}else if(document.body.dataset.view==='trip')location.hash='#voyages';}
 },
 importShared:async data=>{const imported=await prepareImportedBackup(data);try{storeTrips([...imported.trips,...trips]);}catch(error){await imported.rollback();throw error;}},
});
$('#cloud-open').addEventListener('click',()=>cloudUI.open());
$('#share-trip-link').addEventListener('click',()=>cloudUI.shareTrip());
$('#personal-copy').addEventListener('click',()=>{if(!currentRecord)return;try{const copy={...structuredClone(currentRecord),id:crypto.randomUUID(),name:currentRecord.name+' (copie personnelle)',updatedAt:new Date().toISOString()};storeTrips([copy,...trips]);showTrip(copy);notice('Copie personnelle créée. Elle reste locale avec un accès de lecture seule.');}catch(error){notice(error.message);}});

function sharedReadOnly(id){return !!cloudUI?.cloud.state&&!cloudUI.cloud.state.config.writeToken&&Object.hasOwn(cloudUI.cloud.state.base,id);}
function updateTripAccess(){
 const readOnly=currentRecord&&sharedReadOnly(currentRecord.id),shared=currentRecord&&cloudUI?.cloud.state&&Object.hasOwn(cloudUI.cloud.state.base,currentRecord.id);
 const banner=$('#trip-access-banner'),message=readOnly?'Lecture seule : ce dossier est partagé avec vous. Pour préparer votre propre version, créez une copie personnelle.':shared?'Espace partagé : vos modifications de ce dossier seront synchronisées.':'Dossier personnel sur cet appareil.';if(banner.textContent!==message)banner.textContent=message;
 if(!readOnly)document.querySelectorAll('[data-cloud-read-only]').forEach(node=>{node.disabled=false;delete node.dataset.cloudReadOnly;});
 if(readOnly)document.querySelectorAll('#propose-day-groups,#reset-day-groups,#descriptions-start,#google-resolve-trip,#day-cards input,#day-cards textarea,#day-cards button,#trip-organizer-page form:not(#converter-form) input,#trip-organizer-page form:not(#converter-form) textarea,#trip-organizer-page form:not(#converter-form) select,#trip-organizer-page form:not(#converter-form) button,#trip-organizer-page [data-booking-kind],#trip-organizer-page [data-edit],#trip-organizer-page [data-delete],#trip-organizer-page [data-check],#trip-organizer-page [data-ticket-place],#trip-organizer-page [data-action=uncheck],#trip-organizer-page [data-action=rates],#trip-organizer-page [data-action=official-sites],#organizer-import,#ticket-upload,#confirmation-upload').forEach(node=>{if(!node.disabled){node.dataset.cloudReadOnly='true';node.disabled=true;}});
}
new MutationObserver(()=>updateTripAccess()).observe($('#results'),{childList:true,subtree:true});
updateTripAccess();

addEventListener('voyage-cloud-state',()=>{updateTripAccess();renderTrips();});
