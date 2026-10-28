# Affichage des alertes sur le mobile

## Problème

Le téléphone doit montrer qu'une salle est en alerte, puis qu'elle est revenue à la normale,
sur plusieurs salles à la fois. Il faut décider d'où vient l'information, qui décide du seuil,
et comment la rendre lisible sans se fier à la seule couleur.

## Options

Le mobile compare lui-même le CO2 reçu à 1000 ppm.

Le mobile interroge `GET /alerts` sur chaque écran, en plus de `GET /rooms`.

Le backend ajoute l'alerte active à chaque objet de `GET /rooms`, et le mobile n'appelle
`GET /alerts` que pour l'historique d'un capteur.

## Choix et compromis

L'alerte active arrive avec `GET /rooms`, dans le champ `alert` de chaque objet. Les trois
écrans lisent déjà cette réponse sous une seule clé de cache : l'accueil, la salle et le
capteur ne peuvent donc pas se contredire, et l'alerte suit le cache hors ligne avec la date
de la réponse. Le détail d'un capteur appelle en plus `GET /alerts` pour ses 5 dernières
alertes. C'est là qu'on voit le retour à la normale, car une alerte fermée disparaît de
`/rooms`.

Le mobile ne compare jamais une valeur à un seuil. Avec l'hystérésis, il aurait un autre avis
que le backend entre 800 et 1000 ppm.

L'accueil compte les salles en alerte dans un bandeau. Chaque carte de salle porte le texte
« Alerte CO2 » et une bordure. Le détail affiche l'ouverture, le pic et la condition de
retour, « Retour à la normale sous 800 ppm », pour que l'alerte ne paraisse pas bloquée
entre les deux seuils. Les couleurs sont `error` et `errorContainer` du thème Material 3,
dont le contraste avec leur fond est garanti en clair comme en sombre. Le texte dit la même
chose que la couleur. Les blocs portent le rôle `alert`, et iOS annonce une nouvelle alerte
au lecteur d'écran.

Ce que ça coûte : `GET /rooms` grossit d'un objet par alerte active. Une alerte est vue au
rafraîchissement suivant, jusqu'à 15 secondes après son ouverture par le backend.

## Aide de l'IA

L'IA a proposé de comparer le CO2 au seuil sur le téléphone, pour colorer la valeur. On l'a
refusé, pour la raison de l'hystérésis ci-dessus.

## Vérification

`mobile/src/lib/alertes.test.ts` : le décompte des salles en alerte, le résumé, la condition
de retour, et les libellés d'une alerte en cours et terminée. Le rendu est capturé sur la
version web de l'application, dans `docs/preuves/J5-salles-en-alerte.png`,
`J5-alerte-en-cours.png` et `J5-retour-a-la-normale.png`.

```sh
cd mobile && npm test
```

## Limite

Le rendu n'a pas été vu sur l'iPhone, seulement dans un navigateur à la taille d'un
téléphone. Ce qui ferait changer d'avis : un besoin d'être prévenu application fermée. Il
faudrait alors une notification poussée par le backend.
