# Ce qu'on a observé sur le réseau

Toutes les commandes se lancent depuis le dossier `kit/`.
Les messages ci-dessous sont de vraies captures, pas des exemples inventés.

---

## Les 4 types de messages qui circulent

Avant les manips, voilà ce qu'un capteur envoie.

| Topic | Ce que c'est | En clair |
|---|---|---|
| `.../telemetry` | Une mesure | « Il fait 22 °C et 700 ppm de CO2, à telle heure » |
| `.../state` | L'état de l'appareil | « Ma ventilation est allumée / éteinte » |
| `.../availability` | Est-il connecté | « Je suis en ligne » |
| `.../results` | Réponse à une commande | « J'ai bien exécuté ce que tu m'as demandé » |
| `.../commands` | Un ordre | C'est **nous** qui écrirons là-dedans |

Une mesure normale ressemble à ça :

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

Le champ important c'est **`message_id`**. C'est la carte d'identité de la mesure.
Il se termine par un numéro qui s'incrémente : `-292`, `-293`, `-294`...

---

## Manip 1 : allumer la ventilation

```sh
docker compose run --rm tools command sensor-001 on
```

### Ce qui s'est passé, dans l'ordre

**1.** Un ordre est parti sur `campus/v1/devices/sensor-001/commands` :

```json
{
  "command_id": "0356f7aab3aa45568105bb452e077a20",
  "action": "set_ventilation",
  "enabled": true,
  "expires_at": "2026-09-15T08:01:38.258892+00:00"
}
```

**2.** Le capteur a changé son état sur `.../state` : `"ventilation": true`

**3.** Il a répondu sur `.../results` :

```json
{
  "command_id": "0356f7aab3aa45568105bb452e077a20",
  "status": "executed",
  "executed_at": "2026-09-15T08:01:23.299Z",
  "ventilation": true
}
```

**4.** Et le CO2 s'est mis à descendre :

| Heure | CO2 |
|---|---|
| 08:01:21 (avant) | 745 ppm |
| 08:01:23 | 699 ppm |
| 08:01:25 | 656 ppm |
| 08:01:27 | 614 ppm |
| 08:01:29 | 571 ppm |
| 08:01:31 | 528 ppm |
| 08:01:33 | 480 ppm |
| 08:01:35 | 438 ppm |
| 08:01:37 | 420 ppm (plancher) |

### À quoi ça correspond

C'est **le cycle complet d'une commande**, et il fait 3 étapes, pas 1 :

1. on **demande** (commands)
2. l'appareil **répond** qu'il a fait (results)
3. on **constate** le changement dans les mesures

Le piège du projet est là : quand l'utilisateur clique sur « Allumer » dans l'app,
on ne doit **pas** afficher « allumé » tout de suite. On affiche « en attente », et on
n'écrit « allumé » qu'en recevant le `results` avec `status: executed`.

Le `command_id` sert à relier la réponse à la bonne demande. Le `expires_at` (15 secondes
plus tard ici) veut dire : si l'appareil reçoit l'ordre après cette date, il l'ignore.

Note : sans ventilation le CO2 monte d'environ 12 ppm par mesure, avec ventilation il
descend d'environ 45. Le modèle est borné entre 420 et 2500 ppm.

---

## Manip 2 : le doublon

```sh
docker compose run --rm tools incident sensor-001 duplicate
```

### Ce qui s'est passé

```
message_id ...-311   CO2 444
message_id ...-312   CO2 455
message_id ...-312   CO2 455   <-- le même, renvoyé une deuxième fois
message_id ...-313   CO2 469
```

Le message `-312` est arrivé **deux fois, strictement identique**.

### À quoi ça correspond

En vrai, ça arrive tout le temps : le réseau bug, l'appareil renvoie par sécurité.

Si notre backend enregistre bêtement tout ce qu'il reçoit, l'historique de la salle
contient deux fois la même mesure. Le graphique est faux, les moyennes sont fausses.

**Ce qu'on devra faire :** avant d'enregistrer, vérifier si ce `message_id` est déjà
connu. Si oui, on jette. C'est le jalon de J2.

---

## Manip 3 : la mesure en retard

```sh
docker compose run --rm tools incident sensor-001 delay
```

