import test from 'node:test';
import assert from 'node:assert/strict';
import { destinationCurrency } from '../src/destination-currency.js';
import { organizerData, validateOrganizer, weatherPlan, weatherNeedsRefresh, fetchWeather, packingItems } from '../src/travel-tools.js';
import { findOfficialSite } from '../src/official-sites.js';
const trip=()=>({country:'Suède',days:4,places:[{id:'p',name:'Louvre',city:'Paris',country:'France',lat:48.86,lng:2.33}]});
test('conversion par pays : pays français, locaux, codes et euro sans USD inventé',()=>{
 for(const [country,currency] of [['Suède','SEK'],['Sverige','SEK'],['Japon','JPY'],['Jordanie','JOD'],['Portugal','EUR'],['France','EUR'],['Maroc','MAD'],['US','USD'],['Pérou','PEN']])assert.equal(destinationCurrency({country}),currency);
 assert.equal(destinationCurrency({country:'Inconnu'}),null);
});
test('vols et hôtels : multiples réservations sans plafond arbitraire, anciennes entrées compatibles',()=>{
 const data=organizerData(trip());data.bookings=Array.from({length:1001},(_,i)=>({id:'b'+i,title:'Réservation '+i,kind:i%2?'flight':'hotel',day:1,time:'',endTime:'',reference:'',notes:'',url:'',placeId:'',bookingDate:'2026-10-20',checkoutDate:'2026-10-25'}));
 assert.doesNotThrow(()=>validateOrganizer(data));data.bookings[0].bookingDate='2026-02-30';assert.throws(()=>validateOrganizer(data));
});
test('météo automatique : contexte, cache six heures et changement du point de référence',()=>{
 const t=trip();t.organizer={startDate:'2026-10-19'};const p=organizerData(t).packing,now=Date.parse('2026-10-19T12:00:00Z');
 assert.equal(weatherNeedsRefresh(t,p,now),true);const plan=weatherPlan(t,p,'2026-10-19');
 p.weather={lat:plan.place.lat,lng:plan.place.lng,start:plan.first,end:plan.last,fetchedAt:'2026-10-19T11:00:00Z'};
 assert.equal(weatherNeedsRefresh(t,p,now),false);assert.equal(weatherNeedsRefresh(t,p,now+6*3600000),true);
 p.weather.lng=3;assert.equal(weatherNeedsRefresh(t,p,now),true);
 t.organizer.startDate='2027-01-01';assert.match(weatherPlan(t,p,'2026-10-19').reason,/16 jours/);
});
test('séjour déjà commencé : prévisions des journées restantes et liste sportive enrichie',async()=>{
 let url;const result=await fetchWeather(trip().places[0],'2026-10-17',4,async u=>{url=new URL(u);return {ok:true,json:async()=>({daily:{time:['2026-10-19'],temperature_2m_min:[-2],temperature_2m_max:[5],precipitation_probability_max:[90],wind_speed_10m_max:[30]}})};},'2026-10-19');
 assert.equal(url.searchParams.get('start_date'),'2026-10-19');assert.equal(result.end,'2026-10-20');
 result.end='2099-01-01';const packing={hiking:true,checked:{rain:true},manual:[],weather:result};const ids=packingItems(packing).map(i=>i.id);assert.ok(ids.includes('freeze'));assert.ok(ids.includes('hike-rain'));assert.equal(packing.checked.rain,true);
});
const entity=(lng=2.33,url='https://www.louvre.fr/')=>({id:'Q1',labels:{fr:{value:'Musée du Louvre'}},claims:{P625:[{mainsnak:{datavalue:{value:{latitude:48.86,longitude:lng}}}}],P856:[{mainsnak:{datavalue:{value:url}}}]}});
function source(getEntity) {return async url=>({ok:true,json:async()=>String(url).includes('wikidata.org')?{entities:{Q1:getEntity()}}:{query:{pages:{1:{title:'Musée du Louvre',pageprops:{wikibase_item:'Q1'}}}}}});}
test('sites officiels : nom et localisation concordants, source Wikidata conservée',async()=>{
 const found=await findOfficialSite(trip().places[0],source(()=>entity()));assert.equal(found.url,'https://www.louvre.fr/');assert.equal(found.source,'https://www.wikidata.org/wiki/Q1');
});
test('sites officiels : homonyme éloigné, liens dangereux et candidats ambigus non proposés',async()=>{
 assert.equal(await findOfficialSite(trip().places[0],source(()=>entity(18))),null);
 assert.equal(await findOfficialSite(trip().places[0],source(()=>entity(2.33,'javascript:alert(1)'))),null);
 assert.equal(await findOfficialSite(trip().places[0],source(()=>{const e=entity();e.claims.P856.push({mainsnak:{datavalue:{value:'https://other.example/'}}});return e;})),null);
});
