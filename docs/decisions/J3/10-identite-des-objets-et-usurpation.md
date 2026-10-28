# Identité des objets et usurpation

## Problème

Le backend doit savoir de quel objet vient une mesure et refuser une fausse. Jusqu'à J3, il
vérifiait seulement que le `device_id` du topic et celui du message correspondent, sans test.

## Options

- Garder cette seule vérification.
- Un compte MQTT par objet, avec une ACL limitée à son topic.
- Vérifier que le `message_id` commence par le `boot_id` publié sur `state`, comme le prévoit
  le contrat du kit.

## Choix et compromis

On garde la vérification topic et message, et on ajoute la détection de session, sans rejet.

Le compte par objet est impossible : le kit n'a qu'un compte `simulator` qui écrit sur tous les
topics, et on ne modifie pas l'environnement du professeur.

Pas de rejet, car un capteur qui redémarre change de `boot_id` et ses vraies mesures seraient
refusées. De toute façon, le `boot_id` est publié en retained et se recopie.

Coût : une colonne, une lecture en base par mesure, une alerte à interpréter par un humain.

## Aide de l'IA

L'IA a fait une preuve fausse : sa mesure forgée à 99 °C était rejetée par les bornes
physiques, pas par un contrôle d'identité. À 18 °C, elle passait. Elle proposait aussi de
rejeter les messages hors session, ce qui cassait le redémarrage d'un capteur.

## Vérification

Avec les identifiants publics du kit, une fausse mesure sur le topic de `sensor-002` est
devenue l'état courant : 18 °C et 450 ppm pour la salle 204, `is_stale` à faux. Avec la
détection, elle produit une seule ligne `eventType="session_inattendue"`, sans faux positif sur
178 mesures légitimes.

```sh
cd backend && npm test
```

## Limite

La détection n'empêche rien, le `boot_id` se recopie. Une fausse mesure reste dans
l'historique.

Ce qui ferait changer d'avis : un compte par objet sur le broker. On passerait alors au rejet.
