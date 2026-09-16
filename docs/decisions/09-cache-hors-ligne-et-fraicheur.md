# Ce que le téléphone garde, et ce qu'il ose encore affirmer

## Contexte

J2 demande que les dernières données restent consultables sans réseau, que l'écran indique
leur ancienneté, et qu'il retrouve un état cohérent à la reprise. En J1, l'application ne
gardait rien : sans réseau elle affichait une erreur plein écran à la place des valeurs.

Deux questions se cachent derrière. Que garde-t-on, et où. Et surtout, une fois qu'on montre
des valeurs gardées, qu'a-t-on encore le droit d'en dire.

## Options envisagées

Pour le stockage : la persistance de TanStack Query sur AsyncStorage, une base locale
`expo-sqlite`, ou rien.

Pour la fraîcheur : réutiliser le champ `is_stale` de la réponse, le recalculer sur le
téléphone, ou distinguer les deux situations.

## Choix retenu

Le cache de TanStack Query est écrit sur AsyncStorage, gardé 24 heures. La fraîcheur affichée
combine ce que le serveur a dit et l'âge de la réponse. Une horloge locale redessine l'écran
chaque seconde. NetInfo et `AppState` pilotent la reprise, sur téléphone seulement.

## Pourquoi AsyncStorage et pas une base locale

`expo-sqlite` demanderait un schéma, des requêtes et des migrations pour redire ce que
TanStack Query sait déjà : une réponse, sa clé, sa date. Le cache existe, il suffit de
l'écrire sur le disque.

Le piège est ailleurs, et il nous est tombé dessus : par défaut, seules les requêtes en succès
sont écrites sur le disque. Une requête qui a des données mais dont le dernier appel a échoué
est donc effacée. Autrement dit, ouvrir l'application une fois sans réseau vidait le cache, au
moment exact où il servait. On écrit maintenant toute requête qui a des données, quel que soit
l'état du dernier appel.

## Pourquoi la fraîcheur ne se résume pas à `is_stale`

`is_stale` est calculé par le backend au moment où il répond, en comparant l'heure du capteur
à la sienne. C'est la bonne information tant que la réponse est récente, et c'est pour ça
qu'elle est calculée là-bas : l'horloge du téléphone peut différer. Nous avons mesuré 3
secondes d'écart entre le Mac et le conteneur.

Mais une réponse gardée en cache fige ce verdict. Une réponse vieille de dix minutes
continuait d'annoncer « donnée récente ». C'est exactement ce que le scénario R07 interdit.

On ne recalcule pas la fraîcheur sur le téléphone pour autant, sinon on retombe sur l'écart
des horloges. On dit ce qu'on sait, en trois états : la mesure était ancienne, elle était
récente, ou la réponse a trop vieilli pour qu'on puisse encore l'affirmer.

## Pourquoi une horloge locale

« Il y a 12 s » ne dépend pas des données reçues, mais du temps qui passe. Sans horloge,
l'affichage se fige entre deux réponses, et définitivement quand il n'y a plus de réponse. On
l'a observé : l'écran annonçait « il y a 11 s » depuis plus d'une minute. L'ancienneté est
donc pilotée par un compteur d'une seconde, et les fonctions de calcul reçoivent l'heure au
lieu de la lire, ce qui les rend testables.

## Pourquoi NetInfo et `AppState` seulement sur téléphone

TanStack Query a été écrit pour le navigateur : il surveille les évènements `online` et le
retour d'onglet, qui n'existent pas sur un téléphone. NetInfo et `AppState` les remplacent.

Sur le web en revanche, ces évènements existent et fonctionnent, alors que NetInfo y répond en
sondant une adresse : quand ce sondage échoue, l'application se déclare hors ligne pendant que
le serveur répond. Nous avons vu le cas. Les deux branchements sont donc coupés sur le web.

On regarde `isConnected` et non `isInternetReachable` : le backend est sur le réseau local,
donc un Wi-Fi sans accès à Internet nous convient parfaitement.

