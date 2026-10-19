export const tripTemplates = {
 'urban-cold':{name:'Week-end urbain / froid',days:3,mode:'walking',dailyLimit:100,hiking:false,description:'Visites en ville, couches chaudes et équipements utiles au froid.',items:['Vérifier les jours de fermeture des musées','Prévoir une activité intérieure de repli']},
 'urban-mild':{name:'Escapade urbaine',days:3,mode:'walking',dailyLimit:90,hiking:false,description:'Musées, quartiers et trajets à pied, avec un budget journalier de départ.',items:['Vérifier les créneaux de visite à réserver','Préparer les transports depuis la gare ou l’aéroport']},
 'nature-road':{name:'Roadtrip nature',days:7,mode:'driving',dailyLimit:120,hiking:true,description:'Étapes en voiture, randonnées et préparation des sorties.',items:['Vérifier assurance, permis et conditions de location','Prévoir les ravitaillements et stations-service','Télécharger et vérifier les parcours de randonnée']},
 'coast':{name:'Séjour au bord de l’eau',days:5,mode:'walking',dailyLimit:90,hiking:false,description:'Tenues légères, baignade et protection solaire à adapter à la météo.',items:['Prévoir le maillot et une serviette','Vérifier les accès et conditions de baignade']}
};
export function templateOrganizer(profile,startDate='',dailyLimit) {
  const template=tripTemplates[profile];if(!template)throw new Error('Modèle inconnu.');
  return {templateProfile:profile,startDate,bookings:[],offers:[],budget:{currency:'EUR',dailyLimit:dailyLimit??template.dailyLimit,expenses:[],rates:{values:{EUR:1},date:'',source:'manual'}},packing:{profile,running:false,hiking:template.hiking,watch:template.hiking,checked:{},manual:template.items.map(label=>({id:crypto.randomUUID(),label})),autoWeather:true}};
}
