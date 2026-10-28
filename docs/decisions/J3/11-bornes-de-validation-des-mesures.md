# Bornes de validation des mesures

## Problème

Le schéma n'exigeait qu'un nombre fini et une date au bon format. Une mesure à -300 °C et 99999
ppm est entrée en base et l'API l'a servie. Datée de trois minutes dans l'avenir, elle bloquait
l'état courant.

## Options

- Les bornes du modèle du kit : CO2 entre 420 et 2500 ppm.
- Les bornes de fonctionnement d'un capteur, plus larges.
- Marquer les valeurs suspectes sans les refuser.

## Choix et compromis

Bornes de capteur, avec rejet : -40 à 85 °C et 0 à 40000 ppm. Une date à plus de 10 secondes
dans l'avenir est refusée.

Les bornes du kit jetteraient les mesures qui doivent déclencher une alerte. On sépare une
mesure d'une panne, pas le normal de l'anormal. Pas de marquage : une valeur hors des capacités
du capteur n'est pas une mesure, et marquée elle resterait affichable.

Le contrôle de date est dans le job de consolidation, car il dépend de l'heure. Les 10 secondes
couvrent l'écart de 3 secondes mesuré en J2 entre le Mac et le conteneur.

## Aide de l'IA

L'IA avait mis le contrôle de date dans le schéma Zod (`refine` avec `Date.now()`), donc des
tests liés à l'heure. On l'a déplacé dans le domaine, avec l'instant en paramètre. Elle
proposait aussi les bornes du kit, qui rejetaient une vraie alerte au-dessus de 2500 ppm.

## Vérification

Avant correction, la mesure impossible est en base.

```sh
docker compose exec -T postgres psql -U campus -d campus -c \
  "select message_id, temperature_c, co2_ppm from telemetry where message_id like 'test-j3-%'"
# test-j3-impossible-1 | -300 | 99999
```

Après : trois rejets avec leur motif, aucune ligne en base. Six tests couvrent les deux règles,
dont 3000 ppm qui reste accepté.

## Limite

Une dérive lente dans la plage ou un saut de 22 à 80 °C passent. Pendant les 10 secondes de
tolérance, une mesure du futur prend l'état courant.

Ce qui ferait changer d'avis : observer un tel saut. On ajouterait une alerte de variation trop
rapide.
