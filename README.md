# Voyage

Application web en français pour transformer un carnet de lieux en parcours de voyage. Node.js 22 ou supérieur ; aucune dépendance externe à installer. Les fonctions de carnet et de répartition fonctionnent sans clé ; la recherche et le calcul gratuits utilisent OpenStreetMap / OSRM, sans clé.

```sh
npm start
```

Port par défaut : 3000. Variable facultative : `PORT`. Le serveur écoute sur `0.0.0.0`. Tests : `npm test`.

L’interface peut aussi être hébergée en statique sur GitHub Pages, sous `/Voyage/`. Les chemins des ressources et du lien d’accueil sont relatifs pour fonctionner aussi bien à la racine que dans ce sous-répertoire.

## Synchronisation PC / téléphone et droits de partage

Le bouton **Synchronisation & partage** ouvre l’espace en ligne. Il utilise un projet **Supabase Free** à créer par le propriétaire : l’hébergement GitHub Pages ne fournit ni base de données ni synchronisation à lui seul. L’intégration est livrée sans projet externe préconfiguré. Aucune donnée privée n’est publiée dans Git ni dans le code du site.

### Installation, une seule fois

1. Créez un projet Supabase avec l’offre Free. Dans les réglages API / Connect, récupérez son URL `https://…supabase.co` et sa **clé publique publishable ou anon**. Ne renseignez jamais de clé secrète / service_role dans le site.
2. Dans l’application, ouvrez **Synchronisation & partage**, renseignez ces deux valeurs puis **Préparer l’installation**.
3. Exécutez le script généré dans le **SQL Editor** du même projet Supabase. Il crée une table protégée par RLS, deux fonctions autorisées et un espace vide avec des empreintes de clés aléatoires. Il n’efface pas les espaces existants. Le script peut être téléchargé. La création directe d’espaces par l’API publique est interdite.
4. Cliquez **J’ai exécuté le script : connecter et sauvegarder mes voyages**. Tous les dossiers actuels, y compris réservations et billets, sont envoyés chiffrés. Conservez le **lien de modification** affiché, puis ouvrez-le sur votre téléphone et confirmez **Rejoindre et récupérer les voyages**. L’accès reste mémorisé dans chaque navigateur.

Le projet appartient à son créateur. L’offre Free reste soumise aux quotas et conditions Supabase, dont la mise en veille éventuelle d’un projet inactif ; aucun service payant ni facturation n’est configuré par cette application. En cas d’indisponibilité, les copies locales restent accessibles.

### Lecture et modification

- **Lien de lecture** : consultation de tous les dossiers de l’espace, réservations et billets compris. L’interface bloque les modifications de la copie partagée et l’API refuse les écritures sans la clé de modification. **Créer une copie personnelle** permet de préparer une version locale indépendante.
- **Lien de modification** : accès aux mêmes données, avec ajout, modification et suppression. Utilisez ce lien pour vos propres appareils et les personnes avec lesquelles vous préparez le voyage.
- Les permissions sont attachées aux **liens**, sans comptes nominatifs. Un destinataire peut transmettre son lien ; il n’existe pas encore d’invitation par e-mail, de liste de membres ou de révocation individuelle. Le propriétaire du projet peut couper tous les accès en supprimant la ligne de l’espace dans Supabase ; cela ne supprime pas les copies déjà téléchargées. Ne rendez pas publics ces liens contenant les clés d’accès.
- **Partager cet itinéraire par lien** fonctionne immédiatement sans Supabase : c’est une copie statique des lieux, notes, tâches et date de départ, sans réservations, billets ni dépenses. Le destinataire confirme son import. Les changements ultérieurs ne se propagent pas. Limite : 48 000 caractères encodés ; pour un gros dossier, utilisez le JSON ou l’espace synchronisé.

Les liens utilisent le fragment `#espace=…` ou `#partage=…`, qui n’est pas transmis au serveur HTTP. Les liens de l’espace contiennent les clés nécessaires au déchiffrement ; seul le lien de modification contient en plus le droit d’écriture. Les données sont chiffrées côté navigateur avec AES-GCM avant envoi et ne sont jamais mises en cache par le Service Worker.

