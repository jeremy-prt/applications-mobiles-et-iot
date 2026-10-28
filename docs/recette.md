# Recette

Les 13 scénarios obligatoires du sujet, chacun avec un résultat déclaré, même en cas d'échec.
Statuts : réussi, partiel, échoué. Seuils et délais déclarés avant les tests dans
docs/architecture.md.

## Suivi

| Ref | Scénario | Statut | Résultat observé | Preuve |
|---|---|---|---|---|
| R01 | Mesure de bout en bout | réussi | Même `message_id` du broker à l'API | Fiche R01 |
| R02 | Message invalide | réussi | Aucune mesure créée, rejet gardé en zone brute. JSON illisible et valeur impossible en J3 | Fiche R02, et `docs/J3.md` scénarios 3a à 3c |
| R03 | Doublon et retard | réussi | Une seule ligne en base, retard gardé dans l'historique | Fiche R03, et `docs/J3.md` scénarios 4 et 5 |
| R04 | Capteur silencieux | réussi | `is_stale` vrai entre 25 et 40 s, toujours `online`. Bascule tracée depuis J3 | Fiche R04, et `docs/J3.md` scénario 6 |
| R05 | Téléphone hors ligne | partiel | Cache daté en mode Avion. Blocage d'une commande hors ligne codé en J4, pas testé sur l'iPhone | `docs/preuves/J2-hors-ligne.png` |
| R06 | Reconnexion et cycle de vie | partiel | Retour en direct. Arrière-plan et abonnements pas testés sur l'appareil | Fiche R06 |
| R07 | Broker interrompu | réussi | API disponible, ingestion reprise, mobile en « fraîcheur inconnue » | Fiche R07, et `docs/J3.md` scénario 7 |
| R08 | Commande exécutée | partiel | `executed` par l'API. En J5, « Commande confirmée » dans l'application web. Pas testé sur l'iPhone | Fiche R08, et fiche R12 |
| R09 | Commande sans réponse | partiel | `unknown` à 20 s, jamais `failed`. Pas vu sur l'iPhone | Fiche R09 |
| R10 | Association et permission caméra | à faire | Plus planifié depuis la réécriture du sujet, mais toujours dans le périmètre | |
| R11 | Autorisation | à faire | Sorti de J3 par la réécriture du sujet | |
| R12 | Alerte et retour à la normale | réussi | Une alerte pour 22 mesures au-dessus du seuil, fermée à 610 ppm. Aussi fermée par la ventilation depuis l'application | Fiche R12 |
| R13 | Reproductibilité et terminal | partiel | README seul sur une copie propre : tout démarre, données gardées. iPhone pas rejoué | Fiche R13 |

## Détail des scénarios

Les commandes `incident` et `command` se lancent depuis la racine du dépôt, car le service
`tools` est derrière un profil Compose. Lancer le Compose de `infra/kit` seul crée un second
projet qui échoue sur le port 1883 déjà pris.

```sh
docker compose --profile tools run --rm tools incident sensor-001 duplicate
```

| Ref | Action | Attendu |
|---|---|---|
| R01 | Faire évoluer une mesure simulée | Même objet et même mesure suivis de MQTT au mobile, avec unité et date |
| R02 | `incident sensor-001 invalid` | Service disponible, pas de mesure créée, rejet tracé |
| R03 | `incident sensor-001 duplicate` puis `incident sensor-001 delay` | Pas de doublon, le dernier état ne recule pas, politique des retards expliquée |
| R04 | `incident sensor-001 pause` | Mesure marquée ancienne selon la règle, sans accuser le réseau du téléphone |
| R05 | Couper le réseau du téléphone après une consultation | Cache daté, état hors ligne explicite. Commande bloquée et expliquée, pas rejouée au retour du réseau |
| R06 | Rétablir le réseau, passer en arrière-plan, reprendre | Données cohérentes, sans abonnement dupliqué ni chargement infini. Restauration après fermeture expliquée |
| R07 | `docker compose stop mosquitto` puis `docker compose up -d --wait mosquitto` | Backend diagnosticable et reconnecté, anciennes mesures pas montrées comme fraîches, pertes identifiées |
| R08 | Activer la ventilation sur un objet disponible | Attente puis confirmation, le CO2 baisse. L'accusé de transport ne suffit pas |
| R09 | `incident sensor-001 no-response` puis commander | Délai borné vers un échec ou un inconnu, jamais « activé » sans confirmation, réponse tardive documentée |
| R10 | Scanner un code valide, un invalide, puis refuser la caméra | Association correcte, sinon message utile et reprise, sans blocage |
| R11 | Commander sans droit, aussi directement sur l'API | Refus côté backend, cacher le bouton ne suffit pas |
| R12 | `incident sensor-001 high-co2` puis `incident sensor-001 normal-co2` | Une alerte identifiable, pas une par mesure, retour à la normale selon la règle |
| R13 | Relancer avec le seul README, sur le terminal prévu | Configuration claire, persistance conforme, parcours principal démontrable, adresse du backend adaptée au terminal |

