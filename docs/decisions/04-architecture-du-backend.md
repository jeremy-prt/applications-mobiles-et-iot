# Architecture du backend : en couches, avec un noyau métier isolé

## Contexte

Le backend a deux façons d'être sollicité, et elles n'ont rien à voir.

D'un côté il reçoit des événements qu'il n'a pas demandés : les messages MQTT arrivent tout
seuls, en continu, et il faut les traiter au fil de l'eau. De l'autre il répond à des
requêtes du mobile, une question suivie d'une réponse.

Les deux doivent appliquer les mêmes règles. Le chemin MQTT décide si une mesure est un
doublon et si elle doit remplacer l'état courant. Le chemin HTTP décide si une mesure
affichée est encore fraîche, avec le même seuil. Envoyer une commande part du HTTP et se
termine par un message MQTT.

## Options envisagées

Architecture en couches avec noyau métier isolé, architecture hexagonale, CQRS,
microservices.

## Choix retenu

Une architecture en couches, avec les règles métier isolées dans leur propre couche.

```
backend/src/
  schemas/    schémas Zod : le format des messages et des requêtes
  domain/     les règles : doublon, ordre des mesures, fraîcheur, commandes, alertes
  db/         requêtes SQL et migrations
  mqtt/       connexion au broker, abonnements, publication des commandes
  http/       routes Fastify
```

La règle de dépendance : `mqtt/` et `http/` appellent `domain/`, jamais l'inverse.
`domain/` ne connaît ni le broker ni Fastify.

## Pourquoi

Les règles du sujet sont dans `domain/`, donc testables sans lancer un broker. Un test qui
vérifie qu'un message rejoué ne crée pas de doublon appelle une fonction et lui passe deux
messages. Il ne publie rien sur MQTT et n'ouvre pas de serveur HTTP. Le sujet classe le test
automatisé au-dessus de la capture d'écran comme preuve : ce découpage est ce qui rend ces
tests possibles.

Ça évite aussi de dupliquer une règle. Le seuil de fraîcheur est utilisé à l'ingestion et à
l'affichage. S'il était écrit dans le handler MQTT et redéfini dans une route, les deux
finiraient par diverger.

Une commande traverse les mêmes couches qu'une mesure, en sens inverse : `http/`, puis
`domain/`, puis `mqtt/`.

## Pourquoi pas l'architecture hexagonale

Elle poursuit le même but que nous, isoler le métier, mais elle y ajoute des interfaces
qu'on appelle des ports, et des implémentations qu'on appelle des adaptateurs, pour pouvoir
changer de base ou de broker sans toucher au métier.

Nous avons un broker imposé par le sujet et une base choisie pour quatre jours. On écrirait
des interfaces pour des remplacements qui n'arriveront pas. Le bénéfice réel de
l'hexagonal, l'isolement du métier, on l'obtient déjà avec notre règle de dépendance.

## Pourquoi pas CQRS

CQRS sépare le modèle d'écriture du modèle de lecture, avec deux représentations
différentes des mêmes données, quand les besoins de lecture divergent trop de ceux
d'écriture.

Notre système a bien deux chemins, MQTT écrit et HTTP lit, ce qui y ressemble de loin. Mais
les deux travaillent sur les mêmes tables. Notre table de dernier état joue déjà le rôle
d'un modèle de lecture optimisé, et elle tient en une requête SQL. Construire deux modèles
et le mécanisme qui les synchronise créerait un problème de cohérence qu'on n'a pas
aujourd'hui.

## Pourquoi pas des microservices

Découper l'ingestion et l'API en deux services obligerait à partager l'état entre eux et à
gérer deux déploiements. Or c'est justement la cohérence de cet état, le doublon et l'ordre
des mesures, qui est notée. On ajouterait un problème distribué à un projet qui n'en a pas
besoin, à deux personnes sur quatre jours.

## Ce que ça coûte

Plus de fichiers qu'en écrivant tout dans le handler MQTT, et la discipline de ne jamais
appeler la base directement depuis une route.

## Conséquence

Une règle métier qui aurait besoin de connaître Fastify ou MQTT.js est le signe qu'elle est
mal placée. C'est le contrôle qu'on applique à chaque ajout.

## Aide de l'IA

L'IA n'avait pas posé la question de l'architecture. Elle a été ajoutée sur demande, avec
la consigne d'examiner l'hexagonal et CQRS plutôt que de les ignorer.

Sa première réponse décrivait le découpage comme « une version légère de l'hexagonal ».
Formule rejetée : soit on applique des ports et des adaptateurs, soit on n'en applique pas.
Ce qu'on fait est un découpage en couches avec une règle de dépendance, et ça se dit
comme ça.

## Vérification

À faire en J2, quand les règles de doublon et de fraîcheur seront couvertes par des tests :
vérifier qu'aucun fichier de `domain/` n'importe `mqtt`, `fastify` ni `kysely`, et que les
tests de ces règles tournent sans broker ni serveur HTTP.

Aujourd'hui, `src/domain/fraicheur.ts` ne contient que des fonctions pures, sans aucun
import.
