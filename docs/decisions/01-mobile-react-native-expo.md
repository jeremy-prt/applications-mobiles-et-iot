# Choix de la techno mobile : React Native avec Expo

## Contexte

L'application doit scanner un QR code et gérer un refus de permission caméra, garder un
cache hors ligne, détecter la perte et le retour du réseau, reprendre après un passage en
arrière-plan, et stocker un jeton d'authentification. Elle appelle une API en HTTP simple
sur une IP locale. Test sur iPhone réel, 4 jours.

## Options envisagées

React Native avec Expo, React Native nu, Flutter, natif Swift.

## Choix retenu

Expo SDK 57 (React Native 0.86), testé dans Expo Go sur iPhone.

## Pourquoi

La documentation officielle de React Native recommande de partir d'un framework et cite
Expo, avec `create-expo-app` comme commande de démarrage. Choisir React Native nu, c'est
maintenir soi-même la couche que Meta conseille de ne pas réécrire.

Le coût réel de React Native nu n'est pas la caméra, qui existe aussi en bibliothèque
tierce. C'est qu'il faut recompiler en natif à chaque ajout de bibliothèque : `pod install`
plus un build Xcode, 2 à 10 minutes à chaque fois. Avec Expo Go, aucune compilation tant
qu'on reste dans les modules du SDK.

Nos cinq besoins sont couverts par des modules déjà compilés dans Expo Go : `expo-camera`
pour le scan et la permission, `expo-secure-store` pour le jeton, `expo-network` pour
l'état du réseau, `expo-sqlite` pour le cache, et `AppState` qui vient de React Native.

L'installation sur l'iPhone prend 10 minutes contre 1 à 2 heures en React Native nu, où il
faut Xcode, CocoaPods et une signature. Aucun compte Apple payant dans les deux cas, mais
le profil gratuit de Xcode expire tous les 7 jours, ce qui peut tomber juste avant l'oral.

Nos appels en `http://192.168.x.x` fonctionnent sans configuration dans Expo Go, qui
désactive App Transport Security. En React Native nu il faut ajouter
`NSLocalNetworkUsageDescription` dans Info.plist, absent du template, sinon la première
requête échoue sans message d'erreur.

Flutter couvre les mêmes besoins, mais il faudrait apprendre Dart pendant les jours du
projet, sans support de cours pour nous rattraper.

## Ce que ça coûte

Le refus de permission qu'on teste est celui d'Expo Go, pas de notre application : la boîte
de dialogue dit "Allow Expo Go to access your camera". Notre code de gestion du refus est
correct, mais la vraie boîte de dialogue n'est pas testée. À signaler, et à vérifier en
fin de projet avec `npx expo run:ios` si on a le temps.

Expo Go ne lance que des projets du SDK qu'il embarque. On fige les versions et on ne met
pas à jour Expo Go pendant les 4 jours.

Rien d'installable n'existe hors d'Expo Go. Si le prof veut l'application sur son propre
iPhone, il faudrait un build, donc un compte Apple payant.

## Conséquence

L'iPhone et le Mac doivent être sur le même Wi-Fi, et l'API doit écouter sur `0.0.0.0` et
pas sur `127.0.0.1`. L'adresse du backend est une variable de configuration. Si le Wi-Fi de
l'école isole les clients entre eux, repli sur `npx expo start --tunnel`.

Le compte Expo gratuit est à créer avant de commencer : depuis le SDK 57, il faut être
connecté au même compte dans le CLI et dans Expo Go.
