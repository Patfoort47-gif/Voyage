import { emailToText, readConfirmationFile, confirmationJSON, readConfirmationJSON } from './confirmation-mail.js';
import { renderBookingForm, bookingDetails, bookingSection, bookingTextFields, bookingCountFields } from './booking-forms.js';
import { ticketPlaceStatus, ticketPlaces } from './ticket-places.js';
import { parseTicket } from './ticket-parser.js';
import { destinationCurrency } from './destination-currency.js';
import { findOfficialSite } from './official-sites.js';
import { currencies, safeLink, dateForDay, organizerData, convert, dailyBudget, fetchRates, fetchWeather, packingItems, waypointsGPX, weatherPlan, weatherNeedsRefresh } from './travel-tools.js';
import { documentFile, deleteUnusedDocument } from './travel-files.js';
import { planTrip, coordinates } from './core.js';

export const travelPages = { route:'Itinéraire', reservations:'Billets & horaires', budget:'Budget & devises', checklist:'Ma check-list' };
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
  constructor(root,{getTrip,saveTrip,canEdit=()=>true}) {
    this.root=root; this.canEdit=canEdit; this.getTrip=getTrip; this.saveTrip=saveTrip; this.id=''; this.page=''; this.generation=0; this.bookingSection='flight'; this.weatherPending=null; this.weatherAttempts=new Map();
    root.addEventListener('submit',e=>this.submit(e));
    root.addEventListener('click',e=>this.click(e));
    root.addEventListener('change',e=>this.change(e));
    root.addEventListener('input',e=>{if(e.target.closest('#converter-form'))this.conversion();});
    document.addEventListener('visibilitychange',()=>{if(!document.hidden && this.page==='checklist' && !root.hidden)this.autoWeather();});
    root.addEventListener('reset',e=>{this.formRevision=(this.formRevision||0)+1;this.ticketDraft=null; const id=e.target.elements.id;if(id)setTimeout(()=>{id.value='';},0);});
  }
  mount(trip,page) { this.ticketDraft=null; this.id=trip.id; this.page=page; this.generation++; this.render(); clearInterval(this.weatherTimer); if(page==='checklist')this.weatherTimer=setInterval(()=>{if(!document.hidden)this.autoWeather();},60000); }
  leave() { this.generation++; this.page=''; clearInterval(this.weatherTimer); }
  status(message) { const node=this.root.querySelector('#tools-status'); if(node)node.textContent=message; }
  save(data,id=this.id) {
    const trip=this.getTrip(id); if(!trip)throw new Error('Ce voyage n’existe plus.');
    this.saveTrip({...trip,organizer:data,updatedAt:new Date().toISOString()});
  }
  render() {
    this.formRevision=(this.formRevision||0)+1;this.ticketDraft=null;
    const trip=this.getTrip(this.id); if(!trip)return;
    const data=organizerData(trip);
    this.root.innerHTML=`<div class="tools-date"><form id="travel-date-form">${field('startDate','Date de départ','date',`value="${escape(data.startDate)}"`)}<button class="secondary">Enregistrer la date</button></form><p class="small muted">Ces pages sont liées à ce voyage. Sauvegarde sur cet appareil ; activez « Synchronisation & partage » pour les retrouver ailleurs.</p><button class="quiet" type="button" data-action="backup">Exporter le dossier complet</button><label class="backup-import">Restaurer un dossier exporté<input id="organizer-import" type="file" accept=".json,application/json"></label></div><p id="tools-status" class="tools-status" role="status" aria-live="polite"></p>${this[this.page](trip,data)}`;
    if(this.page==='budget')this.conversion();
    if(this.page==='checklist')queueMicrotask(()=>this.autoWeather());
  }
  dayOptions(trip,value=1) { return options(Array.from({length:trip.days},(_,i)=>[i+1,`Jour ${i+1}${dateForDay(organizerData(trip).startDate,i+1)?' · '+dateForDay(organizerData(trip).startDate,i+1):''}`]),value); }
  reservations(trip,data) {
    const stay=this.bookingSection!=='visites';
    const kind=stay?this.bookingSection:'museum';
    const rows=data.bookings.filter(b=>stay ? b.kind===kind : !['flight','hotel'].includes(b.kind)).sort((a,b)=>a.day-b.day || (a.time||'').localeCompare(b.time||''));
    return `${title('01 / TOUT SOUS LA MAIN','Vos billets, sans fouiller.','Réunissez transports, hôtels, restaurants, billets et horaires de visite dans un agenda par jour.')}<nav class="booking-tabs" aria-label="Catégories de réservations">${[['flight','✈ Vols'],['hotel','Hôtels'],['visites','Visites & transports locaux']].map(([section,label])=>`<button class="secondary" data-booking-section="${section}" aria-pressed="${this.bookingSection===section}">${label} (${data.bookings.filter(b=>bookingSection(b.kind)===section).length})</button>`).join('')}</nav><p class="small muted">Ajoutez autant de réservations que nécessaire, dans la limite du stockage de votre navigateur. Chaque entrée peut avoir son propre billet.</p>
    <section class="tools-card ticket-import"><h3>Lire les informations d’un billet</h3><label>Importer un billet PDF, photo ou scan (10 Mo maximum)<input id="ticket-upload" type="file" accept="application/pdf,image/png,image/jpeg,image/webp"></label><label>Type du document<select id="ticket-kind">${options([['auto','Détection automatique'],['flight','Vol'],['hotel','Hôtel'],['museum','Musée / visite'],['activity','Activité / parc / zoo'],['transport','Transport local']],'auto')}</select></label><p id="ticket-read-status" class="small muted" role="status">Lecture locale, sans envoi du billet. Les informations trouvées sont proposées champ par champ. Cochez celles à appliquer, puis enregistrez la réservation.</p><details><summary>Voir le texte lu ou coller le texte du billet</summary><label>Texte du document<textarea id="ticket-transcript" rows="7" maxlength="100000"></textarea></label><button class="secondary" data-action="parse-ticket">Analyser ce texte</button></details><details class="email-import"><summary>Importer une confirmation d’e-mail ou un JSON</summary><label>Fichier e-mail (.eml), texte (.txt) ou confirmation JSON<input id="confirmation-upload" type="file" accept=".eml,.txt,.json,message/rfc822,text/plain,application/json"></label><p class="small muted">Aucune connexion à votre boîte mail. Vous pouvez aussi coller le contenu de l’e-mail dans le texte ci-dessus. Le message est traité sur cet appareil ; ses pièces jointes ne sont pas importées. Pour joindre un billet, utilisez le PDF ou la photo.</p></details><div id="ticket-review"></div><p class="small muted">Un document par réservation. Pour une lecture difficile, choisissez le type du document puis relancez l’analyse du texte. Pour un PDF contenant plusieurs trajets ou billets, vérifiez les champs et créez plusieurs entrées si nécessaire. Les QR codes ne sont pas décodés.</p></section>
    <div class="tools-grid"><section class="tools-card">${renderBookingForm(kind,trip,data,this.dayOptions(trip))}</section>
    <section class="tools-card"><h3>Votre agenda <span class="count">${rows.length}</span></h3>${rows.length?rows.map(b=>`<article class="tool-entry"><span class="eyebrow">${b.bookingDate?escape(b.bookingDate):'Jour '+b.day}${!b.bookingDate&&dateForDay(data.startDate,b.day)?' · '+dateForDay(data.startDate,b.day):''} · ${escape(b.time||'Heure à préciser')}${b.endTime?' → '+escape(b.endTime):''}</span><h4>${escape(b.title)}</h4><label class="booking-classify">Ranger dans<select data-booking-kind="${escape(b.id)}">${options([['flight','Vol / avion'],['hotel','Hôtel / hébergement'],['museum','Musée / horaires'],['transport','Transport local'],['activity','Activité'],['restaurant','Restaurant']],b.kind)}</select></label>${bookingDetails(b)}${b.placeId?`<p>${escape(trip.places.find(p=>p.id===b.placeId)?.name||'Lieu retiré du parcours')}</p>`:''}${b.reference?`<p>Référence : ${escape(b.reference)}</p>`:''}<p class="preserve-lines">${escape(b.notes)}</p>${link(b.url,'Site / réservation')}<div class="tools-actions">${b.attachment?`<button class="secondary" data-action="document" data-id="${escape(b.id)}">Télécharger ${escape(b.attachment.name)}</button>`:''}<button class="quiet" data-edit="bookings" data-id="${escape(b.id)}">Modifier</button><button class="danger-button" data-delete="bookings" data-id="${escape(b.id)}">Supprimer</button></div></article>`).join(''):'<p class="tools-empty">Les billets au même endroit, l’esprit plus léger. Ajoutez votre première réservation.</p>'}
    </section></div>${stay?'':`<section class="tools-card">${this.sitePanel(trip,data)}</section>`}<div class="tools-card"><details><summary>Informations déjà notées dans les lieux avec billet</summary>${ticketPlaces(trip,data).map(p=>`<div class="tool-entry"><strong>${escape(p.name)}</strong><p class="preserve-lines">${escape(p.practicalInfo||'Horaires non renseignés.')}</p>${link(searchURL(`${p.localName||p.name} ${p.city||''} ${trip.country} site officiel horaires`),'Rechercher le site officiel et les horaires')}</div>`).join('')}</details></div>`;
  }
  budget(trip,data) {
    const localCurrency=destinationCurrency(trip);
    const b=data.budget, daily=dailyBudget(trip,b), total=daily.reduce((s,d)=>s+d.total,0), missing=daily.reduce((s,d)=>s+d.missing,0);
    return `${title('02 / COMPTEZ LES SOUVENIRS','Un budget qui vous suit.','Convertissez rapidement et répartissez vos dépenses prévues ou payées sur chaque journée. Les réservations ne sont pas ajoutées automatiquement au budget.')}
    <div class="budget-summary"><div><small>Dépenses prévues + payées</small><strong>${money(total,b.currency)}${missing?' + montants à convertir':''}</strong></div><div><small>Moyenne par jour</small><strong>${money(total/trip.days,b.currency)}</strong></div><div><small>Objectif du séjour</small><strong>${money(b.dailyLimit*trip.days,b.currency)}</strong></div></div>
    <div class="tools-grid"><section class="tools-card"><h3>Convertisseur express</h3><form id="converter-form">${field('amount','Montant','number','min="0" step="0.01" value="1" required')}<div class="two-col"><label>De<select name="from">${currencyOptions(localCurrency||'EUR')}</select></label><label>Vers<select name="to">${currencyOptions('EUR')}</select></label></div><button class="quiet" type="button" data-action="swap-currencies">⇄ Inverser les devises</button><p class="small muted">${localCurrency?`Devise du pays : ${localCurrency}. Conversion vers l’euro par défaut.`:'Devise du pays non identifiée : choisissez-la ci-dessus.'}</p><output id="conversion-result" aria-live="polite"></output></form><p class="small muted">Taux : ${escape(b.rates.source==='manual'?'Saisie manuelle':b.rates.source)}${b.rates.date?' · '+escape(b.rates.date):' · non chargés'}. Hors frais bancaires.</p><button class="secondary" data-action="rates">Actualiser les taux gratuits</button><p class="small muted">Source : ${link('https://www.frankfurter.app/','Frankfurter')} / banques centrales, dernier jour publié. Les montants sont indicatifs.</p><details><summary>Saisir un taux manuellement</summary><form id="manual-rate-form"><label>Devise<select name="currency">${currencyOptions(localCurrency||'EUR')}</select></label>${field('rate','1 EUR = combien dans cette devise ?','number','min="0.00000001" step="any" required')}<button class="secondary">Enregistrer ce taux</button></form></details>
    <h3>Mon objectif</h3><form id="budget-settings-form"><label>Devise du budget<select name="currency">${currencyOptions(b.currency)}</select></label>${field('limit','Budget par jour','number',`min="0" step="0.01" value="${b.dailyLimit}" required`)}<button class="secondary">Enregistrer l’objectif</button></form></section>
    <section class="tools-card"><h3>Ajouter ou modifier une dépense</h3><form id="expense-form"><input name="id" type="hidden">${field('title','Libellé','text','required maxlength="150"')}<div class="two-col">${field('amount','Montant','number','min="0" step="0.01" required')}<label>Devise<select name="currency">${currencyOptions(localCurrency||b.currency)}</select></label></div><div class="two-col"><label>Jour<select name="day">${this.dayOptions(trip)}</select></label><label>Catégorie<select name="category">${options(['Visites','Transport','Hébergement','Repas','Sport','Autre'].map(x=>[x,x]),'Visites')}</select></label></div><label>État<select name="state"><option value="planned">Prévue</option><option value="paid">Payée</option></select></label>${formButtons('Enregistrer la dépense')}</form></section></div>
    <section class="tools-card"><h3>Jour après jour</h3><div class="budget-days">${daily.map(d=>`<article class="budget-day ${d.total>b.dailyLimit?'over-budget':''}"><strong>Jour ${d.day}${d.day>trip.days?' (hors durée actuelle)':''}</strong><span>${money(d.total,b.currency)}</span><small>${d.missing?`${d.missing} montant(s) sans taux`:`${money(Math.abs(b.dailyLimit-d.total),b.currency)} ${d.total>b.dailyLimit?'de dépassement':'disponibles'}`}</small><meter min="0" max="${Math.max(b.dailyLimit,d.total,1)}" value="${d.total}">${d.total}</meter></article>`).join('')}</div>${b.expenses.length?b.expenses.map(e=>`<div class="expense-row"><span><strong>${escape(e.title)}</strong><small>Jour ${e.day} · ${escape(e.category)} · ${e.state==='paid'?'Payée':'Prévue'}</small></span><strong>${money(e.amount,e.currency)}</strong><button class="quiet" data-edit="expenses" data-id="${escape(e.id)}">Modifier</button><button class="danger-button" data-delete="expenses" data-id="${escape(e.id)}">Supprimer</button></div>`).join(''):'<p class="tools-empty">Ajoutez les visites, nuits, repas et déplacements pour voir votre budget par jour.</p>'}${missing?'<p class="warning">Total incomplet : certains taux sont manquants. Actualisez les taux ou renseignez-les manuellement.</p>':''}</section>`;
  }
  checklist(trip,data) {
    const packing=data.packing, items=packingItems(packing,trip.days), count=items.filter(i=>packing.checked[i.id]).length, weather=packing.weather;
    return `${title('04 / PRÊT POUR LES DÉTOURS','Votre sac, bien pensé.','Une liste adaptée à la météo de votre destination et aux activités que vous prévoyez. Course et randonnée sont suggérées si elles apparaissent dans vos lieux. Vos cases cochées restent sauvegardées.')}
    <div class="tools-grid"><section class="tools-card"><h3>Vêtements pour ${trip.days} jour(s)</h3><form id="packing-settings-form"><label>Une lessive pendant le voyage ?<select name="laundryEvery">${options([[0,'Non, prévoir pour tout le séjour'],[3,'Tous les 3 jours'],[5,'Tous les 5 jours'],[7,'Toutes les semaines']],packing.laundryEvery||0)}</select></label><p class="small muted">Quantités indicatives par personne, adaptées à la durée et à la météo. Les éléments « si besoin » restent à adapter.</p><button class="secondary">Ajuster les quantités</button></form><h3>Mes activités</h3><form id="activities-form">${[['running','Course à pied'],['hiking','Randonnée'],['watch','J’utilise une montre de sport']].map(([key,label])=>`<label class="check-label"><input type="checkbox" name="${key}" ${packing[key]?'checked':''}> ${label}</label>`).join('')}<button class="secondary">Adapter ma liste</button></form><h3>La météo sur place</h3><label class="check-label"><input type="checkbox" id="auto-weather" ${packing.autoWeather!==false?'checked':''}> Actualiser la météo et adapter la liste automatiquement</label><p id="auto-weather-status" class="small muted" role="status"></p><form id="weather-form"><label>Lieu de référence<select name="placeId"><option value="">Choisir un lieu du voyage</option>${options(trip.places.filter(p=>coordinates(p.lat,p.lng)).map(p=>[p.id,p.name]),trip.places.find(p=>p.id===packing.placeId && coordinates(p.lat,p.lng))?.id || trip.places.find(p=>p.lat===weather?.lat&&p.lng===weather?.lng)?.id || trip.places.find(p=>coordinates(p.lat,p.lng))?.id || '')}</select></label><button class="secondary">Consulter la météo du séjour</button></form><p class="small muted">${data.startDate?'Départ : '+escape(data.startDate):'Sans date de départ, prévisions à partir d’aujourd’hui.'} Prévisions jusqu’à 16 jours, sur un seul lieu : vérifiez aussi les autres étapes et l’altitude. ${link('https://open-meteo.com/','Source Open-Meteo (CC BY 4.0)')}. Mise à jour automatique à l’ouverture, puis après 6 h si la page reste ouverte. Coordonnées transmises à Open-Meteo lorsque l’actualisation automatique est active.</p><div id="weather-bulletin">${weather?`<div class="weather-summary"><strong>${escape(weather.location)}</strong><p class="small muted">Bulletin chargé le ${escape(new Date(weather.fetchedAt).toLocaleString('fr-FR'))}${weather.partial?' · Couverture partielle du séjour':''}${weather.end<new Date().toISOString().slice(0,10)?' · Bulletin expiré, à actualiser':''}</p>${weather.days.map(d=>`<div><span>${escape(d.date)}</span><strong>${d.min??'—'} à ${d.max??'—'} °C</strong><small>Pluie ${d.rain??'—'} % · Vent ${d.wind??'—'} km/h</small></div>`).join('')}</div>`:'<p class="tools-empty">Aucune prévision chargée. La liste de base reste utilisable.</p>'}</div><p class="small muted">Pour une sortie sportive, vérifiez les alertes locales avant de partir ; le bulletin ne décrit pas les conditions d’un sentier.</p>
    <details><summary>Préparer les étapes pour ma montre</summary><p class="small muted">Export GPX de points d’intérêt, sans tracé routier ni sentier. Ouvrez-les dans votre outil de préparation (Garmin, COROS, Suunto…), tracez et vérifiez le parcours puis synchronisez avec votre montre. Il n’y a pas de connexion directe à la montre.</p><div class="tools-actions">${planTrip(trip.places,trip.days,trip.startId,trip.fileOrder,trip.dayGroups).days.map((_,i)=>`<button class="secondary" data-action="gpx" data-day="${i}">Étapes GPX · jour ${i+1}</button>`).join('')}</div></details></section>
    <section class="tools-card"><div class="section-title"><h3>Ma check-list</h3><strong id="packing-count">${count} / ${items.length}</strong></div><progress id="packing-progress" max="${items.length}" value="${count}">${count}</progress><div class="packing-list">${items.map((i,index)=>`${i.group!==items[index-1]?.group?`<h4 class="packing-group">${escape(i.group||'Équipement & activités')}</h4>`:''}<div class="packing-item"><label><input type="checkbox" data-check="${escape(i.id)}" ${packing.checked[i.id]?'checked':''}><span><strong>${escape(i.label)}${i.quantity?` <span class="packing-quantity">× ${i.quantity}</span>`:''}</strong><small>${escape(i.why)}</small></span></label>${packing.manual.some(m=>m.id===i.id)?`<button class="danger-button" data-delete="packing" data-id="${escape(i.id)}" aria-label="Supprimer ${escape(i.label)}">✕</button>`:''}</div>`).join('')}</div><form id="packing-item-form">${field('label','Ajouter un élément personnel','text','required maxlength="180"')}<button class="secondary">Ajouter à ma liste</button></form><button class="quiet" data-action="uncheck">Tout décocher</button></section></div>`;
  }
  refreshTicketPanels() {
    const trip=this.getTrip(this.id),data=organizerData(trip),container=document.createElement('div');container.innerHTML=this.sitePanel(trip,data);
    const old=this.root.querySelector('#ticket-place-panel');if(old)old.replaceWith(container.firstElementChild);
  }
  async readTicketFile(file) {
    const generation=this.generation,tripId=this.id;let revision=this.formRevision;
    this.ticketDraft=null;
    const status=message=>{if(generation===this.generation&&revision===this.formRevision){const node=this.root.querySelector('#ticket-read-status');if(node)node.textContent=message;}};
    const input=this.root.querySelector('#ticket-upload');input.disabled=true;status('Lecture du billet en cours… Le premier chargement de la reconnaissance peut prendre un moment.');
    try {
      const {readTicket}=await import('./ticket-reader.js');
      const result=await readTicket(file,status);
      if(generation!==this.generation||revision!==this.formRevision)return;
      if(!result.text.trim())throw new Error('Aucun texte lisible. Essayez une image plus nette ou collez le texte du billet.');
      this.ticketDraft={tripId,file};
      this.root.querySelector('#ticket-transcript').value=result.text;
      this.prepareTicket(result.text);revision=this.formRevision;
      status(`${result.method} : informations proposées ci-dessous, à vérifier et appliquer. ${result.warnings.join(' ')} Le document sera joint après application et enregistrement.`);
    } catch(error){status('Lecture impossible : '+error.message+' Vous pouvez compléter les champs manuellement et joindre le billet.');}
    finally {if(input.isConnected)input.disabled=false;}
  }
  prepareTicket(text) {
    const trip=this.getTrip(this.id),data=organizerData(trip),kindChoice=this.root.querySelector('#ticket-kind').value;
    if(String(text).trim().startsWith('{')){this.renderTicketProposal(readConfirmationJSON(text));return;}
    if(/^(?:from|subject|mime-version|content-type):/im.test(text)&&/\r?\n\r?\n/.test(text))text=emailToText(text);
    const proposed=parseTicket(text,{places:trip.places,startDate:data.startDate,days:trip.days,kindHint:kindChoice==='auto'?null:kindChoice});
    this.renderTicketProposal(proposed);
  }
  renderTicketProposal(proposed) {
    const trip=this.getTrip(this.id);
    const labels={title:'Nom',kind:'Type',bookingDate:'Date de départ / arrivée hôtel / visite',arrivalDate:'Date d’arrivée du vol',checkoutDate:'Départ de l’hôtel',time:'Heure de départ / check-in / visite',endTime:'Heure d’arrivée / check-out / fin',reference:'Référence',placeId:'Lieu du carnet',day:'Jour du voyage',airline:'Compagnie',flightNumber:'Numéro de vol',origin:'Aéroport de départ',destination:'Aéroport d’arrivée',passenger:'Passager(s)',terminal:'Terminal de départ',arrivalTerminal:'Terminal d’arrivée',gate:'Porte',seat:'Siège(s)',baggage:'Bagages',address:'Adresse',guestName:'Nom du client',roomType:'Chambre',guests:'Voyageurs',contact:'Contact',visitors:'Visiteurs',ticketType:'Type de billet',meetingPoint:'Point de rendez-vous'};
    this.ticketProposal=proposed;
    const form=this.root.querySelector('#booking-form');
    const entries=Object.entries(labels).filter(([key])=>proposed[key]!==undefined&&proposed[key]!==null&&proposed[key]!=='');
    this.root.querySelector('#ticket-review').innerHTML=`<fieldset class="ticket-review"><legend>${entries.length} champ(s) proposé(s) · vérifiez avant d’appliquer</legend>${proposed.warnings.map(w=>`<p class="warning">${escape(w)}</p>`).join('')}${entries.map(([key,label])=>{
      const current=form.elements.namedItem(key)?.value;
      const checked=key==='kind'||!current||(key==='day'&&current==='1'&&form.elements.id.value==='')||current===String(proposed[key]);
      const values={flight:'Vol',hotel:'Hôtel',museum:'Musée / visite',activity:'Activité',transport:'Transport local',restaurant:'Restaurant'};
      return `<div class="ticket-proposal-row"><label class="check-label"><input type="checkbox" data-proposal-check="${key}" ${checked?'checked':''}>${label}</label>${key==='kind'?`<select data-proposal-value="kind">${options(Object.entries(values),proposed.kind)}</select>`:key==='placeId'?`<select data-proposal-value="placeId">${options(trip.places.map(p=>[p.id,p.name]),proposed.placeId)}</select>`:`<input type="${['bookingDate','arrivalDate','checkoutDate'].includes(key)?'date':['time','endTime'].includes(key)?'time':['day','guests','visitors'].includes(key)?'number':'text'}" data-proposal-value="${key}" aria-label="Proposition : ${label}" value="${escape(proposed[key])}" maxlength="300">`}${current&&current!==String(proposed[key])&&key!=='kind'?`<small>Valeur actuelle conservée tant que non cochée : ${escape(current)}</small>`:''}${proposed.evidence?.[key]?`<small>Lu sur le billet : ${escape(proposed.evidence[key])}</small>`:''}</div>`;
    }).join('')}${entries.length?'<button class="primary" data-action="apply-ticket-fields">Appliquer les champs cochés au formulaire</button><button class="secondary" data-action="export-confirmation">Exporter ces informations en JSON</button>':'<p>Aucun champ suffisamment identifiable. Choisissez le type du document, corrigez le texte lu si nécessaire puis relancez l’analyse, ou complétez le formulaire.</p>'}</fieldset>`;
    this.status('Les valeurs déjà saisies restent en place. Vérifiez les propositions puis appliquez uniquement les champs souhaités.');
  }
  applyTicketFields() {
    const selected={};
    this.root.querySelectorAll('[data-proposal-check]:checked').forEach(box=>{const key=box.dataset.proposalCheck;selected[key]=this.root.querySelector(`[data-proposal-value="${key}"]`).value.trim();});
    let form=this.root.querySelector('#booking-form');const oldValues=new FormData(form),draft=this.ticketDraft;
    if(selected.kind && bookingSection(selected.kind)!==this.bookingSection) {
      this.bookingSection=bookingSection(selected.kind);this.render();this.ticketDraft=draft;form=this.root.querySelector('#booking-form');
      for(const [key,value] of oldValues){const input=form.elements.namedItem(key);if(input&&input.type!=='file'&&input.type!=='checkbox'&&key!=='kind'&&typeof value==='string')input.value=value;}
    }
    let applied=0;
    for(const [key,value] of Object.entries(selected)){const input=form.elements.namedItem(key);if(input){input.value=value;applied++;}}
    if(this.ticketDraft)this.ticketDraft.applied=true;
    this.root.querySelector('#ticket-review').innerHTML='';
    this.root.querySelector('#ticket-read-status').textContent=`${applied} champ(s) appliqué(s). Vérifiez le formulaire puis enregistrez${this.ticketDraft?' pour joindre aussi le document':''}.`;
    form.scrollIntoView({behavior:'smooth',block:'start'});this.status('Formulaire mis à jour avec votre sélection. Rien n’est enregistré avant validation.');
  }
  sitePanel(trip,data) {
    const visible=ticketPlaces(trip,data);
    return `<div id="ticket-place-panel"><h3>Billetteries et sites officiels</h3><p class="small muted">Recherche dans Wikipédia et Wikidata, avec concordance du nom et de la position. Le lien mène au site déclaré par le lieu, pas forcément à sa page d’achat : vérifiez les tarifs et l’adresse avant de payer.</p><p class="small muted">${visible.length} lieu(x) avec billetterie possible sur ${trip.places.length}. Quartiers, rues et lieux à confirmer sont masqués ici. Ce classement ne garantit pas qu’une entrée est payante.</p><details class="ticket-classification"><summary>Choisir les lieux avec ou sans billet</summary>${trip.places.map(p=>`<label>${escape(p.name)} <small>(${ticketPlaceStatus(p,data)==='unknown'?'À confirmer':ticketPlaceStatus(p,data)==='none'?'Sans billet':'Billet possible'})</small><select data-ticket-place="${escape(p.id)}">${options([['auto','Détection automatique'],['ticket','Avec billetterie / réservation possible'],['none','Sans billet · masquer']],data.ticketPlaces?.[p.id]||'auto')}</select></label>`).join('')}</details><button class="secondary" data-action="official-sites">Rechercher les sites officiels des lieux avec billet</button><div class="official-site-results">${visible.map(p=>{
      const site=data.sites?.[p.id],valid=site&&site.lat===p.lat&&site.lng===p.lng;
      return `<article class="tool-entry"><strong>${escape(p.name)}</strong>${valid?`<p>${link(site.url,'Site officiel déclaré · billets et visites')}</p><p class="small muted">${link(site.source,'Source Wikidata')} · ${escape(site.checkedAt.slice(0,10))}</p>`:'<p class="small muted">Aucun site confirmé par la recherche pour ce lieu.</p>'}<div class="tools-actions"><button class="quiet" data-action="official-sites" data-place="${escape(p.id)}">${valid?'Revérifier':'Rechercher ce lieu'}</button>${link(searchURL(`${p.localName||p.name} ${p.city||''} ${p.country||trip.country} official website tickets billetterie`),'Recherche web à vérifier')}</div></article>`;
    }).join('')}${!visible.length?'<p class="tools-empty">Aucun lieu sélectionné pour la billetterie. Vous pouvez en ajouter dans « Choisir les lieux avec ou sans billet ».</p>':''}</div></div>`;
  }
  async researchSites(placeId) {
    if(this.siteResearchPending){this.status('Une recherche de sites est déjà en cours.');return;}
    this.siteResearchPending=true;
    const id=this.id,generation=this.generation,trip=this.getTrip(id);
    const places=ticketPlaces(trip,organizerData(trip)).filter(p=>!placeId||p.id===placeId);
    let found=0,done=0,failed=0;
    for(const place of places) {
      if(generation!==this.generation)break;
      this.status(`Recherche des sites officiels : ${done+1} / ${places.length} · ${place.name}`);
      try {
        const site=await findOfficialSite(place);
        const latest=this.getTrip(id),current=latest?.places.find(p=>p.id===place.id);
        if(site&&current?.lat===place.lat&&current?.lng===place.lng) {
          const data=organizerData(latest);data.sites={...data.sites,[place.id]:{...site,lat:place.lat,lng:place.lng}};this.save(data,id);found++;
        }
      }catch{failed++;}
      done++;
      if(generation===this.generation) {
        const panel=this.root.querySelector('.official-site-results');
        if(panel){const container=document.createElement('div');container.innerHTML=this.sitePanel(this.getTrip(id),organizerData(this.getTrip(id)));panel.replaceWith(container.querySelector('.official-site-results'));}
      }
      if(done<places.length)await new Promise(resolve=>setTimeout(resolve,1000));
    }
    this.siteResearchPending=false;
    if(generation===this.generation)this.status(`${found} site(s) trouvé(s) sur ${done} lieu(x) traité(s).${failed?` ${failed} recherche(s) indisponible(s).`:''} Les autres disposent d’un lien de recherche à vérifier.`);
  }
  updateWeatherView() {
    if(this.page!=='checklist'||this.root.hidden)return;
    const trip=this.getTrip(this.id),data=organizerData(trip),container=document.createElement('div');
    container.innerHTML=this.checklist(trip,data);
    for(const selector of ['#weather-bulletin','.packing-list','#packing-count','#packing-progress']) {
      const old=this.root.querySelector(selector),fresh=container.querySelector(selector);if(old&&fresh)old.replaceWith(fresh);
    }
  }
  async autoWeather() {
    if(this.page!=='checklist'||document.hidden||this.root.hidden||!this.canEdit(this.id))return;
    const id=this.id,trip=this.getTrip(id);if(!trip)return;
    const data=organizerData(trip),plan=weatherPlan(trip,data.packing);
    const message=text=>{if(this.id===id&&this.page==='checklist'){const node=this.root.querySelector('#auto-weather-status');if(node)node.textContent=text;}};
    if(data.packing.autoWeather===false){message('Actualisation automatique désactivée. Vous pouvez toujours consulter la météo manuellement.');return;}
    if(plan.reason){message(plan.reason);return;}
    if(!weatherNeedsRefresh(trip,data.packing)){message('Météo à jour. La liste suit automatiquement le dernier bulletin disponible.');return;}
    const key=JSON.stringify([id,plan.place.id,plan.place.lat,plan.place.lng,plan.first,plan.last]);
    if(this.weatherPending){message('Actualisation météo en cours…');return;}
    if(Date.now()-(this.weatherAttempts.get(key)||0)<15*60*1000){message('La météo n’a pas pu être actualisée. Nouvelle tentative automatique dans 15 minutes, ou utilisez le bouton ci-dessous.');return;}
    this.weatherAttempts.set(key,Date.now());this.weatherPending=key;message('Actualisation automatique de la météo…');
    try {
      const weather=await fetchWeather(plan.place,data.startDate,trip.days);
      const latestTrip=this.getTrip(id);if(!latestTrip)return;
      const latest=organizerData(latestTrip),next=weatherPlan(latestTrip,latest.packing);
      if(latest.packing.autoWeather===false||next.reason||next.place.id!==plan.place.id||next.place.lat!==plan.place.lat||next.place.lng!==plan.place.lng||next.first!==plan.first||next.last!==plan.last)return;
      latest.packing.weather=weather;this.save(latest,id);this.weatherAttempts.delete(key);
      if(this.id===id){this.updateWeatherView();message('Météo actualisée automatiquement : les conseils de la liste sont adaptés.');}
    } catch(error) {message(error.message+' Nouvelle tentative automatique dans 15 minutes.');}
    finally {this.weatherPending=null;if(this.page==='checklist')queueMicrotask(()=>this.autoWeather());}
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
          const previous=data.bookings.find(b=>b.id===value('id')), selectedFile=values.get('file'), file=selectedFile?.size?selectedFile:(this.ticketDraft?.tripId===id&&this.ticketDraft.applied?this.ticketDraft.file:null);
          let attachment=values.has('removeFile')?null:previous?.attachment;
          if(file?.size) { newAttachment=crypto.randomUUID(); await documentFile('put',newAttachment,file); attachment={id:newAttachment,name:file.name,type:file.type,size:file.size}; }
          const booking={...previous,id:previous?.id||crypto.randomUUID(),title:value('title'),kind:value('kind'),day:Number(value('day')),bookingDate:value('bookingDate'),checkoutDate:form.elements.namedItem('checkoutDate')?value('checkoutDate'):(previous?.checkoutDate||''),arrivalDate:form.elements.namedItem('arrivalDate')?value('arrivalDate'):(previous?.arrivalDate||''),placeId:value('placeId'),time:value('time'),endTime:value('endTime'),reference:value('reference'),notes:value('notes'),url:this.validURL(value('url')),attachment:attachment||null};
          for(const key of bookingTextFields)if(form.elements.namedItem(key))booking[key]=value(key);
          for(const key of bookingCountFields)if(form.elements.namedItem(key))booking[key]=value(key)?Number(value(key)):'';
          if(booking.kind==='hotel' && booking.bookingDate && booking.checkoutDate && booking.checkoutDate<booking.bookingDate)throw new Error('La date de retour ou de départ de l’hôtel doit suivre la date de début.');
          data.bookings=[...data.bookings.filter(b=>b.id!==booking.id),booking];
          this.save(data,id); newAttachment=null;this.ticketDraft=null;
          if(previous?.attachment && previous.attachment.id!==attachment?.id) await deleteUnusedDocument(previous.attachment.id).catch(()=>{});
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
        case 'packing-settings-form': data.packing.laundryEvery=Number(value('laundryEvery'));break;
        case 'activities-form': for(const key of ['running','hiking','watch'])data.packing[key]=values.has(key);break;
        case 'packing-item-form': data.packing.manual.push({id:crypto.randomUUID(),label:value('label')});break;
        case 'weather-form': {
          const place=this.getTrip(id).places.find(p=>p.id===value('placeId')); data.packing.placeId=value('placeId');this.save(data,id); this.status('Chargement des prévisions…');
          const weather=await fetchWeather(place,data.startDate,this.getTrip(id).days);
          if(generation!==this.generation)return;
          const latest=organizerData(this.getTrip(id));
          if(latest.startDate!==data.startDate)throw new Error('La date a changé : relancez la météo.');
          latest.packing.placeId=place.id;latest.packing.weather=weather; this.save(latest,id); this.render();this.status('Météo chargée, conseils adaptés.');return;
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
      if(button.dataset.bookingSection) {this.ticketDraft=null;this.bookingSection=button.dataset.bookingSection;this.render();return;}
      if(button.dataset.edit) {
        this.ticketDraft=null;
        const kind=button.dataset.edit;
        if(kind==='bookings')this.render();
        const form=this.root.querySelector({bookings:'#booking-form',expenses:'#expense-form'}[kind]);
        const record=(kind==='expenses'?data.budget.expenses:data[kind]).find(r=>r.id===recordId);
        for(const [key,value] of Object.entries(record)) { const input=form.elements.namedItem(key);if(!input||input.type==='file')continue;if(key==='day' && input.tagName==='SELECT' && ![...input.options].some(o=>o.value===String(value))) input.add(new Option('Jour '+value+' (hors durée actuelle)',value)); if(input.type==='checkbox')input.checked=!!value;else input.value=value??''; }
        form.scrollIntoView({behavior:'smooth',block:'center'});form.elements.title.focus();this.status('Modifiez les champs puis enregistrez.');return;
      }
      if(button.dataset.delete) {
        if(!confirm('Supprimer cet élément du voyage ?'))return;
        const kind=button.dataset.delete;
        let attachment;
        if(kind==='expenses')data.budget.expenses=data.budget.expenses.filter(r=>r.id!==recordId);
        else if(kind==='packing'){data.packing.manual=data.packing.manual.filter(r=>r.id!==recordId);delete data.packing.checked[recordId];}
        else {attachment=data[kind].find(r=>r.id===recordId)?.attachment;data[kind]=data[kind].filter(r=>r.id!==recordId);}
        this.save(data,id);if(attachment)await deleteUnusedDocument(attachment.id).catch(()=>{});
        if(generation===this.generation){this.render();this.status('Élément supprimé.');}return;
      }
      switch(button.dataset.action) {
        case 'parse-ticket': this.formRevision=(this.formRevision||0)+1;this.prepareTicket(this.root.querySelector('#ticket-transcript').value);break;
        case 'export-confirmation': {const fields={};this.root.querySelectorAll('[data-proposal-check]:checked').forEach(box=>{const key=box.dataset.proposalCheck;fields[key]=this.root.querySelector(`[data-proposal-value="${key}"]`).value;});download(new Blob([JSON.stringify(confirmationJSON(fields),null,2)],{type:'application/json'}),'confirmation-voyage.json');break;}
        case 'apply-ticket-fields': this.applyTicketFields();break;
        case 'official-sites': await this.researchSites(button.dataset.place);break;
        case 'swap-currencies': {const form=this.root.querySelector('#converter-form');const previous=form.elements.from.value;form.elements.from.value=form.elements.to.value;form.elements.to.value=previous;this.conversion();break;}
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
          const index=Number(button.dataset.day),day=planTrip(trip.places,trip.days,trip.startId,trip.fileOrder,trip.dayGroups).days[index];
          download(new Blob([waypointsGPX(day,`${trip.name} — jour ${index+1}`)],{type:'application/gpx+xml'}),`etapes-jour-${index+1}.gpx`);this.status('Points GPX exportés. Préparez et vérifiez le tracé dans votre application de sport.');break;
        }
        case 'backup': await this.backup(trip);break;
      }
    }catch(error){if(generation===this.generation)this.status(error.message);}finally{button.disabled=false;}
  }
  async change(event) {
    const target=event.target;
    if(target.id==='confirmation-upload'&&target.files[0]){const generation=this.generation;try{const file=target.files[0];this.ticketDraft=null;if(file.size>2*1024*1024)throw new Error('Confirmation limitée à 2 Mo.');if(/\.json$/i.test(file.name)){const proposal=readConfirmationJSON(await file.text());if(generation===this.generation)this.renderTicketProposal(proposal);}else{const text=await readConfirmationFile(file);if(generation===this.generation){this.root.querySelector('#ticket-transcript').value=text;this.prepareTicket(text);}}if(generation===this.generation)this.status('Confirmation lue localement. Vérifiez les champs proposés. Les pièces jointes d’e-mail ne sont pas importées.');}catch(error){if(generation===this.generation)this.status(error.message);}finally{target.value='';}return;}
    if(target.id==='ticket-upload' && target.files[0]){await this.readTicketFile(target.files[0]);return;}
    if(target.dataset.ticketPlace){try{const data=organizerData(this.getTrip(this.id));data.ticketPlaces={...data.ticketPlaces,[target.dataset.ticketPlace]:target.value};this.save(data);this.refreshTicketPanels();this.status('Choix de billetterie enregistré. Le lieu reste dans votre itinéraire.');}catch(error){this.status(error.message);}return;}
    if(target.dataset.bookingKind) {try{const data=organizerData(this.getTrip(this.id));data.bookings=data.bookings.map(b=>b.id===target.dataset.bookingKind?{...b,kind:target.value}:b);this.save(data);this.bookingSection=bookingSection(target.value);this.render();this.status('Réservation reclassée, document conservé.');}catch(error){this.status(error.message);}return;}
    if(target.id==='auto-weather') {try{const data=organizerData(this.getTrip(this.id));data.packing.autoWeather=target.checked;this.save(data);this.autoWeather();}catch(error){target.checked=!target.checked;this.status(error.message);}}
    if(target.closest('#weather-form') && target.name==='placeId') {try{const data=organizerData(this.getTrip(this.id));data.packing.placeId=target.value;this.save(data);this.autoWeather();}catch(error){this.status(error.message);}}
    if(target.dataset.check) {
      try {
        const data=organizerData(this.getTrip(this.id));data.packing.checked[target.dataset.check]=target.checked;this.save(data);
        const items=packingItems(data.packing,this.getTrip(this.id).days),count=items.filter(i=>data.packing.checked[i.id]).length;
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
      for(const booking of previous.organizer?.bookings || []) if(booking.attachment) await deleteUnusedDocument(booking.attachment.id).catch(()=>{});
      if(generation===this.generation){location.hash='#voyage='+encodeURIComponent(id);this.status('Sauvegarde restaurée.');}
    }catch(error){for(const key of created)await documentFile('delete',key).catch(()=>{});if(generation===this.generation)this.status('Restauration impossible : '+error.message);}
  }
}
