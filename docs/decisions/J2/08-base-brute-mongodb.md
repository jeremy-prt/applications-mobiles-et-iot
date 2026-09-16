# Une base brute en MongoDB, devant la base consolidée

## Problème

Le Notion ne demandait qu'un seul stockage. On nous a conseillé une base NoSQL en amont, qui
reçoit les messages tels qu'ils arrivent et garde ce que notre traitement refuse. Un job la
relit toutes les 5 secondes, valide, déduplique et écrit dans PostgreSQL, seule base que lit
l'application. `docs/decisions/J1/03-base-de-donnees-postgresql.md` écartait un montage
différent, le consolidé dans une base à part, qui cassait la clé étrangère vers le capteur.

## Options

MongoDB, PostgreSQL en JSONB dans une seconde base, ou rien de plus en s'appuyant sur les
agrégats continus de TimescaleDB.

## Choix et compromis

MongoDB 8.3 pour le brut, PostgreSQL 18 pour le consolidé. Le consommateur MQTT écrit dans
MongoDB sans rien valider. Un million de messages ont été simulés sur chaque moteur, à la forme
exacte des messages du kit et avec 100 objets. Le banc est dans `docs/preuves/bench-nosql/`.

| | MongoDB 8.3 | PostgreSQL 18 en JSONB |
|---|---|---|
| Écriture message par message | 0,152 ms | 2,825 ms |
| Écriture d'un million par lots de 1000 | 7,9 s | 24,6 s |
| Taille sur disque | 272 Mo | 1189 Mo |
| Requête d'agrégat sur le million | 0,50 s | 0,42 s |

L'écriture message par message est 18 fois plus rapide, et c'est le chiffre qui tranche, car un
consommateur MQTT reçoit les messages un par un. MongoDB en tient 6 500 par seconde dans ce
mode, PostgreSQL plafonne vers 350. Sans schéma, MongoDB accepte aussi ce qu'une table refuse.

L'agrégat continu de TimescaleDB ne sait ni valider un message contre le contrat, ni écarter un
doublon, ni refuser qu'une mesure en retard remplace le dernier état connu.

Ça coûte un conteneur de plus, le même message gardé deux fois pendant 7 jours, et jusqu'à
5 secondes avant qu'une mesure atteigne l'écran, un sixième du seuil de fraîcheur de 30 secondes,
ce qui a fixé la période du job. Notre volume réel est de 1,5 message par seconde, donc
PostgreSQL tenait déjà 230 fois ce qu'on lui demande et MongoDB 4 300 fois. La mesure ne dit
pas qu'il nous faut MongoDB, elle dit à partir de quand le choix compterait.

## Aide de l'IA

Rejeté : écrire à la fois dans PostgreSQL et dans MongoDB. Deux écritures peuvent diverger, et
le brut n'aurait plus été la seule source du consolidé. Corrigé aussi, l'IA affirmait que la
base brute protégeait d'un arrêt du backend. Si le backend est éteint, personne n'écrit nulle
part. C'est la session persistante du broker qui protège de ça.

## Vérification

Les six messages de testament du broker, publiés quand un objet disparaît sans prévenir, étaient
rejetés depuis J1, car notre schéma exigeait un champ `reported_at` que le contrat décrit comme
absent dans ce cas. Vus parce que la zone brute garde ce qu'elle refuse.

```sh
docker compose exec mongo mongosh campus_brut --quiet \
  --eval 'db.messages.countDocuments({statut:"rejete"})'   # 6 avant correction
docker compose up -d --build backend
docker compose exec backend node dist/jobs/rejouer.js 30
docker compose exec mongo mongosh campus_brut --quiet \
  --eval 'db.messages.countDocuments({statut:"rejete"})'   # 0 apres
```

Rejeu : 2613 messages remis en attente, puis 2600 écartés comme doublons et 19 traités, dont
les 6 testaments. Le total dépasse de 6 les messages remis en attente, car le simulateur a
continué de publier pendant le rejeu et ces nouveaux messages sont passés dans les mêmes
passages de consolidation. `telemetry` n'a pas grossi du nombre de messages rejoués, donc rejouer ne duplique
pas l'historique. Revérifié avec `incident sensor-001 duplicate`, le message est deux fois dans
MongoDB, 0 doublon dans PostgreSQL.

## Limite

Ce montage ne protège d'aucune panne matérielle et d'aucun arrêt du backend. Il protège d'une
erreur dans notre traitement. Si les règles métier sortaient du job, l'agrégat continu de
TimescaleDB ferait la même chose en une définition SQL.
