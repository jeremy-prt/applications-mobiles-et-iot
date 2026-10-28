# Contrat de l'API

REST, JSON, UTF-8. Dates ISO 8601 UTC, comme le contrat MQTT du kit. Cible : toutes les routes
sauf la connexion demandent `Authorization: Bearer <jeton>` (pas encore fait, voir la fin).

Erreurs toujours sous cette forme. Le mobile lit `code`, pas `message`.

```json
{ "error": { "code": "DEVICE_NOT_FOUND", "message": "Objet inconnu" } }
```

Requête mal formée (hors bornes, corps absent, mauvais type) : 400 `INVALID_REQUEST`, partout.

## Les routes

| Méthode | Chemin | Rôle | Droit requis |
|---|---|---|---|
| GET | `/health` | État du service, base, zone brute, broker, job | aucun |
| POST | `/auth/login` | Obtenir un jeton | aucun |
| GET | `/rooms` | Salles et dernière mesure | consultation |
| GET | `/rooms/:id` | Une salle et ses objets | consultation |
| GET | `/devices/:id` | Détail, état, fraîcheur | consultation |
| GET | `/devices/:id/telemetry` | Historique, 500 points max | consultation |
| POST | `/devices/:id/commands` | Activer ou arrêter la ventilation | commande |
| GET | `/commands/:id` | Suivi d'une commande | consultation |
| POST | `/associations` | Associer un objet scanné à une salle | commande |
| GET | `/alerts` | Alertes en cours et récentes, 100 max | consultation |

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
  "ventilation": false,
  "alert": null
}
```

- `recorded_at` : heure du capteur.
- `is_stale` : calculé par le backend (seuil dans `docs/architecture.md`), car l'horloge du
  téléphone peut différer.
- `availability` : joignable ou non, selon le broker. Ce n'est pas la fraîcheur.
- `ventilation` : état annoncé par l'objet sur `state`, `null` avant sa première annonce. Seul
  état réel, une commande ne le change pas.
- `alert` : alerte active, au format de `GET /alerts`, ou `null`.

## L'envoi d'une commande

`POST /devices/:id/commands`

```json
{ "command_id": "cmd-6f1c2a9e-4b7d-4c1e-9a52-3e8d0f7b1c44", "enabled": true }
```

`command_id` : choisi par le mobile, 1 à 80 caractères parmi lettres, chiffres, `_` et `-`
(format du kit). C'est la clé d'idempotence, voir
`docs/decisions/J4/15-idempotence-des-commandes.md`. `enabled` est une consigne absolue, jamais
une inversion.

| Code | Quand |
|---|---|
| 202 | Nouvelle commande, enregistrée et publiée, statut `pending` |
| 200 | Renvoi identique (même `command_id`, même contenu). Rendue telle quelle, pas republiée |
| 409 `COMMAND_ID_CONFLICT` | Même `command_id`, autre objet ou autre consigne |
| 409 `DEVICE_OFFLINE` | Objet hors ligne. Le kit ne garde pas ses commandes |
| 403 `DEVICE_NOT_AUTHORIZED` | Objet connu mais non autorisé dans le registre |
| 404 `DEVICE_NOT_FOUND` | Objet inconnu |
| 400 `INVALID_REQUEST` | Corps invalide ou `command_id` hors format |

Le renvoi est testé avant l'objet, donc il reste en 200 même si l'objet est passé hors ligne.
Le backend attend l'accusé du broker 2 secondes au plus. Sinon il répond avec `published_at` à
`null` et la publication continue en arrière-plan.

`GET /commands/:id` renvoie la même forme, ou 404 `COMMAND_NOT_FOUND`.

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
| `requested_at` | Acceptation par le backend |
| `published_at` | Accusé du broker, `null` avant |
| `expires_at` | Demande + 10 s. Après, l'objet refuse |
| `result_at` | Réception du résultat |
| `reason` | Raison du refus, mot pour mot |
| `late` | Résultat arrivé après les 15 s d'attente |

Le mobile interroge cette route jusqu'à un statut définitif et n'affiche « activé » qu'après
confirmation. Le simulateur répond `executed`, `rejected` avec une raison, ou rien en mode sans
réponse. Nos statuts :

| Notre statut | D'où il vient |
|---|---|
| `pending` | Acceptée, rien n'est revenu |
| `executed` | Réponse `executed` |
| `rejected` | Réponse `rejected`, raison gardée |
| `unknown` | Rien en 15 s. Le job passe toutes les 5 s, donc bascule entre 15 et 20 s. On ne sait pas si l'action a eu lieu |

Pas de `failed` : sans réponse, on ne peut pas savoir que l'action a échoué.

Une réponse après 15 s est quand même appliquée, via son `command_id`, avec `late` à vrai. Une
commande `executed` ou `rejected` ne change plus. Une commande abandonnée n'est jamais
rejouée : nouvelle intention, nouveau `command_id`. Voir
`docs/decisions/J4/16-commande-sans-reponse-et-delai.md`.

## Historique d'un objet

`GET /devices/:id/telemetry`

| Paramètre | Valeurs | Défaut |
|---|---|---|
| `resolution` | `raw` (mesures reçues) ou `5m` (tranches de 5 min) | `raw` |
| `from`, `to` | ISO 8601 avec fuseau | 24 dernières heures |
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

Points du plus ancien au plus récent. Au-delà de la limite, on rend les plus récents avec
`truncated` à `true`, sinon l'écran resterait figé sur le passé. En `raw`, `samples` et les
bornes valent `null`.

Erreurs : `limit` au-delà de 500 ou `from` après `to` donnent 400 `INVALID_REQUEST`, objet
inconnu 404 `DEVICE_NOT_FOUND`. Avant J5, une période à l'envers rendait une liste vide, qu'on
confondait avec un capteur muet.

## Les alertes

`GET /alerts`

| Paramètre | Valeurs | Défaut |
|---|---|---|
| `status` | `active`, `resolved` ou `all` | `all` |
| `device_id` | objet connu, sinon 404 `DEVICE_NOT_FOUND` | tous |
| `limit` | 1 à 100 | 20 |

```json
{
  "alerts": [
    {
      "id": 4,
      "device_id": "sensor-001",
      "room_id": "salle-203",
      "kind": "co2_high",
      "status": "resolved",
      "threshold_on": 1000,
      "threshold_off": 800,
      "opened_at": "2026-10-28T08:29:58.736Z",
      "opening_value": 1813,
      "peak_value": 2056,
      "last_value": 610,
      "last_measure_at": "2026-10-28T08:30:42.964Z",
      "measures": 22,
      "closed_at": "2026-10-28T08:30:42.964Z",
      "closing_value": 610
    }
  ]
}
```

Tri de la plus récente à la plus ancienne. Une alerte est un épisode : ouverte à la première
mesure à 1000 ppm ou plus, mise à jour (`peak_value`, `last_value`, `measures`) à chaque
mesure, `resolved` à la première mesure sous 800 ppm. Dates du capteur, seuils recopiés dans
l'alerte. Règle : `docs/decisions/J5/17-regle-d-alerte-co2.md`.

`/rooms` donne déjà l'alerte active, donc le mobile n'appelle `/alerts` que pour l'historique
d'un capteur.

## État au 28 octobre 2026

Faites, sans authentification : `/health`, `/rooms`, `/devices/:id/telemetry`,
`POST /devices/:id/commands`, `GET /commands/:id`, `GET /alerts`. Pas écrites : `/auth/login`,
`/rooms/:id`, `/devices/:id`, les associations, le contrôle des droits. Périmètre gelé après
J5, elles sont hors livrable.
