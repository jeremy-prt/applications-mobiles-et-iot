# Contrat de l'API

Interface entre le backend et l'application mobile. REST, JSON, UTF-8. Dates en ISO 8601 UTC,
comme dans le contrat MQTT du kit. La cible est que toutes les routes sauf la connexion
attendent un en-tête `Authorization: Bearer <jeton>`. Ce n'est pas encore le cas, voir l'état
en fin de document.

Une erreur renvoie toujours la même forme, et le mobile s'appuie sur `code`, pas sur `message`.

```json
{ "error": { "code": "DEVICE_NOT_FOUND", "message": "Objet inconnu" } }
```

Une requête mal formée, sur n'importe quelle route, reçoit un 400 avec le code
`INVALID_REQUEST` : paramètre hors bornes, corps absent ou champ du mauvais type.

## Les routes

| Méthode | Chemin | Rôle | Droit requis |
|---|---|---|---|
| GET | `/health` | État du service, de la base, de la zone brute et du lien au broker | aucun |
| POST | `/auth/login` | Obtenir un jeton | aucun |
| GET | `/rooms` | Les salles avec la dernière mesure de chacune | consultation |
| GET | `/rooms/:id` | Une salle et ses objets | consultation |
| GET | `/devices/:id` | Le détail d'un objet, son état et sa fraîcheur | consultation |
| GET | `/devices/:id/telemetry` | L'historique borné d'un objet, 500 points au maximum par appel | consultation |
| POST | `/devices/:id/commands` | Demander l'activation ou l'arrêt de la ventilation | commande |
| GET | `/commands/:id` | Le suivi d'une commande | consultation |
| POST | `/associations` | Associer un objet scanné à une salle | commande |
| GET | `/alerts` | Les alertes en cours et récentes | consultation |

## La forme d'une mesure

```json
{
  "device_id": "sensor-001",
  "room_id": "salle-203",
  "temperature": { "value": 22.1, "unit": "°C" },
  "co2": { "value": 700, "unit": "ppm" },
  "recorded_at": "2026-09-15T08:01:11.190Z",
  "is_stale": false,
  "availability": "online",
  "ventilation": false
}
```

`recorded_at` est l'heure du capteur, pas celle de la réponse. `is_stale` est calculé par le
backend à partir du seuil de `docs/architecture.md`, pour que le mobile n'ait pas à le recalculer
avec une horloge qui peut différer. `availability` vient du broker et dit si l'objet est
joignable, ce qui n'est pas la fraîcheur. `ventilation` est l'état annoncé par l'objet sur son
topic `state`, et `null` tant qu'il n'a rien annoncé. C'est le seul état réel de la
ventilation, une commande ne le modifie pas.

## L'envoi d'une commande

`POST /devices/:id/commands`

```json
{ "command_id": "cmd-6f1c2a9e-4b7d-4c1e-9a52-3e8d0f7b1c44", "enabled": true }
```

Le `command_id` est choisi par le mobile, au format du contrat du kit : 1 à 80 caractères parmi
les lettres, les chiffres, `_` et `-`. C'est la clé d'idempotence, voir
`docs/decisions/J4/15-idempotence-des-commandes.md`. `enabled` est une consigne absolue,
activer ou arrêter, jamais une inversion.

| Code | Quand |
|---|---|
| 202 | Nouvelle commande, enregistrée et publiée. Statut `pending` |
| 200 | Même `command_id` et même contenu qu'une commande existante. Elle est renvoyée telle quelle, sans nouvelle publication |
| 409 `COMMAND_ID_CONFLICT` | Même `command_id` avec un autre objet ou une autre consigne |
| 409 `DEVICE_OFFLINE` | L'objet est annoncé hors ligne. Le kit ne garde pas les commandes d'un objet absent |
| 403 `DEVICE_NOT_AUTHORIZED` | L'objet existe mais n'est pas autorisé dans le registre |
| 404 `DEVICE_NOT_FOUND` | Objet inconnu |
| 400 `INVALID_REQUEST` | Corps invalide ou `command_id` hors format |

Le renvoi est reconnu avant de regarder l'objet : une commande déjà acceptée reste lisible en
200 même si l'objet est passé hors ligne depuis.

Le backend attend l'accusé du broker au plus 2 secondes avant de répondre. Au-delà, la réponse
part avec `published_at` à `null`, et la publication continue en arrière-plan.

