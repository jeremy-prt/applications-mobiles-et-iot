# Choix du backend : Node avec Express

## Contexte

Notre service doit faire deux choses en même temps dans le même process. D'un côté il
reste connecté au broker MQTT en permanence et traite un message toutes les 2 secondes par
capteur. De l'autre il expose une API HTTP que le mobile interroge de temps en temps.

Le coeur du projet n'est pas le serveur HTTP. Les points notés sont la validation des
messages, la déduplication, la fraîcheur, le suivi des commandes et les droits. Le HTTP
n'est qu'une porte de sortie pour le mobile, avec quelques routes de lecture et deux
routes d'action.

## Options envisagées

Express, Fastify, NestJS, et une stack Python avec FastAPI et paho-mqtt.

## Choix retenu

Node 24 LTS avec Express 5.2.1, et MQTT.js 5.15.2 comme client MQTT.

## Pourquoi

Le client MQTT doit vivre aussi longtemps que le process et être créé au démarrage, pas
dans une route. Express ne prend pas le contrôle du cycle de vie de l'application : c'est
une simple fonction qu'on branche sur un serveur HTTP Node. On ouvre la connexion MQTT
d'abord, on démarre l'écoute HTTP ensuite, dans l'ordre qu'on veut. NestJS impose son
conteneur d'injection et ses hooks de démarrage, ce qui ajoute une couche à comprendre
pour un problème qu'on n'a pas.

Express 5 transmet automatiquement les promesses rejetées au middleware d'erreur. Nos
routes seront presque toutes asynchrones parce qu'elles lisent la base, donc ça supprime
une source classique de bug où une erreur disparaît silencieusement.

Fastify serait légèrement plus rapide et embarque la validation de schéma. Sauf que la
validation qui compte chez nous est celle des messages MQTT, pas celle des requêtes HTTP.
L'avantage de Fastify porte donc sur la partie du projet qui pèse le moins. Et à trois
capteurs et quelques appels par minute, la différence de performance ne se mesure pas.

MQTT.js est le seul client MQTT réellement maintenu en Node. Il gère la reconnexion
automatique, le QoS 1 et les sessions persistantes, dont on a besoin pour le scénario où
le broker est interrompu puis relancé.

Node partage le langage avec React Native. On écrit le backend et le mobile en JavaScript,
donc les schémas de validation et les types de messages peuvent être pensés une seule fois.

## Ce que ça coûte

Node est mono-thread. Si un traitement de message était long, il bloquerait aussi l'API.
À notre volume ça ne se produira pas, mais ça veut dire qu'une exception non attrapée dans
le handler MQTT tuerait le process et donc l'API avec. On met un try catch dans le handler
dès le départ.

Express ne fournit rien d'office : ni validation, ni logs structurés, ni sécurité. On
assemble nous-mêmes avec Zod, Pino et jose. C'est plus de dépendances qu'avec un framework
complet, mais chaque brique reste explicable.
