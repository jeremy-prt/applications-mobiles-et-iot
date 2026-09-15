# Modèle de données

PostgreSQL 18 avec l'extension TimescaleDB. Une seule base.

Toutes les dates sont en `timestamptz`, stockées en UTC, comme dans le contrat MQTT du kit.

## Les tables

| Table | Ce qu'elle contient |
|---|---|
| `rooms` | Les salles du campus |
| `devices` | Les objets, et la salle à laquelle ils sont rattachés |
| `telemetry` | Toutes les mesures reçues. C'est l'hypertable TimescaleDB |
| `device_state` | Le dernier état connu de chaque objet, une ligne par objet |
| `users` | Les comptes |
| `roles` et `user_roles` | Qui a le droit de consulter, qui a le droit de commander |
| `commands` | Les commandes envoyées et leur suivi |
| `alert_rules` | Les seuils qui déclenchent une alerte |
| `alerts` | Les alertes ouvertes et fermées |

## Les trois points qui portent le projet

### La déduplication

`telemetry` porte une contrainte `UNIQUE (device_id, message_id)`.

L'insertion s'écrit `INSERT ... ON CONFLICT (device_id, message_id) DO NOTHING`, et on lit
le nombre de lignes affectées pour savoir si c'était un doublon.

C'est la base qui garantit l'unicité, pas notre code. Un test écrit en JavaScript du genre
"ce message existe-t-il déjà ?" suivi d'une insertion serait une course si deux
consommateurs tournaient un jour en parallèle.

### Les deux dates de chaque mesure

| Colonne | Ce que c'est |
|---|---|
| `recorded_at` | L'heure donnée par le capteur, le champ `observed_at` du message |
| `received_at` | L'heure où notre backend a reçu le message |

Les deux sont nécessaires. `recorded_at` sert à détecter qu'une mesure est arrivée dans le
désordre et à calculer sa fraîcheur. `received_at` sert à diagnostiquer un retard de
transport, quand l'écart entre les deux grandit.

### Le dernier état, séparé de l'historique

`telemetry` reçoit toutes les mesures, y compris celles qui arrivent en retard.

`device_state` ne garde que la plus récente. Sa mise à jour est conditionnelle :

```sql
UPDATE device_state SET ... WHERE device_id = $1 AND last_recorded_at < $2
```

Une mesure datée d'avant le dernier état est donc bien rangée dans l'historique, mais ne
remplace pas ce qui est affiché.

`device_state` porte aussi la disponibilité de l'objet, qui vient du topic `availability`
et non des mesures. C'est ce qui permet de distinguer un objet déconnecté d'un objet
connecté qui ne mesure plus.

## Le suivi des commandes

`commands` garde l'état de chaque demande : en attente, exécutée, en échec, expirée, ou
résultat inconnu.

L'attente est en base et pas en mémoire. Si le backend redémarre pendant qu'une commande
est en cours, une tâche au démarrage requalifie les commandes en attente dont la date
d'expiration est passée. Un minuteur en mémoire disparaîtrait avec le process.

## La rétention

`telemetry` est une hypertable TimescaleDB avec une politique de rétention qui supprime les
mesures au delà de la durée choisie. C'est ce qui borne l'historique demandé par le sujet,
sans tâche de ménage à écrire.

Point à trancher : l'index de déduplication doit couvrir une fenêtre au moins aussi longue
que la rétention, sinon un `message_id` supprimé n'écarte plus son doublon.

## Les migrations

Le schéma évolue par fichiers de migration numérotés, avec `node-pg-migrate`. Chaque
migration a un chemin de retour en arrière. Aucune modification de schéma à la main.
