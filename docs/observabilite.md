# Centralisation des logs

```text
stdout/stderr des conteneurs -> Grafana Alloy -> Loki -> Grafana
```

- **Alloy** trouve les conteneurs du projet par l'API Docker et reprend sa lecture après un
  redémarrage.
- **Loki** indexe les labels (`service_name`, projet Compose, conteneur) et garde 7 jours de
  logs dans un volume Docker.
- **Grafana** sert à chercher et porte le tableau de bord `Campus connecté - Logs`.

## Format applicatif

Un seul logger Pino, partagé avec Fastify. Une ligne JSON par événement sur `stdout`, avec les
champs imposés par le sujet : `timestamp`, `service`, `level` en toutes lettres, `eventType`,
et selon le cas `deviceId`, `eventId`, `topic`, `status`, `reason`.

```json
{"level":"info","timestamp":"2026-09-17T09:10:20.856Z","service":"backend","environment":"development","eventType":"mesure_enregistree","eventId":"17dfbdc2-9f09-4387-973e-24f83e6e8c23","deviceId":"sensor-003","topic":"campus/v1/devices/sensor-003/telemetry","status":"etat_courant_mis_a_jour","msg":"mesure enregistrée"}
```

Les valeurs de `eventType` et `reason` sont un type TypeScript (`backend/src/logger.ts`), donc
une faute de frappe ne compile pas.

Pas de fichier de logs : Docker lit `stdout`, Alloy envoie à Loki. Les sorties du simulateur et
de Mosquitto (kit) sont aussi centralisées, mais pas dans ce format.

Les trois services démarrent avec le projet :

```sh
docker compose up -d --build
```

Grafana : <http://localhost:3001>. Lecture sans compte (anonyme en Viewer). `admin` avec
`GRAFANA_ADMIN_PASSWORD` sert seulement à éditer. Loki n'est pas publié et Grafana n'écoute que
sur `127.0.0.1`. Capture : `docs/preuves/J3-tableau-de-bord.png`.

## Ce que montre le tableau de bord

Cinq sections, du général au détail. Le i de chaque panneau explique le chiffre et sa valeur
normale.

| Section | À quelle question elle répond |
|---|---|
| La chaîne fonctionne-t-elle en ce moment ? | Mesures entrées, refusées, doublons, capteurs muets |
| Qu'est-ce qui a été refusé, et pourquoi ? | Refus par motif, détail des lignes |
| Suivre un capteur ou une mesure précise | Parcours d'une mesure par son identifiant de corrélation |
| Incidents d'infrastructure | Pertes du broker, reconnexions, usurpations, erreurs |
| Tout le flux | Journal complet, texte libre |

Quatre filtres : service, capteur, identifiant de mesure, recherche libre. Les trois derniers
prennent une regex, par exemple `sensor-00[12]`, et `.*` veut dire tout.

Les panneaux comptent les logs émis. Un zéro ne prouve pas que le scénario a été testé.

## Produire des preuves

Doublon et message invalide :

```sh
docker compose --profile tools run --rm tools incident sensor-001 duplicate
docker compose --profile tools run --rm tools incident sensor-001 invalid
```

Dans Grafana : service `backend`, période du test, `doublon|rejet` dans **Recherche**.

Panne du broker :

```sh
docker compose stop mosquitto
docker compose start mosquitto
```

On doit voir `broker injoignable` puis `reconnexion au broker`.

Alerte CO2 (R12 dans `docs/recette.md`) :

```sh
./docs/preuves/outils/alerte.sh sensor-001
```

Deux lignes : `alerte_ouverte` en warn, `alerte_fermee` en info, avec `alertId`, `co2` et
l'`eventId` de la mesure déclenchante. Cet `eventId` dans **Identifiant de mesure** montre le
parcours jusqu'à l'alerte. Les mises à jour d'une alerte active (`alerte_prolongee`, une par
mesure) ne sortent qu'en `LOG_LEVEL=debug`.

## Persistance et remise à zéro

`loki-data` : les logs. `alloy-data` : les positions de lecture. `grafana-data` : l'état de
Grafana. `docker compose down` les garde, `docker compose down -v` les supprime avec les
données métier.

Alloy monte le socket Docker. Même en lecture seule, c'est un accès sensible au moteur Docker :
OK en local pour le cours, pas sur un hôte partagé ni en production.
