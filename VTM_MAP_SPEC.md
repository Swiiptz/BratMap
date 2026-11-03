# bratMap - Cahier des charges fonctionnel

## 1. Vision

Application web cartographique pour une chronique Vampire: la Mascarade. La carte est le coeur du produit. Elle couvre principalement les Hauts-de-Seine (92), Paris, Saint-Denis et Saint-Ouen, avec une peripherie visible et un fade progressif dans les departements voisins plutot qu'une coupure nette.

L'application est utilisee par deux personnes via un lien. Pas de gestion de comptes, pas de roles complexes.

## 2. Zone cartographique

- Afficher integralement le 92 et Paris.
- Inclure Saint-Denis et Saint-Ouen.
- Les zones limitrophes restent visibles largement.
- Aucun bord administratif brutal.
- Fade progressif hors zone principale : baisse de contraste / saturation / luminosite.
- Zoom max jusqu'au batiment ou a l'entree precise.
- Zoom min : assez large pour voir la zone principale et sa peripherie utile, pas besoin de voir toute la France.

## 3. Fond de carte reel

Le fond de carte doit afficher :
- autoroutes et voies rapides ;
- grands axes routiers ;
- quais, boulevards, rues secondaires ;
- ponts ;
- voies ferrees ;
- gares et stations ;
- parcs et espaces verts ;
- batiments et equipements publics principaux ;
- points d'interet reels.

Les POI reels peuvent inclure : mairies, hopitaux, commissariats, centres commerciaux, musees, cimetieres, lieux culturels, stations-service, bars, restaurants, etc. Leur densite depend du niveau de zoom.

Prevoir un filtre `POI reels` pour les masquer rapidement.

## 4. Pings configurables

Les pings sont des elements de carte configurables selon leur type.

Types initiaux :
- lieu d'interet ;
- havre ;
- Elyseum ;
- acces souterrain ;
- ressource ;
- danger ;
- lieu de rencontre ;
- autre.

Configuration possible :
- icone ;
- couleur ;
- taille ;
- nom ;
- description ;
- niveau d'importance ;
- tags ;
- liens vers d'autres entites.

Les types de pings sont configurables depuis les parametres.

Les personnages ne sont pas des pings.

## 5. Lieux d'interet

Champs :
- nom ;
- type ;
- adresse ;
- description ;
- niveau d'importance ;
- niveau de connaissance ;
- tags ;
- territoire associe ;
- personnages associes ;
- plots associes ;
- notes ;
- source eventuelle.

Niveaux de connaissance indicatifs :
- inconnu ;
- rumeur ;
- repere ;
- connu ;
- bien documente.

## 6. Havres

Champs :
- nom ;
- adresse ;
- description ;
- proprietaire ;
- autres residents ;
- territoire associe ;
- niveau de securite ;
- etat ;
- tags ;
- plots associes ;
- notes.

Le proprietaire peut etre un personnage, plusieurs personnages, une coterie, ou inconnu.

## 7. Territoires

Les territoires sont des polygones dessines directement sur la carte.

Configuration :
- nom ;
- couleur ;
- couleur de bordure ;
- transparence ;
- remplissage ou contour uniquement ;
- description ;
- proprietaire / responsable ;
- faction eventuelle ;
- niveau d'importance ;
- notes.

Edition :
- deplacer les sommets ;
- ajouter/supprimer des sommets ;
- deplacer toute la zone ;
- masquer ;
- supprimer ;
- modifier l'apparence.

Les territoires ne donnent aucun bonus mecanique.

### Traditions rattachees

Les six Traditions existent comme bibliotheque globale. Chaque territoire peut activer seulement certaines Traditions.

Pour chaque Tradition active :
- activation/desactivation ;
- note locale facultative.

Exemple : Hospitalite active avec une regle locale specifique.

## 8. Plots

Gestion volontairement simple.

Champs :
- nom ;
- courte description ;
- statut ;
- importance facultative ;
- notes ;
- personnages associes ;
- lieux associes ;
- havres associes ;
- territoires associes ;
- elements souterrains associes.

Statuts :
- a venir ;
- actif ;
- en pause ;
- termine.

Representation cartographique :
- ping de plot ;
- zone de plot.

Fonction `Afficher ce plot` : filtre temporairement la carte pour ne montrer que les elements relies.

Pas de gestion de quetes, objectifs, sous-objectifs ou arbre complexe.

## 9. Personnages

Page dediee separee de la carte.

### Liste

