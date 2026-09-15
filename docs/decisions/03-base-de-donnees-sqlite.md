# Choix de la base de données : SQLite

## Contexte

On stocke les mesures, le dernier état de chaque objet, les objets et leurs salles, les
utilisateurs et leurs droits, et le suivi des commandes.

Volume : 3 capteurs à une mesure toutes les 2 secondes, soit 1,5 message par seconde et
129 600 lignes par jour si on gardait tout. L'historique est borné, donc bien moins.

Un seul écrivain, le consommateur MQTT. Quelques lecteurs, les requêtes de l'API.

## Options envisagées

SQLite, PostgreSQL, PostgreSQL avec TimescaleDB, InfluxDB, MongoDB, et `node:sqlite`
intégré à Node 24.

## Choix retenu

SQLite avec better-sqlite3 13.0.3, fichier dans un volume Docker.

## Pourquoi

La déduplication est portée par la base. Contrainte `UNIQUE` sur `message_id`, puis
`INSERT ... ON CONFLICT(message_id) DO NOTHING`, et on lit `changes()` pour savoir si la
ligne a été insérée ou si c'était un doublon. On évite `INSERT OR IGNORE`, qui avalerait
aussi les violations de `NOT NULL` ou de `CHECK` et compterait un message malformé comme un
doublon.

Nos données sont relationnelles. Une mesure appartient à un objet, un objet à une salle,
une salle à des utilisateurs, une commande à son résultat. InfluxDB 3 sait faire des
jointures depuis qu'il utilise DataFusion, mais il n'a ni contrainte d'unicité ni clé
étrangère, donc il ne peut pas porter notre registre d'objets et d'utilisateurs. MongoDB a
des index uniques, mais ce serait un service de plus pour des données clairement tabulaires.

PostgreSQL ferait le travail. Il ajoute un conteneur, un healthcheck, un ordre de démarrage
et des identifiants dans le Compose. Le scénario R13 consiste à relancer tout le projet en
suivant le seul README. TimescaleDB, c'est PostgreSQL plus une extension conçue pour des
volumes plusieurs ordres de grandeur au-dessus des nôtres, avec des hypertables et une
politique de rétention à justifier.

`node:sqlite` évite la dépendance native, mais il est encore en release candidate dans
Node 24. On ne pose pas une soutenance sur une API non stabilisée. better-sqlite3 fournit
des binaires précompilés pour arm64 et amd64, donc rien ne se compile au build de l'image.

## Ce que ça coûte

Le pilote est synchrone et Node est mono-thread : une requête lente bloque l'ingestion.
D'où l'index `(device_id, observed_at)` et le `LIMIT` obligatoire.

Plusieurs instances du backend sur la même base sont techniquement possibles en local, mais
déconseillées, et impossibles sur deux machines ou un volume réseau. Si le campus passait à
plusieurs centaines de capteurs ou à plusieurs backends, on migrerait vers PostgreSQL.

`ON CONFLICT DO NOTHING` existe aussi en PostgreSQL, donc cette requête est portable. Ce
qui ne l'est pas : SQLite n'a pas de type date. On stocke les dates en TEXT ISO 8601 UTC,
comme dans le contrat MQTT, et les tables sont déclarées `STRICT` pour que les types soient
réellement vérifiés.

WAL n'autorise toujours qu'un seul écrivain à la fois, et il crée les fichiers `-wal` et
`-shm` à côté de la base. Copier le seul `.db` pendant que le backend tourne perdrait les
dernières écritures : pour une sauvegarde, `VACUUM INTO`.

## Conséquence

Réglages à l'ouverture de la connexion :

| Pragma | Valeur | Pourquoi |
|---|---|---|
| `journal_mode` | WAL | Les lectures ne bloquent pas l'écriture et l'inverse. Permet de lire la base avec `sqlite3` pendant que le backend écrit, ce qui sert de preuve en démonstration |
| `foreign_keys` | ON | Désactivé par défaut dans SQLite |
| `synchronous` | NORMAL | Suffisant avec WAL |
| `busy_timeout` | 5000 | Évite un échec immédiat si une lecture traîne |

Requêtes préparées partout, ce qui règle aussi les injections SQL.

Point à trancher en J2 : l'index de déduplication doit couvrir une fenêtre plus longue que
la rétention des mesures, sinon un `message_id` purgé n'écarte plus son doublon.
