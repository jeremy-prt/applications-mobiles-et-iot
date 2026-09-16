# Sécurité

Ce document décrit la cible. Au 16 septembre 2026, l'authentification et les droits ne sont pas
implémentés, l'API est ouverte.

## Identités

Les objets sont identifiés par leur `device_id`, présent dans le topic MQTT et dans le message.
On vérifie que les deux correspondent à l'ingestion, et un message portant l'identifiant d'un
autre capteur est rejeté. Le QR code ne contient que cet identifiant public, sans aucun droit.

Les utilisateurs ont un compte, mot de passe haché avec argon2. La connexion renvoie un jeton JWT
signé, à durée de vie courte.

## Droits

Deux droits distincts, consulter et commander. Le contrôle est fait dans un hook Fastify qui
s'exécute avant la route. Masquer un bouton dans l'application ne contrôle rien, et c'est le
scénario R11 qui vérifie qu'un appel direct avec un compte sans droit est bien refusé. Les rôles
sont lus en base à chaque appel, pour qu'un jeton émis avant un retrait de droit cesse d'autoriser.

## Secrets

Le mot de passe de la base et la clé de signature des jetons sont des variables d'environnement,
listées sans valeur sensible dans `.env.example`. Le Compose refuse de démarrer si le fichier
`.env` n'a pas été créé. Les identifiants du kit (`backend-demo`, `teacher-demo`) sont des
identifiants de démonstration publics fournis par l'école, pas des secrets.

## Protection des échanges

Rien n'est chiffré. Le broker MQTT du kit écoute en clair sur 127.0.0.1. Le téléphone appelle
l'API en HTTP simple sur le réseau local, parce qu'un certificat HTTPS valide sur une adresse IP
privée n'est pas réalisable dans le temps du projet. Quelqu'un sur le même réseau Wi-Fi pourrait
lire les échanges, dont le jeton.

Le broker refuse quand même les connexions anonymes, chaque rôle a son compte, et l'ACL du kit limite
les droits par topic. Notre backend ne peut pas publier de fausses mesures ni déclencher d'incidents.

## Données conservées

| Donnée | Ce qu'on garde | Combien de temps |
|---|---|---|
| Mesures | Température, CO2, les deux dates, l'identifiant du message | 7 jours, supprimées automatiquement par TimescaleDB |
| Dernier état | Une ligne par objet, écrasée | Tant que l'objet existe |
| Commandes | Qui a demandé quoi, quand, et le résultat | Conservées, elles servent de trace |
| Utilisateurs | Identifiant de connexion et mot de passe haché | Tant que le compte existe |
| Messages bruts | Le message MQTT tel qu'il est arrivé, dans MongoDB | 7 jours, supprimés par un index TTL |
| Cache du téléphone | La dernière réponse de l'API, sur le disque de l'appareil | 24 heures |

Aucune donnée personnelle au delà de l'identifiant de connexion, ni position du téléphone ni
identifiant d'appareil. Le cache est écrit en clair par AsyncStorage et ne contient que des mesures
de salle. Le jour où l'application gardera un jeton de session, il ira dans `expo-secure-store`.

MongoDB tourne sans authentification, comme PostgreSQL. Leurs ports ne sont ouverts que sur
`127.0.0.1`. Seule l'API est exposée au réseau local, parce que le téléphone doit l'atteindre.

## Limites de l'environnement pédagogique

- Le cache des mesures est en clair dans le stockage de l'application. Quand l'application
  gardera un jeton, en J3, il ira dans le Trousseau iOS via `expo-secure-store`.
- Le compte MQTT du simulateur est partagé entre les trois objets, sans identité par appareil.
- Un jeton JWT ne peut pas être révoqué avant son expiration. On compense par une durée de vie
  courte, sans mécanisme de rafraîchissement.
- Pas de limitation du nombre de tentatives de connexion.
- Le dépôt est public, donc tout ce qui s'y trouve est lisible par tous.
