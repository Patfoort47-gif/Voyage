import { coordinates } from './core.js';

export const dayColors = ['#1565c0', '#c62828', '#2e7d32', '#7b1fa2', '#d45b00', '#007f86', '#ad1457', '#5d4037'];
let loading;
function leaflet() {
  if (globalThis.L) return Promise.resolve(globalThis.L);
  if (!loading) loading = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = new URL('../vendor/leaflet/leaflet.js', import.meta.url).href;
    script.onload = () => resolve(globalThis.L);
    script.onerror = () => reject(new Error('La bibliothèque de carte ne peut pas être chargée.'));
    document.head.append(script);
  });
  return loading;
}

export function schematicSegments(day) {
  const stops = day.previous ? [day.previous, ...day.stops] : day.stops;
  return stops.slice(1).flatMap((p, i) => coordinates(stops[i].lat, stops[i].lng) && coordinates(p.lat, p.lng) ? [[[stops[i].lat, stops[i].lng], [p.lat, p.lng]]] : []);
}

export class TripMap {
  constructor() { this.version = 0; this.layers = []; }
  async show(trip) {
    const version = ++this.version;
    try {
      const L = await leaflet();
      if (version !== this.version) return;
      if (!this.map) {
        this.map = L.map('trip-map', { scrollWheelZoom: false }).setView([25, 5], 2);
        const tiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(this.map);
        tiles.on('tileerror', () => { document.querySelector('#map-status').textContent = 'Fond de carte indisponible. Les étapes et tracés restent affichés ; vérifiez votre connexion.'; });
      }
      this.layers.forEach(layer => this.map.removeLayer(layer.group)); this.layers = [];
      const legend = document.querySelector('#map-legend'); legend.replaceChildren();
      const bounds = [];
      trip.days.forEach((day, i) => {
        const color = dayColors[i % dayColors.length], group = L.layerGroup().addTo(this.map);
        const line = L.layerGroup().addTo(group);
        schematicSegments(day).forEach(segment => L.polyline(segment, { color, weight: 4, dashArray: '7 9' }).addTo(line));
        day.stops.forEach((p, j) => {
          if (!coordinates(p.lat, p.lng)) return;
          bounds.push([p.lat, p.lng]);
          const label = document.createElement('span'); label.textContent = `Jour ${i + 1} · étape ${j + 1} : ${p.name}`;
          L.circleMarker([p.lat, p.lng], { color, fillColor: color, fillOpacity: 1, radius: 7, weight: 3 }).bindTooltip(label).addTo(group);
        });
        const label = document.createElement('label'), checkbox = document.createElement('input'), swatch = document.createElement('span'), text = document.createElement('span');
        checkbox.type = 'checkbox'; checkbox.checked = true; checkbox.setAttribute('aria-label', `Afficher le jour ${i + 1}`);
        swatch.className = 'day-swatch'; swatch.style.backgroundColor = color; text.textContent = `Jour ${i + 1}`;
        checkbox.addEventListener('change', () => checkbox.checked ? group.addTo(this.map) : this.map.removeLayer(group));
        label.append(checkbox, swatch, text); legend.append(label);
        this.layers.push({ group, line, color });
      });
      this.map.invalidateSize();
      if (bounds.length) this.map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
      const missing = trip.days.flatMap(d => d.stops).filter(p => !coordinates(p.lat, p.lng)).length;
      document.querySelector('#map-status').textContent = `${missing ? `${missing} lieu(x) sans coordonnées ne peuvent pas être affichés. ` : ''}Pointillés : liaisons schématiques, pas des routes. Calculez les km et temps pour obtenir les tracés routiers disponibles.`;
    } catch (error) { if (version === this.version) document.querySelector('#map-status').textContent = error.message; }
  }
  setRoute(index, path) {
    const layer = this.layers[index];
    if (!layer || !Array.isArray(path) || path.length < 2) return;
    layer.line.clearLayers(); globalThis.L.polyline(path, { color: layer.color, weight: 5, opacity: 0.85 }).addTo(layer.line);
  }
}
