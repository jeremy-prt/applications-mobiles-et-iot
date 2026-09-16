# Choix de la base de données : PostgreSQL avec TimescaleDB

## Problème

On stocke du métier (capteurs, salles, utilisateurs, droits, commandes) et de la télémétrie datée.
Trois capteurs toutes les 2 secondes font 130 000 lignes par jour, 4,3 millions avec 100 objets.

## Options

PostgreSQL, PostgreSQL avec TimescaleDB, MongoDB, InfluxDB, Cassandra, ClickHouse, ou deux bases.

| Solution | Devient pertinente à partir de |
|---|---|
| PostgreSQL seul | jusqu'à quelques milliers de points par seconde |
| TimescaleDB | quand on garde des mois de données et qu'on veut compression et rétention |
| Cassandra | au-delà de 5 000 à 10 000 points par seconde |
| InfluxDB, QuestDB, ClickHouse | des centaines de milliers de lignes par seconde |

## Choix et compromis

PostgreSQL 18.6 avec TimescaleDB 2.30.0, une seule base. Nos données sont pleines de liens à
garantir par clés étrangères, et la déduplication est une contrainte d'unicité que la base doit
tenir, sinon deux consommateurs insèrent le même message. MongoDB a des index uniques, mais
joindre capteurs, salles, utilisateurs et droits l'obligerait à dénormaliser, donc à rendre les
droits incohérents.

TimescaleDB est une extension, pas une autre base. La télémétrie devient une hypertable, le reste
garde ses tables normales et ses clés étrangères. Le gain concret est `add_retention_policy`, qui
supprime les mesures au delà d'une durée choisie, là où le sujet demande un historique borné.

Deux bases coûteraient la perte de la clé étrangère entre une mesure et son capteur. Section
révisée en J2, où une seconde base a été ajoutée pour les messages bruts, pas pour les mesures
consolidées. Ce qui est écarté ici le reste, voir `docs/decisions/J2/08-base-brute-mongodb.md`.

## Aide de l'IA

Deux affirmations fausses ont été corrigées. InfluxDB sait faire des jointures depuis sa version
3, et MongoDB a bien des index uniques. L'IA a aussi avancé que le pilote synchrone empêchait une
course sur un doublon. Supprimé, avec `ON CONFLICT DO NOTHING` il n'y a pas de test préalable.

## Vérification

```sh
docker compose --profile tools run --rm tools incident sensor-001 duplicate
docker compose exec postgres psql -U campus -d campus -tAc "select count(*) from (select device_id, message_id from telemetry group by device_id, message_id having count(*)>1) x"
```

Résultat : 0 doublon en base, et l'incident `delay` ne fait pas reculer `device_state.recorded_at`.

## Limite

Le volume est cent fois sous le premier seuil du tableau, donc ce qui ferait changer d'avis est un
changement d'échelle. Les hypertables sont sous Apache 2.0, la compression et les agrégats
continus sous Timescale License, gratuite tant qu'on ne revend pas la base en service hébergé.
