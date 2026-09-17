# Définition d'un doublon

## Problème

L'unicité en base porte sur `(device_id, message_id, recorded_at)`. La question posée est de
savoir si cette contrainte traduit ce qu'on appelle métier un doublon, ou si elle a été écrite
pour satisfaire TimescaleDB, qui impose la colonne de temps dans l'index unique d'une table
découpée par période.

Deux cas le montrent. Republier le même `message_id` avec une autre date d'observation crée
une deuxième ligne sans qu'aucun doublon soit signalé. Réutiliser un `message_id` avec la même
date fait jeter la nouvelle mesure, même si son contenu diffère.

## Options

Garder la contrainte actuelle et écrire l'hypothèse qu'elle suppose sur le producteur.

Restreindre l'unicité à `(device_id, message_id)`, ce que TimescaleDB refuse sur une hypertable.

Déduire l'identité du contenu, par une empreinte des valeurs mesurées.

## Choix et compromis

La contrainte est gardée, et l'hypothèse qu'elle suppose est désormais écrite : un producteur
n'émet jamais deux dates d'observation différentes sous le même `message_id`. Le kit respecte
cette hypothèse, son `message_id` étant composé d'un identifiant de démarrage et d'un compteur.

Notre définition métier est qu'un événement est une observation faite par un objet à un
instant. La contrainte code « même objet, même identifiant, même instant ». Les deux coïncident
tant que l'hypothèse tient, et elles divergent dès qu'elle ne tient plus.

L'empreinte du contenu est écartée : elle coûte un calcul par message, et elle traiterait deux
mesures réellement identiques prises à la même seconde comme un doublon, ce qui est faux.

Ce que ça coûte : une mesure perdue parce qu'un producteur a réutilisé un identifiant est
aujourd'hui indiscernable d'un vrai doublon dans les traces.

## Aide de l'IA

L'IA avait conclu que la contrainte était correcte, en s'appuyant sur le scénario 4 de J3. Ce
scénario rejoue un message strictement identique, donc il ne pouvait pas trouver le cas. Une
vérification manuelle a montré deux lignes pour un même `message_id`, ce que la doc affirmait
impossible.

Elle a aussi proposé de resserrer l'unicité sur deux colonnes sans voir que TimescaleDB le
refuse, ce qui est écrit dans le CLAUDE.md du projet depuis J1.

## Vérification

Deux messages publiés avec le même `message_id` et des dates différentes donnent deux lignes,
et deux traces `mesure_enregistree` sans aucun `doublon_ecarte`.

```sh
docker compose exec -T postgres psql -U campus -d campus -c \
  "select message_id, recorded_at, temperature_c from telemetry where message_id='dedup-test-1'"
```

Le cas inverse a été joué aussi : une mesure à 2000 ppm publiée sous un `message_id` déjà
utilisé à la même date a été jetée et tracée `doublon_ecarte`.

## Limite

Rien ne vérifie l'hypothèse sur le producteur. Si le kit changeait de façon de composer ses
identifiants, la contrainte deviendrait fausse sans qu'aucun test ne le signale.

Une mesure perdue de cette façon ne laisse aucune trace distinctive : elle est comptée comme un
doublon écarté, donc invisible dans le tableau de bord.

Ce qui ferait changer d'avis : un producteur dont on ne maîtrise pas la numérotation. Il
faudrait alors comparer le contenu, et accepter le coût du calcul.
