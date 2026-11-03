# bratMap

Carte interactive de chronique Vampire: la Mascarade centrée sur les Hauts-de-Seine, Paris, Saint-Denis et Saint-Ouen.

## Développement

```bash
npm install
npm run dev        # serveur Vite
npm run dev:offline  # serveur Vite sans Firebase (chronique dans le navigateur)
npm run build      # vérification TypeScript + build de production
npm run build:staging  # build de recette (.env.staging.local)
npm run check      # TypeScript seul
npm run lint       # ESLint
npm run test       # tests unitaires (Vitest)
npm run format     # Prettier
```

### Variables d'environnement

Copier `.env.example` vers le fichier de l'environnement visé (tous ignorés par git) :

| Fichier | Utilisé par | Conseil |
| --- | --- | --- |
| `.env.development.local` | `npm run dev` | un projet Firebase **de développement**, jamais la base des joueurs |
| `.env.staging.local` | `npm run build:staging` | recette, `VITE_ENV_LABEL=recette` |
| `.env.production.local` | `npm run build` | la vraie chronique |
| `.env.offline` (versionné) | `npm run dev:offline` | aucune donnée envoyée à Firestore |

Un badge sous le logo rappelle l'environnement (« dev », « recette », « hors ligne »…) ; rien ne s'affiche en production avec Firestore.


| Variable | Rôle |
| --- | --- |
| `VITE_FIREBASE_API_KEY` | Clé web Firebase (publique par nature) |
| `VITE_FIREBASE_AUTH_DOMAIN` | Domaine d'auth du projet |
| `VITE_FIREBASE_PROJECT_ID` | Active Firestore lorsqu'elle est définie |
| `VITE_FIREBASE_STORAGE_BUCKET` | Bucket du projet |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Identifiant d'expéditeur |
| `VITE_FIREBASE_APP_ID` | Identifiant de l'application web |
| `VITE_ENV_LABEL` | Facultatif : libellé du badge d'environnement |
| `VITE_ROUTING_URL` | Facultatif : serveur OSRM pour les itinéraires (défaut : FOSSGIS / OpenStreetMap) |
| `VITE_ACCESS_CODE_SHA256` | Facultatif : empreinte SHA-256 du code d'accès global |

Sans `VITE_FIREBASE_PROJECT_ID`, l'application démarre en **mode local** : les données sont stockées dans le `localStorage` du navigateur (synchronisé entre onglets). Pour forcer ce mode malgré un `.env.local` rempli : `npm run dev:offline`.

Les règles `firestore.rules` sont volontairement ouvertes (pas de comptes en V1) : elles ne protègent pas des données sensibles.

## Mise en ligne (GitHub Pages)

Le workflow `.github/workflows/deploy.yml` teste, construit et publie le site à chaque push sur `main`.

1. Pousser le dépôt sur GitHub (branche `main`).
2. *Settings › Pages* : source **GitHub Actions**.
3. *Settings › Secrets and variables › Actions › Variables* : recopier les `VITE_FIREBASE_*` (et `VITE_ACCESS_CODE_SHA256` conseillé). Ce sont des valeurs publiques par nature (elles finissent dans le JavaScript du site), d'où des *variables* et non des secrets. Sans elles, le site part en mode local.
4. Le site est servi sous `https://<compte>.github.io/<dépôt>/` (chemin de base calculé automatiquement ; à la racine pour un dépôt `<compte>.github.io`).

⚠️ Les règles Firestore sont ouvertes : une fois le site public, quiconque a l'URL peut lire et écrire. Le code d'accès (`VITE_ACCESS_CODE_SHA256`) n'est qu'une protection légère ; pour mieux faire, Firebase App Check ou l'authentification.



```
src/
  app/         App, routage par hash (liens partageables), préférences locales
  components/  formulaires partagés, fiches, brouillon d'édition avec contrôle de version
  data/        DataStore (Firestore | local), codec géométrie, référentiels, sauvegarde, état d'enregistrement
  domain/      modèles, géométrie, recherche, focus, filtres — fonctions pures testées
  features/
    map/         carte MapLibre, couches, panneau gauche, fiches lieux/havres/territoires
    characters/  liste filtrable + fiche personnage
    plots/       plots + « Afficher ce plot »
    settings/    référentiels, modifications récentes, corbeille, export/import JSON
```

Principes :

