# Campus connecté

Superviser la température et le CO2 de salles de cours depuis un téléphone, et commander
leur ventilation. Projet de M2 en applications mobiles et objets connectés.

Les capteurs sont simulés. Le broker, le backend, la base de données et l'application
mobile sont réels.

```
Capteurs simulés  ->  Mosquitto  ->  Backend  ->  PostgreSQL
                                        |
                                       API
                                        |
                                     Mobile
```

Les capteurs publient sur le broker MQTT. Le backend y est abonné et enregistre les
mesures. L'application mobile n'écoute pas le broker, elle interroge l'API du backend.

## Organisation

Le dossier `backend` contient notre service, `mobile` notre application, `infra/kit` le
kit fourni par l'école et `docs` la documentation du projet.

## Lancer le projet

Prérequis : Git et Docker Desktop démarré, avec les conteneurs Linux sur Windows.

```sh
cp .env.example .env
docker compose up -d --build --wait
```

Une seule commande lance le broker, les capteurs simulés, la base et le backend.
Les migrations de schéma sont appliquées automatiquement avant le démarrage de l'API.

Pour vérifier :

```sh
curl http://localhost:3000/health
curl http://localhost:3000/rooms
```

Pour arrêter : `docker compose down`. Pour repartir d'une base vide :
`docker compose down -v`.

| Service | Adresse | Remarque |
|---|---|---|
| API | http://localhost:3000 | Ouverte sur le réseau local, pour le téléphone |
| Broker MQTT | 127.0.0.1:1883 | Compte `backend`, mot de passe dans `.env` |
| PostgreSQL | 127.0.0.1:5432 | Accessible depuis cette machine seulement |

Le téléphone ne peut pas utiliser `localhost`, qui désigne le téléphone lui-même.
Il faut l'adresse IP de la machine sur le réseau local, par exemple
`http://192.168.1.20:3000`.

## Lancer l'application mobile

À compléter.

## Simuler des pannes

Le kit permet de provoquer des incidents depuis `infra/kit`, par exemple :

```sh
docker compose run --rm tools incident sensor-001 duplicate
docker compose run --rm tools incident sensor-001 reset
```

La liste complète est dans infra/kit/README.md. Les résultats attendus pour chacun sont
dans docs/recette.md.

## Équipe

Jérémy Perret et Kylian Patry.
