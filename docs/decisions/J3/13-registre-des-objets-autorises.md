# Registre des objets autorisés

## Problème

La première mesure d'un objet inconnu créait l'objet et sa salle. Un client tiers pouvait donc
créer une salle affichée sur le téléphone. Le `device_id` disait seul qui est l'objet, s'il
existe chez nous et s'il peut écrire.

## Options

- Garder la découverte automatique comme limite documentée.
- Un registre en base, qui refuse les objets absents.
- Une ACL par objet sur le broker, donc un compte MQTT par capteur.

## Choix et compromis

Un registre : une colonne `autorise` sur `devices`, posée à l'enrôlement, jamais par un
message. Les trois capteurs du kit sont insérés par migration.

L'ACL est impossible avec le compte `simulator` partagé du kit (décision 10). La découverte
automatique est indéfendable sur un dépôt public.

Le contrôle est dans le job de consolidation. La zone brute garde le message, donc le refus
reste explicable et rejouable après un enrôlement.

Coût : un nouveau capteur doit être enrôlé, ce qui a coûté une manipulation pendant le test de
montée en charge.

## Aide de l'IA

L'IA voulait refuser l'objet inconnu dès le consommateur MQTT, donc jeter le message avant de
le conserver. Elle voulait aussi lire `infra/kit/devices.json` au démarrage. Ce fichier
appartient au kit, et un redémarrage aurait réautorisé un objet retiré.

## Vérification

Avant, l'injection créait une quatrième salle servie par l'API. Après, il reste trois salles et
le refus est tracé avec `reason="objet_non_autorise"` et la salle revendiquée.

```sh
docker run --rm --network applications-mobiles-et-iot_default eclipse-mosquitto:2.0.22 \
  mosquitto_pub -h mosquitto -p 1883 -u teacher -P teacher-demo -q 1 \
  -t "campus/v1/devices/sensor-999/telemetry" -m '{"schema_version":1,...,"room_id":"666",...}'
docker compose exec -T postgres psql -U campus -d campus -c "select count(*) from rooms"
```

## Limite

Le registre dit qui peut écrire, pas qui parle. Un tiers qui reprend le `device_id` d'un
capteur enrôlé passe, seule la détection de session le voit. L'enrôlement par migration n'est
pas une procédure. L'association au QR code prévue pour la remplacer n'est pas faite (R10).

Ce qui ferait changer d'avis : un compte MQTT par objet, qui rendrait le registre redondant.
