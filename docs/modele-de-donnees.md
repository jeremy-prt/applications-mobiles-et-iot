# Modèle de données

Une base PostgreSQL 18 avec TimescaleDB. Dates en `timestamptz`, en UTC, comme le contrat MQTT
du kit.

## Les tables

| Table | Ce qu'elle contient |
|---|---|
| `rooms` | Salles du campus |
| `devices` | Objets et leur salle |
| `telemetry` | Toutes les mesures. Hypertable TimescaleDB |
| `telemetry_bucket` | Tranches de 5 minutes du job : moyenne, minimum, maximum |
| `device_state` | Dernier état, une ligne par objet |
| `commands` | Commandes et leur suivi |
| `alerts` | Alertes CO2, une ligne par épisode |

Prévues en J1, pas créées : `users`, `roles`, `user_roles` (authentification non livrée) et
`alert_rules` (une seule règle, seuils dans la config du backend et recopiés dans chaque
alerte).

## Les règles garanties par la base

Index unique `telemetry_dedup` sur `(device_id, message_id, recorded_at)`. L'insertion fait
`INSERT ... ON CONFLICT (device_id, message_id, recorded_at) DO NOTHING`, et le nombre de
lignes affectées dit si c'est un doublon. L'unicité vient de l'index, car un test dans le code
serait une course. Voir `docs/decisions/J1/03-base-de-donnees-postgresql.md`.

`recorded_at` est dans l'index car TimescaleDB l'exige pour un index unique sur une hypertable.
Sans effet : un doublon rejoue le même triplet.

| Colonne | Ce que c'est | À quoi elle sert |
|---|---|---|
| `recorded_at` | Heure capteur, champ `observed_at` | Mesures dans le désordre, fraîcheur |
| `received_at` | Réception par le backend | Retard de transport |

`telemetry` garde toutes les mesures, même en retard. `device_state` ne garde que la plus
récente :

```sql
UPDATE device_state SET ... WHERE device_id = $1 AND last_recorded_at < $2
```

Une mesure ancienne va dans l'historique sans changer l'affichage.

Deux colonnes de `device_state` ne viennent pas des mesures. `availability` vient du topic du
même nom et du testament du broker : elle distingue un objet déconnecté d'un objet qui ne
mesure plus. `ventilation` vient du topic `state`, seule source de l'état réel.

`commands` a pour clé primaire le `command_id` du mobile, avec `ON CONFLICT (command_id) DO
NOTHING`, donc deux envois simultanés font une seule ligne. Une contrainte limite `status` à
`pending`, `executed`, `rejected` et `unknown`. Un résultat ne s'applique que si la commande
est `pending` ou `unknown` (mise à jour conditionnelle), donc une commande définitive ne
change plus.

L'attente est en base, pas en mémoire, donc un redémarrage ne perd rien. À chaque passage, le
job passe en `unknown` les `pending` de plus de 15 secondes. L'index partiel
`commands_en_attente`, sur `requested_at` et limité aux `pending`, garde cette recherche
rapide.

Le `room_id` des mesures n'est qu'une valeur de départ. Ensuite `devices` fait foi, donc un
message n'écrase pas une réaffectation faite dans l'application (contrat du kit, scénario R10).

## Les commandes

