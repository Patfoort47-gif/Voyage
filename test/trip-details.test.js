import test from 'node:test';
import assert from 'node:assert/strict';
import { createTrip, updateTripPlace } from '../src/trips.js';
import { demo, importPlaces } from '../src/core.js';
import { schematicSegments } from '../src/trip-map.js';
import { findArticles, findPlaceArticles, suggestedLanguage, wikipediaLink } from '../src/place-info.js';
import { computeFreeDay, defaultServices } from '../src/free-maps.js';

test('corriger un lieu du dossier conserve identité, date et carnet d’origine', () => {
  const trip = createTrip({ name: 'Portugal', country: 'Portugal', days: 5, mode: 'driving', fileOrder: false, places: demo });
  const updated = updateTripPlace(trip, demo[0].id, { lat: 38.69, lng: -9.21, description: 'Descriptif', practicalInfo: 'Accès piéton' });
  assert.equal(updated.createdAt, trip.createdAt); assert.equal(updated.id, trip.id);
  assert.equal(trip.places[0].lat, demo[0].lat); assert.equal(updated.places[0].lat, 38.69);
  assert.equal(updated.places[0].description, 'Descriptif');
  assert.throws(() => updateTripPlace(trip, 'inconnu', {}), /figure plus/);
  assert.throws(() => updateTripPlace(trip, demo[0].id, { lat: 1000 }));
});

test('carte : ne relie pas deux lieux en sautant une étape sans coordonnées', () => {
  const a = { lat: 40, lng: 2 }, b = { lat: null, lng: null }, c = { lat: 41, lng: 3 };
  assert.deepEqual(schematicSegments({ stops: [a, b, c] }), []);
  assert.deepEqual(schematicSegments({ previous: a, stops: [c] }), [[[40, 2], [41, 3]]]);
});

test('géométrie OSRM : conversion en latitude/longitude sans présenter un tracé absent', async () => {
  const day = { stops: [{ lat: 40, lng: 2 }, { lat: 41, lng: 3 }] };
  const route = { distance: 100, duration: 60, legs: [{}], geometry: { type: 'LineString', coordinates: [[2, 40], [2.5, 40.5], [3, 41]] } };
  const result = await computeFreeDay(day, 'driving', defaultServices, async value => {
    assert.equal(new URL(value).searchParams.get('geometries'), 'geojson');
    return { code: 'Ok', routes: [route] };
  });
  assert.deepEqual(result.geometry, [[40, 2], [40.5, 2.5], [41, 3]]);
  assert.equal((await computeFreeDay(day, 'driving', defaultServices, async () => ({ code: 'Ok', routes: [{ ...route, geometry: null }] }))).geometry, null);
});

test('fiches Wikipédia : vrais extraits et source sûre, aucune fiche fabriquée', async () => {
  const articles = await findArticles('Lieu Portugal', 'fr', async value => {
    const u = new URL(value); assert.equal(u.hostname, 'fr.wikipedia.org'); assert.equal(u.searchParams.get('explaintext'), '1');
    return { ok: true, json: async () => ({ query: { pages: { 1: { title: 'Lieu', extract: 'Description sourcée.', fullurl: 'https://fr.wikipedia.org/wiki/Lieu', index: 1 }, 2: { title: 'Faux', extract: 'Texte', fullurl: 'javascript:alert(1)' } } } }) };
  });
  assert.equal(articles.length, 1); assert.equal(articles[0].description, 'Description sourcée.');
  assert.equal(wikipediaLink('https://fr.wikipedia.org.evil.test/wiki/Test'), null);
  assert.deepEqual(await findArticles('Inconnu', 'fr', async () => ({ ok: true, json: async () => ({}) })), []);
});

test('sauvegarde GeoJSON : conservation des descriptifs, sources et informations', () => {
  const data = { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [2, 40] }, properties: { name: 'Lieu', description: 'Description', descriptionSource: 'https://fr.wikipedia.org/wiki/Lieu', address: 'Adresse', practicalInfo: 'Accès' } }] };
  const [place] = importPlaces(JSON.stringify(data), 'lieux.geojson');
  assert.equal(place.description, 'Description'); assert.equal(place.practicalInfo, 'Accès'); assert.equal(place.address, 'Adresse');
  assert.equal(place.descriptionSource, 'https://fr.wikipedia.org/wiki/Lieu');
});

test('Wikipédia Suède : nom local, ville, pays localisé et exclusion de l’homonyme français', async () => {
  const found = await findPlaceArticles({ name: 'Église Saint-Nicolas', localName: 'Storkyrkan', city: 'Stockholm', country: 'Suède', lat: 59.325, lng: 18.071 }, 'sv', async value => {
    const url = new URL(value);
    assert.equal(url.hostname, 'sv.wikipedia.org');
    assert.equal(url.searchParams.get('gsrsearch'), 'Storkyrkan Stockholm Sverige');
    return { ok: true, json: async () => ({ query: { pages: {
      1: { title: 'Storkyrkan', extract: 'Description locale.', fullurl: 'https://sv.wikipedia.org/wiki/Storkyrkan', index: 1, coordinates: [{ lat: 59.325, lon: 18.071 }] },
      2: { title: 'Homonyme français', extract: 'À ne pas utiliser.', fullurl: 'https://sv.wikipedia.org/wiki/Homonyme', index: 2, coordinates: [{ lat: 48.85, lon: 2.35 }] }
    } } }) };
  });
  assert.equal(found.length, 1); assert.equal(found[0].verifiedLocation, true);
  assert.equal(found[0].title, 'Storkyrkan');
  assert.equal(suggestedLanguage({ country: 'Jordanie' }), 'ar');
  assert.equal(suggestedLanguage({ country: 'France' }), 'fr');
});

test('français prioritaire, puis langue du pays avec le nom local si aucune fiche française', async () => {
  const calls = [];
  const found = await findPlaceArticles({ name: 'Église Saint-Nicolas', localName: 'Storkyrkan', city: 'Stockholm', country: 'Suède', lat: 59.325, lng: 18.071 }, 'auto', async value => {
    const url = new URL(value); calls.push(url);
    const pages = url.hostname === 'fr.wikipedia.org' ? {} : { 1: { title: 'Storkyrkan', extract: 'Résumé', fullurl: 'https://sv.wikipedia.org/wiki/Test', coordinates: [{ lat: 59.325, lon: 18.071 }] } };
    return { ok: true, json: async () => ({ query: { pages } }) };
  });
  assert.equal(calls.length, 3); assert.equal(calls[0].hostname, 'fr.wikipedia.org'); assert.equal(calls[1].hostname, 'fr.wikipedia.org'); assert.equal(calls[2].hostname, 'sv.wikipedia.org'); assert.ok(calls[2].searchParams.get('gsrsearch').startsWith('Storkyrkan'));
  assert.equal(found[0].title, 'Storkyrkan');
});

test('ville et pays exigés, fiche non géolocalisée signalée au lieu de prétendre la vérifier', async () => {
  await assert.rejects(findPlaceArticles({ name: 'Église', city: 'Paris', country: '' }), /pays/);
  await assert.rejects(findPlaceArticles({ name: 'Église', city: '', country: 'France' }), /ville/);
  const found = await findPlaceArticles({ name: 'Église', city: 'Paris', country: 'France' }, 'fr', async () => ({ ok: true, json: async () => ({ query: { pages: { 1: { title: 'Église', extract: 'Texte', fullurl: 'https://fr.wikipedia.org/wiki/Test' } } } }) }));
  assert.equal(found[0].verifiedLocation, false);
});
