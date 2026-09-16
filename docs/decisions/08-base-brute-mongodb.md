# Une base brute en MongoDB, devant la base consolidée

## Contexte

Le professeur a demandé à l'oral d'ajouter une seconde base, en NoSQL, qui reçoit les
messages des capteurs tels qu'ils arrivent. Un job périodique les relit, applique les règles
métier et écrit le résultat dans PostgreSQL. L'application ne lit que PostgreSQL.

Cette demande n'apparaît nulle part dans le sujet écrit. Les pages 01, 02, 03, 05 et 06 du
Notion ont été relues : elles ne parlent que d'un seul stockage, au singulier, et l'unique
mention proche, « agréger les mesures pour un historique long », est classée dans les
extensions possibles après validation du socle. Nous appliquons donc la consigne orale, en le
disant.

La décision `03` avait écarté une architecture à deux bases. Elle écartait un autre montage :
les mesures consolidées dans une base séparée, ce qui aurait cassé la clé étrangère entre une
mesure et son capteur. Ici la seconde base est placée avant le traitement, pas après, et
PostgreSQL garde toutes ses clés étrangères.

## Options envisagées

MongoDB, PostgreSQL en JSONB dans une seconde base, et ne rien ajouter en s'appuyant sur les
agrégats continus de TimescaleDB, déjà disponibles.

## Choix retenu

MongoDB 8.3 pour la zone brute, PostgreSQL 18 pour la base consolidée. Le consommateur MQTT
écrit dans MongoDB sans rien valider. Un job tourne toutes les 5 secondes, relit les messages
dans leur ordre d'arrivée, valide, déduplique et écrit dans PostgreSQL.

## Pourquoi MongoDB et pas PostgreSQL en JSONB

Le professeur a demandé de trancher par la mesure et non par un comparatif lu sur internet.
Un million de messages ont été simulés sur chaque moteur, dans les mêmes conditions, avec la
forme exacte des messages du kit et 100 objets. Le banc est dans `docs/preuves/bench-nosql/`.

| | MongoDB 8.3 | PostgreSQL 18 en JSONB |
|---|---|---|
| Écriture message par message | 0,152 ms | 2,825 ms |
| Écriture d'un million par lots de 1000 | 7,9 s | 24,6 s |
| Taille sur disque | 272 Mo | 1189 Mo |
| Requête d'agrégat sur le million | 0,50 s | 0,42 s |

L'écriture message par message est 18 fois plus rapide. C'est le chiffre qui compte, parce
qu'un consommateur MQTT reçoit les messages un par un : PostgreSQL plafonne vers 350 messages
par seconde dans ce mode, MongoDB en tient 6 500.

Le disque suit le même sens, 4,4 fois moins. Ramené à nos 130 000 mesures par jour, ça fait
35 Mo par jour contre 155.

Enfin MongoDB écrit sans schéma. Il accepte donc les messages qu'une table refuserait, ce qui
est le but même d'une zone brute : garder ce qui est arrivé, y compris ce qu'on n'a pas su
lire.

## Pourquoi un job explicite et pas un agrégat continu de TimescaleDB

TimescaleDB sait déjà calculer des moyennes par tranche, en une définition SQL au lieu d'un
programme. Nous ne l'utilisons pas, pour une raison précise : un agrégat continu lit une
table et écrit des agrégats. Il ne sait pas faire ce que notre job fait en plus, c'est à dire
valider un message contre le contrat, écarter un doublon sur une contrainte d'unicité, et
refuser qu'une mesure en retard remplace le dernier état connu. Ces trois règles sont du
métier, pas du calcul.

**Question ouverte, à poser au professeur.** Si seule la partie agrégat l'intéresse, l'agrégat
continu suffirait et le job se réduirait à la validation. La question a été identifiée avant
de coder et n'a pas encore de réponse.

## Ce que ça coûte

Un conteneur de plus, un pilote de plus, et une latence ajoutée : une mesure met jusqu'à
5 secondes de plus à atteindre l'écran, puisqu'elle attend le passage suivant du job. Le seuil
de fraîcheur est de 30 secondes et le téléphone rafraîchit toutes les 15 secondes, donc ces
5 secondes restent un sixième du seuil. C'est ce qui a fixé la période du job.

