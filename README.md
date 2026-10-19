# Voyage

Application web en français pour transformer un carnet de lieux en parcours de voyage. Node.js 22 ou supérieur ; aucune dépendance externe à installer. Les fonctions de carnet et de répartition fonctionnent sans clé ; la recherche et le calcul gratuits utilisent OpenStreetMap / OSRM, sans clé.

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

Les CSV de listes Google ne fournissent souvent ni pays ni coordonnées. Vous pouvez cocher « Répartir dans l’ordre du carnet » pour préparer des journées sans coordonnées. Ce mode conserve l’ordre d’import (sauf le premier lieu si vous en avez choisi un), équilibre le nombre de visites et ne prétend pas optimiser les déplacements. Aucune distance ni durée de trajet n’est affichée. Les liens de parcours utilisent le nom et le pays des lieux sans coordonnées : vérifiez les correspondances dans Maps. Chaque lieu conserve aussi son lien Google original pour retrouver précisément la fiche enregistrée. Pour le tri par proximité, complétez latitude et longitude avec « Modifier » (clic droit sur le point dans Google Maps). Les liens courts ne sont pas développés automatiquement. Le bouton « Retrouver les coordonnées » exploite les liens Takeout avec les services gratuits OpenStreetMap ; chaque correspondance est confirmée avant enregistrement.

CSV reconnu : `Titre,Note,URL,Tags,Commentaire` ou `Title,Note,URL` (export de listes), ou `name,country,category,latitude,longitude,note,url`. Les variantes françaises `nom,pays,catégorie` et les CSV au point-virgule sont acceptés. GeoJSON : `FeatureCollection` de points (ou géométrie nulle pour un lieu sans coordonnées), métadonnées Takeout `Title`, `Location`, `Google Maps URL`, `Comment`, ou propriétés `name,country,category,note,tags,url`. Les ZIP, KML, liens de liste et autres formats ne sont pas pris en charge.

## Limites explicites

Google ne fournit pas d’API publique pour lire les listes de lieux enregistrés d’un utilisateur via OAuth. Cette version importe les listes CSV/GeoJSON. Les recherches OpenStreetMap interviennent après cet import, à la demande.

Le parcours utilise une heuristique du plus proche voisin depuis le premier lieu, puis répartit les visites en journées de taille comparable. Il conserve tous les lieux sélectionnés dans le pays demandé, sans garantir un optimum. Les distances sont à vol d’oiseau, y compris les liaisons entre journées ; le budget de visite suppose 1 h 30 par lieu, séparément du temps de déplacement. Les distances à vol d’oiseau sont distinctes des kilomètres renvoyés par OSRM. Les horaires d’ouverture, ferries, frontières, pauses, hébergements, départ depuis le domicile et retour ne sont pas calculés. Les journées estimées au-delà de 8 h sont signalées. Vérifiez le parcours dans Maps avant de voyager.

## Mode gratuit par défaut — sans compte ni clé

Le site démarre en mode **OpenStreetMap / OSRM**. Aucune clé Google, facturation ou carte bancaire n’est nécessaire. Le choix du fournisseur et la configuration Google payante ont été retirés. Les liens externes Google Maps restent disponibles pour consulter les lieux et les étapes.

