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
- les événements métier du backend : connexion MQTT, ingestion, consolidation,
  doublon et rejet ;
- le flux complet, filtrable par service et par expression régulière.

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
