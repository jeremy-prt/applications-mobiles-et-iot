# Choix de la base de données : SQLite

## Contexte

On stocke les mesures, le dernier état de chaque objet, les objets et leurs salles, les
utilisateurs et leurs droits, et le suivi des commandes.

3 capteurs à une mesure toutes les 2 secondes, soit 129 600 lignes par jour si on gardait
tout. Un seul écrivain, le consommateur MQTT.

## Options envisagées

SQLite, PostgreSQL, PostgreSQL avec TimescaleDB, InfluxDB, MongoDB, `node:sqlite`.

## Choix retenu

SQLite avec better-sqlite3 13.0.3, fichier dans un volume Docker.

## Pourquoi

La déduplication est portée par la base : contrainte `UNIQUE` sur `message_id`, puis
`INSERT ... ON CONFLICT(message_id) DO NOTHING`, et `changes()` dit si la ligne a été
insérée ou si c'était un doublon. On n'utilise pas `INSERT OR IGNORE`, qui avalerait aussi
les violations de `NOT NULL` et compterait un message malformé comme un doublon.

Nos données sont relationnelles : une mesure appartient à un objet, un objet à une salle,
une commande à son résultat. InfluxDB 3 sait faire des jointures, mais il n'a ni contrainte
d'unicité ni clé étrangère, donc il ne peut pas porter le registre des objets et des
utilisateurs. MongoDB a des index uniques, mais ce serait un service de plus pour des
données tabulaires.

PostgreSQL ferait le travail, mais ajoute un conteneur, un healthcheck, un ordre de
démarrage et des identifiants. Le scénario R13 consiste à relancer tout le projet en
suivant le seul README. TimescaleDB, c'est PostgreSQL plus une extension prévue pour des
volumes plusieurs ordres de grandeur au-dessus des nôtres.

`node:sqlite` éviterait la dépendance native, mais il est encore en release candidate dans
Node 24. better-sqlite3 fournit des binaires précompilés pour arm64 et amd64, donc rien ne
se compile au build de l'image.

## Ce que ça coûte

Plusieurs backends sur la même base sont déconseillés en local et impossibles sur deux
machines. Si le campus passait à plusieurs centaines de capteurs, on migrerait vers
PostgreSQL.

SQLite n'a pas de type date : on stocke les dates en TEXT ISO 8601 UTC, comme le contrat
MQTT, et les tables sont `STRICT` pour que les types soient vérifiés. `ON CONFLICT DO
NOTHING` existe aussi en PostgreSQL, donc cette requête resterait valable après migration.

WAL n'autorise qu'un seul écrivain à la fois et crée les fichiers `-wal` et `-shm` à côté
de la base. Pour une sauvegarde, `VACUUM INTO`, pas une copie du `.db`.

## Conséquence

| Pragma | Valeur | Pourquoi |
|---|---|---|
| `journal_mode` | WAL | Lectures et écriture ne se bloquent pas. On peut lire la base avec `sqlite3` pendant que le backend écrit, ce qui sert de preuve en démonstration |
| `foreign_keys` | ON | Désactivé par défaut dans SQLite |
| `synchronous` | NORMAL | Suffisant avec WAL |
| `busy_timeout` | 5000 | Évite un échec immédiat si une lecture traîne |

À trancher en J2 : l'index de déduplication doit couvrir une fenêtre plus longue que la
rétention des mesures, sinon un `message_id` purgé n'écarte plus son doublon.
