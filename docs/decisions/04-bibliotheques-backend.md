# Choix des bibliothèques du backend

Quatre dépendances de production, une par point noté : validation, traces,
authentification, mots de passe.

## Zod 4.6.5

Le sujet demande qu'un message invalide soit rejeté, que le service continue, et qu'une
trace explique le rejet. Des `if` suffiraient à rejeter. Zod donne en plus l'erreur
structurée, quel champ et quel type attendu, qui est ce qu'on écrit dans le log pour
justifier le rejet.

`z.toJSONSchema()` permet de comparer notre schéma au contrat du kit dans un test.

## Pino 10.3.1

Un jalon de J4 est de suivre une mesure et une commande dans les traces. Pino écrit du JSON
avec des champs, donc on filtre sur un `device_id` ou un `command_id` en une commande
shell. Les mesures normales sont en niveau `debug`, activable par variable
d'environnement.

## jose 6.2.12

Le sujet exige qu'un utilisateur sans droit ne puisse pas commander, même en appelant l'API
directement. Le JWT est sans état, donc pas de table de sessions.

jsonwebtoken reste maintenu. On prend jose parce qu'il n'a aucune dépendance, s'appuie sur
la Web Crypto API du runtime, et fournit ses types et son ESM nativement.

Limite assumée : un JWT ne se révoque pas. Durée de vie de 15 minutes, pas de refresh.

## bcryptjs 3.0.3

Écrit en JavaScript pur : pas de `python`, `make` ni `g++` dans l'image, et le même
Dockerfile marche sur arm64 et amd64. On accepte une dépendance native pour better-sqlite3
parce qu'elle livre des binaires précompilés pour ces deux architectures.

Deux pièges : bcryptjs bloque la boucle d'événement en synchrone, ce qui arrêterait
l'ingestion MQTT, donc API asynchrone et coût de 10. Et bcrypt tronque au-delà de 72
octets, donc on borne la longueur du mot de passe à la saisie.
