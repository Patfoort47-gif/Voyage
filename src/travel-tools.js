import { bookingTextFields, bookingCountFields } from './booking-forms.js';
import { clothingItems } from './packing-clothes.js';
import { extraCurrencies } from './destination-currency.js';
import { coordinates } from './core.js';

export const currencies = [...new Set(['EUR','USD','GBP','SEK','NOK','DKK','CHF','JPY','CAD','AUD','NZD','CNY','HKD','SGD','KRW','INR','THB','IDR','MYR','PHP','TRY','PLN','CZK','HUF','RON','BGN','ISK','BRL','MXN','ZAR','MAD','AED',...extraCurrencies])];
export const safeLink = value => {
  try { const u = new URL(value); return u.protocol === 'https:' && !u.username && !u.password ? u.href : ''; } catch { return ''; }
};
export function dateForDay(start, day) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start || '') || !Number.isInteger(day) || day < 1) return '';
  const date = new Date(start + 'T12:00:00Z');
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0,10) !== start) return '';
  date.setUTCDate(date.getUTCDate() + day - 1);
  return date.toISOString().slice(0,10);
}
export function organizerData(trip) {
  const data = structuredClone(trip.organizer || {});
  if (data.packing?.weather && !trip.places.some(p => p.lat === data.packing.weather.lat && p.lng === data.packing.weather.lng)) delete data.packing.weather;
  const activities = trip.places.map(p => `${p.category || ''} ${p.name || ''}`).join(' ').toLowerCase();
  return { ...data, startDate: data.startDate || '', bookings: data.bookings || [], offers: data.offers || [],
    budget: { currency:'EUR', dailyLimit:100, expenses:[], rates:{ values:{EUR:1}, date:'', source:'manual' }, ...data.budget },
    packing: { running:/course à pied|running|jogging/.test(activities), hiking:/randonn|hiking|trekking|trail/.test(activities), watch:false, checked:{}, manual:[], ...data.packing } };
}
export function convert(amount, from, to, rates) {
  const a = from === 'EUR' ? 1 : rates?.[from], b = to === 'EUR' ? 1 : rates?.[to];
  if (!Number.isFinite(amount) || amount < 0 || !(a > 0) || !(b > 0) || !Number.isFinite(a) || !Number.isFinite(b)) return null;
  return amount / a * b;
}
export function dailyBudget(trip, budget) {
  const result = Array.from({length:Math.max(trip.days,...budget.expenses.map(e=>e.day))}, (_,i)=>({ day:i+1, total:0, missing:0, entries:0 }));
  for (const expense of budget.expenses) {
    const row = result[expense.day - 1];
    if (!row) continue;
    row.entries++;
    const value = convert(expense.amount, expense.currency, budget.currency, budget.rates?.values);
    if (value === null) row.missing++; else row.total += value;
  }
  return result;
}
export function offerSavings(offer) {
  if (!offer.eligible || !Number.isFinite(offer.normal) || offer.normal < 0 || !Number.isFinite(offer.price) || offer.price < 0) return null;
  return offer.normal - offer.price;
}
export async function fetchRates(fetcher = fetch) {
  let response;
  try { response = await fetcher('https://api.frankfurter.app/latest?from=EUR', {signal:AbortSignal.timeout(15000)}); }
  catch { throw new Error('Connexion au service de devises impossible. Réessayez ou saisissez un taux manuellement.'); }
  if (!response.ok) throw new Error('Taux indisponibles. Vous pouvez saisir un taux manuellement.');
  const json = await response.json();
  if (json.base !== 'EUR' || !dateForDay(json.date,1) || !json.rates || typeof json.rates !== 'object') throw new Error('Réponse de change invalide.');
  const values = {EUR:1};
  for (const [code,value] of Object.entries(json.rates)) if (/^[A-Z]{3}$/.test(code) && Number.isFinite(value) && value>0) values[code] = value;
  return {values, date:json.date, source:'Frankfurter / banques centrales'};
}
export async function fetchWeather(place, start, days, fetcher = fetch, today = new Date().toISOString().slice(0,10)) {
  if (!coordinates(place?.lat,place?.lng)) throw new Error('Choisissez un lieu avec des coordonnées validées.');
  const originalStart=start || today, first=originalStart<today?today:originalStart, end=dateForDay(originalStart,days), horizon=dateForDay(today,16);
  if (!end || end < today || first > horizon) throw new Error('Prévisions disponibles pour les 16 prochains jours. Choisissez une date de départ dans cette période.');
  const last = end < horizon ? end : horizon;
  const query = new URLSearchParams({latitude:place.lat,longitude:place.lng,daily:'temperature_2m_min,temperature_2m_max,precipitation_probability_max,wind_speed_10m_max',timezone:'auto',temperature_unit:'celsius',wind_speed_unit:'kmh',start_date:first,end_date:last});
  let response;
  try { response = await fetcher('https://api.open-meteo.com/v1/forecast?'+query, {signal:AbortSignal.timeout(15000)}); }
  catch { throw new Error('Connexion météo impossible. Réessayez ; votre liste et les derniers conseils sauvegardés restent disponibles.'); }
  if (!response.ok) throw new Error('Météo indisponible. Les conseils liés aux activités restent accessibles.');
  const data = await response.json(), daily = data.daily;
  if (!Array.isArray(daily?.time) || !daily.time.length) throw new Error('Prévisions absentes.');
  const number = value => Number.isFinite(value) ? value : null;
  const rows = daily.time.map((date,i)=>({date,min:number(daily.temperature_2m_min?.[i]),max:number(daily.temperature_2m_max?.[i]),rain:number(daily.precipitation_probability_max?.[i]),wind:number(daily.wind_speed_10m_max?.[i])}));
  if (rows.some(row=>!dateForDay(row.date,1) || row.date<first || row.date>last)) throw new Error('Dates météo incohérentes.');
  return {location:place.name,lat:place.lat,lng:place.lng,fetchedAt:new Date().toISOString(),start:first,end:last,partial:last<end,days:rows};
}
export function packingItems(packing,days=5) {
  const items = [
    {id:'identity',label:'Pièce d’identité, billets et réservations',why:'Les essentiels'},
    {id:'payment',label:'Moyen de paiement et assurance',why:'Les essentiels'},
    {id:'medication',label:'Traitements habituels et petite trousse de premiers soins',why:'Les essentiels'},
    {id:'phone',label:'Téléphone, chargeur et carte hors connexion',why:'Les essentiels'},
    {id:'water',label:'Gourde et protection solaire',why:'Les essentiels'}
  ];
  items.push(...clothingItems(packing,days));
  const add = (id,label,why)=>items.push({id,label,why});
  if (packing.running || packing.hiking) add('sport-hydration','Réserve d’eau et en-cas adaptés à la durée de la sortie','Activité sportive');
  if (packing.running) { add('run-shoes','Chaussures et tenue de course','Course prévue'); add('run-light','Éclairage ou éléments réfléchissants','Course tôt ou tard'); }
  if (packing.hiking) { add('hike-shoes','Chaussures de randonnée et chaussettes adaptées','Randonnée prévue'); add('hike-kit','En-cas, trousse de secours et carte du parcours','Randonnée prévue'); }
  if (packing.watch) { add('watch-charge','Montre chargée, câble spécifique et batterie externe','Montre de sport'); add('watch-route','Charger et vérifier le parcours dans l’application de la montre','Montre de sport'); add('watch-gps','Vérifier le GPS et les cartes hors connexion de la montre','Montre de sport'); }
  const weather = packing.weather;
  // Ne pas recycler les conseils d’un bulletin d’une période passée.
  const today=new Date().toISOString().slice(0,10);
  const rows = weather?.end >= today ? (weather.days || []).filter(d=>!d.date || d.date>=today) : [];
  if (rows.some(d=>d.rain !== null && d.rain >= 40)) add('rain','Veste imperméable et protection du sac','Risque de pluie ≥ 40 %');
  if (rows.some(d=>d.min !== null && d.min < 10)) add('cold','Couche chaude et coupe-vent','Température minimale < 10 °C');
  if (rows.some(d=>d.max !== null && d.max >= 28)) add('heat','Casquette, eau supplémentaire et vêtements légers','Température maximale ≥ 28 °C');
  if (rows.some(d=>d.min !== null && d.min <= 0)) add('freeze','Gants, bonnet et couche thermique ; vérifier le verglas','Température minimale ≤ 0 °C');
  if (rows.some(d=>d.rain !== null && d.rain >= 70) && packing.hiking) add('hike-rain','Vérifier l’état des sentiers et prévoir un itinéraire de repli','Randonnée et forte probabilité de pluie');
  if (rows.some(d=>d.wind !== null && d.wind >= 40)) add('wind','Vérifier l’exposition et adapter la randonnée','Vent prévu ≥ 40 km/h');
  for (const item of packing.manual) add(item.id,item.label,'Votre ajout');
  return items;
}
export function waypointsGPX(day, title) {
  const xml = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  const points = (day.previous ? [day.previous,...day.stops] : day.stops).filter(p=>coordinates(p.lat,p.lng));
  if (!points.length) throw new Error('Aucune coordonnée validée pour cette journée.');
  return `<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="Voyage" xmlns="http://www.topografix.com/GPX/1/1"><metadata><name>${xml(title)}</name><desc>Étapes uniquement : aucun sentier ni guidage calculé.</desc></metadata>${points.map(p=>`<wpt lat="${p.lat}" lon="${p.lng}"><name>${xml(p.name)}</name></wpt>`).join('')}</gpx>`;
}