## Observation complémentaire

Faite en J3. Le kit refuse un intervalle sous 0,1 seconde, donc on a monté la charge par le
nombre d'objets : 15 dans `infra/kit/devices.json`, puis remis à 3. À 101 messages par
seconde, le délai de traitement passe de 3 à 10 secondes et les passages du job de
consolidation s'espacent de 5 à 15 secondes. Aucune erreur, l'API répond en 28 millisecondes.
Méthode dans `docs/J3.md`, scénario 11.

Les onze scénarios de J3 viennent de la réécriture du sujet. Ils sont numérotés dans
`docs/J3.md`, sans référence R.

## R01, mesure de bout en bout

- Scénario et responsable : R01, Jérémy Perret
- Version du projet et environnement : J2, macOS arm64, Docker Compose du dépôt, kit non modifié
- Conditions initiales et paramètres : trois capteurs en ligne, publication toutes les 2 secondes
- Action effectuée : lire un message sur le broker, puis chercher son `message_id` à chaque étape

```sh
docker compose --profile tools run --rm tools watch \
  --topic "campus/v1/devices/sensor-001/telemetry" --count 1
```

- Résultat attendu : la même mesure à chaque étape, avec unité et date
- Résultat observé et preuve : le `message_id` `035be0d8e8664437a94696954a1475e9-44` se retrouve partout, reçu neuf millisecondes après l'observation. L'API rend une mesure plus récente, car le capteur publie toutes les 2 secondes

| Étape | Ce qu'on lit |
|---|---|
| Broker | `observed_at` 09:04:29.466, CO2 1178 ppm |
| Zone brute MongoDB | `statut` traité, reçu à 09:04:29.475, CO2 1178 |
| Base consolidée | `recorded_at` 09:04:29.466, CO2 1178, température 21,64 |
| API `GET /rooms` | `sensor-001`, CO2 en ppm, `recorded_at` daté, `is_stale` faux |

- Conclusion : réussi
- Correction ou limite identifiée : aucune

## R02, message invalide

- Scénario et responsable : R02, Jérémy Perret
- Version du projet et environnement : J2, macOS arm64, Docker Compose du dépôt
- Conditions initiales et paramètres : `sensor-001` en ligne, 6574 mesures en base pour cet objet
- Action effectuée : `docker compose --profile tools run --rm tools incident sensor-001 invalid`
- Résultat attendu : rejet tracé, aucune mesure créée
- Résultat observé et preuve : `/health` répond toujours `{"status":"ok","db":true}`. Les 5 mesures ajoutées en 12 secondes sont les mesures normales du capteur. Le message est gardé en zone brute avec `statut: "rejete"`, `motif: "mesure non conforme au contrat"` et `co2.value` à `invalide`. En J1 il disparaissait. La trace nomme le champ fautif :

```
{"topic":"campus/v1/devices/sensor-001/telemetry",
 "issues":[{"expected":"number","code":"invalid_type","path":["co2","value"],
            "message":"Invalid input: expected number, received string"}],
 "msg":"mesure rejetée"}
```

- Conclusion : réussi
- Correction ou limite identifiée : la validation est passée du consommateur MQTT au job de consolidation, pour ne rien perdre à l'ingestion

## R03, doublon et retard

- Scénario et responsable : R03, Jérémy Perret
- Version du projet et environnement : J2, macOS arm64, Docker Compose du dépôt, kit non modifié
- Conditions initiales et paramètres : trois capteurs en ligne, publication toutes les 2 secondes, seuil de fraîcheur 30 secondes, job de consolidation toutes les 5 secondes
- Action effectuée :

```sh
docker compose --profile tools run --rm tools incident sensor-001 duplicate
docker compose --profile tools run --rm tools incident sensor-001 delay
```