### Comportement de la synchronisation

Vérification toutes les 15 secondes lorsque l’onglet est actif, à son retour au premier plan et au retour du réseau. **Synchroniser maintenant** permet de la déclencher manuellement. Le serveur ne renvoie pas le contenu complet si la version est inchangée. La synchronisation attend lorsque vous saisissez dans un champ ou qu’une fenêtre de dialogue est ouverte.

Les nouveaux dossiers créés sur un appareil avec un accès de modification rejoignent l’espace. Les dossiers déjà présents avant de rejoindre un espace restent personnels s’ils n’en font pas partie. Le carnet de lieux non utilisés n’est pas synchronisé. En cas de collision à la connexion, une copie locale différente est conservée. Les fichiers PDF et images des dossiers partagés sont inclus, avec une limite totale de **12 Mo de données JSON et documents encodés par espace**. Les sauvegardes JSON classiques conservent leur limite de 80 Mo.

Les modifications hors ligne restent locales et sont envoyées au retour du réseau. Une fusion à trois voies distingue les modifications indépendantes des conflits sur un même dossier ; les deux versions d’un dossier modifié simultanément sont conservées au lieu d’écraser un appareil. Les écritures utilisent une version attendue atomique côté PostgreSQL. Déconnecter un appareil conserve ses dossiers locaux et ne révoque pas les liens.

Validation : tests Node du chiffrement, des liens et de la fusion, tests d’accès SQL sur PostgreSQL embarqué et parcours multi-navigateurs avec API simulée. L’activation sur votre propre projet Supabase reste nécessaire ; aucun projet de production n’a été créé ni connecté automatiquement.

## Utilisation

1. Essayez le carnet de démonstration Portugal, ajoutez vos lieux manuellement ou importez un CSV / GeoJSON décompressé depuis Google Takeout.
2. Les exports Google français `Titre,Note,URL,Tags,Commentaire` sont reconnus, y compris les lignes vides, notes multilignes et caractères accentués. Le nom du fichier devient la catégorie par défaut (par exemple `À visiter.csv` → « À visiter »). Notes et commentaires sont réunis sans perte de leur texte, les tags et les liens originaux sont conservés et exportables. Le pays n’est jamais déduit d’un nom ambigu. Pour une liste de plusieurs pays, laissez le pays d’import vide puis cochez les lieux d’un même pays et utilisez « Appliquer le pays ». Cette action concerne uniquement les lieux cochés de la vue filtrée ; le remplacement de pays existants demande confirmation.
3. Sélectionnez les lieux, le pays, la durée (1 à 30 jours), le moyen de transport et éventuellement le premier lieu.
4. Créez le parcours puis ouvrez les étapes dans Google Maps pour obtenir les vrais trajets. Les grands parcours sont divisés en liens comprenant au maximum trois étapes intermédiaires.
5. Exportez le carnet en GeoJSON pour le sauvegarder et le réimporter. Le carnet de lieux reste local. Les dossiers peuvent être synchronisés en activant l’espace en ligne décrit ci-dessous.

## Import rapide, confirmations et modèles

Dans le carnet, **Coller des liens Maps** accepte des liens individuels en vrac, avec un pays et une ville communs. Les noms et les coordonnées précises encodées dans le lien sont extraits ; une position de caméra `@lat,lng` n’est pas utilisée comme position du lieu. Pour les coordonnées manquantes, lancez la recherche OpenStreetMap : les appels sont espacés, les propositions restent vérifiables et les résultats ambigus demandent un choix. Vous pouvez corriger les noms, saisir les coordonnées, décocher des lieux puis importer ou exporter un GeoJSON réimportable. Les doublons sont ignorés lors de l’ajout au carnet.

