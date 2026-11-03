# Prompt de demarrage Codex

Tu vas initialiser le projet VTM Map.

Lis entierement avant de coder :
- `CODEX_INSTRUCTIONS.md`
- `VTM_MAP_SPEC.md`
- `VTM_MAP_DESIGN.md`
- `VTM_MAP_TECH.md`
- `VTM_MAP_DATA_MODEL.md`
- `PUBLIC_DATA_SOURCES.md`

Objectif : construire progressivement l'application complete decrite dans le CDC, sans faire une maquette jetable.

Commence uniquement par la fondation technique et le premier increment fonctionnel :

1. Creer un projet React + TypeScript + Vite propre.
2. Configurer ESLint/Prettier et TypeScript strict.
3. Installer MapLibre GL JS et Firebase.
4. Mettre en place la structure de dossiers recommandee.
5. Creer une vue principale avec :
   - carte plein ecran ;
   - barre de navigation minimale ;
   - panneau gauche repliable ;
   - panneau droit repliable ;
   - petite barre d'outils flottante ;
   - bouton consultation/edition.
6. Integrer un fond de carte MapLibre sombre avec routes, batiments et POI reels visibles selon le zoom.
7. Centrer la carte par defaut sur le 92 / Paris avec une emprise qui inclut Saint-Ouen et Saint-Denis.
8. Preparer l'architecture des couches sans encore implementer tout le CDC.
9. Creer les types TypeScript principaux du domaine a partir de `VTM_MAP_DATA_MODEL.md`.
10. Preparer la couche Firebase mais permettre le lancement local meme si Firebase n'est pas encore configure, avec des donnees mock clairement isolees.

Contraintes :
- ne pas implementer les personnages, plots, souterrains et itineraires complets dans cette premiere passe ;
- ne pas supprimer ces fonctionnalites de l'architecture ;
- ne pas coder de fausses fonctions complexes juste pour simuler qu'elles existent ;
- l'interface initiale doit deja etre propre visuellement et proche de la direction artistique ;
- la carte doit occuper presque tout l'ecran.

A la fin :
- donne un resume des fichiers crees ;
- explique comment lancer le projet ;
- liste les variables d'environnement attendues ;
- indique le prochain increment recommande.
