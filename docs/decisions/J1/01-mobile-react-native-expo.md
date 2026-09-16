# Choix de la techno mobile : React Native avec Expo

## Problème

L'application doit scanner un QR code et gérer un refus de permission caméra, garder un cache
hors ligne, détecter la perte et le retour du réseau, reprendre après un passage en
arrière-plan, et stocker un jeton. Elle appelle une API en HTTP simple sur une IP locale.
Test sur iPhone réel, 4 jours.

## Options

React Native avec Expo, React Native nu, Flutter, natif Swift.

## Choix et compromis

Expo SDK 57 (React Native 0.86), testé dans Expo Go sur iPhone. La documentation officielle
de React Native recommande de partir d'un framework et cite Expo.

| Point | Expo Go | React Native nu |
|---|---|---|
| Ajout d'une bibliothèque | Aucune compilation tant qu'on reste dans les modules du SDK, qui couvrent nos cinq besoins | Recompilation native à chaque fois : `pod install` plus un build Xcode, 2 à 10 minutes |
| Installation sur l'iPhone | 10 minutes | 1 à 2 heures, avec Xcode, CocoaPods et une signature. Le profil de provisionnement gratuit expire tous les 7 jours, ce qui peut tomber juste avant l'oral |
| Appel en `http://192.168.x.x` | Fonctionne sans configuration, App Transport Security étant désactivé | Il faut ajouter `NSLocalNetworkUsageDescription` dans Info.plist, absent du template, sinon la première requête échoue sans message d'erreur |

La caméra ne départage pas, elle existe aussi hors Expo. Flutter couvre les mêmes besoins,
mais il faudrait apprendre Dart pendant les jours du projet, sans support de cours. Détail
des bibliothèques dans `docs/decisions/J1/06-bibliotheques-mobile.md`.

En échange, Expo Go ne lance que les projets du SDK qu'il embarque, donc on fige les versions
et on ne le met pas à jour pendant les 4 jours. L'iPhone et le Mac doivent être sur le même
Wi-Fi et l'API doit écouter sur `0.0.0.0`, avec `npx expo start --tunnel` en repli si le
réseau de l'école isole les clients. Depuis le SDK 57, il faut aussi être connecté au même
compte Expo gratuit dans le CLI et dans Expo Go, donc à créer avant de commencer.

## Aide de l'IA

L'IA a affirmé qu'un compte Apple à 99 dollars par an était obligatoire pour installer sur un
iPhone. Vérification faite, le provisionnement gratuit de Xcode suffit avec un identifiant
Apple, et le vrai coût est le profil qui expire tous les 7 jours. Elle justifiait aussi Expo
par « il fournit la caméra », ce qui ne départage rien car React Native nu en a aussi.

## Vérification

Fait en J1. L'application tourne dans Expo Go sur un iPhone réel, sans Xcode ni profil de
provisionnement, capture `docs/preuves/J1-liste-des-salles.png`. Elle appelle le backend en
`http://<ip du Mac>:3000/rooms` sans configuration réseau ajoutée, et elle déduit cette adresse
de celle du serveur Expo.

## Limite

Rien d'installable n'existe hors d'Expo Go. Pour que le prof ait l'application sur son propre
iPhone, il faudrait un build, donc un compte Apple payant.

Le refus de permission qu'on teste est celui d'Expo Go, et la boîte de dialogue dit "Allow
Expo Go to access your camera". Notre code de gestion du refus est correct, mais la vraie
boîte n'est pas testée. À vérifier en fin de projet avec `npx expo run:ios`.
