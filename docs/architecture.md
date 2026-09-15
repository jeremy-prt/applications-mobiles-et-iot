# Architecture

```mermaid
flowchart LR
    S["Capteurs simulés (kit)"] -->|MQTT| M["Mosquitto (kit)"]
    M -->|MQTT| B["Backend (nous)"]
    B --> D[("PostgreSQL + TimescaleDB (nous)")]
    B -->|HTTP| A["Application mobile (nous)"]
    B -->|MQTT commandes| M
```

## Technologies retenues

Le choix de chacune, les alternatives écartées et ce qu'elle coûte sont dans
`docs/decisions/`.

| Couche | Techno | Version |
|---|---|---|
| Runtime | Node.js LTS | 24.21.0 |
| Langage | TypeScript | 7.0.2 |
| API | Fastify | 5.12.4 |
| Client MQTT | mqtt | 5.15.2 |
| Base | PostgreSQL | 18.6 |
| Séries temporelles | TimescaleDB | 2.30.0 |
| Accès aux données | pg et Kysely | 8.23.0 et 0.29.5 |
| Migrations | node-pg-migrate | 9.0.0 |
| Validation | Zod | 4.6.5 |
| Authentification | @fastify/jwt et argon2 | 10.2.2 et 0.45.1 |
| Traces | Pino | 10.3.1 |
| Mobile | Expo SDK 57 (React Native 0.86) | expo 57.0.22 |
| Navigation mobile | Expo Router | 57.0.21 |
| Réseau et cache mobile | TanStack Query, persist-client, async-storage-persister | 5.102.8 |
| Détection du réseau | NetInfo | 12.0.1 |
| Stockage local | AsyncStorage | 2.2.0 |
| Jeton sur le téléphone | expo-secure-store | 57.0.4 |
| Interface | React Native Paper | 5.15.3 |
| Scan de QR | expo-camera | 57.0.5 |

Aucune bibliothèque d'état global : les données viennent du serveur et sont gérées par
TanStack Query, le jeton tient dans un contexte React.

## Organisation du code

```
backend/src/
  schemas/    schémas Zod : le format des messages et des requêtes
  domain/     les règles : doublon, ordre des mesures, fraîcheur, commandes, alertes
  db/         requêtes SQL et migrations
  mqtt/       connexion au broker, abonnements, publication des commandes
  http/       routes Fastify
```

Règle de dépendance : `mqtt/` et `http/` appellent `domain/`, jamais l'inverse. Hexagonale,
CQRS et microservices ont été examinés et écartés, voir
`docs/decisions/04-architecture-du-backend.md`.

## Actualisation côté mobile

Le sujet demande d'expliquer comment l'application actualise ses données et ce que
« récent » veut dire.

Récent : une mesure de moins de 30 secondes, seuil calculé par le backend et renvoyé dans
le champ `is_stale` de l'API. Le téléphone ne le recalcule pas, son horloge peut différer.

| Déclencheur | Comportement |
|---|---|
| Ouverture d'un écran | Appel si les données en cache ont plus de 15 secondes |
| Retour de l'application au premier plan | Nouvel appel |
| Retour du réseau | Nouvel appel |
| Pendant qu'un écran est ouvert | Rafraîchissement toutes les 15 secondes |
| Après l'envoi d'une commande | Interrogation du suivi toutes les 2 secondes, jusqu'à un statut définitif ou 15 secondes |

L'écran distingue quatre états : chargement, vide, erreur, et donnée ancienne. L'état hors
ligne est à part, il concerne le téléphone et non la donnée.

Trois situations ne doivent jamais être confondues : l'objet est déconnecté, l'objet est en
ligne mais ne mesure plus, ou le téléphone n'a plus de réseau.

## Flux des données

**Une mesure.** Le capteur publie sur `campus/v1/devices/{id}/telemetry`. Le backend, abonné
en permanence, valide le message, l'écarte si c'est un doublon, l'écrit dans l'historique, et
met à jour le dernier état seulement si la mesure est plus récente. Le mobile lit ce dernier
état via `GET /rooms`.

**Une commande.** Le mobile appelle `POST /devices/:id/commands`. Le backend enregistre la
commande en attente, publie sur `campus/v1/devices/{id}/commands`, puis attend le résultat
sur `.../results`. Le mobile suit l'avancement avec `GET /commands/:id`. L'état réel de la
ventilation ne vient pas de la commande mais du topic `state`.

## Règles à documenter

Ces valeurs sont déclarées avant les tests de recette, comme le demande le sujet.

| Paramètre | Valeur | Pourquoi cette valeur |
|---|---|---|
| Seuil de fraîcheur d'une mesure | 30 secondes | Les capteurs publient toutes les 2 secondes : 30 secondes valent 15 mesures manquées, ce n'est plus un aléa réseau. Assez long pour absorber une reconnexion du broker, assez court pour le montrer en démonstration |
| Expiration d'une commande | 10 secondes | C'est nous qui la choisissons : le contrat impose seulement une date future, et l'outil du kit utilise 15 secondes. Passé ce délai, l'objet refuse d'exécuter |
| Attente maximale d'une commande | 15 secondes | Plus longue que l'expiration. Abandonner avant laisserait l'objet exécuter après notre abandon, et on afficherait un échec faux |
| Alerte CO2, déclenchement | 1000 ppm | Au-dessus de la valeur repère de 800 ppm du HCSP |
| Alerte CO2, retour à la normale | 800 ppm | Retour à la valeur repère. L'écart de 200 ppm empêche l'alerte de clignoter autour d'une valeur unique |
| Rétention de l'historique | 7 jours | Assez pour montrer une évolution sur plusieurs jours, assez court pour que la suppression automatique soit observable |
| Taille maximale d'une page d'historique | 500 points | Borne les lectures, pour qu'une requête ne bloque pas l'ingestion |
| Rafraîchissement du mobile | 15 secondes | Sous le seuil de fraîcheur, donc l'affichage ne passe jamais en ancien à cause de notre propre rythme. Rafraîchir toutes les 2 secondes afficherait des variations d'un point de CO2 et viderait la batterie |

Une seule alerte ouverte par salle : tant qu'elle est ouverte, les mesures au-dessus de
1000 ppm la mettent à jour au lieu d'en créer une nouvelle. L'écart de 200 ppm entre les deux
seuils vaut environ 17 mesures de montée sans ventilation et 5 mesures de descente avec, donc
bien plus que le bruit du modèle : une valeur qui oscille ne peut pas traverser les deux
seuils. Une mesure invalide ne doit ni ouvrir ni fermer une alerte.

Source des seuils : le HCSP retient 800 ppm comme valeur repère d'un renouvellement d'air
satisfaisant et 1500 ppm comme valeur d'action rapide, dans son avis du 21 janvier 2022 sur
la mesure du CO2 dans les établissements recevant du public. Notre seuil de 1000 ppm n'est
pas une norme, c'est notre choix entre ces deux valeurs.