Afficher au minimum :
- nom ;
- clan ;
- faction ;
- statut ;
- importance eventuelle ;
- lieu principal ;
- territoire associe.

Filtres : clan, faction, statut, territoire, influence, actif/disparu/mort/inconnu.

### Fiche personnage

Identite :
- nom ;
- surnom ;
- image facultative ;
- clan ;
- faction ;
- generation facultative ;
- statut ;
- description courte.

Disciplines : nom + niveau.

Competences : nom + niveau.

Capacites particulieres : nom + niveau facultatif.

Influences :
- nom ;
- domaine ;
- niveau ;
- lieu associe facultatif.

Liens :
- havre principal ;
- autres lieux ;
- territoires ;
- plots ;
- autres personnages.

Relations simples entre personnages : allie, ennemi, superieur, subordonne, dette, meme coterie, personnalise.

Bouton `Voir tout ce qui est lie a ce personnage` pour filtrer la carte.

## 10. Bibliotheques reutilisables

Disciplines, competences, capacites, clans, factions, domaines d'influence et autres referentiels doivent etre reutilisables.

Si `Animalisme` existe deja, l'autocompletion le propose automatiquement.

Eviter les doublons. Il reste possible d'ajouter un nouvel element absent de la base.

Disciplines et competences n'ont pas besoin d'une description obligatoire : seulement nom + niveau sur les personnages.

## 11. Souterrains

Couche cartographique specifique.

Representer :
- entrees/sorties ;
- stations ;
- gares ;
- tunnels ;
- galeries ;
- passages ;
- parkings/infrastructures pertinentes ;
- reseaux decouverts en jeu.

### Niveaux de profondeur simplifies

Peu de niveaux :
- 0 : surface ;
- -1 : peu profond ;
- -2 : intermediaire ;
- -3 : profond.

Le but est de regrouper ce qui est a peu pres au meme niveau, pas de reproduire chaque etage exact.

Une profondeur approximative en metres peut etre stockee si connue, sans creer un nouveau niveau.

### Acces souterrains

Champs :
- nom ;
- type ;
- niveau ;
- profondeur approx. facultative ;
- etat ;
- niveau de connaissance ;
- origine ;
- source ;
- segments connectes ;
- lieu associe ;
- territoire ;
- plots ;
- notes.

### Segments souterrains

Champs :
- nom facultatif ;
- type ;
- niveau ;
- profondeur approx. ;
- etat ;
- niveau de connaissance ;
- origine ;
- source ;
- noeud de depart ;
- noeud d'arrivee ;
- connexions ;
- plots ;
- notes.

Le reseau fonctionne comme un graphe de noeuds et segments.

Les changements verticaux peuvent etre representes comme connexions entre niveaux.

### Niveau de connaissance

Exemples : suppose, repere, confirme, partiellement explore, entierement cartographie.

Les passages supposes peuvent apparaitre en pointilles.

### Origine

- infrastructure publique ;
- ajout chronique ;
- decouverte en jeu.

Les sources publiques et les elements fictifs doivent etre distinguables.

## 12. Itineraires

Calcul entre :
- position libre ;
- lieu ;
- havre ;
- acces souterrain ;
- autre point enregistre.

Modes :
- Rapide ;
- Discret ;
- Souterrain.

### Rapide

Trajet le plus court / rapide selon le reseau disponible.

### Discret

Utilise uniquement les donnees narratives definies dans l'application :
- territoires hostiles ;
- zones dangereuses ;
- lieux signales ;
- passages connus comme surs ;
- souterrains connus.

Ne doit pas chercher a contourner des systemes de surveillance reels.

Afficher un risque narratif simple : faible, moyen, eleve, tres eleve.

### Souterrain

Utilise au maximum le reseau souterrain connu et les changements de niveau.

### Territoires traverses

Afficher :
- territoires traverses ;
- distance parcourue dans chacun ;
- traditions actives pertinentes.

### Resume

- distance totale ;
- duree estimee ;
- mode ;
- territoires traverses ;
- niveaux souterrains ;
- entrees/sorties ;
- zones a risque ;
- lieux importants proches.

Points intermediaires possibles.

Comparaison de plusieurs trajets souhaitable.

## 13. Couches et filtres

Couches principales :
- lieux ;
- havres ;
- territoires ;
- plots ;
- souterrains ;
- acces souterrains ;
- itineraires ;
- POI reels.

Chaque couche : afficher, masquer, attenuer.

Filtres selon les types : connaissance, territoire, plot, proprietaire, faction, Tradition, niveau souterrain, origine, statut, etc.