## Ce que ça coûte

Quatre dépendances de plus. Un cache sur le disque du téléphone, donc des données de capteurs
qui survivent à la fermeture de l'application, ce qui est à mentionner dans le dossier
sécurité même si aucune n'est personnelle.

Et une subtilité qu'il faut connaître pour lire le code : une requête que TanStack Query met en
pause parce qu'il se croit hors ligne n'est pas une erreur. `isError` reste faux. L'écran a
d'abord manqué le cas et n'affichait aucun bandeau ; il regarde maintenant `fetchStatus` et
`failureCount`, pas seulement `isError`.

## Conséquence

Le `gcTime` du client est aligné sur la durée de conservation sur disque. Plus court, le cache
serait jeté de la mémoire avant d'être relu.

Le rafraîchissement périodique s'arrête quand l'application n'est pas au premier plan. C'est
voulu et c'est le comportement par défaut de la bibliothèque, mais il faut le savoir en
recette : un écran laissé en arrière-plan ne se met pas à jour tout seul, il se met à jour au
retour, par `AppState`.

## Aide de l'IA

L'IA a proposé de forcer `networkMode: 'always'` pour que l'application reparte toute seule
après une coupure. La justification avancée était qu'une requête en pause ne reprend jamais.
Retiré : l'observation qui servait de preuve venait d'un test fait dans un navigateur dont
l'onglet était caché, où le rafraîchissement périodique est suspendu de toute façon. Le
diagnostic était faux, donc le changement a été annulé. La reprise repose sur NetInfo, ce qui
est le rôle pour lequel il a été ajouté.

Elle a aussi écrit un écran d'historique qui affichait « l'historique se remplit à mesure que
le job de consolidation tourne » dès qu'il n'y avait aucun point, sans regarder pourquoi.
Quand l'appel échouait, l'écran désignait donc le job alors que le problème était le réseau.
Le cas s'est produit en démonstration et a envoyé chercher au mauvais endroit. Les trois
causes sont maintenant distinguées.

Elle a aussi écrit un premier écran qui affichait « chargement » quand l'application était
hors ligne sans rien en cache. Comme la requête est mise en pause et ne se termine jamais,
l'écran tournait indéfiniment, ce que R06 interdit explicitement. Corrigé par un état hors
ligne distinct.

## Vérification

Tests automatisés sur les fonctions de décision, sans téléphone ni serveur :

```sh
cd mobile && npm test
```

20 tests passent, dont ceux qui fixent les trois cas de fraîcheur et les quatre états du lien
avec le serveur, y compris la requête en pause qui n'est pas une erreur.

Comportement vérifié sur l'application en marche, en coupant puis en rétablissant le serveur :

| Situation | Attendu | Observé |
|---|---|---|
| Serveur coupé | Les valeurs restent, un bandeau les date | « Serveur injoignable. Reçues le 16/09 10:15 » |
| Serveur coupé, 1 min plus tard | L'ancienneté avance | « il y a 1 min », puis 2, puis 3 |
| Serveur coupé | La fraîcheur n'est plus affirmée | « Fraîcheur inconnue, données du cache » |
| Application rechargée, serveur toujours coupé | Le cache survit | Les trois salles s'affichent avec leur date |
| Serveur rétabli | Retour aux valeurs en direct | Bandeau disparu, mesures à jour |

## Limite

La reprise après coupure du réseau du téléphone, et après passage en arrière-plan, n'a pas pu
être vérifiée ici : elle passe par NetInfo et `AppState`, qui n'existent que sur un appareil.
Elle reste à exercer sur l'iPhone avec Expo Go, c'est la dernière ligne de la recette R05 et
R06.

Le cache est écrit en clair sur le disque du téléphone. Acceptable pour des mesures de
température, à revoir le jour où l'application gardera un jeton de session, qui lui ira dans
`expo-secure-store`.
