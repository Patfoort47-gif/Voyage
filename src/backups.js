import { validateTrip } from './trips.js';
import { documentFile } from './travel-files.js';
const maxSize=80*1024*1024;
export function downloadFile(blob,name) {const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
export async function workspaceBackup(trips,places=[]) {
  const files=[],seen=new Set();trips.forEach(validateTrip);
  for(const trip of trips)for(const booking of trip.organizer?.bookings||[])if(booking.attachment&&!seen.has(booking.attachment.id)) {
    const meta=booking.attachment,file=await documentFile('get',meta.id);if(!file)throw new Error(`Document absent : ${meta.name}. Réimportez-le dans la réservation avant de sauvegarder.`);
    const content=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Lecture du document impossible.'));reader.readAsDataURL(file);});
    files.push({...meta,content});seen.add(meta.id);
  }
  const blob=new Blob([JSON.stringify({format:'voyage-workspace',version:1,trips,places,files},null,2)],{type:'application/json'});
  if(blob.size>maxSize)throw new Error('La sauvegarde dépasse 80 Mo. Exportez les dossiers séparément ou retirez les gros documents après les avoir sauvegardés.');return blob;
}
export function validateBackup(data) {
  if(!data||data.version!==1||!Array.isArray(data.files))throw new Error('Sauvegarde Voyage non reconnue.');
  const trips=data.format==='voyage-dossier'?[data.trip]:data.format==='voyage-workspace'?data.trips:null,places=data.format==='voyage-workspace'?(data.places||[]):[];
  if(!Array.isArray(trips)||trips.length>1000||!Array.isArray(places)||places.length>10000)throw new Error('Contenu de sauvegarde invalide.');
  trips.forEach(validateTrip);
  if(places.some(p=>!p||typeof p.id!=='string'||typeof p.name!=='string'||!p.name.trim()))throw new Error('Carnet de lieux invalide.');
  const normalizedPlaces=structuredClone(places).map(place=>{for(const field of ['country','category','note','tags','url','description','city','localName','practicalInfo','address'])if(place[field]!==undefined&&typeof place[field]!=='string')throw new Error('Les informations d’un lieu du carnet sont invalides.');return {...place,country:place.country||'',category:place.category||'À visiter',selected:place.selected!==false};});
  return {trips:structuredClone(trips),places:normalizedPlaces,files:data.files};
}
export async function readBackup(file) {if(file.size>maxSize)throw new Error('Sauvegarde trop volumineuse (80 Mo maximum).');return validateBackup(JSON.parse(await file.text()));}
export async function prepareImportedBackup(data) {
  const created=[];
  try {
    const {trips,places,files}=data;
    for(const trip of trips) {
      trip.id=crypto.randomUUID();trip.updatedAt=new Date().toISOString();
      for(const booking of trip.organizer?.bookings||[])if(booking.attachment) {
        const stored=files.find(f=>f.id===booking.attachment.id);
        if(!stored||typeof stored.content!=='string'||!/^data:(application\/pdf|image\/(png|jpeg|webp));base64,/.test(stored.content))throw new Error('Un billet est manquant ou invalide dans cette sauvegarde.');
        const [header,body]=stored.content.split(','),bytes=Uint8Array.from(atob(body),c=>c.charCodeAt(0)),blob=new Blob([bytes],{type:header.slice(5,header.indexOf(';'))}),id=crypto.randomUUID();
        await documentFile('put',id,blob);created.push(id);booking.attachment={...booking.attachment,id,size:blob.size,type:blob.type};
      }
      validateTrip(trip);
    }
    places.forEach(place=>{place.id=crypto.randomUUID();});
    return {trips,places,rollback:async()=>{for(const id of created)await documentFile('delete',id).catch(()=>{});}};
  }catch(error){for(const id of created)await documentFile('delete',id).catch(()=>{});throw error;}
}
export function itineraryCopy(trip) {
  validateTrip(trip);
  const copy=Object.fromEntries(['id','name','country','days','mode','fileOrder','startId','createdAt','updatedAt','places'].filter(key=>trip[key]!==undefined).map(key=>[key,structuredClone(trip[key])]));
  copy.organizer={startDate:trip.organizer?.startDate||''};
  return {format:'voyage-workspace',version:1,trips:[copy],places:[],files:[]};
}
