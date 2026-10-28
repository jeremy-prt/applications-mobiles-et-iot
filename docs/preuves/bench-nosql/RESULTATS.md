# Choix de la base brute, mesuré sur un million de messages

16 septembre 2026, Mac Apple Silicon. Moteurs en conteneur, lancés l'un après l'autre. Messages
au format du kit, 100 objets.

## Résultats

| | MongoDB 8.3 | PostgreSQL 18 en JSONB |
|---|---|---|
| Écriture d'un million, par lots de 1000 | 7,9 s | 24,6 s |
| Débit | 127 000 messages par seconde | 40 600 |
| Écriture message par message | 0,152 ms | 2,825 ms |
| Taille sur disque | 272 Mo | 1189 Mo |
| Requête d'agrégat sur le million | 0,50 s | 0,42 s |

## Ce que ça dit

Ce qui compte est l'écriture message par message, 18 fois plus lente sur Postgres, car MQTT
livre un message à la fois. Postgres plafonne vers 350 messages par seconde, Mongo 6 500. À
1000 messages par seconde (100 objets à 0,1 seconde), Postgres devrait regrouper les écritures.

Sur disque, Mongo prend 4,4 fois moins : 35 Mo par jour contre 155 pour nos 130 000 mesures.
L'agrégat ne compte pas, il tourne une fois par période.

## Décision

MongoDB pour la base brute : plus rapide au fil de l'eau, et sans schéma, donc il garde aussi
les messages invalides. PostgreSQL pour les données consolidées. Détail dans
`docs/decisions/J2/08-base-brute-mongodb.md`.

## Ce qu'il faut dire honnêtement

On reçoit 1,5 message par seconde. Postgres tenait 230 fois ce débit, Mongo 4 300 fois : les
deux convenaient.

## Comment reproduire

```sh
cd docs/preuves/bench-nosql
docker compose -p bench up -d --wait
npm install
node bench.mjs mongo
node bench.mjs postgres
docker exec bench-mongo-1 du -sm /data/db
docker exec bench-postgres-1 du -sm /var/lib/postgresql
docker compose -p bench down -v
```

`TOTAL` et `LOT` se règlent par variable d'environnement.