- **Une seule interface de données** (`src/data/store.ts`) : Firestore ou localStorage, l'UI ne voit pas la différence. Toutes les écritures passent par `src/data/index.ts`, qui alimente l'indicateur « Enregistré / Sauvegarde… / Erreur ».
- **Géométries GeoJSON** : Firestore refuse les tableaux imbriqués, donc LineString et Polygon sont stockés en JSON texte (`src/data/geometryCodec.ts`), les Points restent natifs.
- **Pas d'écrasement silencieux** : chaque document porte un champ `version`. Une fiche enregistrée avec une version périmée est refusée (transaction Firestore) et un bandeau propose de recharger.
- **Corbeille** : suppression douce via `deletedAt`, restauration ou suppression définitive dans Paramètres.
- **Référentiels préchargés** (clans, factions, Traditions, disciplines, compétences, domaines d'influence, statuts, types de pings) avec des IDs déterministes : le préchargement est idempotent.
- **Relations par IDs**, lues dans les deux sens par le mode focus (`src/domain/focus.ts`).

### Carte

- **Zone jouable** : contour réel (union des communes IGN du 92, de Saint-Denis et de Saint-Ouen ; **Paris est hors zone**, marqué « hors zone ») dans `src/assets/main-zone.json`. Tout ce qui est en dehors est assombri avec un bord flouté ; l'intensité se règle dans le panneau gauche.
- **Vue Souterrain** (bouton en haut) : surface atténuée, réseau mis en avant, sélecteur de niveaux 0 / −1 / −2 / −3 avec légende. Couleur par niveau, trait plein = confirmé, tirets = supposé, pointillés = connexion verticale, trait fin = infrastructure publique.
- **Graphe souterrain** (`src/domain/underground.ts`) : nœuds = accès + jonctions partagées par les extrémités des segments. Les connexions se déduisent des nœuds (les champs `connectedSegmentIds` / `segmentIds` ne sont plus maintenus). Plus court chemin avec pénalité de changement de niveau, utilisé par « Trajet souterrain » dans la fiche d'un accès.
- **Repères 3D** (bouton 3D) : emprises OSM (ODbL) des tours ≥ 90 m et de monuments (tour Eiffel, Notre-Dame, Grande Arche, Sacré-Cœur, basilique de Saint-Denis, Stade de France, château de Sceaux…) dans `public/geo/landmarks.geojson`, extrudées à leur hauteur réelle (estimée quand OSM n'en donne pas, signalé au survol).

- **Souterrains publics** (`public/data/public-underground.json`) : tunnels métro / RER / train / routiers, couloirs piétons, stations, bouches et parkings souterrains d'OpenStreetMap, limités à la zone jouable. Couche de référence en lecture seule, visible en vue Souterrain : un élément modifié est copié dans la chronique (même ID) et prime ensuite ; un élément mis à la corbeille est masqué. Niveaux normalisés par type d'infrastructure (voir `scripts/build-public-underground.py`) ; les raccords station → voies et bouche → station sont déduits et marqués « supposés ».
- **Niveaux et profondeurs indicatives** : 0 surface (0 m) · −1 peu profond (0 à 10 m : couloirs, parkings, métro sous chaussée, égouts, rivières couvertes) · −2 intermédiaire (10 à 25 m : métro profond, RER, carrières) · −3 profond (plus de 25 m : RER E, Grand Paris Express).
- **Hiérarchie visuelle** : ajouts de la chronique (épais, lumineux) > métro/RER/train (couleur du niveau) > tunnels routiers (sable), rivières et aqueducs enterrés (vert d'eau) > petits passages publics (gris-bleu). Égouts du Département en ocre, avec leur propre interrupteur de couche : ce sont des segments souterrains cliquables (fiche, plots, focus), nommés par réseau et commune.
- **Souterrains insolites** (`scripts/build-extra-underground.py`) : rivières et aqueducs enterrés (Bièvre, Croult, aqueducs de l'Avre, de la Vanne, du Loing…), sites d'anciennes carrières et abris nommés dans OSM (marqués « accès non public », usage narratif), ouvrages d'assainissement et collecteurs du Département des Hauts-de-Seine (Licence Ouverte). Les accès techniques sans nom et les regards ne sont pas repris. Les plans de carrières de l'IGC ne sont pas publiés en données ouvertes (seulement en images aux Archives départementales).
- **Bâtiments 3D et lieux** : cliquer un bâtiment 3D ouvre le lieu qui lui est rattaché, ou propose de le créer (pré-rempli). Un lieu ou un havre peut aussi recevoir une maquette du catalogue (`src/domain/models3d.ts` : manoir, château, tour, immeuble, église, entrepôt, rotonde) réglable en largeur, profondeur, hauteur et orientation. Le volume 3D reste facultatif. Le château de Sceaux est restitué depuis ses parties OSM (murs ~11,5 m, toiture en gradins jusqu'à ~22 m).
- **Déplacement discret** : chaque segment a une *praticabilité* (debout, voûté, en rampant, impraticable, inconnu) et une *discrétion* (discret, neutre, exposé), avec des valeurs par défaut par type (lignes et couloirs publics praticables mais exposés ; égouts, rivières et carrières discrets, praticabilité inconnue). Le « Trajet souterrain » propose les modes *Discret* (évite l'exposé) et *Plus court*, n'emprunte jamais l'impraticable, et affiche un risque narratif (faible → très élevé) et une durée selon la praticabilité. Le filtre de la vue Souterrain (Tout / Exploitable / Discret) masque ce qui n'est pas exploitable pour se déplacer (impraticable ou seulement en rampant) et, en Discret, estompe en plus l'exposé. Praticabilité des données importées : sourcée quand un gabarit est publié (aqueduc de l'Avre, Ø 1,8 m), sinon estimée et justifiée dans la fiche — égouts calibrés sur ~66 % de linéaire visitable (≥ 1,60 m, chiffre départemental), siphons et conduites forcées impraticables, rivières majeures voûtées, petits rus en rampant. Les réseaux discrets publics ne sont pas reliés aux stations (pas de regards ni d'accès techniques) : les liaisons se tracent dans la chronique.
- **Souterrains d'un territoire** : la fiche liste les stations et souterrains situés dans le polygone, et le focus du territoire les affiche.

Les fichiers de `public/geo` et `public/data` sont générés hors ligne (geo.api.gouv.fr et Overpass) ; ils ne sont pas téléchargés à l'exécution depuis ces services.

### Régénérer les souterrains publics

1. Extraire la zone via Overpass (`out body geom`) : tunnels `railway`, `highway` + `tunnel=yes`, `railway=station|subway_entrance`, `amenity=parking` + `parking=underground` (requête documentée en tête du script).
2. `python3 -I scripts/build-public-underground.py extraction.json src/assets/main-zone.json > public/data/public-underground.json`
3. `python3 -I scripts/build-extra-underground.py osm_insolite.json collecteurs_cd92.geojson bassins_cd92.geojson src/assets/main-zone.json` (complète le fichier, égouts compris ; 5ᵉ argument facultatif : communes du 92 pour nommer les collecteurs)
4. `python3 scripts/enrich-idfm.py` : rattache les lignes Île-de-France Mobilités (open data ODbL : tracés et gares, couleurs officielles) aux tunnels ferrés et aux stations / bouches. Téléchargement mis en cache dans `scripts/.cache/idfm/`. Les horaires (GTFS) ne sont pas importés.

### Itinéraires (CDC §12)

- Modes **Rapide**, **Discret** et **Souterrain** ; à pied ou en voiture, **mode réglable par tronçon** (ex. voiture jusqu'au parking puis à pied).
- **Stationnement stratégique** : parkings souterrains publics et lieux tagués « parking » à distance de marche de l'arrivée, hors territoire hostile de préférence.
- Analyse narrative : territoires traversés (distance, attitude, Traditions actives), zones dangereuses (pings « Danger » ou tag `danger`), lieux importants proches, risque faible → très élevé. Un territoire **hostile** (champ « Attitude » de la fiche) pèse moins traversé en voiture qu'à pied.
- Mode Souterrain : marche jusqu'au réseau, trajet souterrain discret, marche jusqu'à l'arrivée. Option « regards supposés » : entrée et sortie par une jonction du réseau discret praticable (égouts, rivières), hypothèse narrative signalée comme telle.
- Variantes comparées côte à côte ; **itinéraires enregistrés** et partagés (collection `itineraries`).
- Rues : moteur OSRM derrière l'abstraction `RoutingProvider` (`src/domain/routing.ts`), serveurs FOSSGIS d'OpenStreetMap par défaut (`VITE_ROUTING_URL` pour en changer), repli en ligne droite hors ligne.

### Liens partageables

- `#/map/<collection>/<id>` : ouvre un lieu, havre, territoire, plot, accès ou segment sur la carte
- `#/map/focus/<collection>/<id>` : mode focus (tout ce qui est relié)
- `#/map/@<lng>,<lat>,<zoom>` : position ; suffixe `,m` pour un marqueur partagé
- `#/characters/<id>`, `#/plots/<id>`, `#/settings`

### Raccourcis

`/` recherche · `F` plein écran · `Échap` annuler / désélectionner · `Maj+clic` ajouter / retirer de la sélection · `Maj+glisser` sélection rectangulaire · `Ctrl+Z` / `Ctrl+Y` annuler / rétablir (tracé en cours, sinon toute modification de la session : création, fiche, déplacement, suppression) · `Suppr` corbeille (mode édition, avec confirmation) · clic droit : menu contextuel (création, départ / arrivée / étape, autour d'ici, mesures, partage).

## Fonctionnalités

- **Carte** : zone jouable 92 + Saint-Denis + Saint-Ouen (Paris hors zone), fondu progressif, POI réels, repères 3D cliquables, maquettes 3D facultatives sur les lieux et havres (Créer › Bâtiment 3D, ou section « Bâtiment 3D » d'une fiche en mode Édition : catalogue, dimensions, orientation, aperçu en direct avant enregistrement).
- **Pings** : pictogrammes au choix (`src/domain/icons.ts`), palette de couleurs, taille ; lieux ronds, havres carrés, plots en losange.
- **Lieux, havres, territoires, plots** : fiches complètes, liens par IDs, ping et zone de plot, Traditions, attitude du territoire, coteries (propriétaire de havre, appartenance des personnages).
- **Calques** : ordre de superposition par zone (premier plan, arrière-plan, monter, descendre), groupe « plots au-dessus / territoires au-dessus », recliquer sélectionne la zone du dessous.
- **Filtres combinables** (CDC §13) : type de ping, connaissance, territoire, plot, propriétaire, faction, Tradition active, statut, origine.
- **Sélection multiple** : Maj+clic ou rectangle (Maj+glisser), puis cadrer, lier à un plot ou mettre à la corbeille en une fois.
- **Adresses réelles** : recherche via la Base Adresse Nationale (api-adresse.data.gouv.fr), limitée aux alentours de la zone ; marqueur temporaire, clic droit pour y créer un lieu.
- **Fiches** : formulaires en sections repliables (Identité, Liens, Apparence, Bâtiment 3D, Notes), état mémorisé.
- **Accueil** : une chronique vide propose les premiers gestes (territoire, lieu, personnages, import).
- **Outils** : mesure de distance et de surface, « Autour d'ici » (rayon), favoris, marqueur temporaire partageable, lien vers une vue, copie lat/long.
- **Souterrains** : réseau public importé (lignes de métro, RER, Transilien et tram identifiées via IDFM : pastilles aux couleurs officielles, recherche par ligne, mention dans le trajet souterrain), vue Souterrain, praticabilité et discrétion, filtre Exploitable / Discret, trajet souterrain.
- **Synchronisation à deux** : temps réel, contrôle de version contre l'écrasement, verrou indicatif « en cours de modification sur un autre poste » (collection `editLocks`, expiration après 60 s sans activité).
- **Paramètres partagés** (`appConfig/main`) : fondu, densité d'information, style des souterrains, opacité des nouveaux territoires.
- **Sécurité des données** : corbeille, modifications récentes, annuler / rétablir, export / import JSON, sauvegarde automatique quotidienne dans le navigateur (7 conservées, IndexedDB).

### Code d'accès (protection légère)

Définir `VITE_ACCESS_CODE_SHA256` avec l'empreinte du code :

```bash
printf '%s' 'mon-code' | sha256sum
```

Un écran demande alors le code à la première visite. **Ce n'est pas une sécurité forte** : le code est vérifié dans le navigateur et les règles Firestore restent ouvertes. Pour des données sensibles en production, ajouter Firebase Authentication (connexion anonyme ou par lien) et des règles `request.auth != null`, ou App Check.

## Reste à faire

- Environnements : la mécanique est en place, il reste à **créer le projet Firebase de développement** et remplir `.env.development.local` / `.env.production.local`.

## Documents de cadrage

- `VTM_MAP_SPEC.md` : cahier des charges fonctionnel
- `VTM_MAP_DESIGN.md` : direction artistique et UX
- `VTM_MAP_TECH.md` : architecture technique recommandée
- `VTM_MAP_DATA_MODEL.md` : modèle de données Firestore
- `CODEX_INSTRUCTIONS.md` / `CODEX_START_PROMPT.md` : consignes de développement
- `PUBLIC_DATA_SOURCES.md` : sources publiques à exploiter
