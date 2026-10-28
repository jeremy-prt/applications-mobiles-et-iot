# Une base brute en MongoDB, devant la base consolidée

## Problème

Le Notion demandait un seul stockage. On nous a conseillé une base NoSQL en amont qui garde les
messages bruts, refusés compris. Un job la relit toutes les 5 secondes, valide, déduplique et
écrit dans PostgreSQL, seule base lue par l'app. Différent du montage écarté dans
`docs/decisions/J1/03-base-de-donnees-postgresql.md`, qui cassait la clé étrangère vers le capteur.

## Options

- MongoDB.
- PostgreSQL en JSONB dans une seconde base.
- Rien de plus, avec les agrégats continus de TimescaleDB.

## Choix et compromis

MongoDB 8.3 pour le brut, PostgreSQL 18 pour le consolidé. Le consommateur MQTT écrit dans
MongoDB sans valider. Banc d'un million de messages au format du kit, 100 objets, dans
`docs/preuves/bench-nosql/`.

| | MongoDB 8.3 | PostgreSQL 18 en JSONB |
|---|---|---|
| Écriture message par message | 0,152 ms | 2,825 ms |
| Écriture d'un million par lots de 1000 | 7,9 s | 24,6 s |
| Taille sur disque | 272 Mo | 1189 Mo |
| Requête d'agrégat sur le million | 0,50 s | 0,42 s |

L'écriture unitaire tranche, 18 fois plus rapide, car MQTT livre un message à la fois : 6 500 par
seconde pour MongoDB, vers 350 pour PostgreSQL. Et MongoDB accepte ce qu'une table refuse.
L'agrégat continu de TimescaleDB ne valide pas, ne déduplique pas et laisse une mesure en retard
écraser le dernier état.

Coût : un conteneur de plus, chaque message stocké deux fois pendant 7 jours, et jusqu'à
5 secondes de délai, un sixième du seuil de fraîcheur de 30 secondes (d'où la période du job). À
1,5 message par seconde, PostgreSQL tenait déjà 230 fois notre charge et MongoDB 4 300 fois. Le
banc dit à partir de quand le choix compterait, pas qu'il nous faut MongoDB.

## Aide de l'IA

Rejeté : écrire dans les deux bases à la fois, elles pourraient diverger et le brut ne serait plus
la seule source. Corrigé : la base brute ne protège pas d'un arrêt du backend, puisque plus
personne n'écrit. C'est le rôle de la session persistante du broker.

## Vérification

Les six testaments du broker, publiés quand un objet disparaît, étaient rejetés depuis J1 : notre
schéma exigeait `reported_at`, absent dans ce cas selon le contrat. Repérés grâce à la zone brute.

```sh
docker compose exec mongo mongosh campus_brut --quiet \
  --eval 'db.messages.countDocuments({statut:"rejete"})'   # 6 avant correction
docker compose up -d --build backend
docker compose exec backend node dist/jobs/rejouer.js 30
docker compose exec mongo mongosh campus_brut --quiet \
  --eval 'db.messages.countDocuments({statut:"rejete"})'   # 0 apres
```

Rejeu : 2613 messages remis en attente, puis 2600 écartés comme doublons et 19 traités, dont les
6 testaments. Les 6 en trop viennent du simulateur, qui publiait pendant le rejeu. `telemetry` n'a
pas grossi du nombre rejoué, donc pas d'historique dupliqué. Avec `incident sensor-001 duplicate`,
le message est deux fois dans MongoDB, 0 doublon dans PostgreSQL.

## Limite

Protège d'une erreur de traitement, pas d'une panne matérielle ni d'un arrêt du backend. Si les
règles métier sortaient du job, un agrégat continu TimescaleDB ferait pareil en une définition SQL.
