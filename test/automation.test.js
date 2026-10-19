import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMapsPaste,mapsURLType,duplicateMapsPlace,mapsGeoJSON} from '../src/maps-import.js';
import {emailToText,emailHTMLText,confirmationJSON,readConfirmationJSON} from '../src/confirmation-mail.js';
import {proposeDayGroups} from '../src/day-groups.js';
import {templateOrganizer} from '../src/trip-templates.js';
import {clothingItems} from '../src/packing-clothes.js';
import {planTrip,importPlaces} from '../src/core.js';
import {createTrip,updateTripPlace,routeSignature,loadTrips,persistTrips} from '../src/trips.js';
const places=Array.from({length:8},(_,i)=>({id:String(i),name:'Lieu '+i,country:'Suède',lat:59+(i<4?0:0.2)+i/10000,lng:18+i/10000,selected:true}));
test('liens Maps : noms décodés, coordonnées précises, caméra ignorée et doublons',()=>{
 const r=parseMapsPaste('https://www.google.com/maps/place/Mus%C3%A9e+Vasa/@59.1,18.1,12z\nhttps://www.google.com/maps/place/Mus%C3%A9e+Vasa/@59.2,18.2,12z\nhttps://www.google.com/maps/search/?api=1&query=59.328,18.091',{country:'Suède',city:'Stockholm'});
 assert.equal(r.places.length,2);assert.equal(r.places[0].name,'Musée Vasa');assert.equal(r.places[0].lat,null);assert.equal(r.places[1].lat,59.328);assert.equal(r.places[0].city,'Stockholm');assert.equal(mapsGeoJSON(r.places).features[0].geometry,null);assert.deepEqual(mapsGeoJSON(r.places).features[1].geometry.coordinates,[18.091,59.328]);
});
test('listes, itinéraires et raccourcis sans nom restent explicites ; URLs étrangères rejetées',()=>{
 assert.equal(mapsURLType('https://www.google.com/maps/placelists/list/abc'),'list');assert.equal(mapsURLType('https://www.google.com/maps/d/viewer?mid=abc'),'list');
 const r=parseMapsPaste('https://www.google.com/maps/placelists/list/abc\nhttps://maps.app.goo.gl/abc\nhttps://example.com/x\nhttps://www.google.com/maps/dir/a/b');assert.equal(r.places.length,0);assert.equal(r.warnings.length,4);
 assert.equal(parseMapsPaste('Vasa https://maps.app.goo.gl/abc').places[0].name,'Vasa');assert.equal(mapsURLType('https://user:pass@www.google.com/maps/place/Vasa'),'invalid');
 assert.ok(duplicateMapsPlace({name:'Vasa',country:'Suède'},{name:'vasa',country:'suède'}));
});
test('e-mail MIME : texte préféré, sujet décodé, pièces jointes et en-têtes personnels exclus',()=>{
 const mail='From: paris@example.com\r\nSubject: =?UTF-8?Q?R=C3=A9servation?=\r\nContent-Type: multipart/mixed; boundary="x"\r\n\r\n--x\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Transfer-Encoding: quoted-printable\r\n\r\nH=C3=B4tel Vasa\nR=C3=A9f=C3=A9rence : ABC123\r\n--x\r\nContent-Type: text/html\r\n\r\n<b>Doublon HTML</b>\r\n--x\r\nContent-Type: text/plain; name="secret.txt"\r\nContent-Disposition: attachment\r\n\r\nSECRET\r\n--x--';
 const text=emailToText(mail);assert.match(text,/Objet : Réservation/);assert.match(text,/Hôtel Vasa/);assert.match(text,/Référence : ABC123/);assert.doesNotMatch(text,/SECRET|paris@|Doublon/);
});
test('e-mail HTML base64 et texte brut multiparagraphes',()=>{
 const html='<html><head>Secret</head><body><p>Hôtel Vasa</p><img src="https://tracker.invalid"><script>alert(1)</script><p>Arrivée : 10/12/2026</p></body></html>';
 const r=emailToText('Content-Type: text/html; charset=utf-8\nContent-Transfer-Encoding: base64\n\n'+Buffer.from(html).toString('base64'));assert.match(r,/Hôtel Vasa/);assert.doesNotMatch(r,/tracker|Secret|alert/);
 assert.equal(emailToText('Vol AF123\n\nRéférence ABC123'),'Vol AF123\n\nRéférence ABC123');assert.equal(emailHTMLText('<p>A &amp; B</p>'),'A & B');
});
test('confirmation JSON : champs autorisés seulement et limites vérifiées',()=>{
 const r=readConfirmationJSON(confirmationJSON({kind:'flight',flightNumber:'AF123',reference:'ABC123',html:'<img>'}));assert.equal(r.flightNumber,'AF123');assert.equal(r.html,undefined);assert.throws(()=>readConfirmationJSON(confirmationJSON({kind:'evil'})));assert.throws(()=>readConfirmationJSON(confirmationJSON({reference:{nested:1}})));
});
test('modèle froid prépare vêtements, budget et tâches indépendantes',()=>{
 const a=templateOrganizer('urban-cold','2026-12-10',80),b=templateOrganizer('urban-cold');assert.equal(a.budget.dailyLimit,80);assert.equal(a.startDate,'2026-12-10');assert.ok(a.packing.manual.length);assert.notEqual(a.packing.manual[0].id,b.packing.manual[0].id);assert.match(JSON.stringify(clothingItems(a.packing,3)),/Bonnet/);assert.doesNotMatch(JSON.stringify(clothingItems(a.packing,3)),/Short/);
 const trip=createTrip({name:'Stockholm',country:'Suède',days:3,mode:'walking',places,organizer:a});assert.equal(trip.organizer.templateProfile,'urban-cold');assert.equal(trip.organizer.packing.profile,'urban-cold');
});
test('regroupement local conserve chaque lieu, départ choisi et groupes géographiques',()=>{
 const groups=proposeDayGroups(places,2,'5');assert.equal(groups[0][0],'5');assert.deepEqual(new Set(groups.flat()),new Set(places.map(p=>p.id)));assert.ok(groups.every(g=>g.length===4));assert.ok(groups[0].every(id=>Number(id)>=4));assert.ok(groups[1].every(id=>Number(id)<4));assert.deepEqual(proposeDayGroups(places,2,'5'),groups);assert.throws(()=>proposeDayGroups([{...places[0],lat:null}],2));
 assert.equal(proposeDayGroups(places.map(p=>({...p,lat:59,lng:18})),8).filter(g=>g.length===1).length,8);
});
test('journées validées persistent, notes ne recalculent pas, déplacement invalide les zones',()=>{
 const dayGroups=proposeDayGroups(places,2,'0'),trip={...createTrip({name:'Test',country:'Suède',days:2,mode:'walking',places}),dayGroups};
 const planned=planTrip(trip.places,2,trip.startId,false,dayGroups);assert.deepEqual(planned.days.map(d=>d.stops.map(p=>p.id)),dayGroups);assert.ok(planned.grouped);
 const notes=updateTripPlace(trip,'0',{note:'Réserver',description:'Info'});assert.deepEqual(notes.dayGroups,dayGroups);assert.equal(routeSignature(notes),routeSignature(trip));const moved=updateTripPlace(trip,'0',{lat:59.5,lng:18.3});assert.equal(moved.dayGroups,null);assert.notEqual(routeSignature(moved),routeSignature(trip));
 const storage={data:'',getItem(){return this.data},setItem(k,v){this.data=v}};persistTrips(storage,[trip]);assert.deepEqual(loadTrips(storage)[0].dayGroups,dayGroups);
 assert.throws(()=>planTrip(places,2,'0',false,[['0'],['0']]));
});

test('GeoJSON préparé se réimporte et deux liens sur la même ligne gardent des noms propres',()=>{
 const r=parseMapsPaste('https://www.google.com/maps/search/?api=1&query=59.1,18.1 https://www.google.com/maps/search/?api=1&query=59.2,18.2',{country:'Suède'});assert.equal(r.places.length,2);assert.doesNotMatch(r.places[1].name,/https/);const restored=importPlaces(JSON.stringify(mapsGeoJSON(r.places)),'lieux.geojson');assert.equal(restored.length,2);assert.equal(restored[1].lat,59.2);
});
test('modifier durée ou premier lieu retire les groupes pour respecter les nouveaux réglages',()=>{
 const original=createTrip({name:'Test',country:'Suède',days:2,mode:'walking',startId:'0',places});original.dayGroups=proposeDayGroups(places,2,'0');
 assert.deepEqual(createTrip({...original},original).dayGroups,original.dayGroups);assert.equal(createTrip({...original,days:3},original).dayGroups,undefined);assert.equal(createTrip({...original,startId:'5'},original).dayGroups,undefined);
});
