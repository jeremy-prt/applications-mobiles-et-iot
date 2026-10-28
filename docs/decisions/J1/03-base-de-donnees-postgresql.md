# Choix de la base de données : PostgreSQL avec TimescaleDB

## Problème

Du métier (capteurs, salles, utilisateurs, droits, commandes) et de la télémétrie datée. Trois
capteurs toutes les 2 secondes font 130 000 lignes par jour, 4,3 millions avec 100 objets.

## Options

PostgreSQL, PostgreSQL avec TimescaleDB, MongoDB, InfluxDB, Cassandra, ClickHouse, ou deux bases.

| Solution | Pertinente |
|---|---|
| PostgreSQL seul | jusqu'à quelques milliers de points par seconde |
| TimescaleDB | sur des mois de données, avec compression et rétention |
| Cassandra | au-delà de 5 000 à 10 000 points par seconde |
| InfluxDB, QuestDB, ClickHouse | à des centaines de milliers de lignes par seconde |

## Choix et compromis

PostgreSQL 18.6 avec TimescaleDB 2.30.0, une seule base. Nos données sont pleines de clés
étrangères, et la déduplication est une contrainte d'unicité tenue par la base. MongoDB devrait
dénormaliser capteurs, salles, utilisateurs et droits, au risque de droits incohérents.

TimescaleDB est une extension : la télémétrie passe en hypertable, le reste ne change pas.
`add_retention_policy` borne l'historique comme le demande le sujet.

Deux bases casseraient la clé étrangère entre une mesure et son capteur. Révisé en J2 : une
seconde base existe pour le brut, pas pour le consolidé (`docs/decisions/J2/08-base-brute-mongodb.md`).

## Aide de l'IA

Corrigé : InfluxDB fait des jointures depuis sa version 3, et MongoDB a des index uniques.
Supprimé : « le pilote synchrone évite une course sur un doublon », car `ON CONFLICT DO NOTHING`
ne fait pas de test préalable.

## Vérification

```sh
docker compose --profile tools run --rm tools incident sensor-001 duplicate
docker compose exec postgres psql -U campus -d campus -tAc "select count(*) from (select device_id, message_id from telemetry group by device_id, message_id having count(*)>1) x"
```

0 doublon, et l'incident `delay` ne fait pas reculer `device_state.recorded_at`.

## Limite

Notre volume est cent fois sous le premier seuil, seul un changement d'échelle ferait changer
d'avis. Hypertables sous Apache 2.0, compression et agrégats continus sous Timescale License,
gratuite tant qu'on ne revend pas la base en service hébergé.
