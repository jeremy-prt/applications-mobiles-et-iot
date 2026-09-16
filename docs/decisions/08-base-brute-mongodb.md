# Une base brute en MongoDB, devant la base consolidée

## Contexte

Le Notion ne demandait qu'un seul stockage. Il nous a été conseillé d'ajouter une seconde base,
en NoSQL, qui reçoit les messages des capteurs tels qu'ils arrivent, parce qu'une zone brute
garde ce qui est arrivé même quand notre traitement le refuse. Un job périodique la relit,
applique les règles métier et écrit dans PostgreSQL. L'application ne lit que PostgreSQL.

La décision `03` écartait bien une architecture à deux bases, mais un autre montage : les mesures
consolidées dans une base séparée, ce qui cassait la clé étrangère entre une mesure et son
capteur. Ici la seconde base est placée avant le traitement, pas après.

## Options envisagées

MongoDB, PostgreSQL en JSONB dans une seconde base, et ne rien ajouter en s'appuyant sur les
agrégats continus de TimescaleDB.

## Choix retenu

MongoDB 8.3 pour la zone brute, PostgreSQL 18 pour la base consolidée. Le consommateur MQTT
écrit dans MongoDB sans rien valider. Un job tourne toutes les 5 secondes, relit les messages
dans leur ordre d'arrivée, valide, déduplique et écrit dans PostgreSQL.

## Pourquoi MongoDB et pas PostgreSQL en JSONB

Le choix devait être tranché par la mesure et non par un comparatif lu en ligne. Un million de
messages ont été simulés sur chaque moteur, dans les mêmes conditions, à la forme exacte des
messages du kit et avec 100 objets. Le banc est dans `docs/preuves/bench-nosql/`.

| | MongoDB 8.3 | PostgreSQL 18 en JSONB |
|---|---|---|
| Écriture message par message | 0,152 ms | 2,825 ms |
| Écriture d'un million par lots de 1000 | 7,9 s | 24,6 s |
| Taille sur disque | 272 Mo | 1189 Mo |
| Requête d'agrégat sur le million | 0,50 s | 0,42 s |

L'écriture message par message est 18 fois plus rapide, et c'est le chiffre qui compte : un
consommateur MQTT reçoit les messages un par un. PostgreSQL plafonne vers 350 messages par
seconde dans ce mode, MongoDB en tient 6 500. Le disque suit, 35 Mo par jour contre 155.

MongoDB écrit sans schéma, donc il accepte les messages qu'une table refuserait. C'est le but
d'une zone brute : garder ce qui est arrivé, y compris ce qu'on n'a pas su lire.

## Pourquoi un job explicite et pas un agrégat continu de TimescaleDB

Un agrégat continu lit une table et écrit des agrégats. Il ne sait pas valider un message
contre le contrat, écarter un doublon sur une contrainte d'unicité, ni refuser qu'une mesure en
retard remplace le dernier état connu. Ces trois règles sont du métier, pas du calcul. La
question a été posée, et le choix nous est laissé.

## Ce que ça coûte

Un conteneur et un pilote de plus, et une mesure met jusqu'à 5 secondes de plus à atteindre
l'écran puisqu'elle attend le passage suivant du job. Le seuil de fraîcheur est de 30 secondes,
donc ces 5 secondes en valent un sixième : c'est ce qui a fixé la période.

Le même message est écrit deux fois, brut puis consolidé, et les deux sont gardés 7 jours. Enfin,
à notre volume réel de 1,5 message par seconde, les deux moteurs testés sont surdimensionnés
d'un facteur 20 000 : la mesure ne prouve pas qu'il nous faut MongoDB, elle montre à partir de
quand le choix compterait.

## Conséquence

La déduplication reste dans PostgreSQL, sur la contrainte d'unicité existante. La mettre dans
le brut le viderait de son sens : une zone brute doit accepter les doublons.

Effet non prévu : les messages `state` et `availability` sont retained, donc livrés dès
l'abonnement, avant que l'objet existe en base. Ils étaient gardés en mémoire, et disparaissaient
au redémarrage. Ils restent maintenant dans MongoDB tant que le job ne peut pas les appliquer.

## Aide de l'IA

L'IA a proposé de garder l'écriture directe dans PostgreSQL et d'ajouter MongoDB à côté, en
écrivant dans les deux. Rejeté : deux écritures qui peuvent diverger, et le brut n'aurait plus
été la seule source du consolidé.

Elle a avancé que la base brute protégeait d'un arrêt du backend. Corrigé : si le backend est
éteint, personne n'écrit, ni dans l'une ni dans l'autre. Ce qui protège de ça, c'est la session
persistante du broker, en place depuis J1.

Le `CLAUDE.md` du projet affirmait que le pilote de base était synchrone. Vérifié dans le code :
c'est `pg` avec un pool de 10 connexions, tout est asynchrone. La conclusion qu'il servait,
borner et indexer les lectures d'historique, reste juste pour une autre raison : ces lectures
partagent le pool avec le job.

## Vérification

Le rejeu a été exercé sur un défaut réel. Les six messages de testament du broker, publiés quand
un objet disparaît sans prévenir, étaient rejetés depuis J1 : notre schéma exigeait un champ
`reported_at` que le contrat décrit comme absent dans ce cas. Vu parce que la zone brute garde
ce qu'elle refuse.

```sh
docker compose exec mongo mongosh campus_brut --quiet \
  --eval 'db.messages.countDocuments({statut:"rejete"})'   # 6 avant correction
docker compose up -d --build backend
docker compose exec backend node dist/jobs/rejouer.js 30
docker compose exec mongo mongosh campus_brut --quiet \
  --eval 'db.messages.countDocuments({statut:"rejete"})'   # 0 apres
```

Traces du rejeu : 2613 messages remis en attente, 2600 écartés comme doublons, 19 traités dont
les 6 testaments. `telemetry` n'a pas grossi du nombre de messages rejoués, donc rejouer ne
duplique pas l'historique. La déduplication a été revérifiée avec
`incident sensor-001 duplicate` : le message est deux fois dans MongoDB, 0 doublon dans
PostgreSQL.

## Limite

Ce montage ne protège d'aucune panne matérielle et d'aucun arrêt du backend. Il protège d'une
erreur dans notre traitement, et c'est tout.

Ce qui nous ferait revenir en arrière : si les règles métier sortaient du job pour ne laisser
que du calcul d'agrégat, l'agrégat continu de TimescaleDB ferait la même chose en une
définition SQL, et le job n'aurait plus lieu d'être.
