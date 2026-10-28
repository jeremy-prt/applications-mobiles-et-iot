# Affichage des alertes sur le mobile

## Problème

Le téléphone doit montrer qu'une salle est en alerte, puis revenue à la normale. Qui décide du
seuil, d'où vient l'information, et comment ne pas dépendre de la couleur seule ?

## Options

- Le mobile compare lui-même le CO2 à 1000 ppm.
- Le mobile appelle `GET /alerts` sur chaque écran, en plus de `GET /rooms`.
- `GET /rooms` inclut l'alerte active, et `GET /alerts` sert seulement à l'historique d'un
  capteur.

## Choix et compromis

L'alerte active arrive dans le champ `alert` de `GET /rooms`. Les trois écrans lisent cette
réponse sous une seule clé de cache, donc ils ne se contredisent pas, et l'alerte suit le cache
hors ligne. Le détail d'un capteur appelle aussi `GET /alerts` pour ses 5 dernières alertes,
car une alerte fermée disparaît de `/rooms`.

Le mobile ne compare jamais une valeur au seuil : avec l'hystérésis, il contredirait le backend
entre 800 et 1000 ppm.

Un bandeau sur l'accueil compte les salles en alerte. Chaque carte porte « Alerte CO2 » et une
bordure. Le détail affiche l'ouverture, le pic et « Retour à la normale sous 800 ppm », pour
que l'alerte ne semble pas bloquée. Les couleurs `error` et `errorContainer` de Material 3 sont
contrastées en clair et en sombre, et doublées par le texte. Les blocs ont le rôle `alert`,
annoncé par iOS au lecteur d'écran.

Coût : `GET /rooms` grossit d'un objet par alerte active, et une alerte apparaît jusqu'à 15
secondes après son ouverture.

## Aide de l'IA

L'IA a proposé de comparer le CO2 au seuil sur le téléphone pour colorer la valeur. Refusé à
cause de l'hystérésis.

## Vérification

`mobile/src/lib/alertes.test.ts` teste le décompte, le résumé, la condition de retour et les
libellés en cours et terminée. Captures de la version web :
`docs/preuves/J5-salles-en-alerte.png`, `J5-alerte-en-cours.png` et
`J5-retour-a-la-normale.png`.

```sh
cd mobile && npm test
```

## Limite

Le rendu n'a été vu que dans un navigateur à la taille d'un téléphone, pas sur l'iPhone.

Ce qui ferait changer d'avis : devoir prévenir application fermée. Il faudrait une notification
poussée par le backend.
