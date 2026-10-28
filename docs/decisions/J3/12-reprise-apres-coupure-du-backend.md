# Reprise après une coupure du backend

## Problème

Depuis J1, le backend se connecte avec `clean: false` pour que le broker garde les messages
pendant son absence. Jamais testé : R07 en J2 coupait le broker, et le simulateur arrête de
publier quand le broker tombe.

## Options

- Session persistante en QoS 1.
- QoS 0, plus simple, qui ne retient rien.
- Redemander l'historique au capteur.

## Choix et compromis

Session persistante en QoS 1. Sur une coupure de 30 secondes : en QoS 1, 12 messages rejoués et
36 perdus ; en QoS 0, rien de rejoué et 48 perdus. Le QoS 1 sert, mais moins que prévu.

Redemander l'historique est impossible, le contrat du kit n'a pas de topic pour ça.

Coût : environ 80 pour cent des mesures de la coupure sont perdues, sans trou signalé à
l'écran.

## Aide de l'IA

L'IA a conclu deux fois trop vite : « aucune perte » avec une fenêtre de comptage qui débordait
après la coupure, puis 7 mesures au lieu de 30 avec une requête SQL sur la mauvaise date. On a
tranché avec le compteur du `message_id`, qui s'incrémente de 1 : un numéro absent est un
message perdu, sans dépendre d'une horloge.

## Vérification

```sh
./docs/preuves/outils/mesure-coupure.sh 30 1
./docs/preuves/outils/mesure-coupure.sh 30 0
```

Le client se reconnecte avec `c0`, donc la session est conservée.

```sh
docker compose logs mosquitto | grep campus-backend
# New client connected ... as campus-backend (p2, c0, k60, u'backend')
```

## Limite

La part rejouée varie de 0 à 12 messages selon l'instant de reconnexion. Seul l'écart entre QoS
0 et QoS 1 est reproductible. La taille et la durée de la file sont des réglages du broker, par
défaut dans le kit.

Ce qui ferait changer d'avis : un trou d'historique vraiment gênant. Il faudrait configurer le
broker, donc modifier le kit.