- **Retrouver un lieu** : cliquez sur « Retrouver le lieu » ou sur la recherche des lieux cochés. Un lieu est traité par action, avec confirmation de l’adresse avant sauvegarde. Le nom du CSV et le pays servent de recherche ; ajoutez la ville au nom via « Modifier » si nécessaire. Les identifiants propres à Google ne sont pas décodables en coordonnées OSM ; les correspondances sont donc toujours à confirmer.
- **Données** : Nominatim / OpenStreetMap, attribution © OpenStreetMap contributors, licence ODbL. Les coordonnées et pays confirmés sont sauvegardés dans le carnet ou dans le dossier choisi, avec conservation du lien Google d’origine.
- **Usage des services publics** : pas d’autocomplétion, pas de traitement massif en arrière-plan ; recherches déclenchées par clic. Les requêtes sont sérialisées, espacées d’au moins 1,1 seconde et coordonnées entre onglets avec Web Locks si disponible. Les résultats de recherche sont mis en cache pendant 30 jours. Le navigateur transmet un référent pour identifier le site. Respecter les [conditions Nominatim](https://operations.osmfoundation.org/policies/nominatim/) et celles des serveurs de routage.
- **Voiture** : serveur public `router.project-osrm.org`, profil driving. **À pied** : serveur piéton FOSSGIS `routing.openstreetmap.de/routed-foot`, profil foot ; aucune durée de voiture n’est présentée comme une durée à pied.
- **Calcul par jour** : les distances routières (mètres) et durées (secondes) de l’API OSRM sont converties en kilomètres et heures/minutes. La liaison depuis la veille est incluse, hors visites, hébergement et retour. Les parcours longs sont divisés en blocs sans doubler les liaisons. L’ordre des visites est celui du parcours affiché, éventuellement obtenu par l’heuristique de proximité ; ce n’est pas une garantie d’optimum routier.
- **Limites** : estimations sans trafic en direct, disponibilité et quotas des serveurs publics non garantis. Les refus, trajets impossibles, erreurs réseau et coordonnées manquantes sont signalés. Une seule étape sans déplacement affiche explicitement 0 km ; une erreur ne devient jamais 0 km.
- **Changer de fournisseur** : les trois adresses HTTPS compatibles Nominatim / OSRM sont modifiables dans les réglages sans changement de code. Les serveurs choisis doivent permettre les requêtes navigateur (CORS). Les lieux concernés sont transmis à ces fournisseurs.

Les tests des réponses API et du navigateur utilisent des données simulées. L’accès aux services publics depuis l’environnement cloud peut être bloqué par son proxy ; cela ne permet pas d’affirmer qu’ils sont accessibles depuis le navigateur de l’utilisateur.

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

## Corriger un lieu dans un voyage sauvegardé

Ouvrez le dossier avec « Consulter ». Chaque étape propose « Modifier ce lieu / informations » (nom, pays, coordonnées, lien, notes, descriptif, adresse, informations pratiques) et « Corriger la localisation » (nouvelle recherche ou saisie manuelle), même si des coordonnées sont déjà présentes. La modification concerne uniquement la copie du dossier, préserve sa date de création et met à jour le parcours. Les anciennes distances et géométries de l’affichage sont réinitialisées et un recalcul de toutes les journées démarre automatiquement. Une modification invalide n’est pas sauvegardée. En mode de proximité, des coordonnées valides restent nécessaires pour tous les lieux.

## Carte du voyage

La carte Leaflet affiche les étapes avec une couleur et un numéro de journée. La légende permet de masquer ou afficher les jours indépendamment. Les huit couleurs sont réutilisées au-delà de huit jours ; les libellés restent distincts. Les lieux sans coordonnées sont signalés et ne sont pas placés arbitrairement.

Avant calcul, les pointillés relient schématiquement les étapes consécutives connues : ils ne représentent pas une route et ne sautent pas les étapes manquantes. Le calcul gratuit OSRM demande une géométrie GeoJSON complète ; les trajets disponibles deviennent des traits pleins dans la couleur du jour. Un trajet sans géométrie ou en erreur conserve ses pointillés. La liaison depuis la veille fait partie du trajet du jour. Les tracés restent en mémoire pour la consultation courante ; les consultations suivantes peuvent être recalculées.

Leaflet 1.9.4 est fourni localement dans `vendor/leaflet`, avec sa licence BSD. Le fond de carte utilise `tile.openstreetmap.org`, avec attribution OpenStreetMap, chargement des seules tuiles visibles et cache du navigateur. La [politique d’utilisation des tuiles](https://operations.osmfoundation.org/policies/tiles/) s’applique : pas de préchargement massif ou hors ligne. L’affichage transmet la zone consultée au fournisseur de tuiles ; la disponibilité du service n’est pas garantie. Un échec du fond est signalé sans bloquer les fiches ou la correction des lieux.

## Descriptifs et informations des lieux

Les fiches sous les étapes affichent les descriptifs, adresses, informations pratiques et notes disponibles. Les textes peuvent être saisis et modifiés directement. Une recherche Wikipédia française ou anglaise, déclenchée depuis l’éditeur, propose jusqu’à trois résumés. L’utilisateur vérifie la fiche avant « Utiliser ce descriptif », puis enregistre le lieu. Aucun descriptif n’est inventé ou attribué automatiquement à un homonyme. La source Wikipédia et sa licence CC BY-SA sont affichées avec le texte conservé. Si aucune fiche n’existe, utilisez les informations manuelles.

Une correction via la recherche de localisation efface un ancien descriptif sourcé si les coordonnées changent, pour éviter de garder une fiche associée à la mauvaise localisation. Une modification manuelle du lieu permet de corriger le descriptif dans le même formulaire. Les horaires, prix et accès saisis ne sont pas vérifiés en direct. Les résumés ne remplacent pas les consignes officielles du lieu.

Les exports/réimports GeoJSON du carnet conservent les descriptifs, sources, adresses et informations pratiques. Les dossiers gardent ces champs dans leur propre sauvegarde locale. Les tests couvrent les modifications isolées, la géométrie, les sources et la persistance ; les réponses OSRM, tuiles et Wikipédia sont simulées dans les vérifications navigateur.

## Recalcul automatique et fiches avec contexte géographique

Après l’enregistrement d’un lieu ou la modification d’un voyage, toutes les journées du dossier sont recalculées automatiquement (distances, durées et géométries disponibles). Une correction depuis la fenêtre de localisation déclenche également ce recalcul. Les anciens résultats sont invalidés ; une réponse d’un calcul antérieur ne peut pas remplacer ceux du nouveau parcours. Les appels restent espacés pour les services gratuits. Les erreurs par journée restent visibles et le bouton permet une nouvelle tentative.

L’éditeur comporte désormais la ville et le nom local du lieu. Les résultats de géocodage conservent ces champs lorsqu’ils sont fournis. « Retrouver la ville et le nom local » consulte les coordonnées via Nominatim ; la ville est proposée et le nom du point doit être accepté explicitement, car le point le plus proche peut être un bâtiment voisin.

La recherche Wikipédia exige ville et pays et combine le nom local (ou le nom connu), la ville et le pays localisé. Le mode automatique choisit notamment le suédois pour la Suède, le français pour la France, l’arabe pour la Jordanie, et propose un repli français. Lorsqu’une fiche française géolocalisée à proximité fournit un lien interlangue, son véritable titre local peut être recherché : aucun nom traduit n’est inventé. La langue peut aussi être choisie manuellement, utile pour les pays multilingues ou les noms peu connus.

Les coordonnées des articles sont comparées à celles du lieu : les fiches situées à plus de 25 km sont exclues. Cette vérification est un filtre géographique, pas une preuve d’identité ; la ville, la source et les homonymes proches restent à contrôler. Une fiche sans coordonnées est explicitement marquée non vérifiée. Les descriptifs ne sont ajoutés qu’après « Utiliser ce descriptif » puis enregistrement du lieu. Le choix d’une fiche ne prétend pas vérifier les horaires ou tarifs. Les tests des services externes restent simulés.

## Accueil, vue dossier et descriptifs en série

L’accueil contient le carnet, les imports, les lieux à localiser, les réglages et les dossiers. « Consulter » ouvre une vue dédiée au voyage avec carte et journées, sans afficher tout le formulaire d’accueil. Le lien Accueil ou Retour permet de revenir au carnet. Les liens `#voyage=<id>` rouvrent un dossier après rechargement dans le même navigateur ; aucun dossier n’est partagé à distance par ce lien.

Un premier calcul des trajets démarre à l’ouverture du dossier. Les résultats, erreurs et géométries sont conservés en mémoire pour cette consultation, même après un retour à l’accueil. Modifier uniquement une description, des notes, une adresse textuelle, un nom ou le titre du dossier ne déclenche aucun nouvel appel routier. Les coordonnées, les étapes, leur ordre de calcul, le nombre de jours, le transport ou le fournisseur routier constituent un changement de parcours et déclenchent un recalcul. Le bouton de calcul permet de forcer une nouvelle tentative. Un rechargement complet vide ce cache de consultation et lance un nouveau calcul initial.

« Compléter les descriptifs de ce dossier » affiche un menu des lieux sans descriptif et un compteur. « Rechercher tous les descriptifs manquants » traite la liste dans l’ordre. Pour chaque lieu, la ville et le nom local sont récupérés via les coordonnées s’ils manquent. Un nom proposé par géocodage inverse est adopté automatiquement seulement si le point est à 100 mètres maximum, ou si le nom concorde déjà ; un pays contradictoire interrompt l’attribution automatique.

La recherche Wikipédia essaie le français d’abord, avec la ville, le pays et le nom local ou connu ; la langue du pays vient ensuite si aucune correspondance française sûre n’existe. Aucun nom n’est traduit artificiellement. Le premier résultat dont le titre correspond au nom connu/local (éventuellement accompagné de la ville) et dont les coordonnées se situent à moins d’un kilomètre est sauvegardé avec sa source. Il s’agit d’un critère prudent de concordance, pas d’une garantie universelle d’identité : le texte reste modifiable dans le dossier. Les fiches lointaines sont exclues ; les noms différents, fiches sans coordonnées ou positions incertaines interrompent la série pour un choix manuel. Les champs de contexte permettent de relancer, et Passer continue sans remplir le lieu.

Les descriptifs existants ne sont pas écrasés par le traitement groupé. Les textes et sources sont sauvegardés au fur et à mesure. Fermer le menu interrompt la suite et affiche les fiches déjà enregistrées, sans recalcul des trajets. Les recherches unitaires depuis l’éditeur suivent les mêmes étapes : ouvrir la recherche démarre la préparation, le résultat concordant est présélectionné et il reste à enregistrer le formulaire. Les tests navigateur utilisent des services simulés pour vérifier ces transitions et le nombre exact d’appels routiers.

## Navigation et ambiances des destinations

La navigation sépare trois vues : `#accueil` pour le carnet et la préparation, `#voyages` pour la collection de dossiers, et `#voyage=<id>` pour un itinéraire. « Mes voyages » ouvre la collection et ne renvoie plus à l’accueil. « Préparer un voyage » ouvre l’accueil au niveau du carnet (`#carnet`). L’onglet actif est identifié par `aria-current`, les liens directs et les retours navigateur sont pris en charge. L’ancien lien `#my-trips` reste compatible. Un dossier contient un lien « Tous mes voyages ». Cliquer à nouveau sur une entrée de navigation réaffiche la vue demandée.

Le design de carnet de voyage ajoute des cartes postales, des boutons arrondis et des illustrations vectorielles locales. Les couvertures des dossiers et les bandeaux des itinéraires utilisent un thème déterminé par le pays et certaines villes reconnues dans le nom du dossier ou la ville des étapes. Exemples : Portugal vert/terracotta, Stockholm bleu/jaune, Jordanie sable/ocre, Japon rose, Paris bleu/rose ; Porto et Sintra possèdent des variantes de couleur. Ce sont des ambiances graphiques inspirées des destinations, pas des représentations officielles de tous les drapeaux. Les destinations non reconnues reçoivent une ambiance générique. Les visuels sont décoratifs, sans photos externes ni coût d’API.

Les thèmes utilisent des palettes contrôlées, les textes des dossiers restent échappés et un nom de ville d’un autre pays ne remplace pas le thème d’un pays reconnu. Ils ne modifient ni les lieux ni les signatures des parcours. Les styles supplémentaires sont dans `design.css`, les règles d’ambiance et illustrations dans `src/destination-theme.js`. Les vérifications navigateur couvrent la collection, son état vide, les liens, l’onglet actif, la navigation vers le carnet et les dossiers, les thèmes et les largeurs mobiles de 320, 390 et 760 pixels, ainsi que le bureau.

## Icône et drapeaux

L’icône du site est fournie localement en SVG, PNG 32 px et icône Apple 180 px. Les dossiers existants et nouveaux affichent automatiquement le drapeau de leur pays, dans la collection et dans le dossier ouvert. Les noms français, anglais et codes ISO sont reconnus ; un pays inconnu conserve son libellé sans drapeau trompeur. Les drapeaux locaux proviennent de `country-flag-icons` (licence MIT dans `vendor/flags/LICENSE`).
