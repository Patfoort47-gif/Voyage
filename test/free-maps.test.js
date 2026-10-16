import test from 'node:test';
import assert from 'node:assert/strict';
import { findFreePlaces, computeFreeDay, formatFreeRoute, readServices, defaultServices, serviceURL } from '../src/free-maps.js';

test('recherche OSM sans clé : candidats avec pays, validation humaine et cache', async () => {
  const values = new Map(), storage = { getItem: k => values.get(k) || null, setItem: (k, v) => values.set(k, v) };
  let calls = 0;
  const request = async url => {
    calls++; const u = new URL(url); assert.equal(u.searchParams.get('q'), 'Jardin japonais, Monaco');
    assert.equal(u.searchParams.get('addressdetails'), '1'); assert.ok(!u.searchParams.has('key'));
    return [{ lat: '43.74', lon: '7.43', name: 'Jardin japonais', display_name: 'Jardin japonais, Monaco', address: { country: 'Monaco' }, osm_type: 'way', osm_id: 123 }];
  };
  const p = { name: 'Jardin japonais', country: 'Monaco', url: 'https://www.google.com/maps/place/Jardin/data=!1s0x123:0x456' };
  const found = await findFreePlaces(p, defaultServices, request, storage);
  assert.equal(found[0].lat, 43.74); assert.equal(found[0].country, 'Monaco');
  assert.equal(found[0].url, 'https://www.openstreetmap.org/way/123');
  assert.equal(found[0].source, 'OpenStreetMap');
  assert.deepEqual(await findFreePlaces(p, defaultServices, request, storage), found); assert.equal(calls, 1);
});

test('OSRM : longitude puis latitude, vraies unités et liaison depuis la veille', async () => {
  let requested;
  const result = await computeFreeDay({ previous: { lat: 43.7, lng: 7.4 }, stops: [{ lat: 43.8, lng: 7.5 }, { lat: 43.9, lng: 7.6 }] }, 'driving', defaultServices, async url => {
    requested = url; return { code: 'Ok', routes: [{ distance: 12300, duration: 3720, legs: [{}, {}] }] };
  });
  assert.ok(requested.includes('/driving/7.4,43.7;7.5,43.8;7.6,43.9'));
  assert.equal(result.distanceMeters, 12300); assert.equal(result.durationMillis, 3720000);
  assert.ok(formatFreeRoute(result).includes('12,3 km · 1 h 02'));
  assert.ok(formatFreeRoute(result).includes('sans trafic'));
});

test('trajet à pied : serveur piéton distinct, jamais une estimation voiture renommée', async () => {
  await computeFreeDay({ stops: [{ lat: 43, lng: 7 }, { lat: 44, lng: 8 }] }, 'walking', defaultServices, async url => {
    assert.ok(url.startsWith(defaultServices.walking)); assert.ok(!url.includes('/driving/'));
    return { code: 'Ok', routes: [{ distance: 1000, duration: 900, legs: [{}] }] };
  });
});

test('grands parcours : blocs de 25 points sans perte ni duplication de liaisons', async () => {
  let legs = 0, calls = 0;
  const result = await computeFreeDay({ stops: Array.from({ length: 60 }, (_, i) => ({ lat: i, lng: 1 })) }, 'driving', defaultServices, async url => {
    const points = new URL(url).pathname.split('/').at(-1).split(';'); calls++; assert.ok(points.length <= 25); legs += points.length - 1;
    return { code: 'Ok', routes: [{ distance: (points.length - 1) * 1000, duration: 10, legs: points.slice(1).map(() => ({})) }] };
  });
  assert.equal(calls, 3); assert.equal(legs, 59); assert.equal(result.distanceMeters, 59000);
});

test('pas de faux zéro si le service ne trouve pas de route ou renvoie un trajet partiel', async () => {
  const day = { stops: [{ lat: 43, lng: 7 }, { lat: 44, lng: 8 }] };
  for (const data of [{ code: 'NoRoute' }, { code: 'Ok', routes: [{ distance: 10, duration: 10, legs: [] }] }]) {
    await assert.rejects(computeFreeDay(day, 'driving', defaultServices, async () => data), /complet/);
  }
  await assert.rejects(computeFreeDay({ stops: [{ name: 'Sans coordonnées' }, day.stops[0]] }, 'driving'), /coordonnées/);
  assert.equal((await computeFreeDay({ stops: [day.stops[0]] }, 'driving')).noTravel, true);
});

test('services interchangeables, sans accepter une URL avec secret ou un protocole non HTTPS', () => {
  assert.deepEqual(readServices({ getItem: () => null }), defaultServices);
  for (const url of ['http://example.com/search', 'https://user:secret@example.com/search', 'https://example.com/search?key=secret']) assert.throws(() => serviceURL(url));
});
