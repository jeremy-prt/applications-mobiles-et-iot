# Ce qu'on a observé sur le réseau

Captures réelles, faites avant d'écrire une ligne de code. Commandes lancées depuis `kit/`.

## Les 5 topics qui circulent

| Topic | Ce que c'est |
|---|---|
| `.../telemetry` | Une mesure : température, CO2, heure |
| `.../state` | L'état de l'appareil : ventilation allumée ou éteinte |
| `.../availability` | L'appareil est connecté ou non |
| `.../results` | Sa réponse à une commande |
| `.../commands` | Un ordre. C'est nous qui écrirons là-dedans |

Une mesure normale :

```json
{
  "schema_version": 1,
  "message_id": "a6ca5d400a2d468299792b252a0ed0dc-292",
  "device_id": "sensor-001",
  "room_id": "salle-203",
  "observed_at": "2026-09-15T08:01:11.190Z",
  "temperature": {"value": 21.67, "unit": "°C"},
  "co2": {"value": 679, "unit": "ppm"}
}
```

Le `message_id` est la carte d'identité de la mesure. Il se termine par un numéro qui
s'incrémente : `-292`, `-293`, `-294`.

## Manip 1 : allumer la ventilation

`docker compose run --rm tools command sensor-001 on`

Un ordre est parti sur `campus/v1/devices/sensor-001/commands`, avec
`command_id: 0356f7aab3aa45568105bb452e077a20`, `action: set_ventilation`, `enabled: true`
et `expires_at: 2026-09-15T08:01:38.258892+00:00`, soit 15 secondes plus tard. Après cette
date, l'appareil ignore l'ordre.

Le capteur a passé `"ventilation": true` sur `.../state`, puis répondu sur `.../results` :

```json
{
  "command_id": "0356f7aab3aa45568105bb452e077a20",
  "status": "executed",
  "executed_at": "2026-09-15T08:01:23.299Z",
  "ventilation": true
}
```

Et le CO2 est descendu, une mesure toutes les 2 secondes : 745 ppm à 08:01:21 avant la
commande, puis 699, 656, 614, 571, 528, 480, 438, et 420 à 08:01:37, le plancher du modèle.

Le cycle d'une commande fait donc 3 étapes et pas 1 : on demande (`commands`), l'appareil
répond qu'il a fait (`results`), on constate le changement dans les mesures.

Sans ventilation le CO2 monte d'environ 12 ppm par mesure, avec ventilation il descend
d'environ 45. Le modèle est borné entre 420 et 2500 ppm.

## Manip 2 : le doublon

`docker compose run --rm tools incident sensor-001 duplicate`

```
message_id ...-311   CO2 444
message_id ...-312   CO2 455
message_id ...-312   CO2 455   <-- le même, renvoyé une deuxième fois
message_id ...-313   CO2 469
```

Le message `-312` est arrivé deux fois, strictement identique.

## Manip 3 : la mesure en retard

`docker compose run --rm tools incident sensor-001 delay`

```
08:02:05   ...-320   observed_at 08:02:07   CO2 546
08:02:07   delayed-2fbffad0   observed_at 08:01:07   CO2 546   <-- datée d'il y a 1 minute
08:02:09   ...-321   observed_at 08:02:09   CO2 555
```

Une mesure datée de 60 secondes plus tôt est arrivée après une mesure plus récente :
l'ordre d'arrivée n'est pas l'ordre des événements.

## Manip 4 : le message invalide

`docker compose run --rm tools incident sensor-001 invalid`

```json
{
  "message_id": "invalid-7f183596f43647a182e4ed0ad71d2b27",
  "device_id": "sensor-001",
  "observed_at": "2026-09-15T08:02:15.933Z",
  "temperature": {"value": 21.68, "unit": "°C"},
  "co2": {"value": "invalide", "unit": "ppm"}
}
```

Le CO2 vaut le texte `"invalide"` au lieu d'un nombre. Le message suivant est redevenu
normal.

## Manip 5 : le capteur muet

`docker compose run --rm tools incident sensor-001 pause`

Sur 8 messages écoutés pendant la pause : 0 reçu de sensor-001, 4 de sensor-002, 4 de
sensor-003. Mais l'`availability` de sensor-001 est restée à
`{"device_id": "sensor-001", "status": "online"}`.

Le capteur est connecté et dit « je suis en ligne », mais n'envoie plus aucune mesure. Être
joignable et mesurer sont deux choses distinctes, d'où la règle de fraîcheur déclarée dans
`docs/architecture.md`.

Pour relancer le capteur : `docker compose run --rm tools incident sensor-001 reset`.

## Ce qu'on retient pour le backend

| Le problème vu | Ce que le backend devra faire | Scénario |
|---|---|---|
| Doublon | Ignorer un `message_id` déjà enregistré | R03 |
| Mesure en retard | Comparer `observed_at`, ne pas régresser l'état courant | R03 |
| Message invalide | Valider, rejeter, tracer, et continuer à tourner | R02 |
| Capteur muet | Calculer une fraîcheur, séparée de la connexion | R04 |
| Commande | Attendre le `results`, avec un délai maximum | R08, R09 |