Filtres combinables.

Mode focus depuis une fiche : n'afficher que ce qui est relie a un personnage, plot, territoire ou reseau.

## 14. Recherche globale

Rechercher :
- lieux ;
- havres ;
- territoires ;
- plots ;
- personnages ;
- influences ;
- acces souterrains ;
- stations ;
- adresses reelles.

Suggestions instantanees et resultats regroupes par categorie.

Recherche aussi par clan, faction, domaine d'influence, proprietaire, territoire, plot, tag.

Navigation croisee cliquable entre toutes les fiches.

Historique de navigation simple.

## 15. Interface generale

Carte plein ecran comme vue principale.

Navigation :
- Carte ;
- Personnages ;
- Plots ;
- Parametres.

Vue carte :
- panneau gauche compact : recherche, couches, filtres, liste visible ;
- panneau droit : fiche de l'element selectionne ;
- barre d'actions flottante : ajouter ping, territoire, zone de plot, acces, souterrain, mesure, itineraire.

Panneaux totalement repliables.

Mode consultation / mode edition.

Mode plein ecran carte.

PC prioritaire, consultation mobile correcte.

## 16. Edition directe

Clic droit sur la carte :
- ajouter lieu ;
- ajouter havre ;
- ajouter acces ;
- territoire ;
- zone de plot ;
- mesurer ;
- depart ;
- arrivee ;
- marqueur temporaire.

Pings deplacables en mode edition.

Territoires/zones modifiables par sommets.

Souterrains traces point par point.

Annuler/retablir.

Duplication d'elements.

Sauvegarde apres validation des gros tracages.

## 17. Outils cartographiques

- mesure de distance ;
- mesure d'un trace multi-points ;
- mesure de surface ;
- copie latitude/longitude ;
- selection multiple ;
- afficher les relations ;
- recherche de proximite dans un rayon ;
- favoris ;
- marqueur temporaire non persistant.

Raccourcis :
- Echap ;
- Ctrl+Z ;
- Ctrl+Y ;
- F ;
- / ;
- Suppr avec confirmation en mode edition.

## 18. Experience de carte

A faible zoom : grands axes, communes, territoires, elements importants.

A zoom intermediaire : rues principales, gares, havres, davantage de lieux.

A fort zoom : petites rues, batiments, entrees precises, tous les pings.

Regroupement des pings proches (clustering).

Labels adaptes au zoom.

Survol PC : infobulle courte.

Clic : selection + panneau droit.

Gestion propre des elements superposes.

Transitions courtes et fluides.

## 19. Historique et securite contre les erreurs

Chaque element : date de creation, date de derniere modification.

Vue `Modifications recentes` simple.

Ctrl+Z pour actions cartographiques importantes.

Confirmation pour suppressions importantes.

Corbeille simple avec restauration avant suppression definitive.

Etat de sauvegarde visible : Enregistre / Sauvegarde / Erreur.

## 20. Parametres

Configurer :
- types de pings ;
- icones/couleurs/taille par defaut ;
- disciplines ;
- competences ;
- capacites ;
- domaines d'influence ;
- traditions ;
- factions ;
- clans ;
- statuts personnages ;
- statuts plots ;
- transparence territoires ;
- intensite du fade ;
- densite des informations ;
- style souterrain.

Import/export de la configuration avec les sauvegardes.

## 21. Synchronisation a deux

Les deux utilisateurs voient les changements sans rechargement complet.

Indication simple lorsqu'un element a ete mis a jour.

Eviter l'ecrasement silencieux si deux personnes modifient le meme element.

Pour les gros tracages, signaler qu'un element est deja en cours d'edition.

Liens partageables vers : lieu, havre, territoire, plot, personnage, position carte.

Marqueur temporaire partageable.

## 22. Stockage et acces

Pas de comptes utilisateurs.

Acces via URL privee et protection legere possible : mot de passe global/code d'acces.

Firebase/Firestore pour :
- stockage ;
- synchro temps reel ;
- configuration ;
- historique leger.

Export JSON complet et import/restauration.

Sauvegardes periodiques.

Environnements dev et production separes.

## 23. Donnees initiales

Precharger :
- clans ;
- factions ;
- six Traditions ;
- disciplines courantes ;
- statuts ;
- domaines d'influence ;
- types de pings ;
- fond de carte ;
- transports publics pertinents ;
- stations/gares/acces ;
- infrastructures souterraines publiques suffisamment documentees.

Les donnees propres a la chronique restent ajoutees manuellement.
