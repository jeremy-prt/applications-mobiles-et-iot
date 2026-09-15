# Choix des bibliothèques du backend

Quatre dépendances de production, une par point noté du sujet : validation, traces,
authentification, mots de passe.

## Zod 4.6.5 pour la validation des messages

Le sujet demande qu'un message invalide soit rejeté, que le service continue de tourner, et
qu'une trace explique le rejet. Le kit envoie exprès un message où le CO2 vaut le texte
`"invalide"`.

Des `if` à la main suffiraient à rejeter. Zod donne en plus l'erreur structurée : quel
champ, quelle valeur reçue, quel type attendu. C'est ce qu'on écrit dans le log pour
justifier le rejet, plutôt qu'un "message ignoré" impossible à défendre.

`z.toJSONSchema()` exporte le schéma, ce qui permet de le comparer au contrat du kit dans
un test plutôt que de vérifier à l'oeil.

## Pino 10.3.1 pour les traces

Un jalon de J4 est de pouvoir suivre une mesure et une commande dans les traces. Pino écrit
des objets JSON avec des champs, donc on filtre sur un `device_id` ou un `command_id` et on
montre le parcours complet en une commande shell. Avec `console.log` il faudrait relire du
texte à l'oeil.

Les mesures normales sont loguées en niveau `debug`, réglable par variable
d'environnement : silencieuses en fonctionnement, activables pour la démonstration.

## jose 6.2.12 pour les jetons

Le sujet exige qu'un utilisateur sans droit ne puisse pas commander, même en appelant l'API
directement. Il faut donc une identité vérifiée côté backend.

Le JWT est sans état : pas de table de sessions ni de store partagé, on vérifie la
signature à chaque appel.

jsonwebtoken (9.0.3) fonctionne toujours et reste maintenu. On prend jose parce qu'il n'a
aucune dépendance, qu'il s'appuie sur la Web Crypto API du runtime, et qu'il fournit ses
types et son ESM nativement. C'est aussi ce qu'utilisent Auth.js et Hono.

Limite à assumer : un JWT sans état ne se révoque pas. On met une durée de vie de 15
minutes et on ne fait pas de refresh, qui n'est pas dans le périmètre.

## bcryptjs 3.0.3 pour les mots de passe

Écrit en JavaScript pur. Pas de `python`, `make` ni `g++` dans l'image, et le même
Dockerfile fonctionne sur Mac arm64 et sur amd64.

À noter : on accepte une dépendance native pour better-sqlite3, parce qu'elle fournit des
binaires précompilés pour ces deux architectures et que rien ne se compile au build.

Deux pièges. bcryptjs est plus lent que le bcrypt natif et bloque la boucle d'événement
s'il est appelé en synchrone, ce qui arrêterait l'ingestion MQTT pendant ce temps : on
utilise l'API asynchrone et un coût de 10. Et bcrypt tronque au-delà de 72 octets, donc la
longueur du mot de passe est bornée à la saisie.
