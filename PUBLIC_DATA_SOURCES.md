# bratMap - Sources publiques a exploiter

## Ile-de-France Mobilites Open Data

Utiliser pour :
- gares et stations ;
- lignes metro / RER / reseaux utiles ;
- entrees et sorties de stations lorsque disponibles ;
- referentiels transport.

Source principale : portail Open Data Ile-de-France Mobilites.

## OpenStreetMap

Utiliser pour :
- fond de carte ;
- routes ;
- batiments ;
- POI reels ;
- certaines infrastructures ferrees et souterraines publiees ;
- geometries utiles.

Important : `layer=*` ne correspond pas directement a une profondeur physique. Ne pas convertir automatiquement layer=-3 en niveau -3 sans normalisation.

## Paris Open Data

Utiliser pour certains jeux de donnees publics utiles a Paris, par exemple ouvrages et informations de voirie lorsque pertinentes.

## Regles d'import

1. Ne recuperer que la zone utile au projet.
2. Normaliser les formats vers le modele interne.
3. Conserver la source et l'identifiant externe.
4. Ne jamais ecraser automatiquement les modifications manuelles.
5. Garder les donnees reelles separees des donnees de chronique.
6. Ne pas cartographier ou enrichir des acces techniques sensibles/non publics.
