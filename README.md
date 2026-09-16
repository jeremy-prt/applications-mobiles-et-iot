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

`backend` : notre service. `mobile` : notre application. `infra/kit` : le kit fourni par
l'école. `docs` : la documentation.

## Lancer le projet

Prérequis : Git et Docker Desktop démarré, avec les conteneurs Linux sur Windows.

```sh
cp .env.example .env
docker compose up -d --build --wait
```

Vérifier avec `curl http://localhost:3000/health` puis `curl http://localhost:3000/rooms`.

Le service `migrate` s'affiche en « Exited » après le lancement. Ce n'est pas une erreur :
il applique les migrations puis s'arrête, avec le code 0. Si le backend tourne, c'est que
les migrations ont réussi, il refuse de démarrer sinon.

Arrêter : `docker compose down`, ou `docker compose stop` pour conserver les conteneurs.
Repartir d'une base vide : `docker compose down -v`.

| Service | Adresse | Remarque |
|---|---|---|
| API | http://localhost:3000 | Ouverte sur le réseau local, pour le téléphone |
| Broker MQTT | 127.0.0.1:1883 | Compte `backend`, mot de passe dans `.env` |
| PostgreSQL | 127.0.0.1:5432 | Base consolidée, accessible depuis cette machine seulement |
| MongoDB | 127.0.0.1:27017 | Zone brute, accessible depuis cette machine seulement |

## Lancer l'application mobile

Prérequis : Expo Go installé sur le téléphone, un compte Expo gratuit, et le téléphone sur
le même réseau que la machine.

```sh
cd mobile
npm install
npx expo start
```

Scanner le code affiché dans le terminal avec Expo Go.

L'application prend l'adresse de la machine qui fait tourner le serveur Expo, donc rien à
configurer, même en changeant de réseau. Si le backend tourne sur une autre machine ou un
autre port, copier `mobile/.env.example` en `mobile/.env` et renseigner
`EXPO_PUBLIC_API_URL`.

## Lancer les tests

```sh
cd backend && npm test
cd mobile && npm test
```

Ils tournent sans broker, sans base et sans serveur : ils portent sur les règles de décision.

## Simuler des pannes

Depuis la racine du dépôt. Le service `tools` du kit est derrière un profil, d'où l'option.

```sh
docker compose --profile tools run --rm tools incident sensor-001 duplicate
docker compose --profile tools run --rm tools incident sensor-001 reset
```

Ne pas lancer le Compose du kit directement depuis `infra/kit` : ça crée un second projet
Docker qui échoue sur le port 1883, déjà pris par le broker en marche.

Liste complète dans infra/kit/README.md, résultats attendus dans docs/recette.md.

## Équipe

Jérémy Perret et Kylian Patry.
