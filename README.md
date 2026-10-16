# Voyage

Application web en français pour transformer un carnet de lieux en parcours de voyage. Node.js 22 ou supérieur ; aucune dépendance externe, aucune clé API.

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

Les CSV de listes Google ne fournissent souvent ni pays ni coordonnées. Vous pouvez cocher « Répartir dans l’ordre du carnet » pour préparer des journées sans coordonnées. Ce mode conserve l’ordre d’import (sauf le premier lieu si vous en avez choisi un), équilibre le nombre de visites et ne prétend pas optimiser les déplacements. Aucune distance ni durée de trajet n’est affichée. Les liens de parcours utilisent le nom et le pays des lieux sans coordonnées : vérifiez les correspondances dans Maps. Chaque lieu conserve aussi son lien Google original pour retrouver précisément la fiche enregistrée. Pour le tri par proximité, complétez latitude et longitude avec « Modifier » (clic droit sur le point dans Google Maps). Les liens courts et les identifiants contenus dans les liens Takeout ne sont pas géocodés automatiquement.

CSV reconnu : `Titre,Note,URL,Tags,Commentaire` ou `Title,Note,URL` (export de listes), ou `name,country,category,latitude,longitude,note,url`. Les variantes françaises `nom,pays,catégorie` et les CSV au point-virgule sont acceptés. GeoJSON : `FeatureCollection` de points (ou géométrie nulle pour un lieu sans coordonnées), métadonnées Takeout `Title`, `Location`, `Google Maps URL`, `Comment`, ou propriétés `name,country,category,note,tags,url`. Les ZIP, KML, liens de liste et autres formats ne sont pas pris en charge.

## Limites explicites

Google ne fournit pas d’API publique pour lire les listes de lieux enregistrés d’un utilisateur via OAuth. Cette version propose un import, sans fausse connexion Google. La récupération automatique ne fait pas partie de cette version.

Le parcours utilise une heuristique du plus proche voisin depuis le premier lieu, puis répartit les visites en journées de taille comparable. Il conserve tous les lieux sélectionnés dans le pays demandé, sans garantir un optimum. Les distances sont à vol d’oiseau, y compris les liaisons entre journées ; les horaires indicatifs supposent 1 h 30 par visite et 4 km/h à pied ou 35 km/h en voiture. Ce ne sont pas des temps routiers. Les horaires d’ouverture, ferries, frontières, pauses, hébergements, départ depuis le domicile et retour ne sont pas calculés. Les journées estimées au-delà de 8 h sont signalées. Vérifiez le parcours dans Maps avant de voyager.

Une évolution avec un service de géocodage et une API de trajets demanderait un backend, un compte fournisseur et éventuellement une facturation. Ne placez pas de clé secrète dans le JavaScript public.
