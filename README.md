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

## Lancer l'application mobile

Prérequis : Expo Go installé sur le téléphone, et un compte Expo gratuit. Le téléphone et
la machine doivent être sur le même réseau.

```sh
cd mobile
npm install
npx expo start
```

Scanner le code affiché dans le terminal avec Expo Go.

L'application trouve le backend toute seule : elle prend l'adresse de la machine qui fait
tourner le serveur Expo, à laquelle le téléphone est déjà connecté. Rien à configurer, même
en changeant de réseau.

Si le backend tourne sur une autre machine ou sur un autre port, copier `mobile/.env.example`
en `mobile/.env` et renseigner `EXPO_PUBLIC_API_URL`. `localhost` ne fonctionnerait pas : sur
le téléphone, il désigne le téléphone lui-même.

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
