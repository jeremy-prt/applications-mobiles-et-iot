# Ce que le téléphone garde, et ce qu'il ose encore affirmer

## Contexte

J2 demande que les dernières données restent consultables sans réseau, que l'écran indique leur
ancienneté, et qu'il retrouve un état cohérent à la reprise. En J1, l'application ne gardait
rien : sans réseau elle affichait une erreur plein écran à la place des valeurs.

## Options envisagées

Pour le stockage : la persistance de TanStack Query sur AsyncStorage, une base locale
`expo-sqlite`, ou rien. Pour la fraîcheur : réutiliser le champ `is_stale` de la réponse, le
recalculer sur le téléphone, ou distinguer les deux situations.

## Choix retenu

Le cache de TanStack Query est écrit sur AsyncStorage, gardé 24 heures. La fraîcheur affichée
combine ce que le serveur a dit et l'âge de la réponse. Une horloge locale redessine l'écran
chaque seconde. NetInfo et `AppState` pilotent la reprise, sur téléphone seulement.

## Pourquoi AsyncStorage et pas une base locale

`expo-sqlite` demanderait un schéma, des requêtes et des migrations pour redire ce que TanStack
Query sait déjà : une réponse, sa clé, sa date.

Par défaut, seules les requêtes en succès sont écrites sur le disque. Ouvrir l'application une
fois sans réseau vidait donc le cache, au moment exact où il sert. On écrit maintenant toute
requête qui a des données.

## Pourquoi la fraîcheur ne se résume pas à `is_stale`

`is_stale` est calculé par le backend quand il répond, en comparant l'heure du capteur à la
sienne. C'est la bonne information tant que la réponse est récente, et c'est pour ça qu'elle
est calculée là-bas : l'horloge du téléphone peut différer, 3 secondes d'écart mesurées entre
le Mac et le conteneur.

Une réponse gardée en cache fige ce verdict : vieille de dix minutes, elle continuait d'annoncer
« donnée récente », ce que R07 interdit. On ne recalcule pas pour autant sur le téléphone, sinon
on retombe sur l'écart des horloges. On dit ce qu'on sait, en trois états : la mesure était
ancienne, elle était récente, ou la réponse a trop vieilli pour l'affirmer.

## Pourquoi une horloge locale

« Il y a 12 s » dépend du temps qui passe, pas des données reçues. Sans horloge l'affichage se
fige, et définitivement quand il n'y a plus de réponse : l'écran annonçait « il y a 11 s »
depuis plus d'une minute. Les fonctions de calcul reçoivent l'heure au lieu de la lire, ce qui
les rend testables.

## Pourquoi NetInfo et `AppState` seulement sur téléphone

TanStack Query surveille les évènements `online` et le retour d'onglet du navigateur, qui
n'existent pas sur un téléphone. NetInfo et `AppState` les remplacent. Sur le web ces évènements
existent, alors que NetInfo y répond en sondant une adresse : quand ce sondage échoue,
l'application se déclare hors ligne pendant que le serveur répond. Les deux branchements sont
donc coupés sur le web.

On regarde `isConnected` et non `isInternetReachable` : le backend est sur le réseau local, donc
un Wi-Fi sans accès à Internet nous convient.

## Ce que ça coûte

Quatre dépendances de plus, et un cache sur le disque du téléphone, donc des données de capteurs
qui survivent à la fermeture de l'application.

Une subtilité à connaître pour lire le code : une requête que TanStack Query met en pause parce
qu'il se croit hors ligne n'est pas une erreur, `isError` reste faux. L'écran a d'abord manqué
le cas et n'affichait aucun bandeau ; il regarde maintenant `fetchStatus` et `failureCount`.

## Conséquence

Le `gcTime` du client est aligné sur la durée de conservation sur disque. Plus court, le cache
serait jeté de la mémoire avant d'être relu.

Le rafraîchissement périodique s'arrête quand l'application n'est pas au premier plan, et
reprend au retour par `AppState`. À savoir en recette.

## Aide de l'IA

L'IA a proposé `networkMode: 'always'` pour que l'application reparte seule après une coupure, en
avançant qu'une requête en pause ne reprend jamais. Annulé : l'observation qui servait de preuve
venait d'un onglet caché, où le rafraîchissement périodique est suspendu de toute façon.

Elle a écrit un écran qui affichait « chargement » quand l'application était hors ligne sans
rien en cache. Comme la requête est mise en pause et ne se termine jamais, l'écran tournait
indéfiniment, ce que R06 interdit.

Elle a aussi écrit un écran d'historique qui annonçait « l'historique se remplit à mesure que le
job tourne » dès qu'il n'y avait aucun point. Sur un poste qui faisait tourner l'ancien backend,
l'écran a donc désigné le job alors que la route n'existait pas. Les trois causes sont
maintenant distinguées.

## Vérification

`cd mobile && npm test` : 20 tests passent sans téléphone ni serveur, dont ceux qui fixent les
trois cas de fraîcheur et les quatre états du lien avec le serveur, y compris la requête en
pause qui n'est pas une erreur.

Comportement vérifié sur l'iPhone en mode Avion, capture `docs/preuves/J2-hors-ligne.png` :

| Situation | Observé |
|---|---|
| Mode Avion activé | « Téléphone hors ligne », mesures et historique toujours affichés |
| La même, 37 secondes après | « Reçues le 16/09 10:39, il y a 37 s », et cette durée avance |
| Ligne Fraîcheur | « Fraîcheur inconnue, données du cache » |
| Serveur coupé au lieu du téléphone | « Serveur injoignable », et le cache survit à un rechargement complet |

## Limite

La reprise après retour du réseau et après passage en arrière-plan n'a pas été vérifiée : couper
le réseau du téléphone coupe aussi son lien avec le serveur de développement d'Expo. Elle a été
observée en rétablissant le serveur, ce qui exerce le même chemin de code sans exercer NetInfo.
Fermer l'application et la rouvrir sans réseau n'est pas testable non plus avec Expo Go, qui
recharge le code depuis ce serveur au lancement.

Le cache est écrit en clair sur le disque du téléphone. Acceptable pour des mesures de
température, à revoir quand l'application gardera un jeton de session, qui ira dans
`expo-secure-store`.
