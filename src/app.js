import { TripMap } from './trip-map.js';
import { findArticles, wikipediaLink } from './place-info.js';
import { findFreePlaces, computeFreeDay, formatFreeRoute, readServices, serviceURL } from './free-maps.js';
import { loadGoogle, findGooglePlaces, computeGoogleDay, formatGoogleRoute } from './google-maps.js';
import { createTrip, loadTrips, persistTrips, formatTripCreatedAt, remainingPlaces, updateTripPlace } from './trips.js';
import { coordinates, fromURL, importPlaces, planTrip, mapsLinks, savedMapsURL, demo } from './core.js';

const $ = s => document.querySelector(s);
const key = 'voyage.places.v1';
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
let places = [];
let trips = [];
let tripStorageReadable = true;
let editingPlaces = [];
let currentRecord = null;
const tripMap = new TripMap();
let mapReady = Promise.resolve();
let articleOptions = [], articleSource = '', articleGeneration = 0;
let routeGeneration = 0;
let mapsProvider = 'free';
try { mapsProvider = localStorage.getItem('voyage.maps.provider') === 'google' ? 'google' : 'free'; } catch {}
let googleKey = '';
try { googleKey = sessionStorage.getItem('voyage.google.session') || ''; } catch { /* Memory-only configuration remains available. */ }
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
} catch { notice('Le carnet enregistré n’a pas pu être chargé. Vous pouvez importer une sauvegarde.'); }

try { trips = loadTrips(localStorage); }
catch { tripStorageReadable = false; notice('Les voyages enregistrés ne peuvent pas être lus. Leur sauvegarde est préservée ; vérifiez que le stockage du navigateur est accessible.'); }