Une liste Google Maps partagée ou privée ne fournit pas automatiquement son contenu au navigateur. Collez ses liens individuels ou utilisez son export Takeout. Les liens courts ne sont pas développés : ajoutez le nom du lieu avant le lien pour permettre une recherche OSM. Aucun accès au compte Google ni service payant n’est requis. Les résultats dépendent de la couverture OSM, du nom, du pays et de la ville renseignés ; aucun délai de deux secondes n’est garanti.

Dans **Billets & horaires**, importez une confirmation `.eml` / `.txt` ou collez son texte dans le lecteur de billets. Le lecteur local décode les e-mails MIME (texte, HTML, base64 et quoted-printable), sans charger leurs images ni importer leurs pièces jointes. Il réutilise la détection des champs de vols, hôtels et visites. Vérifiez les propositions, appliquez les champs cochés puis enregistrez la réservation. **Exporter ces informations en JSON** produit un fichier `voyage-confirmation` réimportable dans ce même panneau. Les confirmations restent variables selon les compagnies : les données incertaines doivent être complétées. Il n’y a aucune connexion ni surveillance automatique de votre boîte mail.

**Créer depuis un modèle** prépare le planificateur, le budget journalier en euros, les activités et des tâches selon quatre profils : week-end urbain froid, escapade urbaine, roadtrip nature ou bord de l’eau. Le brouillon est conservé sur cet appareil. Sélectionnez vos lieux puis créez le dossier normalement ; le modèle n’efface aucun lieu et n’invente aucune dépense. Le profil froid ajoute bonnet, gants et couches chaudes en l’absence de prévisions ; la météo disponible prend ensuite le relais. Le matériel personnel et les adaptateurs restent à vérifier selon la destination.

Dans un dossier, **Proposer des journées par zones** calcule localement des groupes géographiques avec une capacité par jour, puis ordonne leurs visites par proximité et 2-opt. La proposition n’est appliquée qu’après validation et les lieux peuvent changer de journée dans le panneau. Chaque journée proposée conserve au moins un lieu. Les secteurs sont relatifs aux lieux sélectionnés : ce ne sont pas des quartiers identifiés ni des recommandations issues d’une IA. Horaires d’ouverture, ferries et durées routières ne participent pas au regroupement. Une modification de localisation invalide les groupes et recalcule le parcours ; une description ou une note conserve les journées et le cache des trajets. **Revenir au tri automatique** retire cette répartition manuelle. Ces outils locaux sont inclus dans le cache hors ligne ; la recherche de nouvelles coordonnées nécessite Internet.

## Dossiers de voyages et suppression du carnet

« Créer et sauvegarder mon voyage » enregistre automatiquement un dossier dans « Mes voyages ». Le nom est facultatif à la création (par défaut : pays et durée). Les dossiers restent consultables après rechargement, dans le même navigateur, avec une copie indépendante des lieux, des liens Maps et des réglages du parcours. Vider ou modifier le carnet ne modifie pas les dossiers existants.

Chaque dossier propose « Consulter », « Modifier » et « Supprimer ». La modification permet de renommer le voyage, changer la durée, le transport, le mode de calcul, le premier lieu et les visites incluses ; des lieux du même pays peuvent être ajoutés depuis le carnet. Les modifications recalculent le parcours. La suppression d’un dossier demande confirmation et conserve les lieux du carnet.

« Supprimer tous les lieux affichés » supprime, après confirmation, tous les résultats de la vue actuelle, cochés ou non. Sans filtre, ce bouton vide le carnet. Avec une recherche ou une catégorie, les lieux masqués sont conservés. Les voyages sauvegardés sont toujours conservés.

Les dossiers sont enregistrés en `localStorage` sous `voyage.trips.v1`, séparément du carnet (`voyage.places.v1`). Sans espace connecté, ils restent propres à ce navigateur. Effacer les données du site supprime ces copies locales ; un espace configuré permet de récupérer sa dernière version synchronisée via son lien privé. L’export GeoJSON concerne le carnet de lieux ; les itinéraires peuvent être imprimés. Si le stockage échoue, la création, la modification ou la suppression du voyage est signalée comme non enregistrée.

