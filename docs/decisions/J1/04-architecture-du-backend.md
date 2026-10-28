# Architecture du backend : en couches (n-layer), avec les règles métier à part

## Problème

Les messages MQTT et les requêtes du mobile appliquent les mêmes règles. Une commande part du
HTTP et finit en MQTT.

## Options

- En couches (n-layer).
- Hexagonale, et Clean Architecture sur la même idée : une interface entre le métier et chaque techno.
- CQRS : écriture et lecture séparées.
- Microservices.

## Choix et compromis

En couches. Les entrées (`http/`, `mqtt/`, `jobs/`) appellent les règles (`domain/`) puis la base
(`db/`), jamais l'inverse. Détail dans `docs/architecture.md`. Différence avec le n-layer
classique : `domain/` ignore la base, le broker et Fastify. On teste donc les règles seules, ce
que le sujet préfère à une capture, et le seuil de fraîcheur sert à l'ingestion comme à
l'affichage.

Hexagonal écarté car le broker est imposé et la base choisie pour 4 jours, les interfaces ne
serviraient jamais. CQRS écarté car MQTT et HTTP utilisent les mêmes tables et le dernier état
tient en une requête SQL. Microservices écartés car deux services partageraient des données dont
la cohérence est notée.

Coût : plus de fichiers, et une règle à tenir : rien dans `domain/` n'importe la base, le broker
ou Fastify.

## Aide de l'IA

L'IA n'avait pas abordé l'architecture. On lui a demandé d'examiner l'hexagonal et CQRS. Elle a
appelé notre découpage « une version légère de l'hexagonal ». Rejeté : sans interfaces, ce n'est
pas de l'hexagonal.

## Vérification

En J2, `grep -rn "^import" backend/src/domain/*.ts` ne rend aucune ligne hors tests, donc pas
d'import de `mqtt`, `fastify` ou `kysely`. `cd backend && npm test` : 27 tests passent sans
broker, base ni serveur HTTP.

## Limite

Rien n'empêche un import interdit dans `domain/`, seule la relecture le surveille.

Ce qui ferait changer d'avis : un vrai remplacement de la base ou du broker.
