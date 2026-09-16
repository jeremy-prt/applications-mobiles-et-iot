# Choix des bibliothèques du backend

## Problème

Le backend reçoit les messages des capteurs, les valide, les écrit, sert l'API du mobile et
refuse une commande à un utilisateur sans droit. Deux comportements notés tiennent chacun dans
une requête, `INSERT ... ON CONFLICT DO NOTHING` contre les doublons, et `UPDATE device_state
... WHERE recorded_at < :nouvelle` pour qu'une mesure en retard ne fasse pas reculer l'état.

## Options

Pour la base, un ORM comme Prisma ou Drizzle, ou du SQL écrit à la main. Pour le mot de passe,
argon2 ou bcrypt. Pour le jeton, `@fastify/jwt`, `jsonwebtoken` ou `jose`.

## Choix et compromis

| Besoin | Retenu | Pourquoi, et ce qui est écarté |
|---|---|---|
| Accès à la base | `pg` 8.23.0 et `kysely` 0.29.5 | Ces deux requêtes sont celles que les ORM rendent pénibles, parce qu'elles sortent du schéma « je charge un objet, je le modifie, je le sauve ». Kysely vérifie les noms de colonnes à la compilation. Prisma est stable en 7.10.0 avec sa 8 en release candidate, Drizzle est en 0.45 avec sa 1.0 en release candidate, et on ne veut pas arriver au milieu d'une migration majeure sur 4 jours |
| Migrations | node-pg-migrate 9.0.0 | Des fichiers numérotés appliqués dans l'ordre, une table qui mémorise ceux déjà passés, un chemin de retour en arrière. Écartés, le `schema.sql` rejoué à la main et la synchronisation automatique d'un ORM |
| Validation | Zod 4.6.5 | Sur un message mal formé, Zod dit quel champ pose problème et pourquoi. C'est cette raison qu'on écrit dans les logs pour justifier le rejet, ce que le sujet demande. Le même schéma sert au message MQTT, à la requête HTTP et aux types TypeScript |
| Traces | Pino 10.3.1 | Déjà inclus dans Fastify. Les logs sont en JSON avec des champs, et on y rejoue `message_id` et `command_id`, donc on retrouve le parcours d'une commande en filtrant sur son numéro |
| Mot de passe | argon2 0.45.1 | argon2id est ce que recommande l'OWASP. bcrypt reste acceptable, mais il tronque au delà de 72 octets |
| Jeton | `@fastify/jwt` 10.2.2 | Le jeton est vérifié dans un hook avant chaque route protégée, donc le contrôle est au même endroit pour toutes, y compris quand l'API est appelée directement |

Ce que ça coûte. Le SQL est écrit à la main, et les rôles sont relus en base à chaque appel,
parce qu'un jeton émis avant un retrait de droit ne doit pas continuer à autoriser.

## Aide de l'IA

L'IA a proposé bcryptjs pour éviter une dépendance native. Incohérent, on en accepte déjà une
pour le pilote de base, et argon2 fournit des binaires précompilés pour nos deux architectures.

Elle a écrit que `jsonwebtoken` était obsolète. C'est faux, il est toujours maintenu. Les
arguments réels pour `jose` sont l'absence de dépendances et l'appui sur la Web Crypto API.

Elle proposait `INSERT OR IGNORE` pour la déduplication. Rejeté après vérification, parce que
cette forme avalerait aussi les violations de contrainte autres que l'unicité, et qu'un
message malformé serait compté comme un doublon.

## Vérification

Sur un message invalide, la trace nomme le champ fautif, ce que le sujet demande pour
expliquer un rejet. Vérifié sur le système en marche.

```
"issues":[{"expected":"number","code":"invalid_type",
           "path":["co2","value"],
           "message":"Invalid input: expected number, received string"}]
```

## Limite

Un JWT ne se révoque pas. Durée de vie courte et pas de refresh, le sujet ne va pas plus loin.