Les CSV de listes Google ne fournissent souvent ni pays ni coordonnées. Vous pouvez cocher « Répartir dans l’ordre du carnet » pour préparer des journées sans coordonnées. Ce mode conserve l’ordre d’import (sauf le premier lieu si vous en avez choisi un), équilibre le nombre de visites et ne prétend pas optimiser les déplacements. Aucune distance ni durée de trajet n’est affichée. Les liens de parcours utilisent le nom et le pays des lieux sans coordonnées : vérifiez les correspondances dans Maps. Chaque lieu conserve aussi son lien Google original pour retrouver précisément la fiche enregistrée. Pour le tri par proximité, complétez latitude et longitude avec « Modifier » (clic droit sur le point dans Google Maps). Les liens courts ne sont pas développés automatiquement. Le bouton « Retrouver les coordonnées » exploite les liens Takeout avec les services gratuits OpenStreetMap ; chaque correspondance est confirmée avant enregistrement.

CSV reconnu : `Titre,Note,URL,Tags,Commentaire` ou `Title,Note,URL` (export de listes), ou `name,country,category,latitude,longitude,note,url`. Les variantes françaises `nom,pays,catégorie` et les CSV au point-virgule sont acceptés. GeoJSON : `FeatureCollection` de points (ou géométrie nulle pour un lieu sans coordonnées), métadonnées Takeout `Title`, `Location`, `Google Maps URL`, `Comment`, ou propriétés `name,country,category,note,tags,url`. Les ZIP, KML, liens de liste et autres formats ne sont pas pris en charge.

## Limites explicites

Google ne fournit pas d’API publique pour lire les listes de lieux enregistrés d’un utilisateur via OAuth. Cette version importe les listes CSV/GeoJSON. Les recherches OpenStreetMap interviennent après cet import, à la demande.

Le parcours utilise le plus proche voisin puis une amélioration géographique 2-opt (jusqu’à 200 lieux), en conservant le premier lieu, puis répartit les visites en journées de taille comparable. Il conserve tous les lieux sélectionnés dans le pays demandé, sans garantir un optimum. Les distances sont à vol d’oiseau, y compris les liaisons entre journées ; le budget de visite suppose 1 h 30 par lieu, séparément du temps de déplacement. Les distances à vol d’oiseau sont distinctes des kilomètres renvoyés par OSRM. Les horaires d’ouverture, ferries, frontières, pauses, hébergements, départ depuis le domicile et retour ne sont pas calculés. Les journées estimées au-delà de 8 h sont signalées. Vérifiez le parcours dans Maps avant de voyager.

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

Avant calcul, les pointillés relient schématiquement les étapes consécutives connues : ils ne représentent pas une route et ne sautent pas les étapes manquantes. Le calcul gratuit OSRM demande une géométrie GeoJSON complète ; les trajets disponibles deviennent des traits pleins dans la couleur du jour. Un trajet sans géométrie ou en erreur conserve ses pointillés. La liaison depuis la veille fait partie du trajet du jour. Les calculs réussis sont conservés dans IndexedDB avec la date du calcul, pour consultation hors ligne. Un résultat de moins de 24 heures est réutilisé ; un résultat plus ancien peut être actualisé à la prochaine ouverture en ligne.

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

## Pages pratiques dans chaque voyage

Chaque dossier propose quatre pages : **Itinéraire**, **Billets & horaires**, **Budget & devises**, **Ma check-list**. Les liens directs et le retour du navigateur fonctionnent aussi après rechargement, par exemple `#voyage=ID&page=budget`. Les pages conservent l’ambiance de la destination. Leur utilisation ne modifie pas la signature du trajet et ne lance pas de nouveau calcul OSRM.