function storeTrips(next) {
  if (!tripStorageReadable) throw new Error('La sauvegarde des voyages est inaccessible. Rechargez la page après avoir vérifié le stockage du navigateur.');
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
  $('#places').innerHTML = visible.map(p => `<div class="place"><input type="checkbox" data-select="${escape(p.id)}" aria-label="Sélectionner ${escape(p.name)}" ${p.selected ? 'checked' : ''}><div class="place-icon" aria-hidden="true">${p.category === 'Nature' ? '♧' : '⌁'}</div><div class="place-info"><strong>${escape(p.name)}</strong><p>${escape(p.country || 'Pays à compléter')} · ${escape(p.category)}</p>${!coordinates(p.lat, p.lng) ? '<p class="missing">Sans coordonnées · répartition dans l’ordre disponible</p>' : ''}${p.tags ? `<p>Tags : ${escape(p.tags)}</p>` : ''}${p.note ? `<p class="place-note">${escape(p.note)}</p>` : ''}${savedMapsURL(p.url) ? `<a class="place-link" href="${escape(savedMapsURL(p.url))}" target="_blank" rel="noopener noreferrer">Voir le lieu dans Google Maps ↗</a>` : ''}</div><div class="place-actions"><button class="quiet" data-locate="${escape(p.id)}">Retrouver le lieu</button><button class="quiet" data-edit="${escape(p.id)}">Modifier</button><button class="quiet" data-delete="${escape(p.id)}" aria-label="Supprimer ${escape(p.name)}">✕</button></div></div>`).join('') || (places.length ? '<p class="muted">Aucun lieu ne correspond à cette recherche.</p>' : '');
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
function openPlace(p, tripId = null) {
  const form = $('#place-form'); form.reset();
  for (const field of ['id', 'name', 'country', 'category', 'url', 'lat', 'lng', 'note', 'tags', 'description', 'address', 'practicalInfo']) form.elements[field].value = p?.[field] ?? (field === 'category' ? 'À visiter' : '');
  form.elements.tripId.value = tripId || '';
  articleGeneration++; articleOptions = []; articleSource = p?.descriptionSource || '';
  $('#wiki-query').value = [p?.name, p?.country].filter(Boolean).join(' ');
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
  const p = { ...old, id: old?.id || crypto.randomUUID(), name, country: normalize(country, 'country'), category: normalize(fields.category.trim() || 'À visiter', 'category'), url: fields.url, note: fields.note, tags: fields.tags.trim(), description: fields.description.trim(), address: fields.address.trim(), practicalInfo: fields.practicalInfo.trim(), descriptionSource: articleSource, selected: old?.selected ?? true, ...(old?.googlePlaceId && point?.lat === old.lat && point?.lng === old.lng ? { googlePlaceId: old.googlePlaceId } : {}), ...(point || { lat: null, lng: null }) };
  if (old && (old.lat !== p.lat || old.lng !== p.lng || old.url !== p.url)) p.googlePlaceId = '';
  if (fields.tripId) {
    try {
      if (!trip) throw new Error('Ce voyage a été supprimé.');
      const updated = updateTripPlace(trip, fields.id, p);
      storeTrips(trips.map(t => t.id === trip.id ? updated : t));
      $('#place-dialog').close(); showTrip(updated); notice('Le lieu a été mis à jour dans ce dossier. Recalculez les trajets après une correction de localisation.');
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
function showTrip(record) {
  currentRecord = record;
  routeGeneration++;
  $('#google-routes').disabled = false;
  $('#google-routes-status').textContent = `Calcul à la demande, hors visites. Liaison depuis la veille incluse ; aucun hébergement ni retour. ${mapsProvider === 'free' ? 'Source : OpenStreetMap / OSRM. Estimation sans trafic en temps réel.' : 'Source : Google Maps. Trafic au moment du calcul, pas de prévision pour la date du voyage.'}`;
  const trip = planTrip(record.places, record.days, record.startId, record.fileOrder);
  const mode = record.mode;
    $('#result-title').textContent = record.name;
    const km = trip.days.reduce((sum, day) => sum + day.km, 0);
    $('#result-summary').textContent = `${record.places.length} lieux · ${trip.days.length} jours avec des visites · ${trip.fileOrder ? 'Ordre du carnet conservé (sauf le premier lieu si vous en avez choisi un). Aucun tri par proximité ni calcul des distances ou temps de trajet. Google Maps recherchera les étapes par nom et pays si elles n’ont pas de coordonnées : vérifiez chaque correspondance.' : `${Math.round(km)} km à vol d’oiseau entre les étapes.`} ${trip.unusedDays ? `${trip.unusedDays} jour(s) libre(s) pour prolonger les visites ou vous reposer.` : ''} Parcours indicatif, sans hébergement ni retour au point de départ.`;
    $('#day-cards').innerHTML = trip.days.map((day, i) => {
      const hours = day.stops.length * 1.5;
      return `<article class="day-card"><span class="day-number">JOUR ${String(i + 1).padStart(2, '0')}</span><h3>${escape(day.stops[0].name)}</h3><p class="google-day-metric" data-google-day="${i}">Trajet : kilomètres et durée non calculés</p><p class="muted">${day.stops.length} visite(s) · ${trip.fileOrder ? 'ordre du carnet' : `${Math.round(day.km)} km à vol d’oiseau`}</p>${day.previous ? `<p class="small muted">Départ du lien Maps : ${escape(day.previous.name)}, dernière étape de la veille.</p>` : ''}<ol>${day.stops.map(p => `<li><strong>${escape(p.name)}</strong><small>${escape(p.category)}</small><div class="place-details">${p.description ? `<p>${escape(p.description)}</p>` : '<p class="muted small">Descriptif non renseigné. Ajoutez une fiche ou vos informations.</p>'}${wikipediaLink(p.descriptionSource) ? `<a class="place-link" href="${escape(wikipediaLink(p.descriptionSource))}" target="_blank" rel="noopener noreferrer">Source : Wikipédia · CC BY-SA ↗</a>` : ''}${p.address ? `<p><strong>Adresse :</strong> ${escape(p.address)}</p>` : ''}${p.practicalInfo ? `<p><strong>À savoir :</strong> ${escape(p.practicalInfo)}</p>` : ''}${p.note ? `<p><strong>Vos notes :</strong> ${escape(p.note)}</p>` : ''}</div><div class="place-tools"><button type="button" class="quiet" data-folder-place="${escape(p.id)}">Modifier ce lieu / informations</button><button type="button" class="quiet" data-folder-locate="${escape(p.id)}">Corriger la localisation</button></div>${savedMapsURL(p.url) ? `<a class="place-link" href="${escape(savedMapsURL(p.url))}" target="_blank" rel="noopener noreferrer">Lien Maps enregistré ↗</a>` : ''}</li>`).join('')}</ol><p class="small muted">Visites seules : environ ${Math.ceil(hours)} h (hypothèse : 1 h 30 par lieu). Le temps de déplacement calculé s’ajoute à ce budget.</p>${hours > 8 || day.stops.length * 1.5 > 8 ? '<p class="warning">Journée probablement trop chargée. Ajoutez des jours ou retirez des lieux, puis vérifiez les vrais trajets.</p>' : ''}${mapsLinks(day, mode).map((url, j, links) => `<a class="secondary" href="${escape(url)}" target="_blank" rel="noopener noreferrer">Ouvrir dans Maps${links.length > 1 ? ` · partie ${j + 1}` : ''} ↗</a>`).join('')}</article>`;
    }).join('');

  $('#results').dataset.tripId = record.id;
  $('#results').hidden = false;
  mapReady = tripMap.show(trip);
  $('#results').scrollIntoView({ behavior: 'smooth' });
}
$('#plan-form').addEventListener('submit', e => {
  e.preventDefault();
  try {
    const days = Number($('#days').value), country = $('#country').value;
    const record = createTrip({ name: $('#trip-name').value.trim() || `${country} · ${days} jours`, country, days,
      mode: $('#mode').value, startId: $('#start').value, fileOrder: $('#file-order').checked, places: candidates() });
    storeTrips([record, ...trips]);
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
$('#wiki-search').addEventListener('click', async () => {
  const generation = ++articleGeneration;
  $('#wiki-status').textContent = 'Recherche de fiches Wikipédia…'; $('#wiki-options').innerHTML = '';
  try {
    const options = await findArticles($('#wiki-query').value, $('#wiki-language').value);
    if (generation !== articleGeneration) return;
    articleOptions = options;
    $('#wiki-status').textContent = options.length ? 'Vérifiez la fiche avant d’utiliser son descriptif.' : 'Aucune fiche trouvée. Essayez le nom local, l’anglais, ou saisissez votre descriptif.';
    $('#wiki-options').innerHTML = options.map((o, i) => `<article class="resolve-option"><strong>${escape(o.title)}</strong><p class="small muted">${escape(o.description)}</p><a href="${escape(o.sourceURL)}" target="_blank" rel="noopener noreferrer">Lire la fiche Wikipédia ↗</a><button type="button" class="secondary" data-article="${i}">Utiliser ce descriptif</button></article>`).join('');
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
$('#export').addEventListener('click', () => {
  const data = { type: 'FeatureCollection', features: places.map(p => ({ type: 'Feature', geometry: coordinates(p.lat, p.lng) ? { type: 'Point', coordinates: [p.lng, p.lat] } : null, properties: { name: p.name, country: p.country, category: p.category, note: p.note, tags: p.tags || '', googlePlaceId: p.googlePlaceId || '', description: p.description || '', descriptionSource: p.descriptionSource || '', address: p.address || '', practicalInfo: p.practicalInfo || '', url: p.url } })) };
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/geo+json' }));
  const a = document.createElement('a'); a.href = url; a.download = 'voyage-mes-lieux.geojson'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
});
function renderTrips() {
  $('#trip-count').textContent = trips.length;
  $('#no-trips').hidden = trips.length > 0;
  $('#trip-folders').innerHTML = trips.map(t => `<article class="trip-folder"><span class="folder-icon" aria-hidden="true">▱</span><h3>${escape(t.name)}</h3><p class="trip-date small muted">${escape(formatTripCreatedAt(t.createdAt))}</p><p class="muted">${escape(t.country)} · ${t.days} jours · ${t.places.length} lieux</p><p class="small muted">${t.mode === 'walking' ? 'À pied' : 'En voiture'} · ${t.fileOrder ? 'Ordre du carnet' : 'Par proximité'}</p><div class="folder-actions"><button class="secondary" data-trip-open="${escape(t.id)}">Consulter</button><button class="quiet" data-trip-edit="${escape(t.id)}">Modifier</button><button class="danger-button" data-trip-delete="${escape(t.id)}">Supprimer</button></div></article>`).join('');
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
      if ($('#results').dataset.tripId === id) { $('#results').hidden = true; currentRecord = null; routeGeneration++; }
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
    $('#trip-dialog').close(); showTrip(record); notice(`Le voyage « ${record.name} » a été mis à jour.`);
  } catch (error) { alert(error.message); }
});
function resultLink(value) {
  if (savedMapsURL(value)) return savedMapsURL(value);
  try { const u = new URL(value); return u.protocol === 'https:' && u.hostname === 'www.openstreetmap.org' ? u.href : null; } catch { return null; }
}
$('#maps-provider').value = mapsProvider;
function showProvider() {
  $('#free-settings').hidden = mapsProvider !== 'free';
  $('#paid-settings').hidden = mapsProvider !== 'google';
}
showProvider();
$('#maps-provider').addEventListener('change', () => {
  mapsProvider = $('#maps-provider').value;
  try { localStorage.setItem('voyage.maps.provider', mapsProvider); } catch {}
  showProvider();
  if (currentRecord) showTrip(currentRecord);
});
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
$('#google-api-key').value = googleKey;
if (googleKey) $('#google-status').textContent = 'Clé disponible dans cette session. Les services seront chargés lors de votre demande.';
const googleError = error => String(error?.message || 'Google Maps n’a pas répondu.').replaceAll(googleKey || '\u0000', '[clé masquée]');
function requireGoogle() {
  if (!googleKey) {
    $('#google-settings').open = true;
    throw new Error('Configurez une clé Google Maps Platform dans « Services Google Maps ». Les API Places (New), Routes et Maps JavaScript et la facturation doivent être activées.');
  }
  return loadGoogle(googleKey);
}
$('#google-config-form').addEventListener('submit', async e => {
  e.preventDefault();
  googleKey = $('#google-api-key').value.trim();
  if (!googleKey) { $('#google-status').textContent = 'Indiquez votre clé de navigateur Google Maps.'; return; }
  try {
    try { sessionStorage.setItem('voyage.google.session', googleKey); } catch { /* Kept only in memory. */ }
    $('#google-status').textContent = 'Chargement de Google Maps…';
    await requireGoogle();
    $('#google-status').textContent = 'Bibliothèque Google chargée. Les autorisations Places et Routes seront vérifiées lors de la première requête. Les appels peuvent être facturés.';
  } catch (error) { $('#google-status').textContent = googleError(error); }
});
$('#google-forget').addEventListener('click', () => {
  googleKey = ''; $('#google-api-key').value = '';
  try { sessionStorage.removeItem('voyage.google.session'); } catch { /* No stored session. */ }
  $('#google-status').textContent = 'Clé oubliée. Rechargez la page pour décharger Google Maps ou utiliser une autre clé.';
});
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
  const queue = list.filter(Boolean).slice(0, mapsProvider === 'free' ? 1 : 10);
  if (!queue.length) { notice('Aucun lieu à rechercher. Cochez des lieux sans coordonnées dans la vue actuelle.'); return; }
  if (mapsProvider === 'google' && !googleKey && queue.some(p => !fromURL(p.url))) {
    $('#google-settings').open = true;
    notice('Ces liens contiennent des identifiants Google, pas de coordonnées. Configurez d’abord votre clé dans « Services Google Maps ».');
    $('#google-settings').scrollIntoView({ behavior: 'smooth' }); return;
  }
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
      if (trip) showTrip(trip);
    }
    notice('Recherche terminée. Les correspondances confirmées ont été enregistrées. Relancez pour traiter les autres lieux si nécessaire.');
    return;
  }
  const p = resolveQueue[0];
  $('#resolve-search-engine').closest('label').hidden = mapsProvider !== 'free';
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
    const embedded = fromURL(p.url);
    const options = mapsProvider === 'free' ? await findFreePlaces(searchPlace) : await findGooglePlaces({ ...searchPlace, name: [searchPlace.searchName, searchPlace.searchCity].filter(Boolean).join(', '), url: refineSearch ? '' : p.url }, embedded && !refineSearch ? null : await requireGoogle());
    if (generation !== resolveGeneration) return;
    resolveOptions = options;
    $('#resolve-status').textContent = options.length ? 'Confirmez la bonne correspondance avant de conserver les coordonnées.' : 'Aucun résultat trouvé. Précisez la ville et le pays ci-dessus, essayez Photon ou saisissez les coordonnées depuis le lien Maps.';
    $('#resolve-candidates').innerHTML = options.map((o, i) => `<article class="resolve-option"><strong>${escape(o.name)}</strong><p class="small muted">${escape(o.address)} · ${escape(o.country || 'Pays inconnu')}</p><p class="small muted">${o.lat.toFixed(6)}, ${o.lng.toFixed(6)}${o.exact ? ' · Identifiant Google identique au lien enregistré' : ''}</p>${resultLink(o.url) ? `<a class="place-link" href="${escape(resultLink(o.url))}" target="_blank" rel="noopener noreferrer">Vérifier le lieu · ${escape(o.source || 'Google Maps')} ↗</a>` : ''}<button class="secondary" type="button" data-resolve-choice="${i}">${missingWorkflow ? 'Confirmer et rechercher le suivant' : 'Confirmer ce lieu'}</button></article>`).join('');
  if (missingWorkflow) ($('#resolve-candidates button') || $('#resolve-skip')).focus();
  } catch (error) { if (generation === resolveGeneration) $('#resolve-status').textContent = `${googleError(error)} Vérifiez la connexion et les réglages du service, ou précisez le pays et la ville dans le nom du lieu.`; }
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
  const patch = { lat: found.lat, lng: found.lng, country: found.country || original.country, googlePlaceId: found.placeId || '', ...(found.address ? { address: found.address } : {}), ...(original.descriptionSource && (original.lat !== found.lat || original.lng !== found.lng) ? { description: '', descriptionSource: '' } : {}) };
  try {
    if (resolveTripId) {
      const previous = trips.find(t => t.id === resolveTripId);
      if (!previous) throw new Error('Ce voyage a été supprimé.');
      const updated = { ...previous, places: previous.places.map(p => p.id === original.id ? { ...p, ...patch } : p), updatedAt: new Date().toISOString() };
      storeTrips(trips.map(t => t.id === updated.id ? updated : t));
      if (currentRecord?.id === updated.id) currentRecord = updated;
    } else {
      const next = places.map(p => p.id === original.id ? { ...p, ...patch } : p);
      localStorage.setItem(key, JSON.stringify(next)); places = next; render();
      $('#results').hidden = true;
    }
    resolveQueue.shift(); resolveNext();
  } catch (error) { $('#resolve-status').textContent = `Coordonnées non enregistrées : ${googleError(error)}`; }
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
$('#google-routes').addEventListener('click', async () => {
  if (!currentRecord) return;
  const record = currentRecord, generation = routeGeneration;
  const trip = planTrip(record.places, record.days, record.startId, record.fileOrder);
  const button = $('#google-routes'); button.disabled = true;
  let passed = 0, failed = 0;
  try {
    await mapReady;
    if (generation !== routeGeneration) return;
    const provider = mapsProvider;
    let Route;
    if (provider === 'google') {
      const maps = await requireGoogle();
      ({ Route } = await maps.importLibrary('routes'));
      if (!Route?.computeRoutes) throw new Error('La bibliothèque Routes Google n’est pas disponible. Vérifiez Maps JavaScript API et Routes API.');
    }
    for (let i = 0; i < trip.days.length; i++) {
      if (generation !== routeGeneration) return;
      const target = document.querySelector(`[data-google-day="${i}"]`);
      target.textContent = 'Calcul du trajet en cours…';
      try {
        const result = provider === 'free' ? await computeFreeDay(trip.days[i], record.mode) : await computeGoogleDay(trip.days[i], record.mode, Route);
        if (generation !== routeGeneration) return;
        target.textContent = provider === 'free' ? formatFreeRoute(result) : formatGoogleRoute(result);
        if (provider === 'free' && result.geometry) {
          tripMap.setRoute(i, result.geometry);
          $('#map-status').textContent = 'Traits pleins : trajets OSRM calculés. Pointillés restants : liaisons schématiques non calculées. Utilisez la légende pour isoler chaque jour.';
        }
        passed++;
      } catch (error) {
        if (generation !== routeGeneration) return;
        target.textContent = `Trajet indisponible : ${googleError(error)}`; failed++;
      }
    }
    $('#google-routes-status').textContent = `${passed} journée(s) calculée(s), ${failed} non calculée(s). Source : ${provider === 'free' ? 'OpenStreetMap / OSRM (sans trafic)' : 'Google Maps'}, calcul à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}. Temps de déplacement uniquement, hors visites. Liaison depuis la veille incluse ; aucun hébergement ni retour. Les durées restent indicatives. Recalculez à votre prochaine visite.`;
  } catch (error) { if (generation === routeGeneration) $('#google-routes-status').textContent = googleError(error); }
  finally { if (generation === routeGeneration) button.disabled = false; }
});
renderTrips();
$('#print').addEventListener('click', () => window.print());
render();
