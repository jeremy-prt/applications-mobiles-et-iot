# Sécurité

Ce document décrit la cible. Fin J5 (28 octobre 2026), authentification et droits ne sont pas
faits : l'API est ouverte. Écart au périmètre, gelé après J5.

## Identités

Un objet est identifié par son `device_id`, dans le topic MQTT et dans le message. À
l'ingestion, les deux doivent être égaux, sinon le message est rejeté. Le QR code ne contient
que cet identifiant public, sans aucun droit.

Mot de passe utilisateur haché en argon2. La connexion renvoie un JWT signé de courte durée.

## Droits

Deux droits : consulter et commander, contrôlés par un hook Fastify avant la route. Cacher un
bouton ne protège rien : R11 vérifie qu'un appel direct sans droit est refusé. Les rôles sont
relus en base à chaque appel, donc un retrait de droit vaut tout de suite.

## Secrets

Mot de passe de la base et clé de signature des jetons en variables d'environnement, listées
sans valeur sensible dans `.env.example`. Le Compose ne démarre pas sans `.env`. Les
identifiants du kit (`backend-demo`, `teacher-demo`) sont des identifiants de démo publics de
l'école, pas des secrets.

## Protection des échanges

Rien n'est chiffré. Le broker du kit écoute en clair sur 127.0.0.1. Le téléphone appelle l'API
en HTTP sur le réseau local, car un certificat HTTPS valide sur une IP privée n'était pas
faisable dans le temps du projet. Quelqu'un sur le même Wi-Fi pourrait lire les échanges, jeton
compris.

Mais le broker refuse l'anonyme, chaque rôle a son compte et l'ACL du kit limite les topics.
Notre backend ne peut ni publier de fausses mesures ni déclencher d'incidents.

## Données conservées

| Donnée | Ce qu'on garde | Combien de temps |
|---|---|---|
| Mesures | Température, CO2, deux dates, identifiant du message | 7 jours (TimescaleDB) |
| Dernier état | Une ligne par objet, écrasée | Tant que l'objet existe |
| Commandes | Qui a demandé quoi, quand, résultat | Gardées, c'est la trace |
| Alertes | Objet, salle, dates et valeurs de début, pic, fin | Gardées, quelques lignes par jour et par salle |
| Utilisateurs | Identifiant et mot de passe haché | Tant que le compte existe |
| Messages bruts | Message MQTT reçu, dans MongoDB | 7 jours (index TTL) |
| Cache du téléphone | Dernière réponse de l'API | 24 heures |

Aucune autre donnée personnelle que l'identifiant de connexion : ni position, ni identifiant
d'appareil.

MongoDB et PostgreSQL tournent sans authentification, ports ouverts sur `127.0.0.1` seulement.
Seule l'API est exposée au réseau local, pour le téléphone.

## Limites de l'environnement pédagogique

- Cache en clair dans AsyncStorage, mais seulement des mesures de salle. Un futur jeton ira
  dans le Trousseau iOS via `expo-secure-store`.
- Un seul compte MQTT pour les trois objets du simulateur.
- Un JWT n'est pas révocable avant expiration. On compense par une durée courte, sans
  rafraîchissement.
- Pas de limite de tentatives de connexion.
- Dépôt public : tout y est lisible par tous.