- **Billets & horaires** : agenda par journée, heures de début/fin, établissement, référence, lien officiel et notes. Les horaires sont renseignés par l’utilisateur, avec des recherches ciblées vers les sites officiels et les informations pratiques déjà présentes dans les lieux. Pièces jointes PDF, JPG, PNG et WebP de 10 Mo maximum dans IndexedDB, téléchargées à la demande. Pas d’accès automatique aux e-mails ou aux comptes de réservation.
- **Budget & devises** : conversion via des taux EUR publiés par Frankfurter / banques centrales, date et source affichées, saisie manuelle si une devise ou le service est indisponible. Les frais de change ne sont pas inclus. Dépenses prévues/payées modifiables, devise, catégorie et journée, objectif par jour, solde et dépassements. Les réservations n’ajoutent pas automatiquement de dépense. Un taux manquant rend le total explicitement incomplet. Après réduction de la durée, les dépenses des journées retirées restent visibles et comptabilisées.
- **Ma check-list** : activités course/randonnée suggérées par les noms et catégories des lieux, puis modifiables ; accessoires de montre optionnels. Météo Open-Meteo du lieu choisi, à partir de la date de départ (ou aujourd’hui), jusqu’à 16 jours. Le bulletin indique le lieu, la date de chargement et une éventuelle couverture partielle. Pluie ≥ 40 %, minimum < 10 °C, maximum ≥ 28 °C et vent ≥ 40 km/h adaptent la liste. Un bulletin passé n’alimente plus les conseils et une modification de durée ou du point de référence l’invalide. Les cases cochées et ajouts personnels restent enregistrés. Les autres étapes, l’altitude et les alertes locales demandent une vérification séparée. L’export GPX fournit uniquement les étapes géolocalisées, sans tracé ni guidage ; il n’y a pas de synchronisation directe avec une montre.

Les données sont sauvegardées dans ce navigateur. Si un espace est connecté, ses dossiers et leurs documents sont aussi synchronisés sous forme chiffrée. **Exporter le dossier complet** crée une sauvegarde JSON incluant itinéraire, informations pratiques et pièces jointes ; **Restaurer un dossier exporté** remplace le contenu du dossier ouvert après confirmation, en conservant son identifiant et sa date de création. Limite de sauvegarde : 80 Mo. Les fichiers ne sont pas publiés sur GitHub. Conservez vos sauvegardes privées et ne comptez pas sur le seul stockage du navigateur. La suppression d’une réservation ou d’un dossier retire aussi ses pièces jointes locales quand le stockage est disponible.

Réseau supplémentaire : `api.frankfurter.app` pour les taux et `api.open-meteo.com` pour la météo. Les taux sont demandés par bouton ; la météo peut être demandée manuellement ou automatiquement depuis la check-list, sans clé ni facturation. Seules les coordonnées du lieu météo sont envoyées à Open-Meteo. Une panne laisse utilisables les données sauvegardées, les activités et les taux saisis manuellement. Les tests automatisés simulent ces services ; ils ne garantissent pas leur disponibilité réelle.

## Réservations séparées et préparation automatique

**Billets & horaires** contient trois sous-onglets : **Vols**, **Hôtels**, et **Visites & transports locaux**. On peut ajouter plusieurs vols ou hébergements, chacun avec ses dates, horaires, références et pièce jointe. Il n’y a pas de plafond de nombre de réservations dans l’application ; l’espace du navigateur reste limité. Les anciennes réservations restent classées selon leur type, avec leur document. Le sélecteur « Ranger dans » permet de reclasser une ancienne réservation en vol, hôtel ou visite, sans perdre son document.

Le convertisseur commence toujours avec la **monnaie du pays → EUR**, indépendamment de la devise choisie pour le budget. Le bouton d’inversion donne EUR → monnaie locale. La correspondance repose sur le pays du dossier (noms et codes ISO), avec une devise nationale principale ; si elle est inconnue, le site demande de la choisir et ne suppose pas le dollar. Certaines devises nécessitent encore un taux manuel si Frankfurter ne les fournit pas.

