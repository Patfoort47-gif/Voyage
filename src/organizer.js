import { currencies, safeLink, dateForDay, organizerData, convert, dailyBudget, offerSavings, fetchRates, fetchWeather, packingItems, waypointsGPX, officialOfferSources } from './travel-tools.js';
import { documentFile } from './travel-files.js';
import { planTrip, coordinates } from './core.js';

export const travelPages = { route:'Itinéraire', reservations:'Billets & horaires', budget:'Budget & devises', offres:'Réductions & pass', checklist:'Ma check-list' };
const escape = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = (amount,currency)=>new Intl.NumberFormat('fr-FR',{style:'currency',currency}).format(amount);
const options = (list,value)=>list.map(([id,label])=>`<option value="${escape(id)}" ${String(id)===String(value)?'selected':''}>${escape(label)}</option>`).join('');
const currencyOptions = value => options(currencies.map(c=>[c,c]),value);
const link = (url,label)=>safeLink(url)?`<a href="${escape(safeLink(url))}" target="_blank" rel="noopener noreferrer">${escape(label)} ↗</a>`:'';
const field = (name,label,type='text',extra='')=>`<label>${label}<input name="${name}" type="${type}" ${extra}></label>`;
const searchURL = query =>'https://www.google.com/search?q='+encodeURIComponent(query);
const formButtons = label=>`<div class="tools-actions"><button class="primary">${label}</button><button type="reset" class="quiet">Réinitialiser le formulaire</button></div>`;
const title = (tag,name,description)=>`<div class="tools-heading"><span class="eyebrow">${tag}</span><h2>${name}</h2><p class="muted">${description}</p></div>`;
function download(blob,name) {
  const url=URL.createObjectURL(blob), a=document.createElement('a');
  a.href=url; a.download=name; a.click(); setTimeout(()=>URL.revokeObjectURL(url),10000);
}
export class Organizer {
  constructor(root,{getTrip,saveTrip}) {
    this.root=root; this.getTrip=getTrip; this.saveTrip=saveTrip; this.id=''; this.page=''; this.generation=0;
    root.addEventListener('submit',e=>this.submit(e));
    root.addEventListener('click',e=>this.click(e));
    root.addEventListener('change',e=>this.change(e));
    root.addEventListener('input',e=>{if(e.target.closest('#converter-form'))this.conversion();});
    root.addEventListener('reset',e=>{const id=e.target.elements.id;if(id)setTimeout(()=>{id.value='';},0);});
  }
  mount(trip,page) { this.id=trip.id; this.page=page; this.generation++; this.render(); }
  leave() { this.generation++; }
  status(message) { const node=this.root.querySelector('#tools-status'); if(node)node.textContent=message; }
  save(data,id=this.id) {
    const trip=this.getTrip(id); if(!trip)throw new Error('Ce voyage n’existe plus.');
    this.saveTrip({...trip,organizer:data,updatedAt:new Date().toISOString()});
  }
  render() {
    const trip=this.getTrip(this.id); if(!trip)return;
    const data=organizerData(trip);
    this.root.innerHTML=`<div class="tools-date"><form id="travel-date-form">${field('startDate','Date de départ','date',`value="${escape(data.startDate)}"`)}<button class="secondary">Enregistrer la date</button></form><p class="small muted">Ces pages sont liées à ce voyage. Sauvegarde dans ce navigateur, sans compte ni synchronisation entre appareils.</p><button class="quiet" type="button" data-action="backup">Exporter le dossier complet</button><label class="backup-import">Restaurer un dossier exporté<input id="organizer-import" type="file" accept=".json,application/json"></label></div><p id="tools-status" class="tools-status" role="status" aria-live="polite"></p>${this[this.page](trip,data)}`;
    if(this.page==='budget')this.conversion();
  }
  dayOptions(trip,value=1) { return options(Array.from({length:trip.days},(_,i)=>[i+1,`Jour ${i+1}${dateForDay(organizerData(trip).startDate,i+1)?' · '+dateForDay(organizerData(trip).startDate,i+1):''}`]),value); }
  reservations(trip,data) {
    const rows=[...data.bookings].sort((a,b)=>a.day-b.day || (a.time||'').localeCompare(b.time||''));
    return `${title('01 / TOUT SOUS LA MAIN','Vos billets, sans fouiller.','Réunissez transports, hôtels, restaurants, billets et horaires de visite dans un agenda par jour.')}
    <div class="tools-grid"><section class="tools-card"><h3>Ajouter ou modifier une réservation</h3><form id="booking-form"><input type="hidden" name="id">${field('title','Nom / établissement','text','required maxlength="150"')}<div class="two-col"><label>Type<select name="kind">${options([['transport','Transport'],['hotel','Hébergement'],['museum','Musée / horaires'],['activity','Activité'],['restaurant','Restaurant']],'activity')}</select></label><label>Journée<select name="day">${this.dayOptions(trip)}</select></label></div><label>Lieu du carnet<select name="placeId"><option value="">Autre / aucun</option>${options(trip.places.map(p=>[p.id,p.name]),'')}</select></label><div class="two-col">${field('time','Heure de début / ouverture','time')}${field('endTime','Heure de fin / fermeture','time')}</div>${field('reference','Numéro de réservation','text','maxlength="150"')}${field('url','Lien officiel / réservation','url','placeholder="https://…"')}<label>Horaires, adresse et conditions<textarea name="notes" maxlength="3000" placeholder="Fermé le lundi, dernier accès à 17 h, adresse du logement…"></textarea></label><label>Billet PDF ou image (10 Mo maximum)<input name="file" type="file" accept="application/pdf,image/png,image/jpeg,image/webp"></label><label class="check-label"><input name="removeFile" type="checkbox"> Retirer le fichier déjà associé</label><p class="small muted">Les documents restent sur cet appareil. Exportez le dossier pour les sauvegarder. Horaires saisis par vous : vérifiez les exceptions sur le site officiel.</p>${formButtons('Enregistrer la réservation')}</form></section>
    <section class="tools-card"><h3>Votre agenda <span class="count">${rows.length}</span></h3>${rows.length?rows.map(b=>`<article class="tool-entry"><span class="eyebrow">Jour ${b.day}${dateForDay(data.startDate,b.day)?' · '+dateForDay(data.startDate,b.day):''} · ${escape(b.time||'Heure à préciser')}${b.endTime?' → '+escape(b.endTime):''}</span><h4>${escape(b.title)}</h4>${b.placeId?`<p>${escape(trip.places.find(p=>p.id===b.placeId)?.name||'Lieu retiré du parcours')}</p>`:''}${b.reference?`<p>Référence : ${escape(b.reference)}</p>`:''}<p class="preserve-lines">${escape(b.notes)}</p>${link(b.url,'Site / réservation')}<div class="tools-actions">${b.attachment?`<button class="secondary" data-action="document" data-id="${escape(b.id)}">Télécharger ${escape(b.attachment.name)}</button>`:''}<button class="quiet" data-edit="bookings" data-id="${escape(b.id)}">Modifier</button><button class="danger-button" data-delete="bookings" data-id="${escape(b.id)}">Supprimer</button></div></article>`).join(''):'<p class="tools-empty">Les billets au même endroit, l’esprit plus léger. Ajoutez votre première réservation.</p>'}
    <details><summary>Informations déjà notées dans les lieux</summary>${trip.places.map(p=>`<div class="tool-entry"><strong>${escape(p.name)}</strong><p class="preserve-lines">${escape(p.practicalInfo||'Horaires non renseignés.')}</p>${link(searchURL(`${p.localName||p.name} ${p.city||''} ${trip.country} site officiel horaires`),'Rechercher le site officiel et les horaires')}</div>`).join('')}</details></section></div>`;
  }
  budget(trip,data) {
    const b=data.budget, daily=dailyBudget(trip,b), total=daily.reduce((s,d)=>s+d.total,0), missing=daily.reduce((s,d)=>s+d.missing,0);
    return `${title('02 / COMPTEZ LES SOUVENIRS','Un budget qui vous suit.','Convertissez rapidement et répartissez vos dépenses prévues ou payées sur chaque journée. Les réservations ne sont pas ajoutées automatiquement au budget.')}
    <div class="budget-summary"><div><small>Dépenses prévues + payées</small><strong>${money(total,b.currency)}${missing?' + montants à convertir':''}</strong></div><div><small>Moyenne par jour</small><strong>${money(total/trip.days,b.currency)}</strong></div><div><small>Objectif du séjour</small><strong>${money(b.dailyLimit*trip.days,b.currency)}</strong></div></div>
    <div class="tools-grid"><section class="tools-card"><h3>Convertisseur express</h3><form id="converter-form">${field('amount','Montant','number','min="0" step="0.01" value="1" required')}<div class="two-col"><label>De<select name="from">${currencyOptions('EUR')}</select></label><label>Vers<select name="to">${currencyOptions(b.currency==='EUR'?'USD':b.currency)}</select></label></div><output id="conversion-result" aria-live="polite"></output></form><p class="small muted">Taux : ${escape(b.rates.source==='manual'?'Saisie manuelle':b.rates.source)}${b.rates.date?' · '+escape(b.rates.date):' · non chargés'}. Hors frais bancaires.</p><button class="secondary" data-action="rates">Actualiser les taux gratuits</button><p class="small muted">Source : ${link('https://www.frankfurter.app/','Frankfurter')} / banques centrales, dernier jour publié. Les montants sont indicatifs.</p><details><summary>Saisir un taux manuellement</summary><form id="manual-rate-form"><label>Devise<select name="currency">${currencyOptions('USD')}</select></label>${field('rate','1 EUR = combien dans cette devise ?','number','min="0.00000001" step="any" required')}<button class="secondary">Enregistrer ce taux</button></form></details>
    <h3>Mon objectif</h3><form id="budget-settings-form"><label>Devise du budget<select name="currency">${currencyOptions(b.currency)}</select></label>${field('limit','Budget par jour','number',`min="0" step="0.01" value="${b.dailyLimit}" required`)}<button class="secondary">Enregistrer l’objectif</button></form></section>
    <section class="tools-card"><h3>Ajouter ou modifier une dépense</h3><form id="expense-form"><input name="id" type="hidden">${field('title','Libellé','text','required maxlength="150"')}<div class="two-col">${field('amount','Montant','number','min="0" step="0.01" required')}<label>Devise<select name="currency">${currencyOptions(b.currency)}</select></label></div><div class="two-col"><label>Jour<select name="day">${this.dayOptions(trip)}</select></label><label>Catégorie<select name="category">${options(['Visites','Transport','Hébergement','Repas','Sport','Autre'].map(x=>[x,x]),'Visites')}</select></label></div><label>État<select name="state"><option value="planned">Prévue</option><option value="paid">Payée</option></select></label>${formButtons('Enregistrer la dépense')}</form></section></div>
    <section class="tools-card"><h3>Jour après jour</h3><div class="budget-days">${daily.map(d=>`<article class="budget-day ${d.total>b.dailyLimit?'over-budget':''}"><strong>Jour ${d.day}${d.day>trip.days?' (hors durée actuelle)':''}</strong><span>${money(d.total,b.currency)}</span><small>${d.missing?`${d.missing} montant(s) sans taux`:`${money(Math.abs(b.dailyLimit-d.total),b.currency)} ${d.total>b.dailyLimit?'de dépassement':'disponibles'}`}</small><meter min="0" max="${Math.max(b.dailyLimit,d.total,1)}" value="${d.total}">${d.total}</meter></article>`).join('')}</div>${b.expenses.length?b.expenses.map(e=>`<div class="expense-row"><span><strong>${escape(e.title)}</strong><small>Jour ${e.day} · ${escape(e.category)} · ${e.state==='paid'?'Payée':'Prévue'}</small></span><strong>${money(e.amount,e.currency)}</strong><button class="quiet" data-edit="expenses" data-id="${escape(e.id)}">Modifier</button><button class="danger-button" data-delete="expenses" data-id="${escape(e.id)}">Supprimer</button></div>`).join(''):'<p class="tools-empty">Ajoutez les visites, nuits, repas et déplacements pour voir votre budget par jour.</p>'}${missing?'<p class="warning">Total incomplet : certains taux sont manquants. Actualisez les taux ou renseignez-les manuellement.</p>':''}</section>`;
  }
  offres(trip,data) {
    const score = o => { const saving=offerSavings(o); if(saving===null)return -Infinity; const value=convert(Math.abs(saving),o.currency,data.budget.currency,data.budget.rates.values);return value===null?-Infinity:(saving<0?-value:value); };
    const offers=[...data.offers].sort((a,b)=>score(b)-score(a));
    return `${title('03 / LES BONS PLANS','Payez le juste prix.','Comparez un tarif étudiant ou un pass avec le prix normal des seules visites que vous avez réellement prévues. Les offres sont à vérifier auprès du vendeur officiel.')}
    <div class="tools-grid"><section class="tools-card"><h3>Ajouter ou modifier une offre</h3><form id="offer-form"><input name="id" type="hidden">${field('title','Nom de l’offre / du pass','text','required maxlength="150"')}<label>Type<select name="kind">${options([['student','Étudiant'],['youth','Jeune / âge'],['pass','Pass musées'],['other','Autre réduction']],'student')}</select></label><label>Devise<select name="currency">${currencyOptions(data.budget.currency)}</select></label><div class="two-col">${field('normal','Total normal des visites concernées','number','min="0" step="0.01" required')}${field('price','Prix réduit / coût total du pass','number','min="0" step="0.01" required')}</div>${field('url','Lien direct officiel','url','required placeholder="https://…"')}<label>Conditions et visites incluses<textarea name="conditions" required maxlength="3000" placeholder="Âge, résidence, justificatif étudiant, lieux couverts, créneaux et durée du pass…"></textarea></label><label class="check-label"><input name="eligible" type="checkbox"> J’ai vérifié que je remplis les conditions et que mes visites sont incluses</label>${formButtons('Enregistrer l’offre')}</form></section>
    <section class="tools-card"><h3>Vos offres triées par économie</h3><div class="offer-filters"><label>Type d’offre<select id="offer-kind-filter">${options([['','Toutes les offres'],['student','Étudiants'],['youth','Jeunes / âge'],['pass','Pass musées'],['other','Autres']],'')}</select></label><label class="check-label"><input id="offer-verified-filter" type="checkbox"> Uniquement les offres vérifiées</label></div><p class="small muted">Comparaison dans la devise du budget avec vos taux enregistrés. Une offre non vérifiée reste à confirmer. Les réductions ne se cumulent pas automatiquement ; les frais et réservations obligatoires sont à inclure dans les prix saisis.</p>${offers.length?offers.map(o=>{const saving=offerSavings(o), converted=saving===null?null:convert(Math.abs(saving),o.currency,data.budget.currency,data.budget.rates.values);return `<article class="tool-entry" data-offer-kind="${o.kind}" data-offer-verified="${o.eligible}"><span class="offer-badge">${saving===null?'Conditions à vérifier':saving>0?'Économie : '+money(saving,o.currency):saving===0?'Même coût que les billets séparés':'Plus cher de '+money(-saving,o.currency)}</span><h4>${escape(o.title)}</h4><p>Tarif normal : ${money(o.normal,o.currency)} · Offre : ${money(o.price,o.currency)}</p>${saving!==null&&o.currency!==data.budget.currency?`<p class="small muted">${converted===null?'Taux manquant : comparaison entre devises indisponible.':`Écart : ${money((saving<0?-1:1)*converted,data.budget.currency)} dans la devise du budget.`}</p>`:''}<p class="preserve-lines">${escape(o.conditions)}</p><p class="small muted">Fiche mise à jour le : ${escape(o.checkedDate)}</p>${link(o.url,'Voir les conditions et réserver')}<div class="tools-actions"><button class="quiet" data-edit="offers" data-id="${escape(o.id)}">Modifier / vérifier</button><button class="danger-button" data-delete="offers" data-id="${escape(o.id)}">Supprimer</button></div></article>`;}).join(''):'<p class="tools-empty">Un pass n’est utile que s’il couvre vos visites et revient moins cher. Ajoutez les offres à comparer ici.</p>'}</section></div>
    <section class="tools-card"><h3>Liens utiles pour votre destination</h3><p class="small muted">Sites officiels et organisateurs de pass : vérifiez les conditions, les visites incluses et les éventuels frais avant achat. L’achat d’une carte ne garantit pas une économie.</p><div class="tools-actions official-offers">${officialOfferSources(trip).map(s=>link(s.url,s.name)).join('')}</div><h3>Trouver les offres pour vos lieux</h3><p class="muted small">Ces liens ouvrent une recherche ciblée. Ajoutez ensuite le lien officiel et les prix confirmés au comparateur ; aucune réduction n’est annoncée sans vérification.</p><div class="offer-searches">${trip.places.map(p=>`<div class="tool-entry"><strong>${escape(p.name)}</strong><div class="tools-actions">${link(searchURL(`${p.localName||p.name} ${p.city||''} ${trip.country} site officiel tarif étudiant gratuité`),'Tarifs & étudiants')}${link(searchURL(`${p.localName||p.name} ${p.city||''} ${trip.country} official museum pass included`),'Pass musées')}</div></div>`).join('')}</div></section>`;
  }
  checklist(trip,data) {
    const packing=data.packing, items=packingItems(packing), count=items.filter(i=>packing.checked[i.id]).length, weather=packing.weather;
    return `${title('04 / PRÊT POUR LES DÉTOURS','Votre sac, bien pensé.','Une liste adaptée à la météo de votre destination et aux activités que vous prévoyez. Course et randonnée sont suggérées si elles apparaissent dans vos lieux. Vos cases cochées restent sauvegardées.')}
    <div class="tools-grid"><section class="tools-card"><h3>Mes activités</h3><form id="activities-form">${[['running','Course à pied'],['hiking','Randonnée'],['watch','J’utilise une montre de sport']].map(([key,label])=>`<label class="check-label"><input type="checkbox" name="${key}" ${packing[key]?'checked':''}> ${label}</label>`).join('')}<button class="secondary">Adapter ma liste</button></form><h3>La météo sur place</h3><form id="weather-form"><label>Lieu de référence<select name="placeId"><option value="">Choisir un lieu du voyage</option>${options(trip.places.filter(p=>coordinates(p.lat,p.lng)).map(p=>[p.id,p.name]),trip.places.find(p=>p.lat===weather?.lat&&p.lng===weather?.lng)?.id || trip.places.find(p=>coordinates(p.lat,p.lng))?.id || '')}</select></label><button class="secondary">Consulter la météo du séjour</button></form><p class="small muted">${data.startDate?'Départ : '+escape(data.startDate):'Sans date de départ, prévisions à partir d’aujourd’hui.'} Prévisions jusqu’à 16 jours, sur un seul lieu : vérifiez aussi les autres étapes et l’altitude. ${link('https://open-meteo.com/','Source Open-Meteo (CC BY 4.0)')}. Coordonnées transmises uniquement lors de votre demande.</p>${weather?`<div class="weather-summary"><strong>${escape(weather.location)}</strong><p class="small muted">Bulletin chargé le ${escape(new Date(weather.fetchedAt).toLocaleString('fr-FR'))}${weather.partial?' · Couverture partielle du séjour':''}${weather.end<new Date().toISOString().slice(0,10)?' · Bulletin expiré, à actualiser':''}</p>${weather.days.map(d=>`<div><span>${escape(d.date)}</span><strong>${d.min??'—'} à ${d.max??'—'} °C</strong><small>Pluie ${d.rain??'—'} % · Vent ${d.wind??'—'} km/h</small></div>`).join('')}</div>`:'<p class="tools-empty">Aucune prévision chargée. La liste de base reste utilisable.</p>'}<p class="small muted">Pour une sortie sportive, vérifiez les alertes locales avant de partir ; le bulletin ne décrit pas les conditions d’un sentier.</p>
    <details><summary>Préparer les étapes pour ma montre</summary><p class="small muted">Export GPX de points d’intérêt, sans tracé routier ni sentier. Ouvrez-les dans votre outil de préparation (Garmin, COROS, Suunto…), tracez et vérifiez le parcours puis synchronisez avec votre montre. Il n’y a pas de connexion directe à la montre.</p><div class="tools-actions">${planTrip(trip.places,trip.days,trip.startId,trip.fileOrder).days.map((_,i)=>`<button class="secondary" data-action="gpx" data-day="${i}">Étapes GPX · jour ${i+1}</button>`).join('')}</div></details></section>
    <section class="tools-card"><div class="section-title"><h3>Ma check-list</h3><strong id="packing-count">${count} / ${items.length}</strong></div><progress id="packing-progress" max="${items.length}" value="${count}">${count}</progress><div class="packing-list">${items.map(i=>`<div class="packing-item"><label><input type="checkbox" data-check="${escape(i.id)}" ${packing.checked[i.id]?'checked':''}><span><strong>${escape(i.label)}</strong><small>${escape(i.why)}</small></span></label>${packing.manual.some(m=>m.id===i.id)?`<button class="danger-button" data-delete="packing" data-id="${escape(i.id)}" aria-label="Supprimer ${escape(i.label)}">✕</button>`:''}</div>`).join('')}</div><form id="packing-item-form">${field('label','Ajouter un élément personnel','text','required maxlength="180"')}<button class="secondary">Ajouter à ma liste</button></form><button class="quiet" data-action="uncheck">Tout décocher</button></section></div>`;
  }
  conversion() {
    const form=this.root.querySelector('#converter-form'); if(!form)return;
    const data=organizerData(this.getTrip(this.id)), values=new FormData(form), amount=Number(values.get('amount'));
    const converted=convert(amount,values.get('from'),values.get('to'),data.budget.rates.values);
    this.root.querySelector('#conversion-result').textContent=converted===null?'Taux manquant : actualisez ou saisissez un taux.':money(converted,values.get('to'));
  }
  async submit(event) {
    event.preventDefault(); const form=event.target, id=this.id, generation=this.generation, data=organizerData(this.getTrip(id)), values=new FormData(form), value=key=>String(values.get(key)||'').trim();
    const button=form.querySelector('button[type="submit"],button:not([type])'); if(button)button.disabled=true;
    let newAttachment=null;
    try {
      switch(form.getAttribute('id')) {
        case 'travel-date-form': if(value('startDate')&&!dateForDay(value('startDate'),1))throw new Error('Date invalide.'); data.startDate=value('startDate'); delete data.packing.weather; break;
        case 'booking-form': {
          const previous=data.bookings.find(b=>b.id===value('id')), file=values.get('file');
          let attachment=values.has('removeFile')?null:previous?.attachment;
          if(file?.size) { newAttachment=crypto.randomUUID(); await documentFile('put',newAttachment,file); attachment={id:newAttachment,name:file.name,type:file.type,size:file.size}; }
          const booking={id:previous?.id||crypto.randomUUID(),title:value('title'),kind:value('kind'),day:Number(value('day')),placeId:value('placeId'),time:value('time'),endTime:value('endTime'),reference:value('reference'),notes:value('notes'),url:this.validURL(value('url')),attachment:attachment||null};
          data.bookings=[...data.bookings.filter(b=>b.id!==booking.id),booking];
          this.save(data,id); newAttachment=null;
          if(previous?.attachment && previous.attachment.id!==attachment?.id) await documentFile('delete',previous.attachment.id).catch(()=>{});
          if(generation===this.generation){this.render();this.status('Réservation enregistrée.');} return;
        }
        case 'budget-settings-form': data.budget.currency=value('currency'); data.budget.dailyLimit=this.amount(value('limit')); break;
        case 'manual-rate-form': {
          const rate=Number(value('rate')); if(!Number.isFinite(rate)||rate<=0)throw new Error('Le taux doit être supérieur à zéro.');
          if(value('currency')==='EUR'&&rate!==1)throw new Error('Le taux EUR vers EUR est toujours 1.');
          data.budget.rates={values:{...data.budget.rates.values,[value('currency')]:rate},date:new Date().toISOString().slice(0,10),source:'manual'};break;
        }
        case 'expense-form': {
          const expense={id:value('id')||crypto.randomUUID(),title:value('title'),amount:this.amount(value('amount')),currency:value('currency'),day:Number(value('day')),category:value('category'),state:value('state')};
          data.budget.expenses=[...data.budget.expenses.filter(e=>e.id!==expense.id),expense];break;
        }
        case 'offer-form': {
          const offer={id:value('id')||crypto.randomUUID(),title:value('title'),kind:value('kind'),normal:this.amount(value('normal')),price:this.amount(value('price')),currency:value('currency'),url:this.validURL(value('url')),conditions:value('conditions'),eligible:values.has('eligible'),checkedDate:new Date().toISOString().slice(0,10)};
          data.offers=[...data.offers.filter(o=>o.id!==offer.id),offer];break;
        }
        case 'activities-form': for(const key of ['running','hiking','watch'])data.packing[key]=values.has(key);break;
        case 'packing-item-form': data.packing.manual.push({id:crypto.randomUUID(),label:value('label')});break;
        case 'weather-form': {
          const place=this.getTrip(id).places.find(p=>p.id===value('placeId')); this.status('Chargement des prévisions…');
          const weather=await fetchWeather(place,data.startDate,this.getTrip(id).days);
          if(generation!==this.generation)return;
          const latest=organizerData(this.getTrip(id));
          if(latest.startDate!==data.startDate)throw new Error('La date a changé : relancez la météo.');
          latest.packing.weather=weather; this.save(latest,id); this.render();this.status('Météo chargée, conseils adaptés.');return;
        }
        case 'converter-form': this.conversion();return;
        default:return;
      }
      this.save(data,id); if(generation===this.generation){this.render();this.status('Enregistré dans votre voyage.');}
    } catch(error) { if(newAttachment)await documentFile('delete',newAttachment).catch(()=>{}); if(generation===this.generation)this.status(error.message); }
    finally { if(button)button.disabled=false; }
  }
  amount(value) { const number=Number(value); if(!Number.isFinite(number)||number<0)throw new Error('Le montant doit être un nombre positif ou nul.'); return number; }
  validURL(value) { if(value&&!safeLink(value))throw new Error('Utilisez un lien HTTPS valide, sans identifiants.');return safeLink(value); }
  async click(event) {
    const button=event.target.closest('button');if(!button)return;
    const id=this.id,generation=this.generation,trip=this.getTrip(id),data=organizerData(trip), recordId=button.dataset.id;
    try {
      if(button.dataset.edit) {
        const kind=button.dataset.edit, form=this.root.querySelector({bookings:'#booking-form',expenses:'#expense-form',offers:'#offer-form'}[kind]);
        const record=(kind==='expenses'?data.budget.expenses:data[kind]).find(r=>r.id===recordId);
        for(const [key,value] of Object.entries(record)) { const input=form.elements.namedItem(key);if(!input||input.type==='file')continue;if(key==='day' && ![...input.options].some(o=>o.value===String(value))) input.add(new Option('Jour '+value+' (hors durée actuelle)',value)); if(input.type==='checkbox')input.checked=!!value;else input.value=value??''; }
        form.scrollIntoView({behavior:'smooth',block:'center'});form.elements.title.focus();this.status('Modifiez les champs puis enregistrez.');return;
      }
      if(button.dataset.delete) {
        if(!confirm('Supprimer cet élément du voyage ?'))return;
        const kind=button.dataset.delete;
        let attachment;
        if(kind==='expenses')data.budget.expenses=data.budget.expenses.filter(r=>r.id!==recordId);
        else if(kind==='packing'){data.packing.manual=data.packing.manual.filter(r=>r.id!==recordId);delete data.packing.checked[recordId];}
        else {attachment=data[kind].find(r=>r.id===recordId)?.attachment;data[kind]=data[kind].filter(r=>r.id!==recordId);}
        this.save(data,id);if(attachment)await documentFile('delete',attachment.id).catch(()=>{});
        if(generation===this.generation){this.render();this.status('Élément supprimé.');}return;
      }
      switch(button.dataset.action) {
        case 'rates': {
          button.disabled=true;this.status('Actualisation des taux…');const rates=await fetchRates();
          const latest=organizerData(this.getTrip(id));latest.budget.rates=rates;this.save(latest,id);
          if(generation===this.generation){this.render();this.status('Taux actualisés au '+rates.date+'.');}break;
        }
        case 'document': {
          const attachment=data.bookings.find(b=>b.id===recordId)?.attachment,file=attachment&&await documentFile('get',attachment.id);
          if(!file)throw new Error('Document absent de cet appareil. Réimportez-le dans la réservation.');download(file,attachment.name);break;
        }
        case 'uncheck': if(!confirm('Décocher tous les éléments de cette liste ?'))return; data.packing.checked={};this.save(data);this.render();break;
        case 'gpx': {
          const index=Number(button.dataset.day),day=planTrip(trip.places,trip.days,trip.startId,trip.fileOrder).days[index];
          download(new Blob([waypointsGPX(day,`${trip.name} — jour ${index+1}`)],{type:'application/gpx+xml'}),`etapes-jour-${index+1}.gpx`);this.status('Points GPX exportés. Préparez et vérifiez le tracé dans votre application de sport.');break;
        }
        case 'backup': await this.backup(trip);break;
      }
    }catch(error){if(generation===this.generation)this.status(error.message);}finally{button.disabled=false;}
  }
  async change(event) {
    const target=event.target;
    if(['offer-kind-filter','offer-verified-filter'].includes(target.id)) {
      const kind=this.root.querySelector('#offer-kind-filter').value,verified=this.root.querySelector('#offer-verified-filter').checked;
      this.root.querySelectorAll('[data-offer-kind]').forEach(row=>{row.hidden=!!((kind&&row.dataset.offerKind!==kind)||(verified&&row.dataset.offerVerified!=='true'));});
    }
    if(target.dataset.check) {
      try {
        const data=organizerData(this.getTrip(this.id));data.packing.checked[target.dataset.check]=target.checked;this.save(data);
        const items=packingItems(data.packing),count=items.filter(i=>data.packing.checked[i.id]).length;
        this.root.querySelector('#packing-count').textContent=`${count} / ${items.length}`;this.root.querySelector('#packing-progress').value=count;
      }catch(error){target.checked=!target.checked;this.status(error.message);}
    }
    if(target.id==='organizer-import' && target.files[0])await this.restore(target.files[0]);
  }
  async backup(trip) {
    this.status('Préparation de la sauvegarde, documents inclus…');
    const files=[];
    for(const booking of organizerData(trip).bookings) if(booking.attachment) {
      const file=await documentFile('get',booking.attachment.id);if(!file)throw new Error('Un billet est absent de cet appareil : réimportez-le avant de sauvegarder.');
      const content=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(new Error('Lecture du billet impossible.'));reader.readAsDataURL(file);});
      files.push({...booking.attachment,content});
    }
    const blob=new Blob([JSON.stringify({format:'voyage-dossier',version:1,trip,files},null,2)],{type:'application/json'});
    if(blob.size>80*1024*1024)throw new Error('La sauvegarde dépasse 80 Mo. Téléchargez les billets séparément puis retirez les fichiers volumineux du dossier avant un nouvel export.');
    download(blob,'voyage-dossier.json');this.status('Dossier exporté avec ses billets. Conservez ce fichier dans un endroit privé.');
  }
  async restore(file) {
    const id=this.id,generation=this.generation,created=[];
    try {
      if(file.size>80*1024*1024)throw new Error('Sauvegarde trop volumineuse (80 Mo maximum).');
      const backup=JSON.parse(await file.text());
      // Validation des données effectuée par le même validateur que les dossiers enregistrés.
      const {validateTrip}=await import('./trips.js');
      if(backup.format!=='voyage-dossier'||backup.version!==1||!Array.isArray(backup.files))throw new Error('Ce fichier n’est pas une sauvegarde de dossier Voyage.');
      validateTrip(backup.trip);
      if(!confirm('Restaurer cette sauvegarde dans le dossier actuel ? Son contenu sera remplacé.'))return;
      const restored=structuredClone(backup.trip), restoredData=organizerData(restored);
      for(const booking of restoredData.bookings) if(booking.attachment) {
        const stored=backup.files.find(f=>f.id===booking.attachment.id);
        if(!stored||typeof stored.content!=='string'||!/^data:(application\/pdf|image\/(png|jpeg|webp));base64,/.test(stored.content))throw new Error('Un billet de la sauvegarde est invalide ou absent.');
        const [header,body]=stored.content.split(','), binary=atob(body), bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
        const blob=new Blob([bytes],{type:header.slice(5,header.indexOf(';'))}),newId=crypto.randomUUID();
        await documentFile('put',newId,blob);created.push(newId);booking.attachment={...booking.attachment,id:newId,type:blob.type,size:blob.size};
      }
      const previous=this.getTrip(id);this.saveTrip({...restored,id,createdAt:previous.createdAt,organizer:restoredData,updatedAt:new Date().toISOString()});
      created.length=0;
      for(const booking of previous.organizer?.bookings || []) if(booking.attachment) await documentFile('delete',booking.attachment.id).catch(()=>{});
      if(generation===this.generation){location.hash='#voyage='+encodeURIComponent(id);this.status('Sauvegarde restaurée.');}
    }catch(error){for(const key of created)await documentFile('delete',key).catch(()=>{});if(generation===this.generation)this.status('Restauration impossible : '+error.message);}
  }
}
