# Architecture du backend : en couches (n-layer), avec les règles métier à part

## Problème

Le backend reçoit des messages MQTT au fil de l'eau et répond aux requêtes du mobile. Les deux
chemins appliquent les mêmes règles, et une commande part du HTTP pour finir en MQTT.

## Options

Architecture en couches (n-layer), architecture hexagonale, CQRS, microservices.

## Choix et compromis

Architecture en couches, aussi appelée n-layer. Le code est rangé par étages : les entrées
(`http/` pour le mobile, `mqtt/` pour les capteurs, `jobs/` pour la consolidation), les règles
métier (`domain/`) et l'accès aux bases (`db/`). Les entrées appellent les règles et la base,
jamais l'inverse. Le découpage des dossiers est dans `docs/architecture.md`.

Une seule différence avec une archi en couches classique : les règles métier n'appellent pas la
base. `domain/` ne connaît ni le broker, ni Fastify, ni PostgreSQL. Ce sont les entrées qui
appellent les règles, puis la base.

Les règles deviennent testables sans broker ni base : un test de doublon appelle une fonction et
lui passe deux messages. Le sujet classe le test automatisé au-dessus de la capture d'écran. Ça
évite aussi d'écrire deux fois une règle, le seuil de fraîcheur servant à l'ingestion et à
l'affichage.

L'hexagonal isole aussi le métier, mais va plus loin : il ajoute une interface entre le métier
et chaque techno, pour pouvoir changer de base ou de broker sans toucher au métier. Notre broker
est imposé par le sujet et notre base choisie pour 4 jours, ces interfaces ne serviraient
jamais. La Clean Architecture repose sur la même idée, écartée pour la même raison.

CQRS sépare le code qui écrit du code qui lit. Chez nous, MQTT et HTTP travaillent sur les mêmes
tables, et lire le dernier état d'un objet tient en une requête SQL.

Les microservices obligeraient deux services à se partager les mêmes données, alors que leur
cohérence est justement notée.

Ça coûte plus de fichiers que de tout écrire dans le code qui reçoit les messages MQTT, et une
règle à tenir : rien dans `domain/` n'importe la base, le broker ou Fastify.

## Aide de l'IA

L'IA n'avait pas posé la question de l'architecture, elle a été ajoutée sur demande, avec la
consigne d'examiner l'hexagonal et CQRS plutôt que de les ignorer. Sa première réponse décrivait
le découpage comme « une version légère de l'hexagonal ». Formule rejetée : sans les interfaces
entre le métier et les technos, ce n'est pas de l'hexagonal.

## Vérification

Fait en J2. `grep -rn "^import" backend/src/domain/*.ts` ne rend aucune ligne hors fichiers de
test, donc `domain/` n'importe ni `mqtt`, ni `fastify`, ni `kysely`. `cd backend && npm test`
fait passer 27 tests sans broker, sans base et sans serveur HTTP.

## Limite

Rien n'empêche mécaniquement un import interdit dans `domain/`, la règle tient par la relecture
tant qu'aucun test ne la vérifie.

Ce qui ferait changer d'avis est un remplacement réel de la base ou du broker. À ce moment,
l'hexagonal reprendrait du sens.