- Résultat attendu : pas de doublon, le dernier état ne recule pas
- Résultat observé et preuve : message reçu deux fois, une seule ligne en base. En J1 le doublon disparaissait sans trace. L'état courant avance de 07:52:43 à 07:52:53. La mesure en retard est dans l'historique avec `recorded_at` 07:51:46 et `received_at` 07:52:49, soit 63 secondes d'écart

```sh
docker compose exec mongo mongosh campus_brut --quiet --eval '
  db.messages.aggregate([{$match:{genre:"telemetry"}},
    {$group:{_id:"$payload.message_id",recus:{$sum:1},motifs:{$addToSet:"$motif"}}},
    {$match:{recus:{$gt:1}}}]).toArray()'
# [{ _id: "30ce989...-420", recus: 2, motifs: ["doublon écarté"] }]

docker compose exec postgres psql -U campus -d campus -tAc \
  "select count(*) from (select device_id, message_id from telemetry
   group by device_id, message_id having count(*)>1) x"
# 0
```

- Conclusion : réussi
- Correction ou limite identifiée : pas de limite d'ancienneté pour une mesure en retard. Après 7 jours, la rétention la supprime et son `message_id` ne protège plus d'un doublon

## R04, capteur silencieux

- Scénario et responsable : R04, Jérémy Perret
- Version du projet et environnement : J2, macOS arm64, Docker Compose du dépôt
- Conditions initiales et paramètres : `sensor-001` en ligne et mesurant, seuil de fraîcheur 30 secondes
- Action effectuée : `docker compose --profile tools run --rm tools incident sensor-001 pause`
- Résultat attendu : mesure ancienne après le seuil, toujours `online`
- Résultat observé et preuve : bascule entre 25 et 40 secondes, autour du seuil de 30. Toujours `online`, car le capteur répond au broker sans mesurer. L'application affiche « Donnée ancienne » sans parler du réseau du téléphone

| Temps écoulé | `is_stale` | `availability` |
|---|---|---|
| 10 s | faux | `online` |
| 25 s | faux | `online` |
| 40 s | vrai | `online` |

- Conclusion : réussi
- Correction ou limite identifiée : aucune

## R05, téléphone hors ligne

- Scénario et responsable : R05, Jérémy Perret et Kylian Patry
- Version du projet et environnement : J2, iPhone sous Expo Go, backend et kit sur le Mac, sur le même réseau
- Conditions initiales et paramètres : consultation réussie du détail de `sensor-001`, cache de 24 heures, seuil de fraîcheur 30 secondes
- Action effectuée : mode Avion sur le téléphone
- Résultat attendu : cache consultable et daté, état explicite
- Résultat observé et preuve : `docs/preuves/J2-hors-ligne.png`, prise à 10:40, mode Avion visible. Les valeurs et les dix tranches d'historique restent sous le bandeau « Téléphone hors ligne. Données conservées, elles ne décrivent plus la salle en direct. ». Dates affichées : « Reçues le 16/09 10:39, il y a 37 s. » et « Dernière mesure : il y a 44 s ». « Donnée récente » devient « Fraîcheur inconnue, données du cache ». Testé avant en coupant le serveur : bandeau « Serveur injoignable », cache gardé après un rechargement complet
- Conclusion : partiel. Le blocage d'une commande hors ligne attend les commandes, prévues en J4
- Correction ou limite identifiée : deux défauts corrigés. Le cache était effacé au premier appel en échec, car seule une requête réussie est écrite sur le disque. L'ancienneté affichée se figeait, faute d'horloge qui redessine l'écran. Non couvert : rouvrir sans réseau l'application fermée, car Expo Go recharge le code depuis le serveur de développement

## R06, reconnexion et cycle de vie

- Scénario et responsable : R06, Jérémy Perret
- Version du projet et environnement : J2, application servie par Expo sur le navigateur
- Conditions initiales et paramètres : cache affiché avec le bandeau « serveur injoignable »
- Action effectuée : remise en marche du serveur, sans toucher à l'application
- Résultat attendu : données cohérentes, pas de chargement infini
- Résultat observé et preuve : le bandeau disparaît et les valeurs repassent en direct
- Conclusion : partiel, testé en coupant le serveur, pas le réseau du téléphone
- Correction ou limite identifiée : l'arrière-plan passe par `AppState`, absent du navigateur, donc reste à tester sur l'iPhone. Défaut corrigé : hors ligne sans cache, l'écran chargeait sans fin, car une requête en pause ne se termine pas. Il affiche maintenant un message et un bouton Réessayer

