# Sécurité

Ce document décrit la cible. Au 15 septembre 2026, l'authentification et les droits ne sont
pas implémentés : l'API est ouverte.

## Identités

**Les objets** sont identifiés par leur `device_id`, présent à la fois dans le topic MQTT et
dans le message. On vérifie que les deux correspondent à l'ingestion : un message publié sur
le topic d'un capteur mais contenant l'identifiant d'un autre est rejeté.

Le QR code d'association ne contient que cet identifiant public et ne donne aucun droit.

**Les utilisateurs** ont un compte avec un mot de passe haché avec argon2. La connexion
renvoie un jeton JWT signé, à durée de vie courte.

## Droits

Deux droits distincts : consulter et commander.

Le contrôle est fait dans un hook Fastify qui s'exécute avant la route. Masquer un bouton
dans l'application n'est pas un contrôle d'accès : un appel direct à l'API avec un compte
sans droit doit être refusé, et c'est ce que vérifie le scénario R11.

Les rôles sont lus en base à chaque appel, pas seulement dans le jeton. Un jeton émis avant
un retrait de droit ne doit pas continuer à autoriser.

## Secrets

Le mot de passe de la base et la clé de signature des jetons sont des variables
d'environnement, listées sans valeur sensible dans `.env.example`. Le Compose refuse de
démarrer si le fichier `.env` n'a pas été créé.

Les identifiants du kit (`backend-demo`, `teacher-demo`) sont des identifiants de
démonstration publics fournis par l'école. Ce ne sont pas des secrets.

## Protection des échanges

Rien n'est chiffré. Le broker MQTT du kit écoute en clair sur 127.0.0.1. L'API est appelée
par le téléphone en HTTP simple sur le réseau local, parce qu'un certificat HTTPS valide sur
une adresse IP privée n'est pas réalisable dans le temps du projet. Conséquence : quelqu'un
sur le même réseau Wi-Fi pourrait lire les échanges, dont le jeton.

En place malgré tout : le broker refuse les connexions anonymes, chaque rôle a son compte, et
les droits par topic sont limités par le fichier d'ACL du kit. Notre backend ne peut pas
publier de fausses mesures ni déclencher d'incidents.

## Données conservées

| Donnée | Ce qu'on garde | Combien de temps |
|---|---|---|
| Mesures | Température, CO2, les deux dates, l'identifiant du message | 7 jours, supprimées automatiquement par TimescaleDB |
| Dernier état | Une ligne par objet, écrasée | Tant que l'objet existe |
| Commandes | Qui a demandé quoi, quand, et le résultat | Conservées, elles servent de trace |
| Utilisateurs | Identifiant de connexion et mot de passe haché | Tant que le compte existe |

Aucune donnée personnelle au delà de l'identifiant de connexion. On ne stocke ni la position
du téléphone ni d'identifiant d'appareil.

## Limites de l'environnement pédagogique

- Le cache des mesures est en clair dans le stockage de l'application. Le jeton, lui, est
  dans le Trousseau iOS via `expo-secure-store`.
- Le compte MQTT du simulateur est partagé entre les trois objets, sans identité par
  appareil. C'est une simplification du kit.
- Un jeton JWT ne peut pas être révoqué avant son expiration. On compense par une durée de
  vie courte, sans mécanisme de rafraîchissement.
- Pas de limitation du nombre de tentatives de connexion.
- Le dépôt est public, donc tout ce qui s'y trouve est considéré comme lisible par tous.
