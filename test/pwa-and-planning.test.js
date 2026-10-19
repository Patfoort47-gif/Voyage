import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {improvePath} from '../src/route-optimizer.js';
import {planTrip,distance} from '../src/core.js';
import {itineraryCopy,validateBackup} from '../src/backups.js';
import {validateTrip,routeSignature,updateTripPlace} from '../src/trips.js';
const points=[{id:'0',lat:48.0267,lng:2.0444},{id:'1',lat:48.0911,lng:2.0592},{id:'2',lat:48.0035,lng:2.0691},{id:'3',lat:48.0396,lng:2.0016},{id:'4',lat:48.0696,lng:2.012},{id:'5',lat:48.0641,lng:2.0838},{id:'6',lat:48.0786,lng:2.0079},{id:'7',lat:48.0045,lng:2.0336}].map(p=>({...p,name:'Étape '+p.id}));
const trip=()=>({id:'trip',name:'Stockholm',country:'Suède',days:2,mode:'walking',fileOrder:false,startId:'0',places:structuredClone(points)});
test('2-opt réduit un détour réel, conserve le départ et chaque lieu, respecte l’ordre du carnet',()=>{
 const result=planTrip(points,2,'0');assert.ok(result.kmSaved>1);assert.equal(result.days[0].stops[0].id,'0');assert.deepEqual(new Set(result.days.flatMap(d=>d.stops.map(p=>p.id))),new Set(points.map(p=>p.id)));
 const ordered=planTrip(points,2,'0',true);assert.deepEqual(ordered.days.flatMap(d=>d.stops.map(p=>p.id)),points.map(p=>p.id));assert.equal(ordered.kmSaved,0);
 const path=improvePath(points,distance),length=p=>p.slice(1).reduce((s,v,i)=>s+distance(p[i],v),0);assert.ok(length(path)<=length(points));assert.equal(path[0].id,'0');
});
test('notes, cases visitées et tâches persistent sans changer la signature du trajet',()=>{
 const t=trip(),updated=updateTripPlace(t,'0',{note:'Réserver la veille',visited:true,tasks:[{id:'task',text:'Billet coupe-file',done:false}]});assert.equal(routeSignature(t),routeSignature(updated));assert.equal(updated.places[0].visited,true);assert.equal(t.places[0].visited,undefined);
 assert.throws(()=>validateTrip({...updated,places:[{...updated.places[0],tasks:[{id:'x',text:'',done:false}]}]}),/tâches/);
});
test('partage d’itinéraire : notes conservées, réservations et documents personnels exclus',()=>{
 const t=trip();t.organizer={startDate:'2026-10-20',bookings:[{id:'b',title:'Billet',kind:'museum',day:1,time:'',endTime:'',notes:'',placeId:'0',reference:'PNR-SECRET',url:'',attachment:{id:'secret',name:'billet.pdf',type:'application/pdf',size:10}}]};
 const shared=itineraryCopy(t);assert.equal(shared.format,'voyage-workspace');assert.equal(shared.files.length,0);assert.ok(!JSON.stringify(shared).includes('PNR-SECRET'));assert.deepEqual(shared.trips[0].organizer,{startDate:'2026-10-20'});assert.equal(shared.trips[0].places.length,8);
 assert.equal(validateBackup(shared).trips[0].name,'Stockholm');assert.throws(()=>validateBackup({format:'autre',version:1,files:[]}),/invalide/);
});
test('import accepte sauvegarde globale et ancien dossier, sans modifier les données sources',()=>{
 const t=trip(),backup={format:'voyage-dossier',version:1,trip:t,files:[]},parsed=validateBackup(backup);parsed.trips[0].name='Copie';assert.equal(t.name,'Stockholm');assert.equal(parsed.places.length,0);assert.throws(()=>validateBackup({format:'voyage-workspace',version:1,trips:[{invalid:true}],places:[],files:[]}),/invalides/);
});
test('PWA : manifeste et ressources internes sous /Voyage/, sans cache ou téléchargement de cartes externes',async()=>{
 const manifest=JSON.parse(await readFile(new URL('../manifest.json',import.meta.url),'utf8'));assert.equal(manifest.display,'standalone');assert.equal(manifest.scope,'./');
 for(const icon of manifest.icons){assert.ok(new URL(icon.src,'https://example.github.io/Voyage/').pathname.startsWith('/Voyage/'));await access(new URL('../'+icon.src,import.meta.url));}
 const worker=await readFile(new URL('../sw.js',import.meta.url),'utf8');assert.match(worker,/url.origin!==base.origin/);assert.doesNotMatch(worker,/https:\/\/tile\.openstreetmap/);
 const shell=JSON.parse(worker.match(/const SHELL=(\[[^\n]+\]);/)[1]);for(const path of shell.filter(p=>p!=='./'))await access(new URL('../'+path,import.meta.url));
});
