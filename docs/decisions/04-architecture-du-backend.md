# Organisation du code du backend

## Contexte

Le backend a deux entrées qui doivent appliquer les mêmes règles. MQTT écrit, HTTP lit, et
HTTP écrit aussi quand on envoie une commande.

Si on met la règle de déduplication dans le code qui reçoit les messages MQTT, on ne peut
plus la tester sans lancer un broker. Pareil pour la règle de fraîcheur, qui sert à
l'ingestion et à l'affichage.

## Options envisagées

Architecture hexagonale, CQRS, ou un découpage en couches simple.

## Choix retenu

Un découpage en couches, sans framework d'architecture.

```
backend/src/
  schemas/    schémas Zod, partagés entre MQTT et HTTP
  domain/     les règles : doublon, ordre des mesures, fraîcheur, commandes, alertes
  db/         les requêtes SQL et les migrations
  mqtt/       connexion au broker, abonnements, publication des commandes
  http/       les routes Fastify
```

## Pourquoi pas l'hexagonal ni CQRS

L'architecture hexagonale sert à pouvoir remplacer une dépendance externe sans toucher au
métier. Nous avons un broker imposé par le sujet et une base choisie pour 4 jours. On
écrirait des interfaces pour des remplacements qui n'arriveront pas.

CQRS sépare le modèle d'écriture du modèle de lecture quand les deux divergent. Notre
système a bien deux chemins, MQTT qui écrit et HTTP qui lit, mais ils lisent et écrivent
les mêmes tables. Notre table de dernier état joue déjà le rôle d'un modèle de lecture, et
elle tient en une ligne de SQL.

Les deux ajouteraient des fichiers et des indirections sans supprimer un problème réel.

## Pourquoi ce découpage quand même

Les règles du sujet sont dans `domain/`, donc testables sans broker et sans serveur HTTP.
Un test qui vérifie qu'un doublon est écarté appelle une fonction, il ne publie pas un
message MQTT.

Les schémas Zod sont dans `schemas/` parce qu'ils servent aux deux entrées : valider un
message MQTT à l'ingestion, et valider le corps d'une requête HTTP dans Fastify.

## Ce que ça coûte

Un peu plus de fichiers qu'en écrivant tout dans le handler MQTT. En contrepartie, les
règles notées du sujet sont isolées et prouvables par des tests, ce que le sujet classe
au-dessus des captures d'écran.