Dans les visites, « Rechercher les sites officiels » consulte Wikipédia puis Wikidata (propriété P856). Il faut un nom concordant et une position à moins de 1 km. La source Wikidata est conservée. Des liens multiples ambigus ou sans localisation fiable ne sont pas retenus. Un lien trouvé correspond au site déclaré, pas à une billetterie ou une disponibilité garantie. Les liens de recherche web restent explicitement à vérifier. Les sites trouvés sont sauvegardés avec le dossier ; une localisation modifiée masque l’ancien résultat. Services supplémentaires : `www.wikidata.org` et les sous-domaines linguistiques de `wikipedia.org`. Les résultats de recherche et les liens sont des données, jamais des instructions exécutées.

La **météo automatique est activée par défaut dans la check-list**. Elle démarre à l’ouverture, utilise un bulletin frais pendant six heures et vérifie ensuite l’actualisation chaque minute tant que la page reste visible. Le retour à un onglet visible vérifie aussi le cache. L’utilisateur peut la désactiver ou choisir un autre lieu. Après erreur, les nouvelles tentatives automatiques sont espacées de 15 minutes ; le bouton manuel reste disponible. Les dates trop lointaines et les lieux sans coordonnées donnent une explication sans appeler le service. Pendant un séjour déjà commencé, seules les journées restantes sont demandées. Fermer le site arrête cette actualisation : aucun service en arrière-plan n’est installé.

La liste ajoute ou retire les conseils de pluie, froid, gel, chaleur et vent, avec une préparation renforcée pour le sport et un itinéraire de repli pour une randonnée pluvieuse. Elle conserve les ajouts personnels et les cases cochées, même si un conseil disparaît temporairement. L’actualisation préserve aussi le texte en cours de saisie. La météo couvre le lieu de référence choisi, pas tous les microclimats du parcours.

## Billetterie ciblée, valise détaillée et lecture des billets

Dans la billetterie et les recherches de tarifs, seuls les lieux classés **billetterie possible** sont affichés et recherchés. Les musées, zoos, aquariums, parcs d’attractions et certains monuments sont suggérés à partir de leur nom/catégorie. Une réservation musée déjà liée est également un indice. Les rues/quartiers et les types inconnus sont masqués ; le panneau **Choisir les lieux avec ou sans billet** permet d’inclure un parc payant ou d’exclure un musée gratuit. Ce classement reste une aide, sans garantir qu’un lieu est payant. Le choix est conservé dans le dossier ; aucun lieu n’est retiré de l’itinéraire et les trajets ne sont pas recalculés.

La check-list ajoute des quantités indicatives **par personne**, adaptées au nombre de jours et à une lessive éventuelle (tous les 3, 5 ou 7 jours) : sous-vêtements, chaussettes, T-shirts, pantalons, shorts selon la météo, pyjama, pulls, chaussures, tenues de sport et linge sale. Les soins, produits personnels, adaptateur, lunettes/lentilles, bouchons d’oreilles et autres petits oublis sont détaillés. Les identifiants des éléments restent stables afin de conserver les cases cochées lorsque les quantités ou conseils changent.

**Lire les informations d’un billet** accepte un PDF ou une image (10 Mo maximum). La lecture se déroule sur l’appareil, avec PDF.js puis Tesseract pour les images/scans, modèles français et anglais fournis localement. Aucun document ni texte n’est envoyé à un service de reconnaissance. Les bibliothèques et modèles sont chargés à la demande depuis `vendor/tickets` (versions, sources et licences dans ce répertoire, environ 10 Mo). Le serveur local autorise WebAssembly via `wasm-unsafe-eval`, sans activer l’exécution arbitraire de JavaScript. Les URL des ressources fonctionnent aussi sous `/Voyage/`.

Les champs reconnus sont proposés avec des cases à cocher et un extrait source lorsqu’il est disponible. Les valeurs saisies différentes restent décochées par défaut. L’utilisateur vérifie, corrige les propositions puis choisit **Appliquer les champs cochés au formulaire**, avant d’**enregistrer** pour créer ou modifier la réservation et joindre le fichier d’origine. Le texte lu reste visible et peut être corrigé/collé pour une nouvelle analyse. Les informations absentes ou ambiguës restent à compléter ; les dates numériques sont interprétées en jour/mois/année et signalées pour vérification. L’import ne met pas à jour le budget ni les trajets. Il n’assure pas le suivi en temps réel des vols. Les instructions qui pourraient figurer dans le document sont traitées uniquement comme du texte.

