# Sécurité

## Identités

Deux familles d'identités, qu'il ne faut pas confondre.

**Les objets** sont identifiés par leur `device_id`, présent à la fois dans le topic MQTT
et dans le message. On vérifie que les deux correspondent à l'ingestion : un message publié
sur le topic d'un capteur mais contenant l'identifiant d'un autre est rejeté.

Le QR code d'association ne contient que cet identifiant public. Il ne donne aucun droit.
C'est le backend qui vérifie que l'objet existe et que l'utilisateur a le droit de
l'associer.

**Les utilisateurs** ont un compte avec un mot de passe. Le mot de passe est haché avec
argon2, jamais stocké en clair. La connexion renvoie un jeton JWT signé, à durée de vie
courte.

## Droits

Deux droits distincts : consulter et commander.

Le contrôle est fait dans le backend, dans un hook Fastify qui s'exécute avant la route.
Masquer un bouton dans l'application n'est pas un contrôle d'accès : un appel direct à
l'API avec un compte sans droit doit être refusé, et c'est ce que vérifie le scénario R11.

Les rôles sont lus en base à chaque appel, pas seulement dans le jeton. Un jeton émis avant
un retrait de droit ne doit pas continuer à autoriser.

## Secrets

Aucun secret réel n'est dans le dépôt. Les mots de passe de la base et la clé de signature
des jetons sont des variables d'environnement, listées sans valeur sensible dans
`.env.example` à la racine. Le Compose refuse de démarrer avec un message clair si le
fichier `.env` n'a pas été créé.

Les identifiants du kit (`backend-demo`, `teacher-demo`) sont des identifiants de
démonstration publics fournis par l'école, publiés dans un dépôt public. Ce ne sont pas des
secrets, et ils ne servent que localement.

## Protection des échanges

Rien n'est chiffré dans cet environnement.

Le broker MQTT du kit écoute en clair, sur 127.0.0.1 uniquement. L'API est appelée par le
téléphone en HTTP simple sur le réseau local, parce qu'un certificat HTTPS valide sur une
adresse IP privée n'est pas réalisable dans le temps du projet.

Ce que ça implique : quelqu'un sur le même réseau Wi-Fi pourrait lire les échanges entre le
téléphone et le backend, dont le jeton d'authentification. En production, l'API serait
derrière HTTPS et le broker en MQTT sur TLS.

Ce qui est quand même en place : le broker refuse les connexions anonymes, chaque rôle a
son compte, et les droits par topic sont limités par le fichier d'ACL du kit. Notre backend
ne peut pas publier de fausses mesures ni déclencher d'incidents.

## Données conservées

| Donnée | Ce qu'on garde | Combien de temps |
|---|---|---|
| Mesures | Température, CO2, les deux dates, l'identifiant du message | Durée de la politique de rétention TimescaleDB |
| Dernier état | Une ligne par objet, écrasée | Tant que l'objet existe |
| Commandes | Qui a demandé quoi, quand, et le résultat | Conservées, elles servent de trace |
| Utilisateurs | Identifiant de connexion et mot de passe haché | Tant que le compte existe |

Aucune donnée personnelle au delà de l'identifiant de connexion. Les mesures décrivent une
salle, pas une personne. On ne stocke pas la position du téléphone ni d'identifiant
d'appareil.

## Sur le téléphone

Le jeton est rangé avec `expo-secure-store`, qui utilise le Trousseau iOS, donc chiffré au
repos et inaccessible aux autres applications. Un stockage ordinaire l'écrirait en clair.

Le cache des mesures, lui, est en clair dans le stockage de l'application. Il ne contient
que des températures et des taux de CO2.

## Limites de l'environnement pédagogique

- Pas de chiffrement des échanges, ni côté MQTT ni côté API.
- Le compte MQTT du simulateur est partagé entre les trois objets, sans identité par
  appareil. C'est une simplification du kit.
- Un jeton JWT ne peut pas être révoqué avant son expiration. On compense par une durée de
  vie courte, sans mécanisme de rafraîchissement.
- Pas de limitation du nombre de tentatives de connexion.
- Le dépôt est public, donc tout ce qui s'y trouve est considéré comme lisible par tous.
