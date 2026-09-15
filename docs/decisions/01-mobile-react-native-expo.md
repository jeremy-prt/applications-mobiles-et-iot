# Choix de la techno mobile : React Native avec Expo

## Contexte

L'application doit scanner un QR code et gérer un refus de permission caméra, garder un
cache hors ligne, détecter la perte et le retour du réseau, reprendre après un passage en
arrière-plan, et stocker un jeton. Elle appelle une API en HTTP simple sur une IP locale.
Test sur iPhone réel, 4 jours.

## Options envisagées

React Native avec Expo, React Native nu, Flutter, natif Swift.

## Choix retenu

Expo SDK 57 (React Native 0.86), testé dans Expo Go sur iPhone.

## Pourquoi

La documentation officielle de React Native recommande de partir d'un framework et cite
Expo, avec `create-expo-app` comme commande de démarrage.

| Point | Expo Go | React Native nu |
|---|---|---|
| Ajout d'une bibliothèque | Aucune compilation tant qu'on reste dans les modules du SDK, qui couvrent nos cinq besoins | Recompilation native à chaque fois : `pod install` plus un build Xcode, 2 à 10 minutes |
| Installation sur l'iPhone | 10 minutes | 1 à 2 heures, avec Xcode, CocoaPods et une signature. Aucun compte Apple payant, mais le profil gratuit expire tous les 7 jours, ce qui peut tomber juste avant l'oral |
| Appel en `http://192.168.x.x` | Fonctionne sans configuration, App Transport Security étant désactivé | Il faut ajouter `NSLocalNetworkUsageDescription` dans Info.plist, absent du template, sinon la première requête échoue sans message d'erreur |

La caméra ne départage pas : elle existe aussi en bibliothèque tierce hors Expo. Détail des
bibliothèques retenues dans `docs/decisions/06`.

Flutter couvre les mêmes besoins, mais il faudrait apprendre Dart pendant les jours du
projet, sans support de cours pour nous rattraper.

## Ce que ça coûte

- Le refus de permission qu'on teste est celui d'Expo Go, pas de notre application : la boîte
  de dialogue dit "Allow Expo Go to access your camera". Notre code de gestion du refus est
  correct, mais la vraie boîte de dialogue n'est pas testée. À vérifier en fin de projet avec
  `npx expo run:ios` si on a le temps.
- Expo Go ne lance que des projets du SDK qu'il embarque. On fige les versions et on ne met
  pas à jour Expo Go pendant les 4 jours.
- Rien d'installable n'existe hors d'Expo Go. Pour que le prof ait l'application sur son
  propre iPhone, il faudrait un build, donc un compte Apple payant.

## Conséquence

L'iPhone et le Mac doivent être sur le même Wi-Fi, et l'API doit écouter sur `0.0.0.0` et
pas sur `127.0.0.1`. L'adresse du backend est une variable de configuration. Si le Wi-Fi de
l'école isole les clients entre eux, repli sur `npx expo start --tunnel`.

Le compte Expo gratuit est à créer avant de commencer : depuis le SDK 57, il faut être
connecté au même compte dans le CLI et dans Expo Go.

## Aide de l'IA

L'IA a d'abord justifié Expo par « il fournit la caméra », et a affirmé qu'un compte Apple à
99 dollars par an était obligatoire pour installer sur un iPhone. Les deux ont été rejetés.
React Native sans Expo a aussi des bibliothèques de caméra, donc l'argument ne départage
rien. Et le provisionnement gratuit de Xcode permet d'installer sur son propre iPhone avec un
simple identifiant Apple : le vrai coût est le profil qui expire tous les 7 jours, pas le
prix.

Retenu après vérification : le coût réel de React Native sans Expo est la recompilation
native à chaque ajout de bibliothèque, et la documentation officielle de React Native
recommande elle-même de partir d'un framework.

## Vérification

À faire en J1, à la création du projet mobile : mesurer le temps entre `npx create-expo-app`
et le premier écran affiché sur l'iPhone, et vérifier qu'un appel en
`http://192.168.x.x:3000/rooms` aboutit sans configuration.
