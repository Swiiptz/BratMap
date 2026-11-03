# Instructions permanentes Codex - bratMap

Tu travailles sur une application web cartographique VTM.

Avant toute modification significative, lis :
- `VTM_MAP_SPEC.md`
- `VTM_MAP_DESIGN.md`
- `VTM_MAP_TECH.md`
- `VTM_MAP_DATA_MODEL.md`

## Regles

1. Le perimetre du CDC correspond a la premiere vraie version. Ne retire pas arbitrairement une fonctionnalite sous pretexte de simplifier la V1.
2. Construis par increments verticaux fonctionnels : chaque etape doit laisser l'application utilisable.
3. Ne code pas toutes les fonctionnalites en une seule passe.
4. Ne recode pas un moteur cartographique : utiliser MapLibre GL JS.
5. Ne recode pas un backend custom inutile : Firestore suffit pour le stockage et la synchro.
6. Utiliser TypeScript strict.
7. Favoriser des composants petits et reutilisables.
8. Separations nettes : UI, map layers, data access, domain models, routing, imports publics.
9. Les geometries doivent etre basees sur GeoJSON.
10. Les relations entre entites utilisent des IDs, pas des copies completes.
11. Toute donnee publique importee doit conserver sa source.
12. Les donnees chroniques et publiques doivent etre distinguables.
13. Les niveaux souterrains restent simples : 0, -1, -2, -3. Pas de micro-niveaux inutiles.
14. Le mode discret d'itineraire utilise seulement les informations narratives definies dans l'application.
15. La carte doit rester le centre de l'experience et occuper le maximum d'espace.
16. Pas de gestion de comptes utilisateurs a construire.
17. Ne jamais mettre de secret Firebase prive directement dans le code source ; utiliser les variables d'environnement appropriees.
18. Avant une grosse refactorisation, expliquer brievement ce que tu vas changer et pourquoi dans le message de commit ou le resume de travail.
19. Maintenir un README de developpement a jour avec les commandes de lancement, variables d'environnement et architecture.
20. Ajouter des tests pour les fonctions critiques : normalisation, filtres, graphe souterrain, calculs de geometrie et transformations de donnees.

## Design

- Theme sombre moderne.
- Pas de gothique caricatural.
- Pas de HUD surcharge.
- Carte lisible avant tout.
- Panneaux repliables.
- Couleurs significatives.
- Animations courtes.

## Ordre de travail recommande

1. Scaffold React/Vite/TypeScript.
2. Carte MapLibre plein ecran et style sombre.
3. Layout, panneaux et mode consultation/edition.
4. Firebase + couche d'acces aux donnees.
5. Lieux et havres.
6. Territoires + Traditions.
7. Personnages + referentiels + influences.
8. Plots simples.
9. Souterrains + niveaux + graphe.
10. Couches, filtres, recherche.
11. Outils cartographiques.
12. Donnees publiques et import.
13. Itineraires.
14. Synchronisation/conflits/historique leger.
15. Parametres et import/export.
16. Polish UX, responsive consultation, tests et documentation.
