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

## Lancer l'environnement

Prérequis : Docker Desktop démarré.

```sh
cd infra/kit
docker compose up -d --build --wait
docker compose run --rm --build tools watch --count 5
```

La seconde commande affiche les mesures des capteurs. Le broker écoute sur 127.0.0.1
port 1883, le backend s'y connecte avec le compte `backend` et le mot de passe
`backend-demo`.

Pour arrêter : `docker compose down`.

## Lancer le backend

À compléter.

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
