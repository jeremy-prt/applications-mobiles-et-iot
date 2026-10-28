# Idempotence des commandes

## Problème

Si la réponse à une commande se perd, par exemple sur une coupure réseau, le téléphone la
renvoie. Le backend ne doit pas la republier, sinon l'objet agit deux fois.

## Options

- Un identifiant créé par le serveur et renvoyé dans la réponse.
- Un identifiant serveur plus un en-tête `Idempotency-Key` choisi par le client.
- Un `command_id` choisi par le mobile, dans le corps de la demande.

## Choix et compromis

Le `command_id` du mobile est la clé primaire de `commands`. Même identifiant et même contenu :
200 avec la commande existante, sans republier. Contenu différent : 409 `COMMAND_ID_CONFLICT`.
Entre deux renvois simultanés, la clé primaire tranche avec `ON CONFLICT DO NOTHING`.

Avec un identifiant serveur, un client qui perd la réponse ne le connaît pas, et son renvoi
crée une seconde commande. `Idempotency-Key` ajoute une deuxième clé, alors que le contrat du
kit transporte déjà un `command_id` jusqu'à l'objet.

Coût : on fait confiance au client. Le mobile tire `cmd-` suivi d'un UUID, le garde après une
erreur réseau ou 5xx, et en tire un nouveau après un 4xx ou pour une nouvelle consigne.

## Aide de l'IA

L'IA a codé notre contrat : `command_id` comme clé, codes 200, 202 et 409, pas de
republication. Sa version relisait la commande en base pour renvoyer `published_at`. Retiré
après le test de charge, car c'était une requête de plus sur le pool de 10 connexions partagé
avec le job. La date est gardée en mémoire.

## Vérification

Deux envois identiques sur `sensor-002` donnent 202 puis 200, avec les mêmes `requested_at` et
`published_at`. Le topic ne voit que 2 messages pour ce rejeu plus une commande témoin, et la
base une seule ligne.

```sh
docker compose --profile tools run --rm tools watch \
  --topic "campus/v1/devices/sensor-002/commands" --count 2
```

Au test de charge, une commande sur cinq part deux fois en même temps : 260 lignes pour 260
`command_id` sur trois paliers. Une autre consigne sous le même `command_id` donne 409.

## Limite

Entre le broker et l'objet, le QoS 1 peut livrer deux fois. Le kit filtre avec un cache des
1000 dernières commandes, perdu à son redémarrage. Sans authentification, un client peut
prendre un identifiant avant un autre.

Ce qui ferait changer d'avis : des utilisateurs authentifiés. La clé deviendrait le couple
utilisateur et `command_id`.
