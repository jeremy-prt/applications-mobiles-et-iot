# Campus connecté

Superviser la température et le CO2 de salles de cours depuis un téléphone, et commander leur
ventilation. Projet de M2 en applications mobiles et objets connectés, par Jérémy Perret et Kylian
Patry. Les capteurs sont simulés. Le broker, le backend, les bases et l'application sont réels.

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
docker compose up -d --build   # aussi après un changement dans backend/
```

Le service `migrate` passe en « Exited » juste après. C'est normal, il applique les migrations
puis s'arrête. Si le backend tourne, c'est qu'elles ont réussi, il refuse de démarrer sinon.

Laisser une dizaine de secondes au backend, puis vérifier :

```sh
curl http://localhost:3000/health
curl http://localhost:3000/rooms
curl "http://localhost:3000/devices/sensor-001/telemetry?resolution=5m"
```

Le kit simule trois objets, `sensor-001` à `sensor-003`, associés aux salles 203 à 205. Seule
l'API est exposée au réseau local, sur le port 3000, parce que le téléphone doit l'atteindre. Le
broker MQTT (1883), PostgreSQL (5432) et MongoDB (27017) sont liés à `127.0.0.1`.

Arrêter : `docker compose stop`, qui garde les conteneurs. Relancer : `docker compose start`.
Repartir d'une base vide : `docker compose down -v`, qui supprime les conteneurs et les données.

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

Depuis la racine, pas depuis `infra/kit`. Le Compose du kit lancé seul crée un second projet
Docker qui échoue sur le port 1883.

```sh
docker compose --profile tools run --rm tools incident sensor-001 duplicate
docker compose --profile tools run --rm tools incident sensor-001 reset
```

Liste complète dans `infra/kit/README.md`, résultats attendus dans `docs/recette.md`.

## Limites connues

L'API est ouverte, l'authentification et les droits ne sont pas encore implémentés, voir
`docs/securite.md`. Les limites de chaque journée sont dans `docs/J1.md` et `docs/J2.md`.
