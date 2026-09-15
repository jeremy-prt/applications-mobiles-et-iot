# Choix de la base de données : SQLite

## Contexte

On stocke des mesures de capteurs, le dernier état de chaque objet, les objets et leurs
salles, les utilisateurs et leurs droits, et le suivi des commandes.

Volume réel : 3 capteurs qui publient toutes les 2 secondes, soit environ 1,5 message par
seconde, autour de 130 000 lignes par jour si on garde tout. L'historique est borné par le
sujet, donc on en gardera beaucoup moins.

Le schéma d'écriture est particulier : un seul écrivain, le consommateur MQTT, et quelques
lecteurs, les requêtes de l'API.

## Options envisagées

SQLite, PostgreSQL, PostgreSQL avec TimescaleDB, InfluxDB, MongoDB.

## Choix retenu

SQLite, via la bibliothèque better-sqlite3 13.0.3, avec le fichier de base dans un volume
Docker.

## Pourquoi

Un seul écrivain, c'est exactement le cas où SQLite est à l'aise. Les problèmes de
verrouillage qu'on lui reproche viennent de plusieurs process qui écrivent en même temps.
Chez nous le consommateur MQTT est seul à insérer.

La déduplication devient triviale et sûre. On met une contrainte d'unicité sur le
`message_id` et on écrit un `INSERT OR IGNORE`. Le doublon est écarté par la base en une
seule instruction, sans qu'on ait à lire avant d'écrire. better-sqlite3 est synchrone,
donc rien ne peut s'intercaler entre la vérification et l'insertion. Avec un pilote
asynchrone on devrait se méfier de cette course.

Nos données sont relationnelles. On doit relier une mesure à un objet, un objet à une
salle, une salle à des utilisateurs, et une commande à son résultat. C'est ce que SQL fait
bien. InfluxDB ne sait pas faire de jointure et nous obligerait à gérer les utilisateurs
ailleurs, donc à maintenir deux stockages. MongoDB nous ferait recoder à la main des
garanties que SQL donne gratuitement, en particulier l'unicité et l'ordre.

PostgreSQL ferait parfaitement le travail, mais il ajoute un conteneur, un healthcheck,
une configuration réseau et des identifiants dans le Compose. Un des scénarios de recette
consiste à relancer tout le projet en suivant uniquement le README. Chaque service en
moins est une panne en moins le jour de la démonstration. Et à notre volume, PostgreSQL ne
nous apporterait rien de mesurable.

TimescaleDB est conçu pour des millions de points par seconde. On serait obligés de
justifier des hypertables et une politique de rétention qu'on n'aurait pas le temps de
maîtriser. Choisir un outil de séries temporelles sans pouvoir expliquer ce qu'il fait
serait plus fragile que d'assumer SQLite.

La persistance est simple à démontrer. La base est un fichier, il vit dans un volume
Docker, il survit à un redémarrage du conteneur. C'est ce que vérifie le scénario de
reproductibilité.

## Ce que ça coûte

SQLite est un fichier local. On ne peut pas lancer deux instances du backend qui écrivent
dans la même base, et on ne peut pas répartir la charge sur plusieurs machines.

C'est la limite à annoncer honnêtement : si le campus passait à plusieurs centaines de
capteurs ou s'il fallait plusieurs backends en parallèle, on migrerait vers PostgreSQL. Le
SQL qu'on écrit resterait presque identique, c'est justement pour ça qu'on n'utilise pas
de fonction propre à SQLite dans nos requêtes.

## Conséquence

Le fichier de base doit être dans un volume Docker, jamais dans l'image. On active le mode
WAL pour que les lectures de l'API ne soient pas bloquées par l'écriture des mesures. On
écrit du SQL standard et des requêtes préparées, ce qui protège aussi des injections.