Champs détaillés dans [api.md](api.md#lenvoi-dune-commande).

| Colonne | Ce que c'est | À quoi elle sert |
|---|---|---|
| `command_id` | Clé primaire, choisie par le mobile | Renvoi, lien avec résultat et traces |
| `device_id` | Référence vers `devices` | Vérifier l'origine du résultat |
| `action` | Toujours `set_ventilation` | Seule action du kit |
| `enabled` | Activer ou arrêter | Renvoi ou conflit |
| `status` | `pending`, `executed`, `rejected`, `unknown` | Suivi mobile |
| `reason` | Raison du refus | Affichée telle quelle |
| `requested_at` | Acceptation | Attente maximale, retard |
| `published_at` | Accusé du broker, vide sinon | Jamais partie ou sans réponse |
| `expires_at` | Demande + 10 secondes | L'objet refuse après |
| `result_at` | Réception du résultat | Dater la confirmation |
| `late` | Résultat après l'attente maximale | Confirmation tardive |

## Les alertes

| Colonne | Ce que c'est | À quoi elle sert |
|---|---|---|
| `id` | Numéro de la base | Champ `alertId` des traces |
| `device_id`, `room_id` | Objet, et sa salle à l'ouverture | Placer l'alerte |
| `kind` | Toujours `co2_high` | Seul type |
| `status` | `active` ou `resolved` | Épisode fini ou non |
| `threshold_on`, `threshold_off` | Seuils à l'ouverture | Relire après un changement de seuils |
| `opened_at`, `opening_value` | Date et valeur de la première mesure au seuil | Début |
| `peak_value`, `last_value`, `last_measure_at`, `measures` | Pic, dernière valeur et sa date, nombre de mesures | Une ligne pour tout l'épisode |
| `closed_at`, `closing_value` | Première mesure sous le seuil de retour | Retour à la normale |

L'index unique partiel `alerts_une_active`, sur `(device_id, kind)` limité aux `active`,
interdit une seconde alerte active. Ouverture en `ON CONFLICT DO NOTHING`, fermeture
conditionnée à `status = 'active'`. L'index `alerts_recentes` sur `opened_at` sert
`GET /alerts`. Alertes et commandes sont gardées sans limite : quelques lignes par jour et par
salle.

## La zone brute, dans MongoDB

Depuis J2, le consommateur MQTT dépose chaque message, sans validation, dans la collection
`messages` de la base `campus_brut`. Le job de consolidation la relit et remplit les tables
ci-dessus. Voir `docs/decisions/J2/08-base-brute-mongodb.md`.

| Champ | Contenu |
|---|---|
| `topic` | Topic MQTT tel quel |
| `device_id` | Tiré du topic, pas du corps (routage) |
| `genre` | `telemetry`, `state`, `availability`, `result`, ou `inconnu` |
| `payload` | Message décodé, absent si pas JSON |
| `texte` | Texte original, seulement si non décodé |
| `received_at` | Réception par le backend |
| `statut` | `en_attente`, `traite`, `rejete`, `abandonne` |
| `essais` | Passages du job en échec |
| `motif` | Raison du rejet, ou doublon écarté |

Trois index : `(statut, received_at)` pour lire les non traités dans l'ordre d'arrivée, un
TTL de 7 jours sur `received_at` pour la rétention, et `event_id` pour retrouver un message
à partir de ses traces.

Un `state` ou `availability` reçu avant que l'objet existe attend le tour suivant. Après 60
passages, soit 5 minutes, il est abandonné.

La déduplication se fait dans PostgreSQL. La zone brute accepte les doublons : un même
`message_id` peut y être deux fois, le second avec le motif « doublon écarté ».

## Les tranches et la rétention

`telemetry_bucket` : une ligne par objet et par tranche de 5 minutes, clé primaire
`(device_id, bucket_start, bucket_minutes)`. Bornes alignées sur l'heure ronde, donc un
recalcul écrase la tranche au lieu d'en créer une autre.

Le job recalcule toute la tranche depuis `telemetry` au lieu de l'incrémenter. Le résultat ne
dépend donc pas de l'ordre d'arrivée : une mesure en retard corrige sa tranche, et rejouer le
job donne le même résultat.

`telemetry` a une rétention TimescaleDB de 7 jours. Le job supprime les tranches de plus de 7
jours, car elles ne seraient plus recalculables.

Deux limites connues, sans effet pratique ici. Un `message_id` supprimé par la rétention
n'écarte plus son doublon, mais le kit ne rejoue jamais un message de plus de sept jours.

Au redémarrage du simulateur, le `boot_id` change et tous les `message_id` sont renouvelés.
Une mesure identique republiée compterait comme nouvelle. Le kit considère qu'un redémarrage
produit de nouvelles observations.
