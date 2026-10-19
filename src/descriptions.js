import { coordinates } from './core.js';
import { reverseFreePlace } from './free-maps.js';
import { findPlaceArticles, automaticArticle, countryCode } from './place-info.js';

export async function prepareDescription(place, reverse = reverseFreePlace, search = findPlaceArticles) {
  const context = { ...place };
  let warning = '';
  if ((!context.city || !context.localName) && coordinates(context.lat, context.lng)) {
    try {
      const found = await reverse(context);
      const expected = countryCode(context.country, context.countryCode);
      if (expected && found.countryCode && expected !== found.countryCode.toUpperCase()) throw new Error('Le pays du point diffère du pays enregistré. Vérifiez sa localisation.');
      context.city ||= found.city;
      context.country ||= found.country;
      context.countryCode ||= found.countryCode;
      // A nearby reverse result can be a neighbour; only adopt the local name
      // automatically when its point is very close, or the name already agrees.
      if (found.localName && ((found.distanceKm !== null && found.distanceKm <= 0.1) || found.localName.toLowerCase() === context.name?.toLowerCase())) context.localName ||= found.localName;
    } catch (error) { warning = error.message; }
  }
  if (warning.startsWith('Le pays du point')) return { context, options: [], automatic: null, warning };
  if (!context.city || !context.country) return { context, options: [], automatic: null, warning: warning || 'Ville ou pays manquant. Complétez le contexte pour rechercher.' };
  const options = await search(context, 'auto');
  return { context, options, automatic: automaticArticle(context, options), warning };
}