## R07, broker interrompu

- Scénario et responsable : R07, Jérémy Perret
- Version du projet et environnement : J2, macOS arm64, Docker Compose du dépôt
- Conditions initiales et paramètres : chaîne complète en marche, 16 487 mesures en base
- Action effectuée :

```sh
docker compose stop mosquitto
docker compose up -d --wait mosquitto
```

- Résultat attendu : backend diagnosticable et reconnecté
- Résultat observé et preuve : pendant la coupure, `/health` répond `{"status":"ok","db":true}`, `/rooms` répond 200, et les traces montrent « reconnexion au broker » toutes les 2 secondes. Ensuite, 15 mesures en 10 secondes, le rythme normal des trois capteurs
- Conclusion : réussi
- Correction ou limite identifiée : rien n'est perdu car le simulateur suspend ses mesures pendant la coupure. Ça vient du kit, pas de notre backend. Notre protection, la session persistante `clean: false`, n'a pas été mise à l'épreuve

## R08, commande exécutée

- Scénario et responsable : R08, Jérémy Perret et Kylian Patry
- Version du projet et environnement : J4, macOS arm64, Docker Compose du dépôt, kit non modifié
- Conditions initiales et paramètres : `sensor-001` en ligne, ventilation arrêtée, expiration 10 secondes, attente maximale 15 secondes
- Action effectuée :

```sh
curl -X POST http://127.0.0.1:3000/devices/sensor-001/commands \
  -H 'content-type: application/json' -d '{"command_id":"j4-preuve1-on","enabled":true}'
curl http://127.0.0.1:3000/commands/j4-preuve1-on
docker compose logs backend | grep '"j4-preuve1-on"'
```

- Résultat attendu : attente puis confirmation, le CO2 baisse
- Résultat observé et preuve : le POST répond 202 `pending`. Le `published_at`, 5 ms après, n'est que l'accusé du broker. `GET /commands/j4-preuve1-on` passe ensuite à `executed`, résultat reçu 47 ms après la demande, `late` faux. Dans `GET /rooms`, `ventilation` passe à vrai et le CO2 de 759 à 651, 515 puis 422 ppm. Traces : `commande_acceptee` 12:05:31.620, `commande_publiee` .623, `message_recu` .666, `commande_resultat` 12:05:32.775
- Conclusion : partiel, prouvé depuis l'API mais pas depuis l'iPhone
- Correction ou limite identifiée : `executed` apparaît au passage suivant du job, 0 à 5 secondes après le résultat

## R09, commande sans réponse

- Scénario et responsable : R09, Jérémy Perret
- Version du projet et environnement : J4, macOS arm64, Docker Compose du dépôt, kit non modifié
- Conditions initiales et paramètres : `sensor-001` en ligne, attente maximale 15 secondes, job de consolidation toutes les 5 secondes
- Action effectuée :

```sh
docker compose --profile tools run --rm tools incident sensor-001 no-response
curl -X POST http://127.0.0.1:3000/devices/sensor-001/commands \
  -H 'content-type: application/json' -d '{"command_id":"j4-preuve2-noresp","enabled":false}'
docker compose --profile tools run --rm tools incident sensor-001 respond
```

- Résultat attendu : délai borné, jamais « activé » sans confirmation
- Résultat observé et preuve : `pending` à 5, 10 et 15 secondes, `unknown` à 20. Traces : `commande_acceptee` 12:06:04.775, `commande_publiee` .777, `commande_sans_reponse` avec `reason` `delai_depasse` à 12:06:24.701. Un résultat publié ensuite à la main sur `results` passe la commande en `executed` avec `late` à vrai. Rejoué, il donne `commande_doublon` sans effet. Un `command_id` inconnu donne `resultat_rejete`, `reason` `commande_inconnue`
- Conclusion : partiel. Backend prouvé. Le libellé « Sans réponse, résultat inconnu » est testé en unitaire, pas vu sur l'iPhone. L'écran n'affiche que l'état lu dans `GET /rooms`
- Correction ou limite identifiée : `unknown` et pas `failed`, car sans réponse on ne sait pas si l'objet a agi. Bascule entre 15 et 20 secondes, au rythme du job. Voir `docs/decisions/J4/16-commande-sans-reponse-et-delai.md`

