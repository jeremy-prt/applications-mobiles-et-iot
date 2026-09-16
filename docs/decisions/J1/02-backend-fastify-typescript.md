# Choix du backend : Node, TypeScript et Fastify

## Problème

Le service a deux entrées. Il reçoit des messages MQTT en continu, et il répond aux routes
HTTP du mobile listées dans `docs/api.md`.

## Options

Express, Fastify, NestJS. Et JavaScript contre TypeScript.

## Choix et compromis

Node 24 LTS, TypeScript 7.0.2, Fastify 5.12.4.

L'erreur la plus fréquente ici est de lire un champ absent d'un message, ou de traiter un
texte comme un nombre. C'est ce que le kit envoie exprès, avec un CO2 qui vaut le texte
`"invalide"`. On décrit le message une fois avec Zod et les types en sont déduits, donc
`message.co2` au lieu de `message.co2.value` échoue à la compilation, pas en démonstration.

Fastify réutilise ces schémas Zod pour valider les requêtes HTTP et typer les handlers. Avec
Express, il faudrait revalider à la main dans chaque route. Pino est intégré, et le sujet
demande des traces qui suivent une mesure et une commande. NestJS impose d'apprendre ses
modules et ses décorateurs, du temps pris sur les points notés.

Ça coûte une demi-journée pour les hooks et les plugins de Fastify, plus une étape de
compilation, avec le support natif de Node 24 en développement et `tsc` pour la production.

## Aide de l'IA

L'IA a justifié Express 5 par le fait qu'il transmet les promesses rejetées au gestionnaire
d'erreur, « puisque nos routes seront asynchrones car elles lisent la base ». On a d'abord
rejeté l'argument en disant que notre pilote de base était synchrone. C'était faux, et c'est
notre erreur, pas celle de l'IA : `backend/src/db/index.ts` ouvre un `pg.Pool` de 10
connexions, donc tout est asynchrone. L'argument tombe pour une autre raison, il ne couvre que
les routes HTTP.

Elle a aussi affirmé que NestJS ne savait pas gérer un client MQTT au démarrage. Faux après
vérification, NestJS a `OnModuleInit` et un transport MQTT intégré. Le seul argument honnête
contre lui est le temps d'apprentissage.

## Vérification

`curl http://localhost:3000/health` renvoie `{"status":"ok","db":true}`.

Un message invalide est rejeté sans arrêter le service, avec
`docker compose --profile tools run --rm tools incident sensor-001 invalid` : aucune ligne insérée, le log
indique le champ fautif, et `/health` répond toujours.

## Limite

Rien de tout ça ne protège le consommateur MQTT. Le gestionnaire de messages est un écouteur
d'événement, hors du cycle de requête de Fastify, donc ses erreurs ne remontent à aucun
gestionnaire d'erreur HTTP.

Ce qui ferait changer d'avis sur NestJS est la durée. Sur un projet plus long que 4 jours, sa
structure toute faite serait amortie.
