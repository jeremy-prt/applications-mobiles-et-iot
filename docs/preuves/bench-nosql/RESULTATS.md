# Choix de la base brute : mesure sur un million de messages

Fait le 16 septembre 2026, sur Mac Apple Silicon, les deux moteurs en conteneur, l'un après
l'autre pour qu'ils ne se gênent pas.

Les messages ont la forme exacte du contrat du kit, avec 100 objets différents.

## Résultats

| | MongoDB 8.3 | PostgreSQL 18 en JSONB |
|---|---|---|
| Écriture d'un million, par lots de 1000 | 7,9 s | 24,6 s |
| Débit | 127 000 messages par seconde | 40 600 |
| Écriture message par message | 0,152 ms | 2,825 ms |
| Taille sur disque | 272 Mo | 1189 Mo |
| Requête d'agrégat sur le million | 0,50 s | 0,42 s |

## Ce que ça dit

**L'écart décisif est l'écriture message par message : 0,152 ms contre 2,825 ms, soit 18
fois.** C'est le cas qui compte, parce qu'un consommateur MQTT reçoit les messages un par un.
Postgres plafonne à environ 350 messages par seconde dans ce mode, Mongo tient 6 500.

À 1000 messages par seconde, ce que le kit peut produire avec 100 objets à 0,1 seconde,
Postgres ne suivrait pas sans regrouper les écritures. Mongo passe sans rien changer.

**Le disque suit le même sens : 4,4 fois moins pour Mongo.** Ramené à notre volume réel de
130 000 mesures par jour, ça fait 35 Mo par jour contre 155.

**Sur la requête d'agrégat, Postgres est très légèrement meilleur.** L'écart est faible et ne
compte pas : le job tourne une fois par période, pas à chaque écran.

## Décision proposée

**MongoDB pour la base brute.** Il est meilleur là où ça compte, l'écriture au fil de l'eau,
et il accepte un message sans schéma, y compris les messages invalides que la base
relationnelle refuserait.

PostgreSQL reste la base consolidée : c'est là que vivent les objets, les salles, les
utilisateurs, les droits et les commandes, avec leurs clés étrangères.

## Ce qu'il faut dire honnêtement

À notre volume réel de 1,5 message par seconde, les deux moteurs sont surdimensionnés d'un
facteur 20 000. La mesure ne sert pas à prouver qu'on a besoin de Mongo : elle sert à
montrer à partir de quand le choix compterait. Le choix devait être tranché par la mesure et
non par un comparatif lu en ligne.

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
