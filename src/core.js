export function coordinates(lat, lng) {
  if (lat === '' || lng === '' || lat == null || lng == null) return null;
  const a = Number(lat), b = Number(lng);
  return Number.isFinite(a) && Number.isFinite(b) && Math.abs(a) <= 90 && Math.abs(b) <= 180 ? { lat: a, lng: b } : null;
}

export function fromURL(value) {
  try {
    const u = new URL(value);
    // A map camera (@lat,lng) is not necessarily the saved place.
    for (const key of ['query', 'q']) {
      const m = (u.searchParams.get(key) || '').match(/^(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)$/);
      if (m) return coordinates(m[1], m[2]);
    }
  } catch { /* A short URL requires manual coordinates. */ }
  return null;
}

export function parseCSV(text) {
  const first = text.split(/\r?\n/)[0];
  const delimiter = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ';' : ',';
  const rows = []; let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') { cell += '"'; i++; }
      else quoted = !quoted;
    } else if (c === delimiter && !quoted) { row.push(cell); cell = ''; }
    else if (c === '\n' && !quoted) { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
    else cell += c;
  }
  if (quoted) throw new Error('Le fichier CSV contient un guillemet non fermé.');
  if (cell || row.length) { row.push(cell.replace(/\r$/, '')); rows.push(row); }
  const headers = (rows.shift() || []).map(h => h.replace(/^\uFEFF/, '').trim().toLowerCase());
  return rows.filter(r => r.some(Boolean)).map(r => Object.fromEntries(headers.map((h, i) => [h, r[i] || ''])));
}

export function importPlaces(text, filename, country = '', category = 'À visiter') {
  let rows;
  if (/\.(json|geojson)$/i.test(filename)) {
    const data = JSON.parse(text);
    if (data.type !== 'FeatureCollection' || !Array.isArray(data.features)) throw new Error('Un fichier GeoJSON FeatureCollection est attendu.');
    rows = data.features.map(f => {
      const p = f.properties || {}, location = p.Location || {}, point = f.geometry?.type === 'Point' ? f.geometry.coordinates : [];
      return { title: p.name || p.Title || location['Business Name'], country: p.country || location.Country || country,
        category: p.category || category, url: p['Google Maps URL'] || p.url || '', latitude: point[1], longitude: point[0], note: p.Comment || p.note || '' };
    });
  } else if (/\.csv$/i.test(filename)) rows = parseCSV(text);
  else throw new Error('Choisis un fichier CSV, JSON ou GeoJSON décompressé.');
  const places = rows.map(r => {
    const url = r.url || r['google maps url'] || '';
    const point = coordinates(r.latitude ?? r.lat, r.longitude ?? r.lng ?? r.lon) || fromURL(url);
    return { name: String(r.title || r.name || r.nom || '').trim(), country: String(r.country || r.pays || country).trim(), category: String(r.category || r.catégorie || category).trim(), note: String(r.note || r.notes || ''), url: String(url), ...(point || { lat: null, lng: null }) };
  }).filter(p => p.name);
  if (!places.length) throw new Error('Aucun lieu reconnu. Colonnes attendues : Title ou name, URL, country, latitude, longitude.');
  return places;
}

export function distance(a, b) {
  const rad = x => x * Math.PI / 180;
  const x = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(Math.max(0, 1 - x)));
}

export function planTrip(places, days, startId) {
  if (!Number.isInteger(days) || days < 1 || days > 30) throw new Error('Choisis entre 1 et 30 jours.');
  if (!places.length) throw new Error('Sélectionne au moins un lieu.');
  if (places.some(p => !coordinates(p.lat, p.lng))) throw new Error('Complète les coordonnées des lieux sélectionnés avant de calculer le parcours.');
  const remaining = [...places];
  const start = Math.max(0, remaining.findIndex(p => p.id === startId));
  const ordered = [remaining.splice(start, 1)[0]];
  while (remaining.length) {
    let best = 0;
    remaining.forEach((p, i) => { if (distance(ordered.at(-1), p) < distance(ordered.at(-1), remaining[best])) best = i; });
    ordered.push(remaining.splice(best, 1)[0]);
  }
  // Keep geographic continuity while balancing the number of visits.
  const count = Math.min(days, ordered.length), result = []; let offset = 0;
  for (let i = 0; i < count; i++) {
    const size = Math.ceil((ordered.length - offset) / (count - i));
    const stops = ordered.slice(offset, offset + size);
    const previous = offset ? ordered[offset - 1] : null;
    const travel = previous ? [previous, ...stops] : stops;
    const km = travel.slice(1).reduce((sum, p, j) => sum + distance(travel[j], p), 0);
    result.push({ stops, previous, km }); offset += size;
  }
  return { days: result, unusedDays: days - count };
}

export function mapsLinks(day, mode) {
  const stops = day.previous ? [day.previous, ...day.stops] : day.stops;
  const coord = p => `${p.lat},${p.lng}`;
  if (stops.length === 1) return [`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(coord(stops[0]))}`];
  const links = [];
  for (let i = 0; i < stops.length - 1; i += 4) {
    const part = stops.slice(i, i + 5);
    const query = new URLSearchParams({ api: '1', origin: coord(part[0]), destination: coord(part.at(-1)), travelmode: mode });
    if (part.length > 2) query.set('waypoints', part.slice(1, -1).map(coord).join('|'));
    links.push(`https://www.google.com/maps/dir/?${query}`);
  }
  return links;
}

export const demo = [
  ['Tour de Belém', 'Patrimoine', 38.6916, -9.2160], ['Monastère des Hiéronymites', 'Patrimoine', 38.6979, -9.2067],
  ['LX Factory', 'Balade', 38.7031, -9.1788], ['Praça do Comércio', 'Balade', 38.7078, -9.1366],
  ['Château Saint-Georges', 'Patrimoine', 38.7139, -9.1335], ['Miradouro da Graça', 'Point de vue', 38.7162, -9.1314],
  ['Palais de Pena', 'Patrimoine', 38.7876, -9.3906], ['Quinta da Regaleira', 'Patrimoine', 38.7960, -9.3960],
  ['Cabo da Roca', 'Nature', 38.7804, -9.4991], ['Boca do Inferno', 'Nature', 38.6911, -9.4310]
].map(([name, category, lat, lng], i) => ({ id: `demo-${i}`, name, category, lat, lng, country: 'Portugal', note: '', selected: true }));
