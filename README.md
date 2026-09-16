# Campus connecté

Superviser la température et le CO2 de salles de cours depuis un téléphone, et commander leur
ventilation. Projet de M2 en applications mobiles et objets connectés.

Les capteurs sont simulés. Le broker, le backend, les bases et l'application sont réels.

```
Capteurs simulés  ->  Mosquitto  ->  Backend  ->  MongoDB, les messages bruts
                                                       |
                                               job toutes les 5 s
                                                       |
                                         PostgreSQL  ->  API  ->  Mobile
```

## Lancer le projet

Prérequis : Docker Desktop démarré.

```sh
cp .env.example .env
docker compose up -d --build
```

Le service `migrate` passe en « Exited » juste après. C'est normal : il applique les migrations
puis s'arrête. Si le backend tourne, c'est qu'elles ont réussi, il refuse de démarrer sinon.

Laisser une dizaine de secondes au backend, puis vérifier :

```sh
curl http://localhost:3000/health
curl http://localhost:3000/rooms
curl "http://localhost:3000/devices/sensor-001/telemetry?resolution=5m"
```

Arrêter : `docker compose stop`. Repartir d'une base vide : `docker compose down -v`.

## Lancer l'application mobile

Prérequis : Expo Go sur le téléphone, et le téléphone sur le même réseau que la machine.

```sh
cd mobile && npm install && npx expo start
```

Scanner le code affiché dans le terminal. L'application déduit l'adresse du backend de celle du
serveur Expo, donc rien à configurer même en changeant de réseau.

## Lancer les tests

```sh
cd backend && npm test
cd mobile && npm test
```

## Simuler des pannes

Depuis la racine, pas depuis `infra/kit` : le Compose du kit lancé seul crée un second projet
Docker qui échoue sur le port 1883.

```sh
docker compose --profile tools run --rm tools incident sensor-001 duplicate
docker compose --profile tools run --rm tools incident sensor-001 reset
```

Liste complète dans `infra/kit/README.md`, résultats attendus dans `docs/recette.md`.

## Équipe

Jérémy Perret et Kylian Patry.
