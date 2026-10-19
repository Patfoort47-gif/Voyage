import test from 'node:test';
import assert from 'node:assert/strict';
import {parseTicket} from '../src/ticket-parser.js';
import {renderBookingForm,bookingDetails} from '../src/booking-forms.js';
import {organizerData,validateOrganizer} from '../src/travel-tools.js';
const trip={days:5,places:[{id:'p',name:'Musée du Louvre',category:'Musée'}]};
test('vol : libellés et valeurs sur des lignes séparées, aéroports, passager, référence et dates distinctes',()=>{
 const result=parseTicket('BOARDING PASS\nFlight\nAF1234\nFrom: Paris CDG\nTo: Stockholm ARN\nDeparture\n22 November 2026\n08:20\nArrival\n23 November 2026\n10:30\nBooking reference\nABC123\nPassenger\nJean Dupont\nSeat\n12A');
 assert.equal(result.flightNumber,'AF1234');assert.equal(result.origin,'Paris CDG');assert.equal(result.destination,'Stockholm ARN');assert.equal(result.passenger,'Jean Dupont');assert.equal(result.reference,'ABC123');assert.equal(result.bookingDate,'2026-11-22');assert.equal(result.arrivalDate,'2026-11-23');assert.equal(result.time,'08:20');assert.equal(result.endTime,'10:30');assert.equal(result.seat,'12A');assert.match(result.evidence.passenger,/Passenger/);
});
test('tableau départ / arrivée : les colonnes ne sont pas confondues avec plusieurs vols',()=>{
 const result=parseTicket('Flight: AF1234\nDeparture Arrival\n22 Nov 2026   23 Nov 2026\n08:20   10:30');assert.equal(result.bookingDate,'2026-11-22');assert.equal(result.arrivalDate,'2026-11-23');assert.equal(result.time,'08:20');assert.equal(result.endTime,'10:30');
});
test('hôtel : dates au format anglais, nom de client et voyageurs',()=>{
 const result=parseTicket('Hotel name\nGrand Hotel\nCheck-in\nNovember 22, 2026\n15:00\nCheck-out\nNovember 24, 2026\n11:00\nGuest name\nJean Dupont\nGuests: 2');assert.equal(result.title,'Grand Hotel');assert.equal(result.bookingDate,'2026-11-22');assert.equal(result.checkoutDate,'2026-11-24');assert.equal(result.guests,2);assert.equal(result.guestName,'Jean Dupont');
});
test('visite : valeurs sur la ligne suivante et indication explicite du type si détection impossible',()=>{
 const result=parseTicket('Musée du Louvre\nDate de visite\n22 novembre 2026\nCréneau\n10:15\nNombre de visiteurs: 2\nType de billet: Adulte',{places:trip.places,kindHint:'museum'});assert.equal(result.kind,'museum');assert.equal(result.bookingDate,'2026-11-22');assert.equal(result.time,'10:15');assert.equal(result.visitors,2);assert.equal(result.ticketType,'Adulte');
});
test('formulaires spécifiques : pas de champ de visite dans un vol, pas de champ de vol dans un hôtel',()=>{
 const data=organizerData(trip),flight=renderBookingForm('flight',trip,data,''),hotel=renderBookingForm('hotel',trip,data,''),visit=renderBookingForm('museum',trip,data,'');
 assert.match(flight,/name="origin"/);assert.match(flight,/name="arrivalDate"/);assert.doesNotMatch(flight,/name="visitors"|name="checkoutDate"/);
 assert.match(hotel,/name="roomType"/);assert.match(hotel,/name="guests"/);assert.doesNotMatch(hotel,/name="flightNumber"/);assert.match(visit,/name="visitors"/);assert.doesNotMatch(visit,/name="origin"|name="roomType"/);
});
test('sauvegarde : champs nouveaux validés, export affiché sans interprétation de HTML',()=>{
 const data=organizerData(trip);data.bookings=[{id:'b',title:'Vol',kind:'flight',day:1,bookingDate:'2026-11-22',arrivalDate:'2026-11-23',checkoutDate:'',time:'08:20',endTime:'10:30',placeId:'',reference:'ABC123',notes:'',url:'',origin:'Paris',destination:'Stockholm',passenger:'<script>evil</script>'}];
 assert.doesNotThrow(()=>validateOrganizer(data));assert.match(bookingDetails(data.bookings[0]),/&lt;script&gt;/);data.bookings[0].arrivalDate='2026-02-30';assert.throws(()=>validateOrganizer(data));
});
test('un document avec plusieurs vols ou références ne remplit pas arbitrairement le premier',()=>{
 const result=parseTicket('BOARDING PASS\nFlight: AF1234\nDeparture: 22 Nov 2026 08:20\nBooking reference: ABC123\nFlight: AF5678\nDeparture: 24 Nov 2026 17:10\nBooking reference: XYZ789');
 assert.equal(result.flightNumber,'');assert.equal(result.title,'');assert.equal(result.reference,'');assert.equal(result.bookingDate,'');assert.ok(result.warnings.some(w=>w.includes('Plusieurs vols')));
});
test('extraction PDF : morceaux désordonnés regroupés par ligne et colonnes conservées',async()=>{
 const {pdfPageText}=await import('../src/ticket-reader.js');
 const item=(str,x,y,width=30)=>({str,transform:[1,0,0,1,x,y],width});
 const result=pdfPageText([item('08:20',10,80),item('Arrival',200,100),item('Departure',10,100),item('10:30',200,80)]);
 assert.equal(result,'Departure    Arrival\n08:20    10:30');
});
test('année proposée seulement pour une date sans année, pas en remplacement d’une année imprimée abrégée',()=>{
 const inferred=parseTicket('Flight: AF1234\nDeparture\n22 NOV\n08:20',{startDate:'2026-11-20',days:5});assert.equal(inferred.bookingDate,'2026-11-22');assert.match(inferred.evidence.bookingDate,/année proposée/);
 const explicit=parseTicket('Flight: AF1234\nDeparture\n22 NOV 26\n08:20',{startDate:'2027-11-20',days:5});assert.notEqual(explicit.bookingDate,'2027-11-22');
});
