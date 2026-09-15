# Choix des bibliothèques du backend

## Accès à la base : pg et Kysely, pas un ORM

Les deux requêtes que le sujet note explicitement, la déduplication et la non-régression du dernier état, sont
`INSERT ... ON CONFLICT (device_id, message_id) DO NOTHING` pour la déduplication, et
`UPDATE device_state ... WHERE recorded_at < :nouvelle` pour ne pas régresser sur une
mesure en retard.

Ce sont précisément les requêtes que les ORM rendent pénibles, parce qu'elles sortent du
schéma habituel "je charge un objet, je le modifie, je le sauve". On écrit donc du SQL,
avec le driver `pg` 8.23.0 et le constructeur de requêtes `kysely` 0.29.5 qui vérifie les
noms de colonnes à la compilation.

Prisma est stable en 7.10.0 mais sa version 8 est en release candidate, et Drizzle est
toujours en 0.45 avec sa 1.0 en release candidate. Arriver au milieu d'une migration de
version majeure n'est pas ce qu'on veut sur 4 jours.

## Migrations : node-pg-migrate 9.0.0

En production on ne rejoue pas un fichier `schema.sql` à la main et on ne laisse pas un ORM
synchroniser le schéma tout seul. On écrit des fichiers de migration numérotés, appliqués
dans l'ordre, avec une table qui mémorise ceux qui sont déjà passés et un chemin de retour
en arrière.

## Validation : Zod 4.6.5

Quand un message est mal formé, Zod dit quel champ pose problème et pourquoi. C'est cette
raison qu'on écrit dans les logs pour justifier le rejet, ce que le sujet demande
explicitement.

Le même schéma sert trois fois : valider le message MQTT, valider les requêtes HTTP dans
Fastify, et fournir les types TypeScript.

## Traces : Pino 10.3.1, déjà inclus dans Fastify

Pino écrit les logs en JSON avec des champs. On rejoue `message_id` et `command_id` dans
chaque ligne, donc on retrouve tout le parcours d'une commande en filtrant sur son numéro.
C'est le jalon "suivre une mesure et une commande dans les traces" de J4.

## Authentification : @fastify/jwt 10.2.2 et argon2 0.45.1

Le sujet exige qu'un utilisateur sans droit ne puisse pas commander, même en appelant l'API
directement. Le JWT est vérifié dans un hook Fastify avant chaque route protégée, donc le
contrôle est au même endroit pour toutes.

Les rôles sont en base et vérifiés à chaque appel, pas seulement lus dans le jeton. Un jeton
émis avant un retrait de droit ne doit pas continuer à autoriser.

argon2id est ce que recommande l'OWASP pour hacher un mot de passe. bcrypt reste
acceptable, mais il tronque au-delà de 72 octets.

Limite assumée : un JWT ne se révoque pas. Durée de vie courte et pas de refresh, qui n'est
pas dans le périmètre.

## Aide de l'IA

L'IA a d'abord proposé bcryptjs, en avançant qu'il évitait une dépendance native. Corrigé :
on accepte déjà une dépendance native pour le pilote de base, donc l'argument était
incohérent. argon2id est le choix recommandé par l'OWASP, et il fournit des binaires
précompilés pour les deux architectures dont on a besoin.

Elle a aussi écrit que jsonwebtoken était obsolète. Corrigé : il est toujours maintenu. Les
arguments réels pour jose sont l'absence de dépendances et l'appui sur la Web Crypto API.

Elle proposait enfin `INSERT OR IGNORE` pour la déduplication. Rejeté après vérification :
cette forme avalerait aussi les violations de contrainte autres que l'unicité, et un
message malformé serait compté comme un doublon.

## Vérification

Le rejet d'un message invalide produit bien une erreur exploitable dans les traces, vérifié
sur le système en marche :

```
"issues":[{"expected":"number","code":"invalid_type",
           "path":["co2","value"],
           "message":"Invalid input: expected number, received string"}]
```

Le chemin du champ fautif est présent, ce qui est exactement ce que le sujet demande pour
expliquer un rejet.
