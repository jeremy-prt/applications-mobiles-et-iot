# Registre des objets autorisés

## Problème

La première mesure d'un objet inconnu créait cet objet et sa salle. Identifier un capteur
suffisait donc à l'autoriser à écrire. Un client tiers publiant une seule télémétrie créait
une salle que le téléphone affichait comme les autres, avec une mesure annoncée fraîche.

Le défaut vient d'une confusion entre trois questions que le `device_id` tranchait à lui seul :
qui est cet objet, existe-t-il chez nous, et a-t-il le droit d'écrire.

## Options

Garder la découverte automatique et la documenter comme une limite assumée.

Tenir un registre en base, et refuser les mesures d'un objet absent.

Filtrer au niveau du broker par une ACL par objet, ce qui suppose un compte MQTT par capteur.

## Choix et compromis

Un registre en base, avec une colonne `autorise` sur `devices`, posée à l'enrôlement et jamais
par un message entrant. Les trois capteurs du kit y sont insérés par migration.

L'ACL par objet est la vraie réponse en production, et elle reste impossible ici : le kit
fournit un compte `simulator` partagé, autorisé à écrire sur le topic de n'importe quel objet.
C'est déjà le constat de la décision 10.

La découverte automatique est écartée parce qu'elle était indéfendable sur un dépôt public,
mais elle avait un avantage qu'on perd : un capteur ajouté au kit apparaissait tout seul. Il
faut maintenant l'enrôler, ce qui a coûté une manipulation en plus pendant le test de montée
en charge.

Le contrôle est dans le job de consolidation, avec le reste de la validation. Le mettre dans
le consommateur MQTT jetterait le message avant de le conserver, et on ne pourrait plus
expliquer le refus ni le rejouer si l'objet est enrôlé plus tard.

## Aide de l'IA

L'IA a d'abord proposé de refuser l'objet inconnu dans le consommateur MQTT, au plus tôt. Ça
paraît logique et ça casse la propriété qui tient toute l'architecture : la zone brute doit
accepter ce qu'on refusera ensuite, sinon un refus n'est plus explicable.

Elle a aussi proposé de charger `infra/kit/devices.json` au démarrage du backend. Le fichier
appartient au kit, notre code n'a pas à le lire, et un redémarrage aurait alors réautorisé un
objet retiré du registre.

## Vérification

Avant correction, la même injection créait une quatrième salle servie par l'API. Après, la
base reste à trois salles et le refus est tracé.

```sh
docker run --rm --network applications-mobiles-et-iot_default eclipse-mosquitto:2.0.22 \
  mosquitto_pub -h mosquitto -p 1883 -u teacher -P teacher-demo -q 1 \
  -t "campus/v1/devices/sensor-999/telemetry" -m '{"schema_version":1,...,"room_id":"666",...}'
docker compose exec -T postgres psql -U campus -d campus -c "select count(*) from rooms"
```

La trace porte `reason="objet_non_autorise"` et la salle revendiquée, donc une tentative reste
visible dans les logs centralisés.

## Limite

Le registre dit qui a le droit d'écrire, pas qui parle. Un tiers qui publie avec le
`device_id` d'un capteur enrôlé passe toujours, et seule la détection de session le signale.
Les deux contrôles se complètent sans se remplacer.

L'enrôlement se fait aujourd'hui par une migration, ce qui n'est pas une procédure. J4 doit le
remplacer par l'association au QR code prévue par le contrat du kit.

Ce qui ferait changer d'avis : un compte MQTT par objet, qui rendrait ce registre redondant
avec l'ACL du broker.
