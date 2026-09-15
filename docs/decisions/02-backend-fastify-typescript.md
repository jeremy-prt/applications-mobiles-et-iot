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

En production, un backend Node se écrit en TypeScript. Le coût est faible ici parce que les
types viennent des schémas qu'on écrit de toute façon.

## Pourquoi Fastify

On écrit déjà des schémas Zod pour valider les messages MQTT. Fastify sait utiliser ces
mêmes schémas pour valider les requêtes HTTP et en déduire les types des handlers. Un
schéma, deux usages. Avec Express, il faudrait revalider à la main dans chaque route.

Pino est intégré à Fastify. Le sujet demande des traces qui permettent de suivre une mesure
et une commande, donc on aurait branché Pino de toute façon.

Fastify est effectivement plus rapide qu'Express sur le nombre de requêtes servies par
seconde. Ce n'est pas notre argument, parce que ça ne joue pas ici : le mobile fait quelques
appels par minute sur neuf routes.

Il faut aussi éviter une confusion. La vitesse à laquelle les mesures arrivent ne dépend pas
du tout du framework HTTP : les messages MQTT sont reçus par le client MQTT et écrits en
base, sans jamais passer par Fastify. Le framework n'est sur le chemin que des appels du
mobile. Ce qui détermine la vitesse d'ingestion, c'est le broker, le QoS, et le temps
d'écriture en base.

NestJS apporte une structure toute faite, mais impose d'apprendre ses modules, son
injection de dépendances et ses décorateurs. Sur 4 jours à deux, c'est du temps pris sur les
points notés.

## Ce que ça coûte

Fastify a ses propres notions de hooks et de plugins, qui sont à comprendre avant d'écrire
la première route protégée. Une demi-journée environ.

TypeScript ajoute une étape de compilation. On utilise le support natif de Node 24 pour
exécuter du TypeScript en développement, et `tsc` pour l'image de production.