Limites : un document par réservation, pas de décodage des QR codes ni de prise en charge des PDF protégés ; PDF de 20 pages maximum, reconnaissance de trois pages scannées maximum par lecture. Un document regroupant plusieurs billets doit être vérifié et éventuellement importé séparément pour chaque réservation. La reconnaissance dépend de la lisibilité et du format ; le formulaire et l’ajout manuel d’une pièce jointe restent disponibles en cas d’échec.

## Formulaires adaptés aux réservations

- **Vols** : compagnie, numéro de vol, passager, aéroports de départ/arrivée, dates et heures locales distinctes, terminaux, porte, siège et bagages. Une entrée par vol ; les horaires de nuit ou avec décalage horaire ne sont pas assimilés à une visite.
- **Hôtels** : établissement, adresse, dates/heures de check-in et check-out, voyageurs, client, chambre et contact.
- **Visites et transports locaux** : lieu, date de visite, créneau d’entrée, heure de fin facultative, nombre de visiteurs, type/tarif du billet et point de rendez-vous.

Chaque formulaire conserve référence, lien, notes et document. Les nouveaux champs sont optionnels pour rester compatibles avec les anciennes réservations. La modification d’une entrée conserve son identifiant et sa pièce jointe ; elle ne crée pas une copie.

La lecture reconnaît aussi les libellés suivis de leur valeur sur les lignes suivantes, certains tableaux à deux colonnes départ/arrivée, les dates anglaises mois/jour en toutes lettres et les dates sans année uniquement si elles correspondent à la période du voyage. Le texte du PDF est regroupé par position pour mieux conserver ses lignes et colonnes. Plusieurs vols ou références distinctes restent à sélectionner manuellement plutôt que de retenir arbitrairement le premier. Le type du document peut être choisi explicitement avant l’analyse. La lecture et la présentation de propositions restent locales. La précision dépend toujours du format du billet : les tests sur documents synthétiques ne garantissent pas tous les documents de compagnie.

La page **Réductions & pass** et ses commandes ont été retirées. Les anciens champs d’offres éventuellement présents restent compatibles avec les sauvegardes existantes, sans écran dédié. La recherche des sites officiels reste disponible dans les visites.

## Installation PWA et consultation hors ligne

Le manifeste `manifest.json`, les icônes 192/512 px et `sw.js` permettent l’installation sur un navigateur compatible. Bouton **Installer Voyage** lorsque le navigateur le propose ; sur iPhone, Safari → Partager → Sur l’écran d’accueil. Une première visite en ligne est nécessaire : attendre le message **Carnet prêt hors ligne** dans **Sauvegarde & hors-ligne**. Le périmètre de l’application reste le répertoire du projet, y compris `/Voyage/` sur GitHub Pages. HTTPS est requis, sauf sur localhost pour le développement.

Le Service Worker conserve les ressources locales et les met à jour depuis le réseau lorsque possible. Les mises à jour du worker peuvent être activées par le bouton dédié, sans recharger automatiquement un formulaire en cours de saisie. Il ne met pas les données personnelles dans un cache réseau et ne télécharge pas de cartes OpenStreetMap en masse. Dossiers, budget/taux déjà saisis, check-lists, notes et billets IndexedDB restent utilisables hors ligne. Les étapes et les tracés sauvegardés restent visibles, mais le fond cartographique peut manquer. Les recherches de lieux, Wikipédia, nouveaux calculs OSRM, nouveaux taux et prévisions nécessitent une connexion.

