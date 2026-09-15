# Campus connecté

Projet de M2 en applications mobiles et objets connectés.

Le but est de superviser la température et le CO2 de salles de cours depuis un téléphone,
et de commander leur ventilation à distance. Les capteurs sont simulés. Le reste de la
chaîne est réel : le broker, le backend, la base de données et l'application mobile.

## Comment ça marche

Les capteurs publient leurs mesures sur un broker MQTT. Le backend est abonné à ce broker,
il reçoit les mesures et les enregistre. L'application mobile n'écoute pas le broker :
elle interroge l'API du backend.

```
Capteurs simulés  ->  Mosquitto  ->  Backend  ->  Base de données
                                        |
                                       API
                                        |
                                     Mobile
```

Le détail se trouve dans docs/architecture.md.

## Organisation du dépôt

Le dossier `backend` contient notre service : il lit le MQTT, stocke les mesures et expose
l'API. Le dossier `mobile` contient notre application. Le dossier `infra/kit` contient le
kit fourni par l'école, avec le broker et le simulateur de capteurs. Le dossier `docs`
contient le contexte du projet, l'architecture, les décisions techniques et les journaux
de bord de chaque journée.

## Avant de commencer

Il faut Git et Docker Desktop démarré, avec la commande `docker compose` disponible.

## Lancer l'environnement

```sh
cd infra/kit
docker compose up -d --build --wait
```

Pour vérifier que les capteurs publient bien :

```sh
docker compose run --rm --build tools watch --count 5
```

Le broker écoute sur 127.0.0.1 port 1883. Le compte utilisé par notre backend est
`backend` avec le mot de passe `backend-demo`.

Pour tout arrêter :

```sh
docker compose down
```

## Lancer le backend

À compléter.

## Lancer l'application mobile

À compléter.

## Provoquer des incidents

Le kit permet de simuler des pannes. Toutes ces commandes se lancent depuis `infra/kit`.

```sh
docker compose run --rm tools command sensor-001 on
docker compose run --rm tools incident sensor-001 duplicate
docker compose run --rm tools incident sensor-001 reset
```

La liste complète est dans infra/kit/README.md. Ce que ces incidents produisent
réellement sur le réseau est décrit dans docs/observations-kit.md.

## Équipe

Jérémy Perret, rôle à définir.

Second membre à compléter.