`GET /commands/:id` renvoie la même forme, ou un 404 `COMMAND_NOT_FOUND`.

```json
{
  "command_id": "cmd-6f1c2a9e-4b7d-4c1e-9a52-3e8d0f7b1c44",
  "device_id": "sensor-001",
  "action": "set_ventilation",
  "enabled": true,
  "status": "executed",
  "reason": null,
  "requested_at": "2026-10-07T12:00:00.000Z",
  "published_at": "2026-10-07T12:00:00.005Z",
  "expires_at": "2026-10-07T12:00:10.000Z",
  "result_at": "2026-10-07T12:00:00.047Z",
  "late": false
}
```

| Champ | Ce que c'est |
|---|---|
| `requested_at` | L'heure où le backend a accepté la demande |
| `published_at` | L'heure de l'accusé du broker. `null` tant qu'il n'est pas arrivé |
| `expires_at` | 10 secondes après la demande. Passé cette date, l'objet refuse d'exécuter |
| `result_at` | L'heure de réception du résultat par le backend |
| `reason` | La raison donnée par l'objet quand il refuse, telle qu'il l'a écrite |
| `late` | Vrai si le résultat est arrivé après l'attente maximale de 15 secondes |

Le mobile interroge `GET /commands/:id` jusqu'à un statut définitif. L'application n'affiche
jamais « activé » tant que l'objet n'a pas confirmé. Nos statuts ne sont pas ceux du kit. Le
simulateur répond `executed` ou `rejected` avec une raison, et ne répond pas du tout en mode
sans réponse.

| Notre statut | D'où il vient |
|---|---|
| `pending` | La commande est acceptée, rien n'est encore revenu |
| `executed` | Le simulateur a répondu `executed` |
| `rejected` | Le simulateur a répondu `rejected`, sa raison est conservée |
| `unknown` | Rien n'est revenu dans les 15 secondes. Le job le vérifie toutes les 5 secondes, donc la bascule a lieu entre 15 et 20 secondes. On ne sait pas si l'action a eu lieu |

Il n'y a pas de statut `failed`, car un échec supposerait qu'on sait que l'action n'a pas eu
lieu. Sans réponse, on ne le sait jamais.

Une réponse arrivant après les 15 secondes est appliquée quand même, corrélée par son
`command_id`, avec `late` à vrai. Une commande déjà `executed` ou `rejected` ne change plus. Une
commande abandonnée n'est jamais rejouée, toute nouvelle intention utilise un nouveau
`command_id`. Voir `docs/decisions/J4/16-commande-sans-reponse-et-delai.md`.

## Historique d'un objet

`GET /devices/:id/telemetry`

| Paramètre | Valeurs | Défaut |
|---|---|---|
| `resolution` | `raw` pour les mesures reçues, `5m` pour les tranches de 5 minutes | `raw` |
| `from`, `to` | dates ISO 8601 avec fuseau | les 24 dernières heures |
| `limit` | 1 à 500 | 500 |

```json
{
  "device_id": "sensor-001",
  "resolution": "5m",
  "from": "2026-09-15T08:00:00.000Z",
  "to": "2026-09-16T08:00:00.000Z",
  "limit": 72,
  "truncated": false,
  "points": [
    {
      "at": "2026-09-16T07:50:00.000Z",
      "temperature": 21.95,
      "co2": 2500,
      "samples": 43,
      "temperature_min": 21.62,
      "temperature_max": 22.39,
      "co2_min": 2500,
      "co2_max": 2500
    }
  ]
}
```

Les points vont du plus ancien au plus récent, pour être tracés dans cet ordre. Quand la période
contient plus de points que la limite, ce sont les plus récents qui sont rendus et `truncated`
vaut `true`. Prendre les plus anciens figerait l'écran sur une période qui ne bouge plus.

En `raw`, `samples` et les bornes valent `null`, car une mesure reçue n'a rien à agréger. Une
limite au-delà de 500 est refusée avec un 400 et `INVALID_REQUEST`, un objet inconnu avec un 404
et `DEVICE_NOT_FOUND`.

## État au 7 octobre 2026

Sont implémentées : `/health`, `/rooms`, `/devices/:id/telemetry`, `POST /devices/:id/commands`
et `GET /commands/:id`, toutes sans authentification. Restent à écrire : `/auth/login`,
`/rooms/:id`, `/devices/:id`, les associations, les alertes, et le contrôle des droits sur
l'ensemble.
