# Centralisation des logs

La stack locale utilise trois composants :

```text
stdout/stderr des conteneurs -> Grafana Alloy -> Loki -> Grafana
```

- **Alloy** découvre les conteneurs du projet par l'API Docker et reprend la
  lecture à la bonne position après un redémarrage.
- **Loki** indexe les labels (`service_name`, projet Compose, conteneur) et
  conserve les journaux pendant 7 jours dans un volume Docker.
- **Grafana** fournit la recherche et le tableau de bord provisionné
  `Campus connecté - Logs`.

## Format applicatif

Le backend utilise un logger Pino unique, également transmis à Fastify. Chaque
événement est écrit sur `stdout` sous la forme d'une seule ligne JSON, avec les
noms de champs imposés par le sujet : `timestamp`, `service`, `level` en toutes
lettres, `eventType`, et selon l'événement `deviceId`, `eventId`, `topic`,
`status` et `reason`. Exemple :

```json
{"level":"info","timestamp":"2026-09-17T09:10:20.856Z","service":"backend","environment":"development","eventType":"mesure_enregistree","eventId":"17dfbdc2-9f09-4387-973e-24f83e6e8c23","deviceId":"sensor-003","topic":"campus/v1/devices/sensor-003/telemetry","status":"etat_courant_mis_a_jour","msg":"mesure enregistrée"}
```

Les valeurs de `eventType` et de `reason` sont déclarées dans un type TypeScript,
donc une faute de frappe est refusée à la compilation et ne peut pas rendre une
ligne introuvable. La liste est dans `backend/src/logger.ts`.

Il n'y a pas de fichier de logs dans le conteneur : Docker collecte directement
`stdout`, puis Alloy transmet ces lignes à Loki. Le simulateur et Mosquitto sont
des composants du kit fourni ; leurs sorties texte sont aussi centralisées, mais
ne constituent pas le format applicatif du backend.

Les trois services démarrent avec le projet :

```sh
docker compose up -d --build
```

Ouvrir <http://localhost:3001>, puis se connecter avec `admin` et la valeur de
`GRAFANA_ADMIN_PASSWORD` (`admin` par défaut). Le tableau de bord se trouve dans
le dossier **Campus connecté**. Loki n'est pas publié sur la machine et Grafana
n'écoute que sur `127.0.0.1`.

## Ce que montre le tableau de bord

- le nombre de logs, d'erreurs/rejets, de doublons et de services actifs ;
- le débit de logs et les anomalies, ventilés par service ;
- les télémétries traitées, séparées par `deviceId` ;
- les événements métier du backend : connexion MQTT, ingestion, consolidation,
  doublon et rejet ;
- le flux complet, filtrable par service et par expression régulière.

Les panneaux reposent sur les logs réellement émis. Une valeur à zéro est donc
une observation, pas une promesse que le scénario correspondant a été testé.
Le champ **Device ID** accepte une expression régulière (`sensor-001` ou
`sensor-00[12]`) pour isoler un ou plusieurs capteurs.

## Produire des preuves

Injecter un doublon et un message invalide :

```sh
docker compose --profile tools run --rm tools incident sensor-001 duplicate
docker compose --profile tools run --rm tools incident sensor-001 invalid
```

Dans Grafana, sélectionner `backend`, une période couvrant le test, puis saisir
`doublon|rejet` dans **Recherche**. Le flux conserve l'heure, le service et le
message exacts. Pour une panne du broker :

```sh
docker compose stop mosquitto
docker compose start mosquitto
```

Les messages `broker injoignable` puis `reconnexion au broker` permettent de
prouver la détection et la reprise.

## Persistance et remise à zéro

Les volumes `loki-data`, `alloy-data` et `grafana-data` conservent respectivement
les logs, les positions de lecture et l'état local de Grafana. `docker compose
down` les conserve. `docker compose down -v` les supprime avec les données
métier du projet.

Alloy a besoin du socket Docker pour découvrir et lire les conteneurs. Ce montage
donne un accès sensible au moteur Docker malgré son mode lecture seule ; cette
configuration convient à l'environnement local pédagogique, pas à un hôte
mutualisé ou à une production.
