import { coordinates, fromURL, importPlaces, planTrip, mapsLinks, savedMapsURL, demo } from './core.js';

const $ = s => document.querySelector(s);
const key = 'voyage.places.v1';
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
let places = [];
function notice(message) { $('#notice').textContent = message; }
try {
  const saved = JSON.parse(localStorage.getItem(key) || '[]');
  if (!Array.isArray(saved)) throw new Error();
  places = saved.filter(p => p && typeof p.name === 'string').map(p => ({ ...p, id: p.id || crypto.randomUUID(), country: String(p.country || ''), category: String(p.category || 'À visiter'), selected: p.selected !== false }));
} catch { notice('Le carnet enregistré n’a pas pu être chargé. Vous pouvez importer une sauvegarde.'); }

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
  $('#places').innerHTML = visible.map(p => `<div class="place"><input type="checkbox" data-select="${escape(p.id)}" aria-label="Sélectionner ${escape(p.name)}" ${p.selected ? 'checked' : ''}><div class="place-icon" aria-hidden="true">${p.category === 'Nature' ? '♧' : '⌁'}</div><div class="place-info"><strong>${escape(p.name)}</strong><p>${escape(p.country || 'Pays à compléter')} · ${escape(p.category)}</p>${!coordinates(p.lat, p.lng) ? '<p class="missing">Sans coordonnées · répartition dans l’ordre disponible</p>' : ''}${p.tags ? `<p>Tags : ${escape(p.tags)}</p>` : ''}${p.note ? `<p class="place-note">${escape(p.note)}</p>` : ''}${savedMapsURL(p.url) ? `<a class="place-link" href="${escape(savedMapsURL(p.url))}" target="_blank" rel="noopener noreferrer">Voir le lieu dans Google Maps ↗</a>` : ''}</div><div class="place-actions"><button class="quiet" data-edit="${escape(p.id)}">Modifier</button><button class="quiet" data-delete="${escape(p.id)}" aria-label="Supprimer ${escape(p.name)}">✕</button></div></div>`).join('') || (places.length ? '<p class="muted">Aucun lieu ne correspond à cette recherche.</p>' : '');
  renderStart();
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
$('#places').addEventListener('change', e => {
  const p = places.find(p => p.id === e.target.dataset.select);
  if (p) { p.selected = e.target.checked; save(); }
});
$('#places').addEventListener('click', e => {
  const edit = e.target.closest('[data-edit]'), remove = e.target.closest('[data-delete]');
  if (edit) openPlace(places.find(p => p.id === edit.dataset.edit));
  if (remove) {
    const p = places.find(p => p.id === remove.dataset.delete);
    if (p && confirm(`Supprimer « ${p.name} » de ce carnet ?`)) { places = places.filter(q => q.id !== p.id); save(); }
  }
});
function openPlace(p) {
  const form = $('#place-form'); form.reset();
  for (const field of ['id', 'name', 'country', 'category', 'url', 'lat', 'lng', 'note', 'tags']) form.elements[field].value = p?.[field] ?? (field === 'category' ? 'À visiter' : '');
  $('#place-dialog-title').textContent = p ? 'Modifier le lieu' : 'Ajouter un lieu';
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
  const old = places.find(p => p.id === fields.id);
  const p = { id: old?.id || crypto.randomUUID(), name, country: normalize(country, 'country'), category: normalize(fields.category.trim() || 'À visiter', 'category'), url: fields.url, note: fields.note, tags: fields.tags.trim(), selected: old?.selected ?? true, ...(point || { lat: null, lng: null }) };
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
$('#plan-form').addEventListener('submit', e => {
  e.preventDefault();
  try {
    const trip = planTrip(candidates(), Number($('#days').value), $('#start').value, $('#file-order').checked);
    const mode = $('#mode').value;
    $('#result-title').textContent = `${$('#country').value}, à votre rythme.`;
    const km = trip.days.reduce((sum, day) => sum + day.km, 0);
    $('#result-summary').textContent = `${candidates().length} lieux · ${trip.days.length} jours avec des visites · ${trip.fileOrder ? 'Ordre du carnet conservé (sauf le premier lieu si vous en avez choisi un). Aucun tri par proximité ni calcul des distances ou temps de trajet. Google Maps recherchera les étapes par nom et pays si elles n’ont pas de coordonnées : vérifiez chaque correspondance.' : `${Math.round(km)} km à vol d’oiseau entre les étapes.`} ${trip.unusedDays ? `${trip.unusedDays} jour(s) libre(s) pour prolonger les visites ou vous reposer.` : ''} Parcours indicatif, sans hébergement ni retour au point de départ.`;
    $('#day-cards').innerHTML = trip.days.map((day, i) => {
      const hours = trip.fileOrder ? null : day.km / (mode === 'walking' ? 4 : 35) + day.stops.length * 1.5;
      return `<article class="day-card"><span class="day-number">JOUR ${String(i + 1).padStart(2, '0')}</span><h3>${escape(day.stops[0].name)}</h3><p class="muted">${day.stops.length} visite(s) · ${trip.fileOrder ? 'ordre du carnet' : `${Math.round(day.km)} km à vol d’oiseau`}</p>${day.previous ? `<p class="small muted">Départ du lien Maps : ${escape(day.previous.name)}, dernière étape de la veille.</p>` : ''}<ol>${day.stops.map(p => `<li>${escape(p.name)}<small>${escape(p.category)}</small>${savedMapsURL(p.url) ? `<a class="place-link" href="${escape(savedMapsURL(p.url))}" target="_blank" rel="noopener noreferrer">Lien Maps enregistré ↗</a>` : ''}</li>`).join('')}</ol><p class="small muted">${trip.fileOrder ? 'Distances et temps de trajet inconnus. Vérifiez les lieux et la faisabilité dans Google Maps.' : `Budget indicatif : ${Math.ceil(hours)} h, avec 1 h 30 par visite et une vitesse théorique de ${mode === 'walking' ? 4 : 35} km/h. Hors pauses, détours et attente.`}</p>${hours > 8 || day.stops.length * 1.5 > 8 ? '<p class="warning">Journée probablement trop chargée. Ajoutez des jours ou retirez des lieux, puis vérifiez les vrais trajets.</p>' : ''}${mapsLinks(day, mode).map((url, j, links) => `<a class="secondary" href="${escape(url)}" target="_blank" rel="noopener noreferrer">Ouvrir dans Maps${links.length > 1 ? ` · partie ${j + 1}` : ''} ↗</a>`).join('')}</article>`;
    }).join('');
    notice(''); $('#results').hidden = false; $('#results').scrollIntoView({ behavior: 'smooth' });
  } catch (error) { notice(error.message); $('#notice').scrollIntoView({ behavior: 'smooth', block: 'center' }); }
});
$('#export').addEventListener('click', () => {
  const data = { type: 'FeatureCollection', features: places.map(p => ({ type: 'Feature', geometry: coordinates(p.lat, p.lng) ? { type: 'Point', coordinates: [p.lng, p.lat] } : null, properties: { name: p.name, country: p.country, category: p.category, note: p.note, tags: p.tags || '', url: p.url } })) };
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/geo+json' }));
  const a = document.createElement('a'); a.href = url; a.download = 'voyage-mes-lieux.geojson'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
});
$('#print').addEventListener('click', () => window.print());
render();
