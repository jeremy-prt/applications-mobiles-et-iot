# Architecture du backend : en couches, avec un noyau métier isolé

## Contexte

Le backend reçoit des messages MQTT au fil de l'eau et répond aux requêtes du mobile. Les
deux chemins appliquent les mêmes règles, et une commande part du HTTP pour finir en MQTT.

## Options envisagées

Architecture en couches avec noyau métier isolé, architecture hexagonale, CQRS,
microservices.

## Choix retenu

Une architecture en couches, avec les règles métier isolées dans `domain/`, qui ne connaît ni
le broker ni Fastify. Règle de dépendance : `mqtt/` et `http/` appellent `domain/`, jamais
l'inverse. Le découpage des dossiers est dans `docs/architecture.md`.

## Pourquoi

Les règles sont dans `domain/`, donc testables sans broker : un test de déduplication appelle
une fonction et lui passe deux messages. Le sujet classe le test automatisé au-dessus de la
capture d'écran.

Ça évite aussi de dupliquer une règle. Le seuil de fraîcheur sert à l'ingestion et à
l'affichage ; écrit à deux endroits, il finirait par diverger.

## Les trois patterns écartés

| Pattern | Pourquoi écarté |
|---|---|
| Architecture hexagonale | Même but que nous, isoler le métier, mais elle ajoute des ports et des adaptateurs pour pouvoir changer de base ou de broker. Notre broker est imposé par le sujet et notre base choisie pour quatre jours : on écrirait des interfaces pour des remplacements qui n'arriveront pas. Son bénéfice réel, on l'obtient déjà avec la règle de dépendance |
| CQRS | Il sépare le modèle d'écriture du modèle de lecture, quand les besoins divergent trop. Nos deux chemins, MQTT écrit et HTTP lit, travaillent sur les mêmes tables. Notre table de dernier état joue déjà le rôle d'un modèle de lecture optimisé, et elle tient en une requête SQL. Deux modèles et leur synchronisation créeraient un problème de cohérence qu'on n'a pas |
| Microservices | Découper l'ingestion et l'API obligerait à partager l'état entre deux services et à gérer deux déploiements. Or c'est justement la cohérence de cet état, le doublon et l'ordre des mesures, qui est notée |

## Ce que ça coûte

Plus de fichiers qu'en écrivant tout dans le handler MQTT, et la discipline de ne jamais
appeler la base directement depuis une route.

## Aide de l'IA

L'IA n'avait pas posé la question de l'architecture. Elle a été ajoutée sur demande, avec la
consigne d'examiner l'hexagonal et CQRS plutôt que de les ignorer.

Sa première réponse décrivait le découpage comme « une version légère de l'hexagonal ».
Formule rejetée : soit on applique des ports et des adaptateurs, soit on n'en applique pas.
Ce qu'on fait est un découpage en couches avec une règle de dépendance.

## Vérification

À faire en J2, quand les règles de doublon et de fraîcheur seront couvertes par des tests :
vérifier qu'aucun fichier de `domain/` n'importe `mqtt`, `fastify` ni `kysely`, et que les
tests de ces règles tournent sans broker ni serveur HTTP.

Aujourd'hui, `src/domain/fraicheur.ts` ne contient que des fonctions pures, sans aucun
import.
