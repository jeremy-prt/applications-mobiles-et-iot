# Architecture du backend : en couches, avec un noyau métier isolé

## Problème

Le backend reçoit des messages MQTT au fil de l'eau et répond aux requêtes du mobile. Les deux
chemins appliquent les mêmes règles, et une commande part du HTTP pour finir en MQTT.

## Options

Architecture en couches avec noyau métier isolé, architecture hexagonale, CQRS, microservices.

## Choix et compromis

Les règles métier sont isolées dans `domain/`, qui ne connaît ni le broker ni Fastify. Règle de
dépendance : `mqtt/` et `http/` appellent `domain/`, jamais l'inverse. Le découpage des dossiers
est dans `docs/architecture.md`.

Les règles deviennent testables sans broker, un test de déduplication appelle une fonction et lui
passe deux messages. Le sujet classe le test automatisé au-dessus de la capture d'écran. Ça évite
aussi de dupliquer une règle, le seuil de fraîcheur servant à l'ingestion et à l'affichage.

L'hexagonal vise le même but, mais ajoute des ports et des adaptateurs pour pouvoir changer de
base ou de broker. Notre broker est imposé par le sujet et notre base choisie pour 4 jours, donc
on écrirait des interfaces pour des remplacements qui n'arriveront pas. CQRS sépare le modèle
d'écriture du modèle de lecture, alors que MQTT et HTTP travaillent sur les mêmes tables et que
notre table de dernier état tient en une requête SQL. Les microservices obligeraient à partager
entre deux services l'état dont la cohérence est justement notée.

Ça coûte plus de fichiers qu'en écrivant tout dans le handler MQTT, et la discipline de ne jamais
appeler la base directement depuis une route.

## Aide de l'IA

L'IA n'avait pas posé la question de l'architecture, elle a été ajoutée sur demande, avec la
consigne d'examiner l'hexagonal et CQRS plutôt que de les ignorer. Sa première réponse décrivait
le découpage comme « une version légère de l'hexagonal ». Formule rejetée, soit on applique des
ports et des adaptateurs, soit on n'en applique pas.

## Vérification

Fait en J2. `grep -rn "^import" backend/src/domain/*.ts` ne rend aucune ligne hors fichiers de
test, donc `domain/` n'importe ni `mqtt`, ni `fastify`, ni `kysely`. `cd backend && npm test`
fait passer 27 tests sans broker, sans base et sans serveur HTTP.

## Limite

Rien n'empêche mécaniquement un import interdit dans `domain/`, la règle de dépendance tient par
la relecture tant qu'aucun test ne la vérifie.

Ce qui ferait changer d'avis est un remplacement réel de la base ou du broker. À ce moment, les
ports et les adaptateurs de l'hexagonal reprendraient du sens.
