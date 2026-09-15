# Contrat de l'API

Interface entre le backend et l'application mobile. REST, JSON, UTF-8. Dates en ISO 8601
UTC, comme dans le contrat MQTT du kit. Toutes les routes sauf la connexion attendent un
en-tête `Authorization: Bearer <jeton>`.

Une erreur renvoie toujours la même forme, et le mobile s'appuie sur `code`, jamais sur
`message`, destiné aux humains :

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

Toute réponse qui contient une mesure porte les mêmes champs :

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
backend à partir du seuil de fraîcheur déclaré dans `docs/architecture.md`, pour que le
mobile n'ait pas à le recalculer avec une horloge qui peut différer. `availability` vient du
broker et dit si l'objet est joignable, ce qui est différent de la fraîcheur.

## L'envoi d'une commande

`POST /devices/:id/commands` ne renvoie pas le résultat de l'action, mais un identifiant de
commande et le statut `pending`. Le mobile interroge ensuite `GET /commands/:id` jusqu'à un
statut définitif. L'application ne doit jamais afficher « activé » tant que l'objet n'a pas
confirmé.

Nos statuts ne sont pas ceux du kit. Le simulateur répond `executed` ou `rejected` avec une
raison, et ne répond pas du tout en mode sans réponse.

| Notre statut | D'où il vient |
|---|---|
| `pending` | La commande est partie, rien n'est encore revenu |
| `executed` | Le simulateur a répondu `executed` |
| `rejected` | Le simulateur a répondu `rejected`, sa raison est conservée |
| `unknown` | Rien n'est revenu dans les 15 secondes. On ne sait pas si l'action a eu lieu |

Pas de statut `failed` : un échec supposerait qu'on sait que l'action n'a pas eu lieu, ce
qui n'est jamais le cas en l'absence de réponse.

Une réponse arrivant après les 15 secondes est quand même traitée et corrélée par son
`command_id`. Une commande abandonnée n'est jamais rejouée automatiquement, et toute nouvelle
intention utilise un nouveau `command_id`. L'état réel de la ventilation reste celui du topic
`state`.

## État au 15 septembre 2026

Seules `/health` et `/rooms` sont implémentées, et sans authentification. Le reste décrit le
contrat visé.

Restent à écrire : le détail de chaque route, les corps de requête et de réponse, et la
liste complète des codes d'erreur.
