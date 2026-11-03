# bratMap - Architecture technique recommandee

## Stack

- React
- TypeScript
- Vite
- MapLibre GL JS
- Firebase / Firestore
- Firebase Hosting ou Vercel
- GeoJSON

## Carte

MapLibre GL JS pour :
- WebGL ;
- couches ;
- GeoJSON ;
- style sombre personnalise ;
- symboles ;
- lignes ;
- polygones ;
- clustering ;
- filtrage dynamique ;
- performance.

## Fond de carte

Base OpenStreetMap via un fournisseur de tuiles compatible MapLibre. Ne pas utiliser directement les serveurs publics OSM comme backend de production.

## Geometries

- Point : lieu, havre, acces souterrain, ping de plot.
- LineString : segment souterrain, mesure, itineraire.
- Polygon : territoire, zone de plot, fade/perimetres.

## Ordre indicatif des couches

1. fond de carte ;
2. batiments/routes ;
3. fade geographique ;
4. territoires ;
5. zones de plots ;
6. souterrains ;
7. itineraires ;
8. lieux ;
9. havres ;
10. acces souterrains ;
11. selection/surbrillance.

## Souterrains

Modele en graphe :
- noeuds ;
- segments ;
- niveau 0/-1/-2/-3 ;
- connexions verticales ;
- geometrie GeoJSON.

La profondeur exacte est facultative et ne doit pas multiplier les niveaux.

## Itineraires

Ne pas inventer un moteur complet trop tot.

Prevoir une abstraction `RoutingProvider` pour pouvoir brancher :
- un moteur de routage public pour le trajet rapide ;
- le graphe interne pour le souterrain ;
- une couche de ponderation narrative pour le mode discret.

Le mode discret doit utiliser uniquement les donnees narratives de l'application, pas des donnees de surveillance reelles.

## Edition

Prevoir une couche d'edition cartographique dediee pour :
- placement de points ;
- edition de LineString ;
- edition de Polygon ;
- undo/redo ;
- validation avant sauvegarde.

## Firebase

Firestore pour les donnees metier et la synchro temps reel.

Ne pas stocker les tuiles cartographiques dans Firestore.

Ne pas dupliquer les objets entiers dans les relations : utiliser des IDs.

Chaque document important doit avoir :
- `createdAt` ;
- `updatedAt` ;
- eventuellement `deletedAt` ;
- champ de version ou timestamp pour eviter l'ecrasement silencieux.

## Acces

Pas de comptes applicatifs en V1. Une protection legere peut etre placee devant l'application, mais ne pas construire un IAM.

Attention : ne jamais considerer un simple lien secret comme une vraie protection de donnees sensibles. Garder la solution simple mais explicite.

## Environnements

- `.env.development`
- `.env.production`
- projets Firebase ou collections separees selon besoin.

## Qualite

- ESLint ;
- Prettier ;
- TypeScript strict ;
- tests unitaires sur les fonctions de normalisation, filtres et graphe ;
- tests d'integration critiques pour Firestore et edition de geometrie.
