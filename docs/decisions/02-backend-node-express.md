# Choix du backend : Node avec Express

## Contexte

Le service traite environ 1,5 message MQTT par seconde en continu, et expose quelques
routes HTTP que le mobile interroge de temps en temps. Le coeur du projet est l'ingestion,
pas le serveur web.

## Options envisagées

Express, Fastify, NestJS, Python avec FastAPI et paho-mqtt.

## Choix retenu

Node 24 LTS, Express 5.2.1, MQTT.js 5.15.2.

## Pourquoi

Node partage le langage avec React Native, donc le schéma Zod d'un message est écrit une
fois pour les deux côtés.

NestJS sait très bien faire ce qu'on veut, avec `OnModuleInit` et son transport MQTT
intégré. Ce qu'on lui reproche n'est pas technique : c'est le nombre de concepts à
apprendre et à défendre à l'oral en 4 jours à deux.

Fastify serait plus rapide et valide les requêtes HTTP par schéma. Chez nous la validation
qui compte porte sur les messages MQTT, et à ce volume la vitesse ne se mesure pas.

MQTT.js est le client de référence en Node, avec environ 3 700 paquets qui en dépendent. Il
gère la reconnexion automatique et le QoS 1.

## Ce que ça coûte

Node est mono-thread et notre pilote de base est synchrone : une requête d'historique lente
bloque l'ingestion pendant son exécution. D'où l'index `(device_id, observed_at)` et le
`LIMIT` obligatoire.

Une exception non attrapée dans le handler MQTT tue le process, et une promesse rejetée non
gérée aussi depuis Node 15. Express 5 ne protège pas de ça : il ne rattrape que les
promesses retournées par un handler de route, pas celles d'un écouteur d'événement. Donc
`try/catch` avec `await` dans le handler, `process.on('unhandledRejection')`, et
`restart: unless-stopped` dans le Compose.

Express ne fournit ni validation, ni logs structurés, ni authentification. Quatre
dépendances de production à assembler, une par point noté du sujet.
