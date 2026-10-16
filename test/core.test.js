import test from 'node:test';
import assert from 'node:assert/strict';
import { coordinates, fromURL, importPlaces, parseCSV, planTrip, mapsLinks, demo } from '../src/core.js';

test('CSV Takeout : notes multilignes, virgules et guillemets', () => {
  const csv = 'Title,Note,URL\r\n"Palais, jardin","Une note\navec ""citation""",https://maps.google.com/?q=38.7%2C-9.1\r\n';
  assert.equal(parseCSV(csv)[0].note, 'Une note\navec "citation"');
  const [p] = importPlaces(csv, 'saved.csv', 'Portugal');
  assert.equal(p.name, 'Palais, jardin'); assert.equal(p.country, 'Portugal'); assert.equal(p.lat, 38.7);
});
test('CSV français et coordonnées absentes ne deviennent pas 0,0', () => {
  const [p] = importPlaces('nom;pays;latitude;longitude\nTour;France;;', 'lieux.csv');
  assert.equal(p.lat, null); assert.equal(p.country, 'France');
  assert.equal(coordinates('', ''), null); assert.equal(coordinates(91, 0), null);
  assert.equal(fromURL('https://google.com/maps/@48.3,2.1,10z'), null);
});
test('GeoJSON Takeout utilise longitude puis latitude et les métadonnées', () => {
  const data = { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [-9.2, 38.7] }, properties: { Title: 'Belém', Location: { Country: 'Portugal' }, Comment: 'Vue' } }] };
  const [p] = importPlaces(JSON.stringify(data), 'lieux.json');
  assert.equal(p.lat, 38.7); assert.equal(p.lng, -9.2); assert.equal(p.note, 'Vue');
  assert.throws(() => importPlaces('{}', 'lieux.json'), /FeatureCollection/);
});
test('10 lieux en 5 jours : aucune omission, départ demandé et liaisons interjours', () => {
  const trip = planTrip(demo, 5, 'demo-4');
  assert.equal(trip.days.length, 5);
  assert.equal(trip.days[0].stops[0].id, 'demo-4');
  assert.equal(new Set(trip.days.flatMap(d => d.stops.map(p => p.id))).size, 10);
  assert.ok(trip.days.every(d => d.stops.length === 2));
  assert.equal(trip.days[1].previous.id, trip.days[0].stops.at(-1).id);
  assert.ok(trip.days[1].km > 0);
});
test('jours libres, lieux incomplets et durée invalide sont traités', () => {
  assert.equal(planTrip(demo.slice(0, 2), 5).unusedDays, 3);
  assert.throws(() => planTrip([], 5), /Sélectionne/);
  assert.throws(() => planTrip([{ lat: null, lng: null }], 5), /coordonnées/);
  for (const days of [0, 31, 1.2, NaN]) assert.throws(() => planTrip(demo, days));
});
test('liens Maps : 3 étapes intermédiaires maximum et continuité entre les parties', () => {
  const links = mapsLinks({ stops: demo, previous: null }, 'driving').map(url => new URL(url));
  assert.equal(links.length, 3);
  links.forEach(u => assert.ok((u.searchParams.get('waypoints') || '').split('|').filter(Boolean).length <= 3));
  assert.equal(links[0].searchParams.get('destination'), links[1].searchParams.get('origin'));
  assert.equal(new URL(mapsLinks({ stops: [demo[0]] }, 'walking')[0]).pathname, '/maps/search/');
});
