# Choix des bibliothèques du backend

Trois dépendances qui ne sont pas des détails, parce qu'elles répondent chacune à un point
noté du sujet.

## Zod 4.6.5 pour la validation des messages

Le sujet demande qu'un message invalide soit rejeté, que le service continue de tourner, et
qu'une trace permette d'expliquer le rejet. Le kit envoie exprès un message où le CO2 vaut
le texte "invalide".

On pourrait écrire des `if` à la main. Zod nous donne en plus l'erreur structurée : quel
champ, quelle valeur, quel type attendu. C'est exactement ce qu'on veut écrire dans le log
pour pouvoir justifier le rejet devant le jury, plutôt qu'un simple "message ignoré".

Le schéma sert aussi de documentation du contrat MQTT dans le code.

## Pino 10.3.1 pour les traces

Un des jalons de J4 est de pouvoir suivre une mesure et une commande dans les traces.
Avec `console.log` on obtient du texte qu'on relit à l'oeil. Avec Pino on écrit des objets
JSON avec des champs, donc on peut filtrer sur un `device_id` ou un `command_id` précis et
montrer le parcours complet d'une commande en une commande shell.

C'est aussi ce qui permet de distinguer les niveaux : un message rejeté est un
avertissement, une commande sans réponse est une erreur, une mesure normale ne se logue
pas du tout.

## jose 6.2.12 et bcryptjs 3.0.3 pour l'authentification

Le sujet exige qu'un utilisateur sans droit ne puisse pas commander, même en appelant l'API
directement. Il faut donc une vraie identité côté backend.

Le JWT est sans état : le backend n'a pas à stocker de sessions, il vérifie la signature du
jeton à chaque appel. C'est le plus rapide à mettre en place et le plus simple à expliquer.
jose est la bibliothèque JWT maintenue aujourd'hui, jsonwebtoken est considéré comme
ancien.

bcryptjs est écrit en JavaScript pur, sans compilation native. Notre image Docker reste
simple et se construit partout sans outil de build supplémentaire.
