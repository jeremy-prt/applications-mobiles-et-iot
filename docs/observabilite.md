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

Ouvrir <http://localhost:3001>. La consultation ne demande pas de compte : le
rôle anonyme est Viewer, donc on peut tout lire et rien modifier. Se connecter
avec `admin` et la valeur de `GRAFANA_ADMIN_PASSWORD` sert seulement à éditer un
tableau de bord. Loki n'est pas publié sur la machine et Grafana n'écoute que sur
`127.0.0.1`.

Un aperçu du tableau de bord est conservé dans
`docs/preuves/J3-tableau-de-bord.png`.

## Ce que montre le tableau de bord

Il est rangé en cinq sections, de la vue d'ensemble au détail. Chaque panneau
porte une description : passer la souris sur le i en haut à gauche du panneau
explique ce que le chiffre veut dire et quelle valeur est normale.

| Section | À quelle question elle répond |
|---|---|
| La chaîne fonctionne-t-elle en ce moment ? | Combien de mesures entrent, combien sont refusées, combien de doublons, quels capteurs se sont tus |
| Qu'est-ce qui a été refusé, et pourquoi ? | Les refus comptés par motif, et le détail de chaque ligne refusée |
| Suivre un capteur ou une mesure précise | Le parcours complet d'une mesure à partir de son identifiant de corrélation |
| Incidents d'infrastructure | Pertes du broker, reconnexions, usurpations détectées, erreurs |
| Tout le flux | Le journal complet, filtrable par texte libre |

Quatre champs en haut filtrent l'ensemble : le service, un capteur, un
identifiant de mesure et une recherche libre. Les trois derniers acceptent une
expression régulière, par exemple `sensor-00[12]`, et `.*` veut dire tout.

Les panneaux reposent sur les logs réellement émis. Une valeur à zéro est donc
une observation, pas une promesse que le scénario correspondant a été testé.

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
