# Choix du backend : Node, TypeScript et Fastify

## Problème

Deux entrées : les messages MQTT en continu et les routes HTTP du mobile (`docs/api.md`).

## Options

Express, Fastify, NestJS. JavaScript ou TypeScript.

## Choix et compromis

Node 24 LTS, TypeScript 7.0.2, Fastify 5.12.4.

Le kit envoie exprès un CO2 qui vaut `"invalide"`. Zod décrit le message et les types en sont
déduits, donc `message.co2` au lieu de `message.co2.value` casse à la compilation. Fastify
réutilise ces schémas pour le HTTP, Express obligerait à revalider dans chaque route. Pino est
intégré pour tracer mesures et commandes. NestJS demande d'apprendre modules et décorateurs.

Coût : une demi-journée sur les hooks et plugins de Fastify, et une compilation (Node 24 natif en
dev, `tsc` en production).

## Aide de l'IA

L'IA défendait Express 5, qui transmet les promesses rejetées au gestionnaire d'erreur. On a
répondu à tort que notre pilote était synchrone : `backend/src/db/index.ts` ouvre un `pg.Pool` de
10 connexions. L'argument tombe quand même, il ne couvre que le HTTP. Elle disait aussi que
NestJS ne gérait pas MQTT au démarrage. Faux, il a `OnModuleInit` et un transport MQTT.

## Vérification

`curl http://localhost:3000/health` renvoie `{"status":"ok","db":true}`.

`docker compose --profile tools run --rm tools incident sensor-001 invalid` : rien n'est inséré,
le log nomme le champ fautif et `/health` répond toujours.

## Limite

Le consommateur MQTT est hors du cycle de requête de Fastify, donc ses erreurs ne remontent à
aucun gestionnaire HTTP.
