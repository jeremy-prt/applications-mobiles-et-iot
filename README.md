# Campus connecté

Projet M2 — Applications mobiles et objets connectés.

Superviser la température et le CO2 de salles de cours depuis un téléphone, et commander
leur ventilation. Les capteurs sont simulés, le reste de la chaîne est réel.

## Architecture

```
[Capteurs simulés] --MQTT--> [Mosquitto] --MQTT--> [backend/] <--> [base de données]
                                                        |
                                                       API HTTP
                                                        |
                                                   [mobile/]
```

Détail dans [docs/architecture.md](docs/architecture.md).

## Structure du dépôt

| Dossier | Contenu |
|---|---|
| `backend/` | Notre service : ingestion MQTT, stockage, API |
| `mobile/` | Notre application mobile |
| `infra/kit/` | Le kit fourni : broker Mosquitto et simulateur de capteurs |
| `docs/` | Contexte, architecture, décisions, journaux de bord J1 à J4 |

## Prérequis

- Git
- Docker Desktop démarré, avec la commande `docker compose`

## Lancer l'environnement

```sh
cd infra/kit
docker compose up -d --build --wait
```

Vérifier que ça tourne :

```sh
docker compose ps
docker compose run --rm --build tools watch --count 5
```

Le broker écoute sur `127.0.0.1:1883`. Compte pour notre backend : `backend` / `backend-demo`.

Arrêter :

```sh
docker compose down
```

## Lancer le backend

À compléter.

## Lancer l'application mobile

À compléter.

## Observer et provoquer des incidents

Toutes les commandes se lancent depuis `infra/kit`.

```sh
docker compose run --rm tools command sensor-001 on
docker compose run --rm tools incident sensor-001 duplicate
docker compose run --rm tools incident sensor-001 reset
```

La liste complète est dans [infra/kit/README.md](infra/kit/README.md).
Ce qu'on a observé en lançant ces incidents est noté dans
[docs/observations-kit.md](docs/observations-kit.md).

## Équipe

| Membre | Rôle |
|---|---|
| Jérémy Perret | à définir |
| à compléter | à définir |
