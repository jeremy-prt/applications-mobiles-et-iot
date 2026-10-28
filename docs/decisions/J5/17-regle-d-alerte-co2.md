# Règle d'alerte CO2

## Problème

Un capteur publie toutes les 2 secondes. Une alerte par mesure au-dessus du seuil ferait 30
alertes par minute et par salle. Une valeur proche du seuil ouvrirait et fermerait une alerte à
chaque mesure. Il faut un début, une fin, et une seule alerte à la fois.

## Options

- Un seuil unique à 1000 ppm, l'alerte suit la dernière mesure.
- Deux seuils : 1000 ppm pour ouvrir, 800 ppm pour revenir à la normale.
- 1000 ppm dépassés pendant une minute.
- Pour l'unicité : un test dans le code avant l'insertion, ou un index unique partiel en base.

## Choix et compromis

Deux seuils. Ouverture à la première mesure à 1000 ppm ou plus, retour à la normale à la
première sous 800 ppm. Entre les deux, la même ligne est mise à jour : pic, dernière valeur,
nombre de mesures. Seuils et origine dans `docs/architecture.md`.

L'index unique partiel `alerts_une_active`, sur `(device_id, kind)` des alertes actives,
interdit une seconde alerte active, avec `ON CONFLICT DO NOTHING` comme pour les commandes.

Le job de consolidation applique la règle sur la mesure qui prend l'état courant. Une mesure
invalide ou en retard ne change donc rien.

Le seuil avec durée retarde l'alerte d'une minute et oscille quand même à la fin. Le seuil
unique oscille.

Coût : l'alerte reste active jusqu'à 800 ppm. La règle est par capteur, donc deux capteurs dans
une salle feraient deux alertes.

## Aide de l'IA

L'IA a codé la règle avec nos seuils de J1. Elle ajoutait une table `alert_rules`, prévue dans
`docs/modele-de-donnees.md`. Écartée : une seule règle, gardée en configuration et recopiée
dans chaque alerte.

## Vérification

`backend/src/domain/alertes.test.ts` : une oscillation entre 985 et 1010 ppm n'ouvre qu'une
alerte, et `high-co2` puis `normal-co2` donnent une ouverture puis un retour. R12 avec le kit :
une ligne, 22 mesures, ouverte à 1813 ppm, revenue à la normale à 610 ppm. À 30 messages par
seconde, toujours une alerte active par capteur.

```sh
./docs/preuves/outils/alerte.sh sensor-001
```

## Limite

L'alerte n'est pas poussée : le téléphone la voit au rafraîchissement, toutes les 15 secondes,
ou à l'ouverture.

Ce qui ferait changer d'avis : plusieurs capteurs par salle. La règle passerait à la salle, sur
la valeur la plus haute.
