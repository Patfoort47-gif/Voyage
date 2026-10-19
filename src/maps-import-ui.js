import { parseMapsPaste, duplicateMapsPlace, mapsGeoJSON } from './maps-import.js';
import { findFreePlaces } from './free-maps.js';
import { coordinates } from './core.js';
import { flagCode } from './country-flags.js';
import { downloadFile } from './backups.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const key=value=>String(value||'').normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
export class MapsImport {
  constructor(dialog,{getPlaces,addPlaces,notice}) {
    this.root=dialog;this.getPlaces=getPlaces;this.addPlaces=addPlaces;this.notice=notice;this.rows=[];this.token=0;
    dialog.innerHTML=`<div class="section-title"><h2>Des liens Maps à votre carnet</h2><button class="quiet" type="button" data-maps-action="close" aria-label="Fermer">✕</button></div><form id="maps-paste-form"><label>Liens de lieux, un ou plusieurs par ligne<textarea name="text" rows="6" maxlength="100000" required placeholder="Musée Vasa https://www.google.com/maps/place/…"></textarea></label><div class="two-col"><label>Pays de ces lieux<input name="country" maxlength="120" placeholder="Suède"></label><label>Ville ou zone de recherche<input name="city" maxlength="120" placeholder="Stockholm"></label></div><label>Catégorie<input name="category" maxlength="120" value="À visiter"></label><button class="primary">Analyser les liens</button></form><p class="small muted">Coordonnées précises du lien si présentes ; sinon recherche gratuite OpenStreetMap. Une caméra @lat,lng ne prouve pas la position du lieu. Les listes partagées et liens courts ne donnent pas accès automatiquement à tous leurs lieux : utilisez leurs liens individuels ou l’export Takeout. Recherches espacées, pas de délai garanti de deux secondes.</p><p id="maps-paste-status" role="status" class="small muted"></p><div id="maps-paste-warnings"></div><div class="tools-actions"><button class="secondary" data-maps-action="search">Rechercher les coordonnées manquantes</button><button class="quiet" data-maps-action="stop">Arrêter la recherche</button></div><div id="maps-paste-preview"></div><div class="tools-actions"><button class="primary" data-maps-action="import">Importer les lieux cochés</button><button class="secondary" data-maps-action="export">Exporter le GeoJSON préparé</button></div>`;
    dialog.querySelector('form').addEventListener('submit',e=>{e.preventDefault();this.parse();});
    dialog.addEventListener('click',e=>this.click(e));dialog.addEventListener('change',e=>this.change(e));dialog.addEventListener('close',()=>{this.token++;});
  }
  open(){this.root.showModal();}
  status(message){this.root.querySelector('#maps-paste-status').textContent=message;}
  parse(){
    this.token++;const values=new FormData(this.root.querySelector('form'));
    try {const parsed=parseMapsPaste(values.get('text'),Object.fromEntries(values));this.rows=parsed.places.map(p=>({...p,include:true,candidates:[]}));this.root.querySelector('#maps-paste-warnings').innerHTML=parsed.warnings.map(w=>`<p class="warning">${esc(w)}</p>`).join('');this.preview();this.status(`${this.rows.length} lieu(x) prêt(s) à vérifier.${!this.rows.length?' Collez des liens individuels avec leur nom.':''}`);}catch(error){this.status(error.message);}
  }
  preview(){
    this.root.querySelector('#maps-paste-preview').innerHTML=this.rows.map(p=>`<article class="tools-card maps-row"><label class="check-label"><input type="checkbox" data-map-include="${esc(p.id)}" ${p.include?'checked':''}>Importer ce lieu</label><label>Nom<input data-map-name="${esc(p.id)}" value="${esc(p.name)}" maxlength="200"></label><a href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">Vérifier le lien Maps ↗</a><p class="small muted">${esc(p.country||'Pays non renseigné')} · ${esc(p.city||'Ville non renseignée')} · ${esc(p.coordinateSource)}</p>${p.candidates.length?`<label>Correspondance proposée à vérifier<select data-map-candidate="${esc(p.id)}"><option value="">Garder sans coordonnées</option>${p.candidates.map((c,i)=>`<option value="${i}" ${p.candidateIndex===i?'selected':''}>${esc(c.name)} · ${esc(c.address)} · ${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}</option>`).join('')}</select></label>`:''}<div class="two-col"><label>Latitude<input type="number" step="any" min="-90" max="90" data-map-lat="${esc(p.id)}" value="${p.lat??''}"></label><label>Longitude<input type="number" step="any" min="-180" max="180" data-map-lng="${esc(p.id)}" value="${p.lng??''}"></label></div>${p.error?`<p class="warning">${esc(p.error)}</p>`:''}</article>`).join('');
  }
  change(event){
    const node=event.target,keys=['include','name','candidate','lat','lng'];
    for(const field of keys){const id=node.dataset['map'+field[0].toUpperCase()+field.slice(1)];if(!id)continue;const row=this.rows.find(p=>p.id===id);if(!row)return;
      if(field==='include')row.include=node.checked;else if(field==='name')row.name=node.value;
      else if(field==='candidate'){const candidate=row.candidates[node.value];if(node.value!==''&&candidate){row.lat=candidate.lat;row.lng=candidate.lng;row.candidateIndex=Number(node.value);row.address=candidate.address;row.localName=candidate.localName;row.coordinateSource='Correspondance choisie';}else{row.lat=row.lng=null;row.candidateIndex=null;row.coordinateSource='À confirmer';}this.preview();}
      else {row[field]=node.value===''?null:Number(node.value);row.coordinateSource='Coordonnées saisies';}return;
    }
  }
  clean(){const places=this.rows.filter(p=>p.include).map(({include,candidates,candidateIndex,error,...p})=>p);if(!places.length)throw new Error('Cochez au moins un lieu.');for(const p of places){if(!p.name.trim())throw new Error('Chaque lieu doit avoir un nom.');if((p.lat!==null||p.lng!==null)&&!coordinates(p.lat,p.lng))throw new Error('Vérifiez les coordonnées saisies, ou videz les deux champs.');}return places;}
  async click(event){
    const button=event.target.closest('[data-maps-action]');if(!button)return;const action=button.dataset.mapsAction;
    try {
      if(action==='close'){this.root.close();return;}if(action==='stop'){this.token++;this.status('Recherche arrêtée. Les résultats déjà trouvés restent disponibles.');return;}
      if(action==='search'){
        const token=++this.token,queue=this.rows.filter(p=>p.include&&!coordinates(p.lat,p.lng));button.disabled=true;
        try {for(let i=0;i<queue.length;i++){if(token!==this.token)return;const row=queue[i];this.status(`Recherche ${i+1}/${queue.length} : ${row.name}…`);try{const candidates=await findFreePlaces({...row,searchCity:row.city});if(token!==this.token)return;row.candidates=candidates;
          const matches=candidates.filter(c=>key(c.localName||c.name)===key(row.name)&&c.countryCode&&flagCode(c.countryCode)===flagCode(row.country)&&(!row.city||key(c.city)===key(row.city)));
          if(matches.length===1){const c=matches[0];row.candidateIndex=candidates.indexOf(c);row.lat=c.lat;row.lng=c.lng;row.address=c.address;row.localName=c.localName;row.coordinateSource='OSM proposé · vérifiez avant import';}else row.coordinateSource=candidates.length?'Correspondance à choisir':'Aucun résultat : précisez nom, ville et pays';row.error='';
        }catch(error){row.error=error.message;}this.preview();}this.status('Recherche terminée. Vérifiez les propositions puis importez les lieux cochés.');}finally{button.disabled=false;}return;
      }
      if(action==='export'){downloadFile(new Blob([JSON.stringify(mapsGeoJSON(this.clean()),null,2)],{type:'application/geo+json'}),'lieux-prepares.geojson');this.status('GeoJSON exporté, réimportable dans le carnet.');return;}
      if(action==='import'){const selected=this.clean(),known=[...this.getPlaces()],added=[];for(const p of selected)if(!known.some(old=>duplicateMapsPlace(old,p))){added.push({...p,selected:true});known.push(p);}this.addPlaces(added);this.root.close();this.notice(`${added.length} lieu(x) ajouté(s), ${selected.length-added.length} doublon(s) ignoré(s). Les lieux sans coordonnées restent à localiser.`);}
    }catch(error){this.status(error.message);}
  }
}