Les calculs routiers réussis sont archivés localement avec leur date, séparés des données du dossier. Une correction des lieux, du mode, de la durée ou des serveurs change la clé du parcours ; les anciennes distances ne sont donc pas attribuées au nouveau trajet. Les notes, cases « visité » et tâches ne changent pas cette clé. Les résultats sauvegardés sont des estimations au moment du calcul, sans trafic en direct. Ces caches ne sont pas inclus dans les exports JSON ; un nouvel appareil peut recalculer les routes en ligne pour préparer son propre usage hors ligne.

La lecture de PDF/photos peut aussi être préparée par **Préparer aussi la lecture des billets hors ligne** (environ 10 Mo). Elle n’alourdit pas l’installation initiale. Le navigateur peut évincer son stockage, notamment en navigation privée ou en manque de place : conserver une sauvegarde JSON séparée reste nécessaire. Pour ajouter une ressource indispensable à l’interface, mettre à jour la liste `SHELL` du worker ; pour modifier sa stratégie, incrémenter la version du cache. Les caches sont séparés par périmètre d’installation.

## Sauvegarde globale et partage sans serveur

**Sauvegarde & hors-ligne**, disponible depuis toutes les pages, permet d’exporter l’ensemble des dossiers et le carnet non encore organisé en JSON, avec les billets joints. Le bouton **Exporter ce voyage avec ses billets** reste disponible dans chaque dossier. Limite : 80 Mo par fichier.

L’import global accepte le format `voyage-workspace` et l’ancien `voyage-dossier`. Les données sont validées avant application. Il ajoute des copies avec de nouveaux identifiants, restaure les documents dans IndexedDB et conserve les dossiers déjà présents ; il ne fusionne pas automatiquement deux versions d’un même voyage. Les échecs de validation ou de stockage interrompent l’import sans appliquer de données invalides. La restauration qui remplace un dossier reste une action distincte dans ses pages pratiques.

**Partager l’itinéraire sans billets** propose le partage natif de fichier quand disponible, sinon télécharge un JSON à envoyer. La copie comprend les lieux, notes, tâches, suivi des visites et date de départ ; elle exclut les réservations, documents et dépenses. Le destinataire l’importe avec le même menu, puis peut modifier sa copie. Ce partage JSON ne crée pas de synchronisation. Le bouton « Partager cet itinéraire par lien » donne aussi accès à une copie statique ; les liens de l’espace synchronisé servent à suivre les modifications.

## Notes par étape, tri et aperçu du dossier

Chaque lieu de la feuille de route propose une case **Lieu visité**, une note rapide et une liste de tâches cochables et supprimables (100 tâches maximum par lieu). Ces informations appartiennent à la copie du lieu dans ce dossier et sont incluses dans les sauvegardes. Leur modification ne relance pas le calcul des trajets.

Le tri par proximité applique 2-opt sur un chemin ouvert après le plus proche voisin (jusqu’à 200 lieux, quatre passes maximum). Il garde le premier lieu choisi, tous les lieux et le nombre de visites par jour, et conserve les liaisons entre journées. L’ordre du carnet reste respecté lorsqu’il est choisi. L’amélioration porte sur les distances à vol d’oiseau, pas sur un optimum de temps routier ou les horaires d’ouverture. Les kilomètres géographiques évités sont indiqués s’ils sont significatifs.

Le dossier affiche directement le total et la moyenne des dépenses, les conversions disponibles entre monnaie du budget, monnaie du pays et euro, ainsi que le dernier bulletin météo du lieu de référence. Les dates, la source et les limites de couverture sont indiquées ; une probabilité de pluie élevée suggère une activité intérieure. Au-delà de la fenêtre de prévision, aucune tendance saisonnière inventée n’est affichée. Les pages Budget et Check-list restent les écrans de saisie et d’actualisation.

Validation : `npm test` ; tests navigateur du démarrage hors ligne avec Service Worker réellement installé, export/import avec billet, partage sans réservations, suivi des étapes sans recalcul, lecture photo hors ligne après préparation et périmètre `/Voyage/`. Les réponses routières sont simulées dans les tests navigateur ; elles ne prouvent pas la disponibilité des services publics.
