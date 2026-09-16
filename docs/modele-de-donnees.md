# Modèle de données

PostgreSQL 18 avec l'extension TimescaleDB, une seule base. Toutes les dates sont en
`timestamptz`, stockées en UTC, comme dans le contrat MQTT du kit.

## Les tables

| Table | Ce qu'elle contient |
|---|---|
| `rooms` | Les salles du campus |
| `devices` | Les objets, et la salle à laquelle ils sont rattachés |
| `telemetry` | Toutes les mesures reçues. C'est l'hypertable TimescaleDB |
| `telemetry_bucket` | Les tranches de 5 minutes calculées par le job : moyenne, minimum, maximum |
| `device_state` | Le dernier état connu de chaque objet, une ligne par objet |
| `users` | Les comptes |
| `roles` et `user_roles` | Qui a le droit de consulter, qui a le droit de commander |
| `commands` | Les commandes envoyées et leur suivi |
| `alert_rules` | Les seuils qui déclenchent une alerte |
| `alerts` | Les alertes ouvertes et fermées |

## Trois règles garanties par la base

### La déduplication

`telemetry` porte une contrainte `UNIQUE (device_id, message_id)`. L'insertion s'écrit
`INSERT ... ON CONFLICT (device_id, message_id) DO NOTHING`, et on lit le nombre de lignes
affectées pour savoir si c'était un doublon.

L'unicité vient de la contrainte et non d'un test applicatif, qui serait une course. Voir
`docs/decisions/03`.

Contrainte de TimescaleDB : tout index unique d'une hypertable doit contenir la colonne de
partitionnement. L'index porte donc sur `(device_id, message_id, recorded_at)`. Sans effet
ici, puisque `recorded_at` vient du message : un doublon rejoue exactement le même triplet.

### Les deux dates de chaque mesure

| Colonne | Ce que c'est | À quoi elle sert |
|---|---|---|
| `recorded_at` | L'heure du capteur, le champ `observed_at` du message | Détecter une mesure arrivée dans le désordre, et calculer sa fraîcheur |
| `received_at` | L'heure où notre backend a reçu le message | Diagnostiquer un retard de transport, quand l'écart entre les deux grandit |

### Le dernier état, séparé de l'historique

`telemetry` reçoit toutes les mesures, y compris celles qui arrivent en retard.
`device_state` ne garde que la plus récente, par une mise à jour conditionnelle :

```sql
UPDATE device_state SET ... WHERE device_id = $1 AND last_recorded_at < $2
```

Une mesure datée d'avant le dernier état est donc rangée dans l'historique, mais ne remplace
pas ce qui est affiché.

`device_state` porte aussi deux informations qui ne viennent pas des mesures :

| Colonne | Source | À quoi ça sert |
|---|---|---|
| `availability` | topic `availability`, retained, alimenté aussi par le testament du broker | Distinguer un objet déconnecté d'un objet connecté qui ne mesure plus |
| `ventilation` | topic `state`, retained | La seule source de l'état réel de la ventilation. Une commande acceptée ne suffit pas à le déduire |

Ces deux topics étant retained, le broker les livre dès l'abonnement, avant la première
mesure, à un moment où l'objet n'existe pas encore en base. Ils sont gardés en mémoire et
appliqués dès que l'objet apparaît.

Une valeur retained reçue à l'abonnement peut être ancienne : elle dit ce que l'objet avait
annoncé la dernière fois. C'est la fraîcheur des mesures qui tranche, pas elle.

## Le suivi des commandes

`commands` garde l'état de chaque demande : en attente, exécutée, en échec, expirée, ou
résultat inconnu. L'attente est en base et pas en mémoire : si le backend redémarre pendant
qu'une commande est en cours, une tâche au démarrage requalifie les commandes en attente dont
la date d'expiration est passée. Un minuteur en mémoire disparaîtrait avec le process.

## L'affectation d'un objet à une salle

Le `room_id` présent dans les mesures est une indication de départ. Une fois l'objet
enregistré, c'est notre table `devices` qui fait foi : une réaffectation faite depuis
l'application n'est pas écrasée par le message suivant. C'est ce que prévoit le contrat du
kit, et ce que vérifie le scénario R10.

## La rétention

`telemetry` est une hypertable avec une politique de rétention à 7 jours, ce qui borne
l'historique sans tâche de ménage à écrire. Deux limites connues, sans effet pratique ici.
Un `message_id` supprimé par la rétention n'écarte plus son doublon, mais le kit ne rejoue
jamais un message vieux de plus de sept jours. Et au redémarrage du simulateur le `boot_id`
change, donc tous les `message_id` sont renouvelés : une mesure identique republiée après un
redémarrage serait enregistrée comme nouvelle. C'est conforme au contrat, le kit considère
qu'un redémarrage produit de nouvelles observations.

## La zone brute, dans MongoDB

Depuis J2, le consommateur MQTT n'écrit plus directement dans PostgreSQL. Il dépose chaque
message dans la collection `messages` de la base `campus_brut`, sans le valider. Le job de
consolidation la relit et écrit dans les tables ci-dessus.

| Champ | Contenu |
|---|---|
| `topic` | Le topic MQTT, tel quel |
| `device_id` | Extrait du topic, pas du corps : c'est du routage, pas une règle métier |
| `genre` | `telemetry`, `state`, `availability`, ou `inconnu` |
| `payload` | Le message décodé. Absent quand ce n'était pas du JSON |
| `texte` | Le texte original, gardé seulement quand on n'a pas su le décoder |
| `received_at` | Heure de réception par le backend |
| `statut` | `en_attente`, `traite`, `rejete`, `abandonne` |
| `essais` | Nombre de passages du job qui n'ont pas pu l'appliquer |
| `motif` | Pourquoi il a été rejeté, ou écarté comme doublon |

Deux index : `(statut, received_at)` pour que le job lise les messages non traités dans leur
ordre d'arrivée, et un index TTL de 7 jours sur `received_at` qui tient la rétention.

Un message `state` ou `availability` qui arrive avant que l'objet existe en base reste en
attente et repasse au tour suivant. Au bout de 60 passages, soit 5 minutes, il est abandonné.
Ce mécanisme remplace la table en mémoire utilisée en J1, qui disparaissait au redémarrage.

La déduplication reste dans PostgreSQL, sur la contrainte d'unicité. Une zone brute doit
accepter les doublons, sinon elle ne garde plus ce qui est arrivé : le même `message_id` peut
donc s'y trouver deux fois, avec le motif « doublon écarté » sur le second.

## Les tranches d'agrégat

`telemetry_bucket` porte une ligne par objet et par tranche de 5 minutes, avec la clé primaire
`(device_id, bucket_start, bucket_minutes)`. Les bornes sont alignées sur l'heure ronde, donc
recalculer une tranche donne toujours le même résultat et écrase la précédente au lieu d'en
créer une seconde.

Le job recalcule une tranche entière à partir de `telemetry` au lieu de l'incrémenter. C'est
plus de travail, mais le résultat ne dépend pas de l'ordre d'arrivée : une mesure en retard
corrige sa tranche, et rejouer le job donne exactement le même résultat.

Les tranches plus vieilles que 7 jours sont supprimées par le job, pour rester d'accord avec
la rétention de `telemetry` : une tranche plus ancienne ne pourrait plus être recalculée.