### Ce qui s'est passé

```
08:02:05   ...-320   observed_at 08:02:07   CO2 546
08:02:07   delayed-2fbffad0   observed_at 08:01:07   CO2 546   <-- datée d'il y a 1 minute
08:02:09   ...-321   observed_at 08:02:09   CO2 555
```

Une mesure **datée de 60 secondes plus tôt** est arrivée **après** une mesure plus récente.

### À quoi ça correspond

L'ordre d'arrivée n'est pas l'ordre des événements. Un appareil qui a eu une coupure
réseau renvoie ses mesures en retard quand il revient.

Si notre backend fait juste « la dernière reçue = la valeur actuelle », on va afficher
une valeur d'il y a une minute comme si c'était maintenant. Sur l'app, la température
de la salle *recule dans le temps* sans que personne comprenne pourquoi.

**Ce qu'on devra faire :** comparer `observed_at` avant de remplacer l'état courant.
Une mesure plus ancienne peut aller dans l'historique, mais ne doit pas devenir la
valeur affichée.

---

## Manip 4 : le message invalide

```sh
docker compose run --rm tools incident sensor-001 invalid
```

### Ce qui s'est passé

```json
{
  "message_id": "invalid-7f183596f43647a182e4ed0ad71d2b27",
  "device_id": "sensor-001",
  "observed_at": "2026-09-15T08:02:15.933Z",
  "temperature": {"value": 21.68, "unit": "°C"},
  "co2": {"value": "invalide", "unit": "ppm"}
}
```

Le CO2 vaut le **texte** `"invalide"` au lieu d'un nombre. Le message suivant est
redevenu normal.

### À quoi ça correspond

Un capteur qui déconne envoie n'importe quoi. Si notre backend fait un calcul sur cette
valeur, il plante. Et s'il plante, il arrête de traiter tous les capteurs.

**Ce qu'on devra faire :** valider chaque message avant de le traiter. S'il est mauvais :
on le rejette, on écrit une ligne de log pour pouvoir l'expliquer, et **le service
continue de tourner**. C'est le scénario R02 de la recette.

---

## Manip 5 : le capteur muet

```sh
docker compose run --rm tools incident sensor-001 pause
```

### Ce qui s'est passé

Sur 8 messages écoutés pendant la pause :

| Capteur | Messages reçus |
|---|---|
| sensor-001 | **0** |
| sensor-002 | 4 |
| sensor-003 | 4 |

Mais son `availability` est resté à :

```json
{"device_id": "sensor-001", "status": "online"}
```

### À quoi ça correspond

**C'est le piège le plus important du projet.**

Le capteur est toujours connecté. Il dit « je suis en ligne ». Mais il n'envoie plus
aucune mesure. Il faut donc distinguer trois choses **complètement différentes** :

| Situation | Ce que ça veut dire | Ce qu'on affiche |
|---|---|---|
| L'objet est `offline` | Le capteur est débranché | « Capteur déconnecté » |
| L'objet est `online` mais se tait | Il est branché mais ne mesure plus | « Dernière mesure il y a 3 min » |
| Le téléphone n'a plus de réseau | C'est **notre** app le problème | « Hors ligne, données du 15/09 à 10h » |

Si on mélange les trois, l'utilisateur ne sait jamais où est le problème.

**Ce qu'on devra faire :** définir une règle de fraîcheur. Genre « une mesure de plus de
30 secondes est considérée comme ancienne ». Ce chiffre, c'est nous qui le choisissons,
mais il faut l'écrire dans la doc et s'y tenir.

Pour relancer le capteur :

```sh
docker compose run --rm tools incident sensor-001 reset
```

---

## Ce qu'on retient pour le backend

| Le problème vu | Ce que le backend devra faire |
|---|---|
| Doublon | Ignorer un `message_id` déjà enregistré |
| Mesure en retard | Comparer `observed_at`, ne pas régresser l'état courant |
| Message invalide | Valider, rejeter, tracer, et continuer à tourner |
| Capteur muet | Calculer une fraîcheur, séparée de la connexion |
| Commande | Attendre le `results`, avec un délai maximum |

Ces 5 points sont exactement les jalons de J2 et J3. On les a vus en vrai avant
d'écrire une ligne de code.
