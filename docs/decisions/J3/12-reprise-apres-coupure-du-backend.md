# Reprise après une coupure du backend

## Problème

Depuis J1, le backend ouvre sa session MQTT avec `clean: false`, pour que le broker garde les
messages publiés pendant son absence. Cette protection n'avait jamais été mise à l'épreuve.
R07 en J2 avait coupé le broker, pas le backend, et le simulateur suspend ses mesures quand le
broker tombe, donc il n'y avait rien à rejouer.

## Options

Garder la session persistante en QoS 1 et accepter ce qu'elle rejoue.

Passer en QoS 0, ce qui simplifie mais ne retient rien.

Ne pas compter sur le broker et faire rattraper les mesures manquantes par une autre voie, par
exemple une demande d'historique au capteur.

## Choix et compromis

La session persistante en QoS 1 est gardée, et la perte résiduelle est documentée plutôt que
comblée.

La mesure, à coupure identique de 30 secondes, départage les deux premières options : en
QoS 1, 12 messages sont rejoués et 36 perdus ; en QoS 0, rien n'est rejoué et 48 sont perdus.
Les 12 messages sauvés sont exactement l'écart entre les deux modes. Le QoS 1 sert donc à
quelque chose, sans tenir la promesse qu'on lui prêtait.

Le rattrapage par le capteur est écarté : le contrat du kit ne prévoit aucun topic pour
redemander des mesures passées, et l'inventer nous éloignerait du sujet.

Ce que ça coûte : sur une coupure de 30 secondes, environ 80 pour cent des mesures de la
fenêtre sont perdues sans trace. L'historique a un trou qu'aucun écran ne signale.

## Aide de l'IA

L'IA a conclu deux fois trop vite. Elle a d'abord annoncé qu'aucune mesure n'était perdue, en
comptant les documents de la zone brute sur une fenêtre de temps qui débordait sur l'après
coupure. Puis elle a écrit une requête SQL bornée sur la mauvaise date, qui comptait 7 mesures
là où il y en avait 30.

Le comptage par numéro de séquence a tranché : le kit compose le `message_id` d'un identifiant
de démarrage et d'un numéro qui s'incrémente de 1, donc un numéro absent est un message qui
n'est jamais arrivé. Cette méthode ne dépend d'aucune horloge.

## Vérification

```sh
./docs/preuves/outils/mesure-coupure.sh 30 1
./docs/preuves/outils/mesure-coupure.sh 30 0
```

Les logs du broker confirment que la session est bien conservée, le client se reconnectant
avec `c0`, c'est à dire sans demander de session propre.

```sh
docker compose logs mosquitto | grep campus-backend
# New client connected ... as campus-backend (p2, c0, k60, u'backend')
```

## Limite

La part rejouée varie d'un essai à l'autre, entre 0 et 12 messages selon l'instant de la
reconnexion. Ce qui est reproductible est l'écart entre QoS 0 et QoS 1, pas le chiffre absolu.

MQTT garantit la livraison d'un message accepté pour une session existante. Il ne dit rien de
la taille de la file ni du temps pendant lequel le broker la garde, qui sont des réglages du
broker et que le kit laisse par défaut.

Ce qui ferait changer d'avis : un trou d'historique qui gênerait vraiment. On configurerait
alors la file du broker, ce qui suppose de modifier le kit.