## R12, alerte et retour à la normale

- Scénario et responsable : R12, Jérémy Perret
- Version du projet et environnement : J5, Windows 11 avec Docker Desktop, Docker Compose du dépôt, kit non modifié
- Conditions initiales et paramètres : trois capteurs en ligne, publication toutes les 2 secondes, seuils de 1000 ppm à l'activation et 800 ppm au retour, `sensor-001` sous 800 ppm au départ
- Action effectuée : le script joue `incident sensor-001 high-co2`, attend 42 secondes, puis `incident sensor-001 normal-co2`

```sh
./docs/preuves/outils/alerte.sh sensor-001
```

- Résultat attendu : une alerte, pas une par mesure, puis retour à la normale
- Résultat observé et preuve : l'alerte 4 s'ouvre sur la première mesure, 1813 ppm à 08:29:58. Elle compte 5 mesures 12 secondes plus tard, 20 après 30 secondes, toujours sur la même ligne. Après `normal-co2`, elle passe en `resolved` à 610 ppm, à 08:30:42. Une seule alerte créée. Les traces la relient à sa mesure

```
08:30:01.767  alerte_ouverte  alerte 4  1813 ppm  mesure 56f734cf-b8ed-43aa-b343-a75eccbbe5f4
08:30:47.538  alerte_fermee   alerte 4   610 ppm  mesure 7bb1b143-2188-4e31-a3c0-1ee77c3c8b3d
```

Même cycle sans incident, depuis la version web de l'application : alerte 7 ouverte à 1007 ppm,
pic à 2500 ppm, ventilation activée depuis l'écran du capteur, commande `executed` en 55 ms,
retour à la normale à 789 ppm. 308 mesures, une seule ligne. Captures
`docs/preuves/J5-alerte-en-cours.png` et `docs/preuves/J5-retour-a-la-normale.png`.

- Conclusion : réussi
- Correction ou limite identifiée : l'alerte apparaît au passage suivant du job, 0 à 5 secondes après la mesure, puis sur le mobile au rafraîchissement, jusqu'à 15 secondes. Les heures des traces sont celles du job, 3 à 5 secondes après le capteur

## R13, reproductibilité et terminal

- Scénario et responsable : R13, Jérémy Perret
- Version du projet et environnement : J5, Windows 11 avec Docker Desktop, Node 24, Git Bash
- Conditions initiales et paramètres : fichiers suivis du dépôt copiés dans un dossier neuf, sans `.env` ni `node_modules`. Pile de travail arrêtée pour libérer les ports. Projet nommé `campus-r13`, donc volumes vides. Images Docker déjà en cache
- Action effectuée : les commandes du README, dans l'ordre

```sh
cp .env.example .env
docker compose up -d --build
curl http://localhost:3000/health
curl "http://localhost:3000/alerts?status=active"
cd backend && npm ci && npm test && npm run typecheck
cd mobile && npm ci && npm test && npm run typecheck
docker compose stop && docker compose start
```

- Résultat attendu : le projet démarre et garde ses données avec le seul README
- Résultat observé et preuve : `up` en 14 secondes, `/health` à `ok` sur les quatre composants 10 secondes après, Grafana répond. `/rooms` rend les trois salles, sans alerte. 63 tests backend et 54 tests mobile passent, typecheck compris, avec Expo 57.0.22 installé par `npm ci`. Les trois alertes s'ouvrent seules 58 secondes après le démarrage, à 1004, 1009 et 1012 ppm, comme prévu par le README. Après `stop` puis `start`, les 63 mesures sont toujours en base
- Conclusion : partiel
- Correction ou limite identifiée : ajouté au README : Windows, `npm ci` avant les tests, le pare-feu qui bloque le téléphone. Pas rejoué : `npx expo start` et l'iPhone, donc l'adresse du backend vue par le téléphone. Sur une machine neuve, le premier `docker compose up --build` télécharge les images, ce qui prend plusieurs minutes

## Fiche vierge

À recopier pour chaque scénario exécuté.

- Scénario et responsable :
- Version du projet et environnement :
- Conditions initiales et paramètres :
- Action effectuée :
- Résultat attendu :
- Résultat observé et preuve :
- Conclusion : réussi, partiel ou échoué
- Correction ou limite identifiée :
