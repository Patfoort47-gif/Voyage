# Voyage

Application web en français pour transformer un carnet de lieux en parcours de voyage. Node.js 22 ou supérieur ; aucune dépendance externe à installer. Les fonctions de carnet et de répartition fonctionnent sans clé ; les recherches et trajets Google nécessitent une configuration Google Maps Platform.

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

## Google Maps : coordonnées et trajets par jour

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
