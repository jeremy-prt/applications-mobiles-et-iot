# Suivi du projet Campus connecté

Petit pas par petit pas. On coche au fur et à mesure.

## Avant de commencer

- [x] Lire le sujet Notion
- [x] Groupe de 2 formé
- [ ] Choisir qui fait quoi en premier (backend / mobile)

## Étape 1 : Faire tourner le kit fourni

- [x] Cloner le kit dans `kit/`
- [x] Vérifier que Docker tourne
- [x] Lancer `docker compose up -d --build --wait`
- [x] Vérifier que les 2 conteneurs sont sains (mosquitto + simulator)
- [x] Voir passer les vrais messages MQTT des 3 capteurs

Résultat : ça marche. On reçoit température et CO2 de sensor-001 à 003.

## Étape 2 : Installer un client MQTT graphique

- [x] Installer MQTTX (`brew install --cask mqttx`)
- [x] Créer la connexion : `127.0.0.1` port `1883`, user `teacher` / `teacher-demo`
- [x] Connecté au broker
- [x] S'abonner au topic `campus/v1/#` et voir les messages arriver

Note : MQTT Explorer n'est plus installable via Homebrew (retiré le 1er septembre 2026,
il ne passe plus le Gatekeeper d'Apple). MQTTX fait la même chose.

## Étape 3 : Comprendre ce qui passe sur le réseau

À faire dans MQTTX, en lançant les commandes en parallèle depuis `kit/`.

- [x] Repérer les 4 types de topics : telemetry, state, availability, results
- [x] Allumer la ventilation et voir le CO2 baisser (`tools command sensor-001 on`)
- [x] Éteindre et voir le CO2 remonter
- [x] Incident `duplicate` : le même message_id passe deux fois
- [x] Incident `delay` : une mesure datée de 60 s avant arrive après une plus récente
- [x] Incident `invalid` : le CO2 vaut le texte "invalide"
- [x] Incident `pause` : le capteur se tait mais reste connecté (availability reste online)
- [x] `tools incident sensor-001 reset` pour tout remettre d'aplomb
- [ ] Relire `kit/docs/contrat-mqtt.md` maintenant qu'on a vu les messages
- [ ] Lire `kit/docs/association.md` (le QR code, pour J3)

Résultats des manips notés dans `resultats.md`.

## Étape 4 : Créer notre repo d'équipe

- [x] Créer le monorepo GitHub (1 seul pour nous deux)
- [x] Créer la structure : `backend/ mobile/ infra/ docs/ README.md`
- [x] Y remettre le kit (dans `infra/kit`)
- [x] Premier commit + push
- [ ] Ajouter le binôme en collaborateur
- [ ] Compléter le tableau Équipe du README

Repo : https://github.com/jeremy-prt/applications-mobiles-et-iot (public)

## Étape 5 : Choisir la stack

- [ ] Choisir le langage/framework backend + écrire pourquoi
- [ ] Choisir la base de données + écrire pourquoi
- [ ] Choisir la techno mobile + écrire pourquoi
- [ ] Noter ces 3 choix dans `docs/decisions/`

## Étape 6 : le backend reçoit et expose une mesure

- [ ] Se connecter au broker avec le compte `backend` / `backend-demo`
- [ ] S'abonner à `campus/v1/devices/+/telemetry`
- [ ] Afficher une mesure reçue dans les logs (première preuve que ça marche)
- [ ] Stocker la dernière mesure de chaque capteur
- [ ] Exposer une route `GET /rooms` : la liste des salles avec leur dernière mesure
- [ ] Ajouter le backend au `compose.yaml` du kit
- [ ] Vérifier la route avec curl

## Étape 7 : le mobile affiche la mesure

- [ ] Créer le projet mobile
- [ ] Écran liste des salles qui appelle l'API
- [ ] Afficher température, CO2, leur unité et la date de la mesure
- [ ] État de chargement visible
- [ ] État d'erreur visible si l'API ne répond pas
- [ ] Faire tourner sur un téléphone ou un émulateur
- [ ] Utiliser l'IP de la machine, pas `localhost` (sur le téléphone, `localhost` = le téléphone)

## Étape 8 : Prouver les 4 jalons de J1

- [ ] Une variation du simulateur arrive jusqu'à l'écran du téléphone
- [ ] On retrouve le même `sensor-001` dans MQTTX, dans l'API et sur l'écran
- [ ] Le mobile gère le chargement et une erreur d'API (couper le backend pour le prouver)
- [ ] Chacun de nous deux sait expliquer le trajet complet de la donnée

## Étape 9 : Livrables de fin de J1

- [ ] `docs/architecture.md` : schéma de la chaîne + technos retenues
- [ ] `docs/J1.md` : les 3 questions + les preuves des 4 jalons
- [ ] `README.md` : comment lancer l'environnement, le backend, le mobile
- [ ] Les 4 rubriques de fin dans `J1.md` + contributions de chacun
- [ ] Tag Git `J1` + push

---

## Commandes utiles

Tout se lance depuis `kit/`.

Démarrer :
```
docker compose up -d --build --wait
```

Voir les messages :
```
docker compose run --rm tools watch --count 10
```

Voir seulement les mesures :
```
docker compose run --rm tools watch --topic "campus/v1/devices/+/telemetry" --count 5
```

Allumer / éteindre la ventilation :
```
docker compose run --rm tools command sensor-001 on
docker compose run --rm tools command sensor-001 off
```

Provoquer un incident (remplacer `duplicate` par : pause, resume, delay, invalid,
high-co2, normal-co2, no-response, respond, reset) :
```
docker compose run --rm tools incident sensor-001 duplicate
```

Arrêter :
```
docker compose down
```
