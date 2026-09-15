# Suivi — Campus connecté

Petit pas par petit pas. On coche au fur et à mesure.

## Avant de commencer

- [x] Lire le sujet Notion
- [x] Groupe de 2 formé
- [ ] Choisir qui fait quoi en premier (backend / mobile)

## Étape 1 — Faire tourner le kit fourni

- [x] Cloner le kit dans `kit/`
- [x] Vérifier que Docker tourne
- [x] Lancer `docker compose up -d --build --wait`
- [x] Vérifier que les 2 conteneurs sont sains (mosquitto + simulator)
- [x] Voir passer les vrais messages MQTT des 3 capteurs

Résultat : ça marche. On reçoit température et CO2 de sensor-001 à 003.

## Étape 2 — Installer un client MQTT graphique

- [x] Installer MQTTX (`brew install --cask mqttx`)
- [x] Créer la connexion : `127.0.0.1` port `1883`, user `teacher` / `teacher-demo`
- [x] Connecté au broker
- [x] S'abonner au topic `campus/v1/#` et voir les messages arriver

Note : MQTT Explorer n'est plus installable via Homebrew (retiré le 1er septembre 2026,
il ne passe plus le Gatekeeper d'Apple). MQTTX fait la même chose.

## Étape 3 — Comprendre ce qui passe sur le réseau

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

## Étape 4 — Créer notre repo d'équipe

- [ ] Créer le monorepo GitHub (1 seul pour nous deux)
- [ ] Ajouter l'autre membre en collaborateur
- [ ] Créer la structure : `backend/ mobile/ infra/ docs/ README.md`
- [ ] Y remettre le kit (dans `infra/`)
- [ ] Premier commit + push

## Étape 5 — Choisir la stack

- [ ] Choisir le langage/framework backend + écrire pourquoi
- [ ] Choisir la base de données + écrire pourquoi
- [ ] Choisir la techno mobile + écrire pourquoi
- [ ] Noter ces 3 choix dans `docs/decisions/`

## Étape 6 — J1 : la mesure arrive sur le téléphone

- [ ] Backend : se connecter à MQTT et recevoir une mesure
- [ ] Backend : la stocker
- [ ] Backend : l'exposer via une route API
- [ ] Mobile : écran qui appelle l'API et affiche la mesure
- [ ] Mobile : afficher unité + date
- [ ] Mobile : gérer l'état de chargement
- [ ] Mobile : gérer l'erreur API
- [ ] Vérifier qu'une variation du simulateur arrive bien jusqu'à l'écran

## Étape 7 — Livrables de J1

- [ ] `docs/architecture.md` : schéma de la chaîne + technos retenues
- [ ] `docs/J1.md` : les 3 questions + preuves des 4 jalons
- [ ] `README.md` : comment lancer l'environnement, le backend, le mobile
- [ ] Contributions de chacun notées
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
