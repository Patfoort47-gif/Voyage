# Voyage

Application web en français pour transformer un carnet de lieux en parcours de voyage. Node.js 22 ou supérieur ; aucune dépendance externe à installer. Les fonctions de carnet et de répartition fonctionnent sans clé ; la recherche et le calcul gratuits utilisent OpenStreetMap / OSRM, sans clé. L’option Google nécessite sa propre configuration payante.

```sh
npm start
```

Port par défaut : 3000. Variable facultative : `PORT`. Le serveur écoute sur `0.0.0.0`. Tests : `npm test`.

L’interface peut aussi être hébergée en statique sur GitHub Pages, sous `/Voyage/`. Les chemins des ressources et du lien d’accueil sont relatifs pour fonctionner aussi bien à la racine que dans ce sous-répertoire.

## Utilisation

1. Essayez le carnet de démonstration Portugal, ajoutez vos lieux manuellement ou importez un CSV / GeoJSON décompressé depuis Google Takeout.
2. Les exports Google français `Titre,Note,URL,Tags,Commentaire` sont reconnus, y compris les lignes vides, notes multilignes et caractères accentués. Le nom du fichier devient la catégorie par défaut (par exemple `À visiter.csv` → « À visiter »). Notes et commentaires sont réunis sans perte de leur texte, les tags et les liens originaux sont conservés et exportables. Le pays n’est jamais déduit d’un nom ambigu. Pour une liste de plusieurs pays, laissez le pays d’import vide puis cochez les lieux d’un même pays et utilisez « Appliquer le pays ». Cette action concerne uniquement les lieux cochés de la vue filtrée ; le remplacement de pays existants demande confirmation.
3. Sélectionnez les lieux, le pays, la durée (1 à 30 jours), le moyen de transport et éventuellement le premier lieu.
4. Créez le parcours puis ouvrez les étapes dans Google Maps pour obtenir les vrais trajets. Les grands parcours sont divisés en liens comprenant au maximum trois étapes intermédiaires.
5. Exportez le carnet en GeoJSON pour le sauvegarder et le réimporter. La sauvegarde automatique est propre au navigateur et à l’origine du site ; pas de compte ni de synchronisation entre appareils.

## Dossiers de voyages et suppression du carnet

« Créer et sauvegarder mon voyage » enregistre automatiquement un dossier dans « Mes voyages ». Le nom est facultatif à la création (par défaut : pays et durée). Les dossiers restent consultables après rechargement, dans le même navigateur, avec une copie indépendante des lieux, des liens Maps et des réglages du parcours. Vider ou modifier le carnet ne modifie pas les dossiers existants.

Chaque dossier propose « Consulter », « Modifier » et « Supprimer ». La modification permet de renommer le voyage, changer la durée, le transport, le mode de calcul, le premier lieu et les visites incluses ; des lieux du même pays peuvent être ajoutés depuis le carnet. Les modifications recalculent le parcours. La suppression d’un dossier demande confirmation et conserve les lieux du carnet.

« Supprimer tous les lieux affichés » supprime, après confirmation, tous les résultats de la vue actuelle, cochés ou non. Sans filtre, ce bouton vide le carnet. Avec une recherche ou une catégorie, les lieux masqués sont conservés. Les voyages sauvegardés sont toujours conservés.

Les dossiers sont enregistrés en `localStorage` sous `voyage.trips.v1`, séparément du carnet (`voyage.places.v1`). Ils ne sont pas synchronisés avec un compte ou un autre appareil. Effacer les données du site les supprime. L’export GeoJSON concerne le carnet de lieux ; les itinéraires peuvent être imprimés. Si le stockage échoue, la création, la modification ou la suppression du voyage est signalée comme non enregistrée.

Les CSV de listes Google ne fournissent souvent ni pays ni coordonnées. Vous pouvez cocher « Répartir dans l’ordre du carnet » pour préparer des journées sans coordonnées. Ce mode conserve l’ordre d’import (sauf le premier lieu si vous en avez choisi un), équilibre le nombre de visites et ne prétend pas optimiser les déplacements. Aucune distance ni durée de trajet n’est affichée. Les liens de parcours utilisent le nom et le pays des lieux sans coordonnées : vérifiez les correspondances dans Maps. Chaque lieu conserve aussi son lien Google original pour retrouver précisément la fiche enregistrée. Pour le tri par proximité, complétez latitude et longitude avec « Modifier » (clic droit sur le point dans Google Maps). Les liens courts ne sont pas développés automatiquement. Le bouton « Retrouver les coordonnées » exploite les liens Takeout avec les services Google configurés ; chaque correspondance est confirmée avant enregistrement.

