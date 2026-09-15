# Choix de la base de données : PostgreSQL avec TimescaleDB

## Contexte

On stocke deux familles de données. D'un côté le métier : capteurs, salles, utilisateurs,
droits, commandes et leurs résultats, règles d'alerte. De l'autre la télémétrie, qui est
une série de mesures datées.

Volume : 3 capteurs à une mesure toutes les 2 secondes, soit environ 130 000 lignes par
jour. Le kit permet de monter à 100 objets, ce qui ferait 4,3 millions de lignes par jour.

## Options envisagées

PostgreSQL, PostgreSQL avec TimescaleDB, MongoDB, InfluxDB, Cassandra, ClickHouse, et une
architecture à deux bases.

## Choix retenu

PostgreSQL 18.6 avec l'extension TimescaleDB 2.30.0, une seule instance, une seule base.

## Pourquoi du relationnel plutôt que du NoSQL

Nos données sont pleines de liens qu'il faut garantir : un capteur appartient à une salle,
un utilisateur porte des rôles, une commande a un émetteur et zéro ou un résultat, une
alerte pointe une règle et un capteur. Ce sont des clés étrangères.

Surtout, la déduplication est une contrainte d'unicité sur `(device_id, message_id)`. C'est
la base qui doit la garantir, pas notre code. Si on écrivait en JavaScript un test "ce
message existe-t-il déjà ?" suivi d'une insertion, et qu'un jour deux consommateurs
tournaient en parallèle, les deux liraient "non" et les deux insèreraient.

MongoDB sait faire un index unique. Mais il ne sait pas joindre capteurs, salles,
utilisateurs et droits sans dénormaliser, et dénormaliser les droits c'est les rendre
incohérents. Et nous n'avons aucun des problèmes que le NoSQL résout : notre schéma est
connu à l'avance et stable, et le volume tient largement sur une machine.

## Pourquoi pas un moteur de séries temporelles dédié

La télémétrie est bien une série temporelle, mais les seuils comptent.

| Solution | Devient pertinente à partir de |
|---|---|
| PostgreSQL seul | jusqu'à quelques milliers de points par seconde |
| TimescaleDB | quand on garde des mois de données et qu'on veut compression et rétention |
| Cassandra | au-delà de 5 000 à 10 000 points par seconde |
| InfluxDB, QuestDB, ClickHouse | des centaines de milliers de lignes par seconde |

Nous sommes à 1,5 message par seconde, et 50 si on monte à 100 objets. Cent fois sous le
premier seuil.

## Pourquoi TimescaleDB quand même

C'est une extension de PostgreSQL, pas une autre base. On déclare la table de télémétrie en
hypertable et on garde tout le reste en tables normales, avec les mêmes clés étrangères.

Le gain concret : `add_retention_policy` supprime automatiquement les mesures au delà d'une
durée choisie. Le sujet demande un historique borné, et ça le règle en une ligne au lieu
d'une tâche de ménage à écrire et à surveiller.

## Pourquoi pas deux bases

C'est ce que font les plateformes IoT en production, par exemple ThingsBoard avec
PostgreSQL pour les entités et Cassandra pour les mesures. Mais on y va quand la télémétrie
sature la base métier.

À deux sur 4 jours, ça se retournerait contre nous : deux schémas, deux clients, deux jeux
de migrations, et surtout on perdrait la clé étrangère entre une mesure et son capteur,
c'est à dire l'intégrité qu'on vient de défendre.

## Ce que ça coûte

Un conteneur de plus dans le Compose, avec un healthcheck et un ordre de démarrage. C'est le
prix d'une base qui accepte plusieurs écrivains et qui gère des rôles.

Les hypertables de TimescaleDB sont sous licence Apache 2.0. La compression et les agrégats
continus sont sous Timescale License, gratuite tant qu'on ne revend pas la base en service
hébergé. Ça ne nous concerne pas, mais autant le savoir.

## Conséquence

Deux colonnes de temps sur chaque mesure, et pas une seule : `recorded_at`, l'heure donnée
par le capteur, et `received_at`, l'heure où on l'a reçue. Sans les deux, on ne peut
calculer ni la fraîcheur d'une mesure ni détecter qu'elle est arrivée dans le désordre.

Le schéma évolue par migrations versionnées, avec `node-pg-migrate`. On ne rejoue pas un
fichier `schema.sql` à la main, et on n'utilise pas la synchronisation automatique d'un ORM.

## Aide de l'IA

L'IA a d'abord proposé SQLite, en avançant qu'il n'y avait aucun service à administrer.
Rejeté : personne ne déploie SQLite sur ce type de système, et « c'est plus simple à
installer » n'est pas un critère de choix.

Dans la même réponse, deux affirmations fausses ont été corrigées après vérification :
InfluxDB sait faire des jointures depuis sa version 3, et MongoDB a bien des index uniques.
Les arguments réels sont ailleurs : ni l'un ni l'autre n'a de clé étrangère.

Elle a aussi avancé que le pilote synchrone empêchait une course entre la vérification et
l'insertion d'un doublon. Supprimé : avec `ON CONFLICT DO NOTHING` il n'y a pas de
vérification préalable, l'atomicité vient de la base et pas du pilote.

## Vérification

L'index unique et la déduplication ont été testés sur le système en marche :

```sh
docker compose run --rm tools incident sensor-001 duplicate
docker compose exec postgres psql -U campus -d campus -tAc \
  "select count(*) from (select device_id, message_id from telemetry
   group by device_id, message_id having count(*)>1) x"
```

Résultat : 0 doublon en base.

La non-régression de l'état courant a été testée avec l'incident `delay` : la mesure datée
d'une minute avant est bien dans l'historique, et `device_state.recorded_at` a continué
d'avancer au lieu de reculer.