Le stockage double, dans le sens où le même message est écrit deux fois : une fois brut, une
fois consolidé. Nous gardons les deux 7 jours, la même durée, parce que le brut sert à
recalculer la période qu'on affiche et pas au delà.

À notre volume réel de 1,5 message par seconde, les deux moteurs testés sont surdimensionnés
d'un facteur 20 000. La mesure ne prouve donc pas qu'il nous faut MongoDB. Elle montre à
partir de quand le choix compterait.

## Conséquence

La déduplication reste dans PostgreSQL, sur la contrainte d'unicité existante. La mettre dans
le brut la viderait de son sens : une zone brute doit accepter les doublons, sinon elle ne
garde plus ce qui est arrivé.

Un effet de bord non prévu et bienvenu : les messages `state` et `availability` sont retained,
donc livrés dès l'abonnement, avant que l'objet existe en base. Ils étaient gardés dans une
table en mémoire qui disparaissait au redémarrage. Ils restent maintenant dans MongoDB tant
que le job ne peut pas les appliquer, et le tampon en mémoire a été supprimé.

## Aide de l'IA

L'IA a d'abord proposé de garder l'écriture directe dans PostgreSQL et d'ajouter MongoDB à
côté, en écrivant dans les deux. Rejeté : deux écritures qui peuvent diverger, et surtout
l'inverse de ce qui était demandé, puisque le brut n'aurait plus été la seule source du
consolidé.

Elle a aussi avancé que la base brute protégeait d'un arrêt du backend. C'est faux et ça a été
corrigé : si le backend est éteint, personne n'écrit, ni dans l'une ni dans l'autre. Ce qui
protège de ça, c'est la session persistante du broker, en place depuis J1. La base brute
protège d'autre chose, d'une erreur dans notre propre traitement.

Le `CLAUDE.md` du projet affirmait que le pilote de base était synchrone. Vérifié dans le
code : c'est `pg` avec un pool de 10 connexions, tout est asynchrone. La phrase a été
corrigée. La conclusion qu'elle servait, borner et indexer les lectures d'historique, reste
juste pour une autre raison : ces lectures partagent le pool avec le job.

## Vérification

Le rejeu est la raison d'être de la zone brute. Il a été exercé pour de vrai, sur un défaut
réel trouvé le jour même.

Les six messages de testament du broker, ceux qu'il publie quand un objet disparaît sans
prévenir, étaient rejetés depuis J1 : notre schéma exigeait un champ `reported_at` que le
contrat du kit décrit explicitement comme absent dans ce cas. Aucune déconnexion brutale
n'était donc enregistrée. Le défaut a été vu parce que la zone brute garde ce qu'elle refuse.

```sh
docker compose exec mongo mongosh campus_brut --quiet \
  --eval 'db.messages.countDocuments({statut:"rejete"})'
# 6 avant correction

docker compose up -d --build backend
docker compose exec backend node dist/jobs/rejouer.js 30
docker compose exec mongo mongosh campus_brut --quiet \
  --eval 'db.messages.countDocuments({statut:"rejete"})'
# 0 apres correction et rejeu
```

Traces du rejeu : 2613 messages remis en attente, 2600 reconnus comme doublons et écartés,
19 traités dont les 6 testaments. Le nombre de lignes dans `telemetry` n'a pas augmenté du
nombre de messages rejoués, ce qui montre que rejouer ne duplique pas l'historique.

La chaîne complète a été vérifiée avec les incidents du kit, après le passage à deux bases :

```sh
docker compose --profile tools run --rm tools incident sensor-001 duplicate
docker compose exec postgres psql -U campus -d campus -tAc \
  "select count(*) from (select device_id, message_id from telemetry
   group by device_id, message_id having count(*)>1) x"
```

Résultat : le message est présent deux fois dans MongoDB, avec le motif « doublon écarté », et
0 doublon dans PostgreSQL.

## Limite

Ce montage ne protège d'aucune panne matérielle et d'aucun arrêt du backend. Il protège d'une
erreur dans notre traitement, et c'est tout.

Ce qui nous ferait revenir en arrière : si le professeur répond que l'agrégat continu suffit,
le job disparaît et la zone brute perd les deux tiers de son intérêt. Il resterait alors à
décider si on la garde pour la seule capacité de rejeu.