CSV reconnu : `Titre,Note,URL,Tags,Commentaire` ou `Title,Note,URL` (export de listes), ou `name,country,category,latitude,longitude,note,url`. Les variantes françaises `nom,pays,catégorie` et les CSV au point-virgule sont acceptés. GeoJSON : `FeatureCollection` de points (ou géométrie nulle pour un lieu sans coordonnées), métadonnées Takeout `Title`, `Location`, `Google Maps URL`, `Comment`, ou propriétés `name,country,category,note,tags,url`. Les ZIP, KML, liens de liste et autres formats ne sont pas pris en charge.

## Limites explicites

Google ne fournit pas d’API publique pour lire les listes de lieux enregistrés d’un utilisateur via OAuth. Cette version importe les listes CSV/GeoJSON. Les recherches Places interviennent après cet import, à la demande.

Le parcours utilise une heuristique du plus proche voisin depuis le premier lieu, puis répartit les visites en journées de taille comparable. Il conserve tous les lieux sélectionnés dans le pays demandé, sans garantir un optimum. Les distances sont à vol d’oiseau, y compris les liaisons entre journées ; le budget de visite suppose 1 h 30 par lieu, séparément du temps de déplacement. Les distances à vol d’oiseau sont distinctes des kilomètres renvoyés par Google Routes. Les horaires d’ouverture, ferries, frontières, pauses, hébergements, départ depuis le domicile et retour ne sont pas calculés. Les journées estimées au-delà de 8 h sont signalées. Vérifiez le parcours dans Maps avant de voyager.

## Mode gratuit par défaut — sans compte ni clé

Le site démarre en mode **OpenStreetMap / OSRM**. Aucune clé Google, facturation ou carte bancaire n’est nécessaire. L’option Google reste facultative dans « Itinéraires gratuits » et ne lance aucun appel en mode gratuit.

