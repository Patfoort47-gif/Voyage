import test from 'node:test';
import assert from 'node:assert/strict';
import {dateForDay,organizerData,convert,dailyBudget,offerSavings,fetchRates,fetchWeather,packingItems,waypointsGPX,validateOrganizer,safeLink} from '../src/travel-tools.js';
import {createTrip,routeSignature,updateTripPlace} from '../src/trips.js';
import {validateFile} from '../src/travel-files.js';
const trip=()=>createTrip({name:'Paris',country:'France',days:2,mode:'walking',fileOrder:false,places:[{id:'p',name:'Musée',lat:48,lng:2}]});

test('anciens dossiers compatibles, informations pratiques conservées lors des modifications sans recalcul de route',()=>{
 const original=trip(),data=organizerData(original);data.packing.running=true;data.budget.expenses=[{id:'e1',title:'Repas',amount:20,currency:'EUR',day:1,category:'Repas',state:'planned'}];
 const withTools={...original,organizer:data}, updated=createTrip({...withTools,name:'Nouveau nom'},withTools);
 assert.deepEqual(updated.organizer,data);assert.equal(routeSignature(withTools),routeSignature(original));
 assert.deepEqual(updateTripPlace(withTools,'p',{description:'Description'}).organizer,data);
 updated.organizer.packing.running=false;assert.equal(withTools.organizer.packing.running,true);
});
test('dates : changement de mois et année, invalides refusées',()=>{
 assert.equal(dateForDay('2026-12-31',2),'2027-01-01');assert.equal(dateForDay('2026-02-30',1),'');assert.equal(dateForDay('',1),'');
});
test('conversion via EUR, absence de taux signalée et budgets prévus/payés conservés hors durée réduite',()=>{
 assert.equal(convert(110,'SEK','USD',{SEK:11,USD:1.2}),12);assert.equal(convert(10,'EUR','EUR',{}),10);assert.equal(convert(20,'MAD','EUR',{}),null);
 assert.equal(convert(-2,'EUR','USD',{USD:1.2}),null);
 const b={currency:'EUR',rates:{values:{USD:1.2}},expenses:[{day:1,amount:24,currency:'USD'},{day:1,amount:10,currency:'MAD'},{day:3,amount:5,currency:'EUR'}]};
 const rows=dailyBudget({days:2},b);assert.equal(rows[0].total,20);assert.equal(rows[0].missing,1);assert.equal(rows[2].total,5);
});
test('taux publics : unités et date vérifiées, panne et contenu invalide ne deviennent pas un faux taux',async()=>{
 const result=await fetchRates(async()=>({ok:true,json:async()=>({base:'EUR',date:'2026-10-19',rates:{USD:1.2,SEK:11,BAD:-5}})}));assert.deepEqual(result.values,{EUR:1,USD:1.2,SEK:11});
 await assert.rejects(fetchRates(async()=>({ok:false})),/indisponibles/);
 await assert.rejects(fetchRates(async()=>({ok:true,json:async()=>({base:'USD',date:'2026-10-19',rates:{}})})),/invalide/);
});
test('réductions : éligibilité explicite, pass non rentable et tarifs zéro',()=>{
 assert.equal(offerSavings({eligible:false,normal:50,price:10}),null);assert.equal(offerSavings({eligible:true,normal:50,price:60}),-10);assert.equal(offerSavings({eligible:true,normal:20,price:0}),20);
});
test('météo : destination, fenêtre limitée à 16 jours, dates et unités explicites, aucun appel pour des dates impossibles',async()=>{
 let url,count=0;const place={name:'Paris',lat:48,lng:2};
 const forecast=await fetchWeather(place,'2026-10-19',30,async value=>{url=new URL(value);count++;return {ok:true,json:async()=>({daily:{time:['2026-10-19'],temperature_2m_min:[5],temperature_2m_max:[29],precipitation_probability_max:[80],wind_speed_10m_max:[45]}})};},'2026-10-19');
 assert.equal(url.searchParams.get('end_date'),'2026-11-03');assert.equal(url.searchParams.get('latitude'),'48');assert.equal(forecast.partial,true);assert.equal(forecast.days[0].wind,45);
 await assert.rejects(fetchWeather(place,'2026-12-19',3,()=>{count++;},'2026-10-19'),/16 prochains/);assert.equal(count,1);
 await assert.rejects(fetchWeather({name:'Inconnu'},'2026-10-19',2,()=>{},'2026-10-19'),/coordonnées/);
});
test('check-list : pluie, chaleur, froid, vent et montre ; cases conservées entre les suggestions',()=>{
 const p=organizerData(trip()).packing;p.running=true;p.hiking=true;p.watch=true;p.checked={'watch-charge':true};p.weather={end:'2099-01-01',days:[{min:3,max:30,rain:60,wind:50}]};
 const ids=packingItems(p).map(i=>i.id);for(const id of ['rain','cold','heat','wind','watch-charge','hike-kit','run-shoes'])assert.ok(ids.includes(id));assert.equal(p.checked['watch-charge'],true);
 p.weather.end='2000-01-01';assert.ok(!packingItems(p).some(i=>i.id==='rain'));
});
test('GPX : points géolocalisés, échappement XML et absence de faux tracé',()=>{
 const xml=waypointsGPX({stops:[{name:'A & <B>',lat:48,lng:2},{name:'Absent'}]},'Jour 1');assert.match(xml,/A &amp; &lt;B&gt;/);assert.equal((xml.match(/<wpt /g)||[]).length,1);assert.doesNotMatch(xml,/<trk/);assert.match(xml,/aucun sentier/);
 assert.throws(()=>waypointsGPX({stops:[{name:'Absent'}]},'Vide'),/Aucune coordonnée/);
});
test('restauration : contenu invalide, liens exécutables et montants injectés refusés sans altérer les dossiers',()=>{
 const data=organizerData(trip());assert.equal(validateOrganizer(data),data);const original=structuredClone(data);
 data.budget.dailyLimit='\"><script>';assert.throws(()=>validateOrganizer(data),/invalides/);
 const malformed=structuredClone(original);malformed.budget.expenses=[{id:'x',title:'X',day:1,amount:NaN,currency:'EUR',category:'Autre',state:'paid'}];assert.throws(()=>validateOrganizer(malformed));
 assert.equal(safeLink('javascript:alert(1)'),'');assert.equal(safeLink('https://user:pass@example.com/'),'');
});
test('billets : PDF et images seulement, taille limitée, aucun document HTML exécutable',()=>{
 assert.doesNotThrow(()=>validateFile({size:10,type:'application/pdf'}));assert.throws(()=>validateFile({size:10,type:'text/html'}),/PDF/);assert.throws(()=>validateFile({size:11*1024*1024,type:'image/png'}),/10 Mo/);
});
test('activités suggérées depuis les lieux, choix explicites conservés et ancien bulletin retiré après déplacement',()=>{
 const t=trip();t.places[0].category='Randonnée / trail';assert.equal(organizerData(t).packing.hiking,true);
 const data=organizerData(t);data.packing.hiking=false;data.packing.weather={lat:49,lng:3};t.organizer=data;
 assert.equal(organizerData(t).packing.hiking,false);assert.equal(organizerData(t).packing.weather,undefined);
});
