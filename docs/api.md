# Contrat de l'API

Interface entre le backend et l'application mobile. REST, JSON, UTF-8. Dates en ISO 8601 UTC,
comme dans le contrat MQTT du kit. La cible est que toutes les routes sauf la connexion
attendent un en-tête `Authorization: Bearer <jeton>`. Ce n'est pas encore le cas, voir l'état
en fin de document.

Une erreur renvoie toujours la même forme, et le mobile s'appuie sur `code`, pas sur `message`.

```json
{ "error": { "code": "DEVICE_NOT_FOUND", "message": "Objet inconnu" } }
```

## Les routes

| Méthode | Chemin | Rôle | Droit requis |
|---|---|---|---|
| GET | `/health` | État du service et de la base | aucun |
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
  "temperature": { "value": 22.1, "unit": "°C" },
  "co2": { "value": 700, "unit": "ppm" },
  "recorded_at": "2026-09-15T08:01:11.190Z",
  "is_stale": false,
  "availability": "online"
}
```

`recorded_at` est l'heure du capteur, pas celle de la réponse. `is_stale` est calculé par le
backend à partir du seuil de `docs/architecture.md`, pour que le mobile n'ait pas à le recalculer
avec une horloge qui peut différer. `availability` vient du broker et dit si l'objet est
joignable, ce qui n'est pas la fraîcheur.

## L'envoi d'une commande

`POST /devices/:id/commands` renvoie un identifiant de commande et le statut `pending`. Le mobile
interroge ensuite `GET /commands/:id` jusqu'à un statut définitif. L'application n'affiche jamais
« activé » tant que l'objet n'a pas confirmé. Nos statuts ne sont pas ceux du kit. Le simulateur
répond `executed` ou `rejected` avec une raison, et ne répond pas du tout en mode sans réponse.

| Notre statut | D'où il vient |
|---|---|
| `pending` | La commande est partie, rien n'est encore revenu |
| `executed` | Le simulateur a répondu `executed` |
| `rejected` | Le simulateur a répondu `rejected`, sa raison est conservée |
| `unknown` | Rien n'est revenu dans les 15 secondes. On ne sait pas si l'action a eu lieu |

Il n'y a pas de statut `failed`, car un échec supposerait qu'on sait que l'action n'a pas eu
lieu. Sans réponse, on ne le sait jamais.

Une réponse arrivant après les 15 secondes est traitée quand même, corrélée par son `command_id`.
Une commande abandonnée n'est jamais rejouée, toute nouvelle intention utilise un nouveau
`command_id`, et l'état réel de la ventilation reste celui du topic `state`.

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
limite au-delà de 500 est refusée avec un 400, un objet inconnu avec un 404 et `DEVICE_NOT_FOUND`.

## État au 16 septembre 2026

Sont implémentées : `/health`, `/rooms` et `/devices/:id/telemetry`, toutes sans
authentification. Restent à écrire : `/auth/login`, `/rooms/:id`, `/devices/:id`, les commandes,
les associations, les alertes, et le contrôle des droits sur l'ensemble.
