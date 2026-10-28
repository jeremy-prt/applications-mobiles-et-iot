# Choix de la techno mobile : React Native avec Expo

## Problème

L'app scanne un QR code (refus de caméra compris), gère le hors ligne, l'arrière-plan et un
jeton. Elle appelle une API en HTTP sur une IP locale. iPhone réel, 4 jours.

## Options

React Native avec Expo, React Native nu, Flutter, natif Swift.

## Choix et compromis

Expo SDK 57 (React Native 0.86) dans Expo Go, conseillé par la doc de React Native.

| | Expo Go | React Native nu |
|---|---|---|
| Nouvelle bibliothèque | Pas de compilation, le SDK couvre nos cinq besoins | `pod install` et build Xcode, 2 à 10 minutes |
| Installation sur l'iPhone | 10 minutes | 1 à 2 heures, profil gratuit à refaire tous les 7 jours |
| `http://192.168.x.x` | Marche, App Transport Security désactivé | Échec silencieux sans `NSLocalNetworkUsageDescription` dans Info.plist |

La caméra existe partout, elle ne départage pas. Flutter demande d'apprendre Dart. Bibliothèques
dans `docs/decisions/J1/06-bibliotheques-mobile.md`.

Coût : versions figées sur le SDK d'Expo Go pendant 4 jours. iPhone et Mac sur le même Wi-Fi,
API sur `0.0.0.0`, sinon `npx expo start --tunnel`. Depuis le SDK 57, le même compte Expo
gratuit dans le CLI et dans Expo Go.

## Aide de l'IA

L'IA disait qu'un compte Apple à 99 dollars par an était obligatoire. Faux, le provisionnement
gratuit de Xcode suffit, avec un profil de 7 jours. Elle justifiait aussi Expo par la caméra,
que React Native nu a aussi.

## Vérification

En J1, l'app tourne dans Expo Go sur iPhone sans Xcode, capture
`docs/preuves/J1-liste-des-salles.png`. Elle appelle `http://<ip du Mac>:3000/rooms` sans config
réseau, avec l'adresse déduite du serveur Expo.

## Limite

Rien d'installable hors Expo Go. Pour l'iPhone du prof, il faudrait un build et un compte Apple
payant.

Le refus de caméra testé est celui d'Expo Go ("Allow Expo Go to access your camera"), pas celui
de notre app. À vérifier avec `npx expo run:ios`.
