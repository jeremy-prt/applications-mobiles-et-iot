# Commande sans réponse et délai de confirmation

## Problème

Une commande publiée peut ne jamais recevoir de résultat : l'objet ignore les commandes avec
l'incident `no-response`, ou le résultat se perd. Il peut aussi arriver en retard. Il faut
décider quand on arrête d'attendre, quel statut on affiche, et ce qu'on fait d'un résultat
qui arrive après.

## Options

Passer la commande en `failed` après un délai.

Passer la commande en `unknown` après un délai.

Attendre sans limite, la commande reste `pending`.

Pour le délai lui-même : un minuteur en mémoire par commande, ou un contrôle en base fait par
le job de consolidation à chaque passage.

## Choix et compromis

Après 15 secondes sans résultat, la commande passe en `unknown`. Sans réponse, on ne sait pas
si l'objet a agi ou si seul son résultat s'est perdu. Écrire `failed` affirmerait une chose
qu'on ignore. Les 15 secondes dépassent
l'expiration de 10 secondes envoyée à l'objet : passé ce délai, l'objet refuse d'exécuter,
donc il ne peut plus agir après notre abandon.

Le contrôle est fait par le job, sur la date de demande en base. Un redémarrage du backend
ne perd donc aucune attente, là où un minuteur en mémoire disparaîtrait. Un résultat arrivé
après le délai est quand même appliqué, avec `late` à vrai.

Les résultats passent par la zone brute et le job, comme les mesures. Ils sont gardés tels
qu'ils sont arrivés, et validés au même endroit. Dans un passage, le job applique les
résultats avant d'abandonner les commandes, pour ne pas abandonner une commande dont la
réponse est déjà là.

Ce que ça coûte : le job passe toutes les 5 secondes, donc un résultat devient visible 0 à
5 secondes après sa réception, et `unknown` tombe entre 15 et 20 secondes. Pour l'utilisateur,
`unknown` ne dit pas quoi faire. L'état réel de la ventilation reste lisible sur l'écran.

## Aide de l'IA

L'IA a codé à partir de nos statuts et de nos délais. Le suivi du mobile s'arrêtait d'abord à
15 secondes, la même valeur que le backend. Mais le backend tranche au rythme de son job,
donc jusqu'à 20 secondes. Le mobile aurait arrêté de suivre une commande encore `pending`.
On a porté le plafond du mobile à 30 secondes.

## Vérification

Avec `incident sensor-001 no-response`, une commande envoyée reste `pending` à 5, 10 et 15
secondes, et vaut `unknown` à 20 secondes. Les traces donnent `commande_acceptee` à 12:06:04.775,
`commande_publiee` à 12:06:04.777, puis `commande_sans_reponse` avec `reason` `delai_depasse`
à 12:06:24.701.

Un résultat publié à la main après coup passe la commande en `executed` avec `late` à vrai. Le
même résultat rejoué donne une trace `commande_doublon` et ne change rien. Un `command_id`
inconnu donne `resultat_rejete` avec `reason` `commande_inconnue`. Les tests de
`backend/src/domain/commandes.test.ts` couvrent le cas d'un résultat reçu après le délai
alors que le job n'a pas encore abandonné la commande.

## Limite

Si le broker est coupé pendant un POST, la réponse part après 2 secondes sans `published_at`.
La commande finit en `unknown` si rien ne revient. Le refus par l'objet, statut `rejected`,
n'a pas pu être provoqué en réel, car le backend envoie toujours une expiration valide. Il
n'est testé qu'en unitaire.

Ce qui ferait changer d'avis : si le délai de 0 à 5 secondes gênait à l'usage. On
déclencherait alors un passage du job dès l'arrivée d'un résultat.
