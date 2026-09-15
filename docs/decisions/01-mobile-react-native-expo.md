# Choix de la techno mobile : React Native avec Expo

## Contexte

Il faut une application mobile en 4 jours, avec scan de QR code, permission caméra,
cache hors ligne, gestion de la perte de réseau et reprise après passage en arrière-plan.
L'équipe connaît JavaScript. Le test se fera sur un iPhone réel.

## Options envisagées

React Native avec Expo, Flutter, natif Swift.

## Choix retenu

React Native avec Expo.

## Pourquoi

Le cours fournit un support React Native, donc c'est la techno sur laquelle on peut
s'appuyer si on bloque. L'équipe écrit déjà du JavaScript, il n'y a pas de langage à
apprendre en plus du projet. Expo fournit d'origine la caméra, le scan de QR code, le
stockage local et l'état du réseau, qui sont justement les points notés du sujet. Et Expo
Go permet de tester sur un iPhone réel sans compte développeur Apple ni build.

## Ce que ça coûte

On dépend de ce qu'Expo expose. Si on avait besoin d'une fonction native absente du SDK,
il faudrait sortir du mode géré. Ce n'est pas le cas ici.

## Conséquence

Le téléphone et le Mac doivent être sur le même réseau Wi-Fi. L'application devra viser
l'adresse IP locale du Mac, pas `localhost`.
