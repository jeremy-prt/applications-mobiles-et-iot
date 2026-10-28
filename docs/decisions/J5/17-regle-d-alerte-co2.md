# Règle d'alerte CO2

## Problème

Un capteur publie toutes les 2 secondes. Une règle naïve, « une alerte par mesure au-dessus
du seuil », crée 30 alertes par minute et par salle. Une valeur qui oscille autour du seuil
ouvre et ferme une alerte à chaque mesure. Il faut dire quand une alerte commence, quand elle
se termine, et garantir qu'il n'y en a qu'une à la fois.

## Options

Un seul seuil à 1000 ppm, l'alerte suit la dernière mesure.

Deux seuils, 1000 ppm pour l'activation et 800 ppm pour le retour, une alerte par épisode.

Un seuil avec une durée : 1000 ppm dépassés pendant une minute.

Pour l'unicité : un test dans le code avant d'insérer, ou un index unique partiel en base.

## Choix et compromis

Deux seuils. L'alerte s'ouvre à la première mesure à 1000 ppm ou plus, et revient à la
normale à la première sous 800 ppm. Entre les deux, une alerte active le reste. Les mesures
suivantes mettent à jour la même ligne : pic, dernière valeur, nombre de mesures. Une
nouvelle alerte ne peut s'ouvrir qu'après un retour à la normale. Les seuils sont dans
`docs/architecture.md`, avec leur origine.

L'index unique partiel `alerts_une_active`, sur `(device_id, kind)` pour les seules alertes
actives, rend une seconde alerte active impossible. L'insertion s'écrit
`ON CONFLICT DO NOTHING`, comme pour les commandes.

La règle est appliquée par le job de consolidation, sur la mesure qui vient de prendre l'état
courant. Une mesure invalide est rejetée avant, une mesure en retard ne prend pas l'état
courant : ni l'une ni l'autre n'ouvre ou ne ferme d'alerte.

Le seuil avec une durée est écarté : il retarde l'alerte d'une minute et oscille quand même à
la fin. Le seuil unique est écarté pour l'oscillation.

Ce que ça coûte : une alerte reste active jusqu'à 800 ppm, même si l'air est déjà sous le
seuil d'activation. La règle est par capteur, et une salle n'en a qu'un ici. Avec deux
capteurs dans une salle, on aurait deux alertes.

## Aide de l'IA

L'IA a codé la règle à partir de nos seuils, déclarés en J1 dans `docs/architecture.md`.
Elle prévoyait une table `alert_rules` annoncée dans `docs/modele-de-donnees.md`. On l'a
écartée : une seule règle existe, elle reste dans la configuration et elle est recopiée dans
chaque alerte.

## Vérification

`backend/src/domain/alertes.test.ts` rejoue des suites de mesures : une oscillation entre 985
et 1010 ppm n'ouvre qu'une alerte, et `high-co2` puis `normal-co2` donnent une ouverture puis un
retour. R12 avec le kit : une ligne, 22 mesures, ouverte à 1813 ppm, revenue à la normale à
610 ppm. Au flux de 30 messages par seconde, toujours une alerte active par capteur.

```sh
./docs/preuves/outils/alerte.sh sensor-001
```

## Limite

L'alerte n'est pas poussée au téléphone : il la voit au rafraîchissement suivant, toutes les
15 secondes, ou à l'ouverture de l'application. Ce qui ferait changer d'avis : une salle
équipée de plusieurs capteurs. La règle passerait à la salle, sur la plus haute valeur.
