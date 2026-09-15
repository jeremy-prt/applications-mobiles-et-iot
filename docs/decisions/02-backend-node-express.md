# Choix du backend : Node avec Express

## Contexte

Le service fait deux choses dans le même process. Il reste connecté au broker MQTT en
permanence et traite environ 1,5 message par seconde. Il expose aussi une API que le mobile
interroge de temps en temps, soit quelques routes de lecture et deux routes d'action.

Le coeur du projet n'est pas le serveur HTTP. Les points notés sont la validation des
messages, la déduplication, la fraîcheur, le suivi des commandes et les droits.

## Options envisagées

Express, Fastify, NestJS, et Python avec FastAPI et paho-mqtt.

## Choix retenu

Node 24 LTS, Express 5.2.1, MQTT.js 5.15.2.

## Pourquoi

Node partage le langage avec React Native. Le format des messages MQTT est décrit une fois
en Zod, et le même schéma sert des deux côtés.

Express n'impose pas d'ordre de démarrage. On ouvre la connexion MQTT, puis on écoute en
HTTP, dans le fichier d'entrée. NestJS sait aussi le faire, avec `OnModuleInit` et son
transport MQTT intégré. L'argument contre NestJS n'est donc pas technique : c'est le nombre
de concepts à apprendre et à défendre à l'oral en quatre jours à deux.

Fastify serait plus rapide et embarque la validation de schéma. Mais la validation qui
compte chez nous porte sur les messages MQTT, pas sur les requêtes HTTP, et à ce volume la
différence de vitesse n'est pas mesurable.

MQTT.js est le client de référence en Node, avec environ 3 700 paquets qui en dépendent. Il
gère la reconnexion automatique et le QoS 1, dont on a besoin quand le broker est
interrompu puis relancé.

## Ce que ça coûte

Node est mono-thread. Une requête d'historique lourde bloquerait l'ingestion MQTT pendant
son exécution, parce que notre pilote de base est synchrone. D'où l'index sur
`(device_id, observed_at)` et le `LIMIT` obligatoire sur toutes les lectures d'historique.

Une exception non attrapée dans le handler MQTT tue le process, et donc l'API avec. Une
promesse rejetée non gérée aussi, depuis Node 15. Donc : handler `async` avec un `await`
dans le `try`, plus `process.on('unhandledRejection')` et `restart: unless-stopped` dans le
Compose.

Attention à ne pas compter sur Express 5 pour ça. Express 5 transmet bien au middleware
d'erreur les promesses rejetées, mais uniquement celles que le handler retourne. Une erreur
jetée dans un écouteur d'événement, comme notre handler MQTT, n'est pas couverte.

Express ne fournit ni validation, ni logs structurés, ni authentification. On assemble avec
Zod, Pino, jose et bcryptjs : quatre dépendances de production, chacune rattachée à un
point noté du sujet.
