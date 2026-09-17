# Identité des objets et usurpation

## Problème

Trois capteurs publient en parallèle. Le backend doit savoir de quel objet vient une mesure,
et refuser celles qui ne viennent pas de l'objet annoncé. Jusqu'à J3, la seule vérification
était que le `device_id` du topic et celui du message correspondent, et elle n'avait jamais
été testée.

## Options

Garder la seule vérification de cohérence entre le topic et le message.

Donner un compte MQTT à chaque objet, avec une ACL qui limite son écriture à son propre topic.

Vérifier que le `message_id` commence par le `boot_id` que l'objet publie sur son topic
`state`, comme le contrat du kit le décrit.

## Choix et compromis

La cohérence topic contre message est gardée, et la vérification de session est ajoutée en
détection, sans rejet.

Le compte par objet est ce qu'on mettrait en production, et c'est écarté pour une raison
externe : l'ACL du kit donne un seul compte `simulator` autorisé à écrire sur le topic de
n'importe quel objet. Le contrat l'appelle une simplification pédagogique. Modifier le kit
nous donnerait un environnement différent de celui du professeur.

La détection ne rejette pas, parce qu'un capteur qui redémarre change de `boot_id`. Pendant le
temps où l'ancien est encore en base, ses mesures légitimes seraient refusées. On perdrait des
mesures vraies pour arrêter un client qui peut de toute façon recopier le `boot_id`, publié en
retained.

Ce que ça coûte : une colonne de plus, une lecture en base par mesure, et une alerte qui
demande un humain pour être interprétée.

## Aide de l'IA

L'IA a produit une preuve fausse. Pour montrer qu'une mesure forgée était refusée, elle a
publié un message portant le bon `device_id` mais une température de 99 °C, et a conclu au
rejet. Le rejet venait des bornes physiques ajoutées le matin même, pas d'un contrôle
d'identité. Rejoué avec 18 °C, une valeur crédible, le message a été accepté et affiché à la
place de la vraie mesure. La première conclusion faisait croire à une protection inexistante.

Elle a aussi proposé de rejeter les messages hors session, ce qui aurait cassé le redémarrage
d'un capteur.

## Vérification

Un client tiers, avec les identifiants publics du kit, a publié une mesure crédible sur le
topic de `sensor-002`. Elle est devenue l'état courant et l'API a servi 18 °C et 450 ppm pour
la salle 204, avec `is_stale` à faux.

La même injection rejouée après l'ajout de la détection produit une ligne
`eventType="session_inattendue"`, et une seule : 178 mesures légitimes sur la même période
n'ont produit aucun faux positif.

```sh
cd backend && npm test
```

## Limite

La détection n'empêche rien. Le `boot_id` est lisible par quiconque peut lire le topic `state`
et se recopie. Elle arrête une injection qui ne s'en donne pas la peine.

L'historique reste polluable, même quand la fausse mesure ne prend pas l'état courant, et rien
ne permet de l'en retirer.

Ce qui ferait changer d'avis : un broker où chaque objet a son compte. La détection
deviendrait inutile et on passerait au rejet.