- **Retrouver un lieu** : cliquez sur « Retrouver le lieu » ou sur la recherche des lieux cochés. Un lieu est traité par action, avec confirmation de l’adresse avant sauvegarde. Le nom du CSV et le pays servent de recherche ; ajoutez la ville au nom via « Modifier » si nécessaire. Les identifiants propres à Google ne sont pas décodables en coordonnées OSM ; les correspondances sont donc toujours à confirmer.
- **Données** : Nominatim / OpenStreetMap, attribution © OpenStreetMap contributors, licence ODbL. Les coordonnées et pays confirmés sont sauvegardés dans le carnet ou dans le dossier choisi, avec conservation du lien Google d’origine.
- **Usage des services publics** : pas d’autocomplétion, pas de traitement massif en arrière-plan ; recherches déclenchées par clic. Les requêtes sont sérialisées, espacées d’au moins 1,1 seconde et coordonnées entre onglets avec Web Locks si disponible. Les résultats de recherche sont mis en cache pendant 30 jours. Le navigateur transmet un référent pour identifier le site. Respecter les [conditions Nominatim](https://operations.osmfoundation.org/policies/nominatim/) et celles des serveurs de routage.
- **Voiture** : serveur public `router.project-osrm.org`, profil driving. **À pied** : serveur piéton FOSSGIS `routing.openstreetmap.de/routed-foot`, profil foot ; aucune durée de voiture n’est présentée comme une durée à pied.
- **Calcul par jour** : les distances routières (mètres) et durées (secondes) de l’API OSRM sont converties en kilomètres et heures/minutes. La liaison depuis la veille est incluse, hors visites, hébergement et retour. Les parcours longs sont divisés en blocs sans doubler les liaisons. L’ordre des visites est celui du parcours affiché, éventuellement obtenu par l’heuristique de proximité ; ce n’est pas une garantie d’optimum routier.
- **Limites** : estimations sans trafic en direct, disponibilité et quotas des serveurs publics non garantis. Les refus, trajets impossibles, erreurs réseau et coordonnées manquantes sont signalés. Une seule étape sans déplacement affiche explicitement 0 km ; une erreur ne devient jamais 0 km.
- **Changer de fournisseur** : les trois adresses HTTPS compatibles Nominatim / OSRM sont modifiables dans les réglages sans changement de code. Les serveurs choisis doivent permettre les requêtes navigateur (CORS). Les lieux concernés sont transmis à ces fournisseurs.

Les tests des réponses API et du navigateur utilisent des données simulées. L’accès aux services publics depuis l’environnement cloud peut être bloqué par son proxy ; cela ne permet pas d’affirmer qu’ils sont accessibles depuis le navigateur de l’utilisateur.

## Google Maps facultatif : coordonnées et trajets par jour

Dans « Services Google Maps », configurez une **clé de navigateur** Google Maps Platform. Créez un projet avec facturation, activez **Maps JavaScript API**, **Places API (New)** et **Routes API**. Limitez la clé aux API concernées et aux référents de votre site, par exemple `https://patfoort47-gif.github.io/*`. Définissez des quotas dans Google Cloud. Pour le développement local, ajoutez explicitement le référent local avec son port si nécessaire. Documentation : [bibliothèque Routes](https://developers.google.com/maps/documentation/javascript/routes/overview), [recherche Places](https://developers.google.com/maps/documentation/javascript/place-search), [protection des clés](https://developers.google.com/maps/api-security-best-practices).

La clé n’est pas committée, exportée ou sauvegardée dans les voyages. Elle est conservée dans la session d’onglet (`sessionStorage`) et peut être oubliée. Une clé web est visible par le navigateur ; elle doit avoir des restrictions de site et d’API. Ne saisissez pas une clé de serveur ou d’autres identifiants secrets. Les recherches et calculs sont demandés explicitement ; ils peuvent être facturés par Google. Aucun appel de trajet n’est lancé au simple chargement d’un voyage sauvegardé.

- Les coordonnées `q=lat,lng`, `query=lat,lng` et un couple explicite `!3d…!4d…` sont extraits directement des liens Maps. Le centre de caméra `@lat,lng` est ignoré.
- Les liens Takeout `!1s0x…:0x…` contiennent un identifiant, pas des coordonnées. Le nom contenu dans le lien et le pays servent à la recherche Places. Un vrai Place ID présent dans un lien peut être interrogé directement. Les identifiants CID sont comparés sans perte de précision lorsqu’ils sont disponibles dans les résultats. La sélection reste toujours confirmée par l’utilisateur : les homonymes ne sont pas attribués automatiquement.
- « Retrouver les coordonnées des lieux cochés » traite au maximum 10 lieux sans coordonnées de la vue filtrée par lot. La confirmation enregistre latitude, longitude, pays retourné et Place ID tout en conservant l’URL d’origine. « Retrouver Maps » recherche un lieu individuellement. Dans un voyage sauvegardé, le bouton de recherche met à jour sa copie indépendante des lieux ; les dossiers plus anciens ne sont pas perdus.
- Après confirmation des coordonnées, désactivez le mode « ordre du carnet » si vous souhaitez recalculer un parcours par proximité. Le tri reste une heuristique géographique ; il ne minimise pas le temps routier Google.
- « Calculer les km et temps Google Maps » appelle `Route.computeRoutes` dans la bibliothèque JavaScript `routes`, avec les étapes dans leur ordre affiché, un mode `DRIVING` ou `WALKING`, et les champs `distanceMeters` et `durationMillis`. En voiture, `TRAFFIC_AWARE` prend en compte le trafic au moment du calcul. Sans date de départ configurée, ce n’est pas une prévision pour une date de voyage future. Les parcours longs sont divisés en blocs de 25 étapes intermédiaires maximum sans compter deux fois la liaison commune.
- Chaque journée affiche le total Google en kilomètres et en heures/minutes, hors visites. La liaison depuis le dernier lieu de la veille est incluse ; l’hébergement, le trajet depuis le domicile et le retour ne sont pas inclus. Une journée avec une seule étape et aucune liaison affiche explicitement l’absence de déplacement. Les temps et distances Google restent dans l’affichage de la session : recalculer lors d’une nouvelle consultation, plutôt que présenter une ancienne estimation comme actuelle.
- Les erreurs de configuration, les lieux sans coordonnées et les trajets absents sont signalés ; aucun chiffre estimé n’est présenté comme une réponse Google.

Les tests automatisés et les tests navigateur peuvent simuler Places et Routes pour vérifier les requêtes et l’affichage. Une validation réelle nécessite une clé avec les services et la facturation activés ; les tests simulés ne prouvent pas le fonctionnement du compte Google.

## Validation rapide au chargement

La section « Lieux sans coordonnées » apparaît automatiquement si le carnet ou les dossiers de voyages contiennent des lieux incomplets. Elle est indépendante des filtres et des cases du carnet. Chaque entrée indique son pays et son carnet ou dossier d’origine ; les copies sauvegardées sont affichées séparément et restent indépendantes.

Filtrez par nom, pays ou voyage, puis utilisez « Commencer la validation » ou « Rechercher et valider ». « Confirmer et rechercher le suivant » sauvegarde le résultat et déclenche la recherche du prochain lieu incomplet dans ce filtre. Le focus passe au bouton de confirmation pour une validation au clavier. « Passer ce lieu et rechercher le suivant » conserve le lieu incomplet pour une prochaine session de validation. Fermer la recherche interrompt la session. Le compteur et la liste se mettent à jour après chaque sauvegarde et après chaque import ou suppression.

Aucune requête externe ne part au chargement ou à la saisie du filtre. Chaque nouvelle recherche résulte d’un clic explicite de recherche, confirmation ou passage au suivant, avec les limites de fréquence et le cache du fournisseur gratuit. Les coordonnées validées persistent dans le navigateur ; au prochain chargement, seuls les lieux encore incomplets apparaissent.

## Lieux difficiles à retrouver

La recherche gratuite essaie Nominatim, une version simplifiée du nom si nécessaire (articles et parenthèses), puis Photon si aucun résultat n’est trouvé ou si Nominatim est indisponible. Les requêtes restent sérialisées et espacées. Photon utilise également les données OpenStreetMap ; il ne garantit pas la présence des lieux spécifiques à Google.

Dans la fenêtre de validation, modifiez le nom, ajoutez une ville ou une zone et le pays, puis « Relancer la recherche ». Vous pouvez choisir Photon directement ou Nominatim uniquement. Les résultats restent à confirmer ; aucune adresse n’est attribuée automatiquement. Les résultats vides ne sont plus conservés pendant 30 jours ; un nouveau cache ignore les anciennes réponses vides.

Si le lieu est absent des deux moteurs, ouvrez « Lieu introuvable ? Saisir ses coordonnées ». Ouvrez le lien Google Maps original, faites un clic droit sur le point pour copier latitude et longitude, puis validez-les dans les champs dédiés. Cette saisie fonctionne dans le carnet et les voyages sauvegardés, et poursuit la validation rapide si elle est active. L’ajout de contexte sert à la recherche, sans renommer le lieu enregistré.

Le serveur Photon compatible est modifiable dans les réglages, au même titre que Nominatim. Le service public par défaut est `https://photon.komoot.io/api` ; sa disponibilité n’est pas garantie. Les tests avec réponses simulées vérifient le repli, la conversion des résultats et le comportement du cache, pas le taux de correspondance réel sur vos lieux.

## Dates, zone commune et remise à zéro

Les dossiers affichent leur date et heure de création en français (heure de Paris). Une modification conserve cette date ; une ancienne sauvegarde sans date affiche « Date de création inconnue ».

Dans « Lieux sans coordonnées », une zone commune permet de préciser pays et/ou ville pour toutes les recherches suivantes, y compris dans les dossiers. « Appliquer à toutes les recherches » la sauvegarde dans le navigateur ; « Effacer la zone commune » revient au pays propre à chaque lieu. Les champs de la fenêtre restent modifiables pour une exception. Le contexte sert à la recherche et n’écrit aucun pays dans les lieux avant confirmation.

Un compteur persistant en haut du site et un compteur dans la fenêtre de validation indiquent le total de localisations restant à trouver dans le carnet et les dossiers. Les copies indépendantes d’un même lieu sont comptées séparément. Le total se met à jour à chaque validation, import ou suppression.

À la création, le dossier est sauvegardé avant de retirer du carnet les lieux inclus dans ce voyage. Les autres lieux sont conservés, toutes les cases restantes sont décochées et les filtres du carnet sont remis à zéro. Si tous les lieux ont été inclus, le carnet devient vide. Une erreur de sauvegarde du voyage laisse le carnet intact ; si seul le nettoyage du carnet échoue, un message l’indique et le dossier reste disponible. Modifier un dossier existant ne relance pas ce nettoyage.
