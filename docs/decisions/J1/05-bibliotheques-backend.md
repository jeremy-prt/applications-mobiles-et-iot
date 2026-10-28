# Choix des bibliothèques du backend

## Problème

Le backend valide et écrit les messages, sert l'API et refuse une commande sans droit. Deux
comportements notés tiennent en une requête : `INSERT ... ON CONFLICT DO NOTHING` contre les
doublons, `UPDATE device_state ... WHERE recorded_at < :nouvelle` contre les mesures en retard.

## Options

- Base : un ORM (Prisma, Drizzle) ou du SQL à la main.
- Mot de passe : argon2 ou bcrypt.
- Jeton : `@fastify/jwt`, `jsonwebtoken` ou `jose`.

## Choix et compromis

| Besoin | Retenu | Pourquoi |
|---|---|---|
| Accès à la base | `pg` 8.23.0 et `kysely` 0.29.5 | Nos deux requêtes sont pénibles en ORM. Kysely vérifie les colonnes à la compilation. Prisma (7.10.0, la 8 en release candidate) et Drizzle (0.45, la 1.0 en release candidate) sont en pleine migration majeure |
| Migrations | node-pg-migrate 9.0.0 | Fichiers numérotés, suivi, retour arrière. Mieux qu'un `schema.sql` rejoué à la main ou la synchro d'un ORM |
| Validation | Zod 4.6.5 | Donne le champ fautif et la raison, qu'on logue pour justifier le rejet. Un schéma pour MQTT, HTTP et les types |
| Traces | Pino 10.3.1 | Inclus dans Fastify. Logs JSON avec `message_id` et `command_id` pour suivre une commande |
| Mot de passe | argon2 0.45.1 | argon2id recommandé par l'OWASP. bcrypt tronque au-delà de 72 octets |
| Jeton | `@fastify/jwt` 10.2.2 | Vérifié dans un hook avant chaque route protégée, même en appel direct |

Coût : SQL écrit à la main, et rôles relus en base à chaque appel, pour qu'un jeton émis avant un
retrait de droit n'autorise plus rien.

## Aide de l'IA

- bcryptjs pour éviter une dépendance native : incohérent, le pilote de base en a déjà une et
  argon2 a des binaires précompilés pour nos deux architectures.
- « `jsonwebtoken` est obsolète » : faux, il est maintenu. Les vrais atouts de `jose` sont zéro
  dépendance et la Web Crypto API.
- `INSERT OR IGNORE` pour dédupliquer : rejeté, il avalerait toute violation de contrainte et
  compterait un message malformé comme doublon.

## Vérification

Sur le système en marche, la trace d'un message invalide nomme le champ fautif :

```
"issues":[{"expected":"number","code":"invalid_type",
           "path":["co2","value"],
           "message":"Invalid input: expected number, received string"}]
```

## Limite

Un JWT ne se révoque pas. Durée de vie courte et pas de refresh, le sujet ne va pas plus loin.
