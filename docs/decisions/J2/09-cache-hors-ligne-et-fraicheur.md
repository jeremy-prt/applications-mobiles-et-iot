# Cache hors ligne et fraîcheur affichée

## Problème

J2 demande que les dernières données restent consultables sans réseau, que l'écran indique leur
ancienneté, et qu'il retrouve un état cohérent à la reprise. En J1, l'application ne gardait
rien et affichait une erreur plein écran à la place des valeurs.

## Options

Pour le stockage : la persistance de TanStack Query sur AsyncStorage, une base locale
`expo-sqlite`, ou rien. Pour la fraîcheur : réutiliser le champ `is_stale` de la réponse, le
recalculer sur le téléphone, ou distinguer les deux situations.

## Choix et compromis

Le cache de TanStack Query est écrit sur AsyncStorage et gardé 24 heures. `expo-sqlite`
demanderait un schéma, des requêtes et des migrations pour redire ce qu'il sait déjà, une
réponse, sa clé et sa date.

`is_stale` est calculé par le backend, qui compare l'heure du capteur à la sienne. Le téléphone
ne peut pas refaire ce calcul, son horloge diffère, 3 secondes d'écart mesurées entre le Mac et
le conteneur. Une réponse gardée en cache fige pourtant ce verdict, et vieille de dix minutes
elle annonçait encore « donnée récente », ce que R07 interdit. L'écran affiche donc trois états :
la mesure était ancienne, elle était récente, ou la réponse a trop vieilli pour l'affirmer.

Trois défauts sont sortis des essais. Seules les requêtes en succès étaient écrites sur le
disque, donc ouvrir l'application une fois sans réseau vidait le cache. On écrit maintenant
toute requête qui a des données.

L'ancienneté se figeait faute d'horloge, et l'écran a annoncé « il y a 11 s » pendant plus d'une
minute. Une horloge locale le redessine chaque seconde, et les fonctions de calcul reçoivent
l'heure au lieu de la lire, ce qui les rend testables.

Une requête que TanStack Query met en pause parce qu'il se croit hors ligne n'est pas une
erreur, `isError` reste faux. L'écran n'affichait donc aucun bandeau, il regarde maintenant
`fetchStatus` et `failureCount`.

NetInfo et `AppState` remplacent sur téléphone les évènements `online` du navigateur, et sont
coupés sur le web où NetInfo nous déclare hors ligne pendant que le serveur répond. Ça coûte
quatre dépendances, un cache en clair sur le disque, et un rafraîchissement périodique qui
s'arrête hors premier plan, à savoir en recette.

## Aide de l'IA

L'IA a proposé `networkMode: 'always'`, en avançant qu'une requête en pause ne reprend jamais.
Annulé, l'observation qui servait de preuve venait d'un onglet caché. Elle a aussi écrit un
écran qui affichait « chargement » hors ligne sans rien en cache, donc indéfiniment puisque la
requête est en pause, ce que R06 interdit. Son écran d'historique désignait le job dès qu'il n'y
avait aucun point, y compris sur un poste où la route n'existait pas.

## Vérification

`cd mobile && npm test` : 20 tests passent sans téléphone ni serveur, dont ceux qui fixent les
trois cas de fraîcheur et les quatre états du lien avec le serveur.

Sur l'iPhone en mode Avion, capture `docs/preuves/J2-hors-ligne.png` :

| Situation | Observé |
|---|---|
| Mode Avion activé | « Téléphone hors ligne », mesures et historique toujours affichés |
| La même, 37 secondes après | « Reçues le 16/09 10:39, il y a 37 s », et cette durée avance |
| Ligne Fraîcheur | « Fraîcheur inconnue, données du cache » |
| Serveur coupé au lieu du téléphone | « Serveur injoignable », et le cache survit à un rechargement complet |

## Limite

La reprise après retour du réseau et après passage en arrière-plan n'a pas été exercée, car
couper le réseau du téléphone coupe aussi son lien avec le serveur de développement d'Expo. On
l'a observée en rétablissant le serveur, ce qui suit le même chemin de code sans exercer NetInfo.
Rouvrir l'application sans réseau n'est pas testable non plus, Expo Go recharge le code depuis ce
serveur au lancement.

Le cache est écrit en clair sur le disque du téléphone, à revoir quand l'application gardera un
jeton de session, qui ira dans `expo-secure-store`.
