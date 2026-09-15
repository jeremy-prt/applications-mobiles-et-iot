# Choix du backend : Node, TypeScript et Fastify

## Contexte

Le service a deux entrées. Il reçoit des messages MQTT en continu et il répond à environ
neuf routes HTTP appelées par le mobile : connexion, liste des salles, détail d'une salle,
détail d'un objet, historique, association par QR code, envoi d'une commande, suivi d'une
commande, alertes.

## Options envisagées

Express, Fastify, NestJS. Et JavaScript contre TypeScript.

## Choix retenu

Node 24 LTS, TypeScript 7.0.2, Fastify 5.12.4.

## Pourquoi TypeScript

L'erreur la plus fréquente sur ce genre de projet est de lire un champ qui n'existe pas
dans un message, ou de traiter un texte comme un nombre. C'est exactement ce que le kit
nous envoie exprès, avec un CO2 qui vaut le texte `"invalide"`.

En TypeScript, on décrit le message une fois avec Zod, et les types en sont déduits
automatiquement. Si quelqu'un écrit `message.co2` au lieu de `message.co2.value`, l'erreur
apparaît à la compilation au lieu d'apparaître en démonstration.

Le coût est faible ici parce que les types viennent des schémas qu'on écrit de toute façon.

## Pourquoi Fastify

On écrit déjà des schémas Zod pour valider les messages MQTT. Fastify sait utiliser ces
mêmes schémas pour valider les requêtes HTTP et en déduire les types des handlers. Un
schéma, deux usages. Avec Express, il faudrait revalider à la main dans chaque route.

Pino est intégré à Fastify. Le sujet demande des traces qui permettent de suivre une mesure
et une commande, donc on aurait branché Pino de toute façon.

La différence de débit HTTP avec Express ne joue pas ici, le mobile fait quelques appels par
minute. Et elle ne joue pas non plus sur la vitesse d'arrivée des mesures, qui passent par
le client MQTT et la base, jamais par Fastify.

NestJS apporte une structure toute faite, mais impose d'apprendre ses modules, son
injection de dépendances et ses décorateurs. Sur 4 jours à deux, c'est du temps pris sur les
points notés.

## Ce que ça coûte

Fastify a ses propres notions de hooks et de plugins, qui sont à comprendre avant d'écrire
la première route protégée. Une demi-journée environ.

TypeScript ajoute une étape de compilation. On utilise le support natif de Node 24 pour
exécuter du TypeScript en développement, et `tsc` pour l'image de production.

## Aide de l'IA

L'IA a d'abord recommandé Express, en avançant qu'il n'y avait « rien à apprendre puisqu'on
le connaît déjà ». Argument rejeté : il défend notre confort, pas la techno.

Elle a ensuite justifié Express 5 par le fait qu'il transmet les promesses rejetées au
gestionnaire d'erreur, « puisque nos routes seront asynchrones car elles lisent la base ».
Corrigé : notre pilote de base est synchrone, donc la prémisse était fausse. Et cette
protection ne couvre de toute façon pas le gestionnaire de messages MQTT, qui est un
écouteur d'événement.

Elle a aussi affirmé que NestJS ne savait pas gérer un client MQTT au démarrage. Corrigé
après vérification : NestJS a `OnModuleInit` et un transport MQTT intégré. Le seul argument
honnête contre lui est le temps d'apprentissage.

## Vérification

Le service tourne et répond : `curl http://localhost:3000/health` renvoie
`{"status":"ok","db":true}`.

Un message invalide est rejeté sans arrêter le service, vérifié avec
`docker compose run --rm tools incident sensor-001 invalid` : aucune ligne insérée, le log
indique le champ fautif, et `/health` répond toujours.
