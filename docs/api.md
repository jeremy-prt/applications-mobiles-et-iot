# Contrat de l'API

Interface entre le backend et l'application mobile. REST, JSON, UTF-8.

## Conventions

Les dates sont au format ISO 8601 en UTC, comme dans le contrat MQTT du kit.

Une erreur renvoie toujours la même forme :

```json
{ "error": { "code": "DEVICE_NOT_FOUND", "message": "Objet inconnu" } }
```

Le mobile s'appuie sur `code` pour choisir quoi afficher, jamais sur `message`, qui est
destiné aux humains.

Toutes les routes sauf la connexion attendent un en-tête
`Authorization: Bearer <jeton>`.

## Les routes

| Méthode | Chemin | Rôle | Droit requis |
|---|---|---|---|
| POST | `/auth/login` | Obtenir un jeton | aucun |
| GET | `/rooms` | Les salles avec la dernière mesure de chacune | consultation |
| GET | `/rooms/:id` | Une salle et ses objets | consultation |
| GET | `/devices/:id` | Le détail d'un objet, son état et sa fraîcheur | consultation |
| GET | `/devices/:id/telemetry` | L'historique borné d'un objet, 500 points au maximum par appel | consultation |
| POST | `/devices/:id/commands` | Demander l'activation ou l'arrêt de la ventilation | commande |
| GET | `/commands/:id` | Le suivi d'une commande | consultation |
| POST | `/associations` | Associer un objet scanné à une salle | commande |
| GET | `/alerts` | Les alertes en cours et récentes | consultation |

## Ce que le mobile a besoin de savoir sur chaque mesure

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

`recorded_at` est l'heure du capteur, pas l'heure de la réponse. `is_stale` est calculé par
le backend à partir du seuil de fraîcheur déclaré dans `docs/architecture.md`, pour que le
mobile n'ait pas à refaire ce calcul avec une horloge qui peut différer. `availability`
vient du broker et dit si l'objet est joignable, ce qui est une information différente de
la fraîcheur.

## L'envoi d'une commande

`POST /devices/:id/commands` ne renvoie pas le résultat de l'action. Il renvoie un
identifiant de commande et le statut `pending`.

Le mobile interroge ensuite `GET /commands/:id` jusqu'à obtenir un statut définitif.

Nos statuts ne sont pas ceux du kit. Le simulateur répond `executed` ou `rejected` avec une
raison, et ne répond pas du tout quand il est en mode sans réponse. La correspondance :

| Notre statut | D'où il vient |
|---|---|
| `pending` | La commande est partie, rien n'est encore revenu |
| `executed` | Le simulateur a répondu `executed` |
| `rejected` | Le simulateur a répondu `rejected`, sa raison est conservée |
| `unknown` | Rien n'est revenu dans les 15 secondes. On ne sait pas si l'action a eu lieu |

Il n'y a pas de statut `failed` : un échec supposerait qu'on sait que l'action n'a pas eu
lieu, ce qui n'est jamais le cas en l'absence de réponse.

Une réponse arrivant après les 15 secondes est quand même traitée et corrélée par son
`command_id`. L'état réel de la ventilation reste celui du topic `state`.

C'est voulu. Une commande acceptée n'est pas une action réalisée, et l'application ne doit
jamais afficher "activé" tant que l'objet n'a pas confirmé.

## Le contrôle des droits

Le droit est vérifié dans le backend, dans un hook Fastify qui s'exécute avant la route.
Masquer un bouton dans l'application ne constitue pas un contrôle d'accès : un appel direct
à l'API avec un compte sans droit doit être refusé.

## Ce qui reste à écrire

Le détail de chaque route, corps de requête et de réponse, et la liste complète des codes
d'erreur. À compléter au fur et à mesure du développement.