export function validateOrganizer(data) {
  const fail=()=>{throw new Error('Les informations pratiques de ce dossier sont invalides.');};
  const object = value => value && typeof value==='object' && !Array.isArray(value);
  const text = (value,max=4000) => typeof value==='string' && value.length<=max;
  const number = value => Number.isFinite(value)&&value>=0&&value<=1e12;
  const day = value => Number.isInteger(value)&&value>=1&&value<=30;
  const currency = value => currencies.includes(value);
  const list = (value,max=1000) => Array.isArray(value)&&value.length<=max;
  const identifier = value => text(value,100)&&/^[a-zA-Z0-9_-]+$/.test(value);
  const url = value => !value || text(value,3000)&&!!safeLink(value);
  if(!object(data))fail();
  if(data.startDate!==undefined && (!text(data.startDate,10) || data.startDate&&!dateForDay(data.startDate,1)))fail();
  for(const key of ['bookings','offers']) {
    if(data[key]!==undefined && !list(data[key],key==='bookings'?Infinity:1000))fail();
    const ids=new Set();
    for(const row of data[key]||[]) {
      if(!object(row)||!identifier(row.id)||ids.has(row.id)||!text(row.title,150)||!row.title.trim()||!url(row.url))fail();ids.add(row.id);
      if(key==='bookings') {
        if(!day(row.day)||!['flight','transport','hotel','museum','activity','restaurant'].includes(row.kind)||!text(row.notes,3000)||!text(row.reference,150)||!text(row.placeId,200))fail();
        for(const key of ['bookingDate','checkoutDate','arrivalDate']) if(row[key]!==undefined && (!text(row[key],10)||row[key]&&!dateForDay(row[key],1)))fail();
        if(row.kind==='hotel' && row.bookingDate && row.checkoutDate && row.checkoutDate<row.bookingDate)fail();
        for(const key of bookingTextFields)if(row[key]!==undefined&&!text(row[key],300))fail();
        for(const key of bookingCountFields)if(row[key]!==undefined&&row[key]!==''&&(!Number.isInteger(row[key])||row[key]<1||row[key]>1000))fail();
        for(const time of [row.time,row.endTime])if(!text(time,5)||time&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(time))fail();
        if(row.attachment && (!object(row.attachment)||!identifier(row.attachment.id)||!text(row.attachment.name,255)||!['application/pdf','image/png','image/jpeg','image/webp'].includes(row.attachment.type)||!number(row.attachment.size)||row.attachment.size>10*1024*1024))fail();
      } else if(!number(row.normal)||!number(row.price)||!currency(row.currency)||typeof row.eligible!=='boolean'||!['student','youth','pass','other'].includes(row.kind)||!text(row.conditions,3000)||!dateForDay(row.checkedDate,1))fail();
    }
  }
  if(data.sites!==undefined) { if(!object(data.sites))fail(); for(const entry of Object.values(data.sites))if(!object(entry)||!url(entry.url)||!url(entry.source)||!text(entry.name,300)||!coordinates(entry.lat,entry.lng)||!Number.isFinite(Date.parse(entry.checkedAt)))fail(); }
  if(data.ticketPlaces!==undefined && (!object(data.ticketPlaces)||Object.values(data.ticketPlaces).some(value=>!['ticket','none','auto'].includes(value))))fail();
  if(data.budget!==undefined) {
    const b=data.budget;if(!object(b)||!currency(b.currency)||!number(b.dailyLimit)||!list(b.expenses)||!object(b.rates)||!object(b.rates.values)||!text(b.rates.source,150)||!text(b.rates.date,10)||b.rates.date&&!dateForDay(b.rates.date,1))fail();
    for(const [code,value] of Object.entries(b.rates.values))if(!/^[A-Z]{3}$/.test(code)||!number(value)||value<=0||code==='EUR'&&value!==1)fail();
    const ids=new Set();
    for(const e of b.expenses) {if(!object(e)||!identifier(e.id)||ids.has(e.id)||!text(e.title,150)||!e.title.trim()||!number(e.amount)||!day(e.day)||!currency(e.currency)||!text(e.category,100)||!['planned','paid'].includes(e.state))fail();ids.add(e.id);}
  }
  if(data.packing!==undefined) {
    const p=data.packing;
    if(!object(p)||!['running','hiking','watch'].every(k=>typeof p[k]==='boolean')||!object(p.checked)||!list(p.manual))fail();
    for(const [key,value] of Object.entries(p.checked))if(!identifier(key)||typeof value!=='boolean')fail();
    const ids=new Set();
    for(const item of p.manual) {if(!object(item)||!identifier(item.id)||ids.has(item.id)||!text(item.label,180)||!item.label.trim())fail();ids.add(item.id);}
    if(p.laundryEvery!==undefined && ![0,3,5,7].includes(p.laundryEvery))fail();
    if(p.placeId!==undefined && !text(p.placeId,200))fail();
    if(p.autoWeather!==undefined && typeof p.autoWeather!=='boolean')fail();
    if(p.weather) {
      const w=p.weather;
      if(!object(w)||!text(w.location,300)||!coordinates(w.lat,w.lng)||!Number.isFinite(new Date(w.fetchedAt).getTime())||!dateForDay(w.start,1)||!dateForDay(w.end,1)||!list(w.days,16)||typeof w.partial!=='boolean')fail();
      for(const d of w.days)if(!object(d)||!dateForDay(d.date,1)||d.date<w.start||d.date>w.end||!['min','max','rain','wind'].every(k=>d[k]===null||Number.isFinite(d[k])))fail();
    }
  }
  return data;
}

