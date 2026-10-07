# Idempotence des commandes

## Problème

Le téléphone envoie une commande et la réponse se perd, par exemple quand le réseau coupe
juste après l'envoi. Le téléphone ne sait pas si le serveur l'a reçue. S'il renvoie la
demande, le backend ne doit pas la publier une seconde fois, sinon l'objet peut agir deux
fois. Il faut donc reconnaître qu'une demande est la même qu'une précédente.

## Options

Laisser le serveur créer l'identifiant de la commande et le renvoyer dans la réponse.

Garder un identifiant créé par le serveur, et ajouter un en-tête `Idempotency-Key` choisi par
le client, que le serveur mémorise à part.

Faire choisir le `command_id` par le mobile et l'envoyer dans le corps de la demande.

## Choix et compromis

Le `command_id` est choisi par le mobile et sert de clé. C'est la clé primaire de la table
`commands`. Le même identifiant avec le même contenu est un renvoi : le backend répond 200
avec la commande existante et ne republie rien. Avec un contenu différent, il répond 409
`COMMAND_ID_CONFLICT` plutôt que d'exécuter l'une des deux. Deux renvois simultanés passent
tous les deux la lecture préalable, c'est la clé primaire qui tranche, avec
`ON CONFLICT DO NOTHING`.

L'identifiant créé par le serveur est écarté : si la réponse se perd, le client n'a jamais
connu cet identifiant, et son renvoi crée une seconde commande. L'en-tête `Idempotency-Key`
règle ce problème, mais ajoute une deuxième clé à stocker. Le contrat du kit transporte déjà
un `command_id` jusqu'à l'objet et le reçoit dans le résultat. Un seul identifiant sert donc
dans l'API, dans MQTT, dans la base et dans les traces.

Ce que ça coûte : on fait confiance au client pour tirer un identifiant unique. Le mobile
tire `cmd-` suivi d'un UUID. Il doit aussi garder le même identifiant quand il réessaie après
une erreur réseau ou une erreur 5xx, et en tirer un nouveau après un refus 4xx ou pour une
nouvelle consigne.

## Aide de l'IA

L'IA a écrit le code à partir d'un contrat fixé par nous : le `command_id` comme clé, les
codes 200, 202 et 409, et aucune republication d'un renvoi.

Sa première version relisait la commande en base après la publication, pour renvoyer
`published_at`. Le test de charge nous a fait la retirer. C'était une requête de plus par
commande, sur le pool de 10 connexions partagé avec le job de consolidation. La date
d'accusé est maintenant gardée en mémoire et ajoutée à la réponse.

## Vérification

La même demande envoyée deux fois sur `sensor-002` donne 202 puis 200, avec les mêmes
`requested_at` et `published_at`. Sur le topic de commande, seuls 2 messages passent pour
cette demande rejouée et une commande témoin envoyée après : le rejeu n'a pas été republié.
Une seule ligne en base.

```sh
docker compose --profile tools run --rm tools watch \
  --topic "campus/v1/devices/sensor-002/commands" --count 2
```

Au test de charge, une commande sur cinq est envoyée deux fois en même temps. Sur trois
paliers, 260 lignes en base pour 260 `command_id`, aucun doublon. Le même `command_id` avec
une autre consigne donne 409 `COMMAND_ID_CONFLICT`.

## Limite

Notre protection s'arrête au backend. Entre le broker et l'objet, le QoS 1 peut livrer deux
fois la même commande. Le kit l'écarte, mais seulement dans son cache des 1000 dernières
commandes, et jusqu'à son redémarrage.

Sans authentification, n'importe quel client peut prendre un identifiant avant un autre.
Ce qui ferait changer d'avis : plusieurs utilisateurs authentifiés. La clé deviendrait le
couple utilisateur et `command_id`, pour qu'un client ne puisse pas bloquer celui d'un autre.
