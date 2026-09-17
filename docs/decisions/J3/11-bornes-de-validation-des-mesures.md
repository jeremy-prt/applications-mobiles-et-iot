# Bornes de validation des mesures

## Problème

Le schéma d'une mesure n'exigeait qu'un nombre fini, et rien sur la date d'observation au delà
du format. Une mesure à -300 °C et 99999 ppm est entrée en base et a été servie par l'API
comme une mesure normale. Datée de trois minutes dans l'avenir, elle a pris l'état courant et
y bloquait toute mesure réelle.

## Options

Reprendre les bornes du modèle du kit, qui garde le CO2 entre 420 et 2500 ppm.

Prendre les bornes de fonctionnement d'un capteur, plus larges que le modèle.

Marquer les valeurs suspectes sans les refuser, comme pour la détection d'usurpation.

## Choix et compromis

Les bornes de capteur, avec rejet : -40 à 85 °C et 0 à 40000 ppm. Une date d'observation est
refusée au delà de 10 secondes dans l'avenir.

Les bornes du kit sont écartées, et c'est le point important. Une supervision existe pour
signaler les valeurs anormales. Refuser tout ce qui sort de 420 à 2500 ppm reviendrait à jeter
les mesures qui doivent déclencher une alerte, et à ne garder que celles qui vont bien. La
frontière utile n'est pas entre normal et anormal, mais entre une mesure et une panne de
capteur.

Le simple marquage est écarté ici, à la différence de l'usurpation : une valeur hors des
capacités d'un capteur n'est pas une mesure douteuse, c'est une absence de mesure. La laisser
entrer, même marquée, la rendrait affichable.

Le contrôle de date est dans le job de consolidation et non dans le schéma, parce qu'il dépend
de l'heure qu'il est. Le schéma reste testable sans horloge. La tolérance de 10 secondes vient
de l'écart mesuré en J2 entre le Mac et le conteneur, 3 secondes, avec de la marge.

## Aide de l'IA

L'IA avait mis le contrôle de date dans le schéma Zod, avec un `refine` appelant `Date.now()`.
Le schéma cessait d'être une fonction pure et ses tests dépendaient de l'heure d'exécution.
Déplacé dans le domaine, avec l'instant passé en paramètre.

Elle avait aussi proposé les bornes du modèle du kit, 420 à 2500 ppm, ce qui aurait fait
rejeter une alerte CO2 réelle au dessus de 2500 ppm, c'est à dire le cas que le projet doit
détecter.

## Vérification

Avant correction, la mesure impossible est en base.

```sh
docker compose exec -T postgres psql -U campus -d campus -c \
  "select message_id, temperature_c, co2_ppm from telemetry where message_id like 'test-j3-%'"
# test-j3-impossible-1 | -300 | 99999
```

Après correction, le même scénario rejoué à l'identique donne trois rejets et aucune ligne en
base, avec des motifs qui nomment la cause. Six tests couvrent les deux règles, dont un qui
vérifie que 3000 ppm, anormal mais plausible, reste accepté.

## Limite

Les bornes écartent l'absurde, pas une dérive lente d'un capteur qui resterait dans la plage.

Pendant les 10 secondes de tolérance, une mesure datée de l'avenir prend quand même l'état
courant.

Rien ne compare deux mesures successives : un capteur qui passerait de 22 à 80 °C d'un coup
serait accepté. Ce qui ferait changer d'avis : une alerte sur une variation trop rapide, utile
seulement si on observe ce cas.