export function officialOfferSources(trip) {
  const normalize=value=>String(value||'').normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase();
  const city=trip.places.map(p=>normalize(p.city)).join(' '),country=normalize(trip.country);
  const sources=[{name:'ISIC · conditions et avantages étudiants',url:'https://www.isic.org/'}];
  if(['france','fr'].includes(country)&&city.includes('paris'))sources.push(
    {name:'Paris Museum Pass · site du pass',url:'https://www.parismuseumpass.fr/'},
    {name:'Louvre · tarifs, gratuités et réservation',url:'https://www.louvre.fr/'},
    {name:'Musée d’Orsay · tarifs et réservation',url:'https://www.musee-orsay.fr/'});
  if(['suede','sweden','sverige','se'].includes(country)&&city.includes('stockholm'))sources.push({name:'Visit Stockholm · office du tourisme',url:'https://www.visitstockholm.com/'});
  if(['portugal','pt'].includes(country)&&/lisbo|lisbon/.test(city))sources.push({name:'Visit Lisboa · office du tourisme et Lisboa Card',url:'https://www.visitlisboa.com/'});
  return sources;
}

export function weatherPlan(trip, packing, today=new Date().toISOString().slice(0,10)) {
  const place=trip.places.find(p=>p.id===packing.placeId && coordinates(p.lat,p.lng)) || trip.places.find(p=>coordinates(p.lat,p.lng));
  if(!place)return {reason:'Validez au moins une localisation pour adapter automatiquement la liste à la météo.'};
  const start=organizerData(trip).startDate || today,end=dateForDay(start,trip.days),horizon=dateForDay(today,16);
  if(!end || end<today)return {reason:'Ce séjour est terminé : les conseils météo ne sont plus actualisés.'};
  if(start>horizon)return {reason:'La météo sera actualisée automatiquement à l’ouverture de cette page dans les 16 jours avant le départ.'};
  return {place,first:start<today?today:start,last:end<horizon?end:horizon,start,end};
}
export function weatherNeedsRefresh(trip, packing, now=Date.now()) {
  const plan=weatherPlan(trip,packing,new Date(now).toISOString().slice(0,10)),w=packing.weather;
  if(plan.reason)return false;
  return !w || w.lat!==plan.place.lat || w.lng!==plan.place.lng || w.start!==plan.first || w.end!==plan.last || !Number.isFinite(Date.parse(w.fetchedAt)) || Date.parse(w.fetchedAt)>now || now-Date.parse(w.fetchedAt)>=6*60*60*1000;
}
