# Choix des bibliothèques de l'application mobile

## Navigation : Expo Router 57

C'est ce que génère `create-expo-app` aujourd'hui. Les routes sont des fichiers, donc
`app/salles/[id]/equipements.tsx` se lit tout seul.

React Navigation n'est pas un concurrent : Expo Router tourne dessus. L'utiliser seul
voudrait dire écrire à la main l'arbre de navigation et la gestion des liens profonds, dont
on a besoin au retour d'un scan de QR code.

## Appels réseau et cache : TanStack Query 5.102.8

C'est le choix central de l'application, parce qu'il donne d'origine ce que le sujet note.

Il fournit l'état de chargement, l'état d'erreur, et surtout `dataUpdatedAt`, la date de la
dernière mise à jour, qui est exactement ce qu'on affiche pour signaler des données
anciennes. Pour la commande de ventilation, il rend un statut qui vaut `pending`, `success`
ou `error`, soit nos trois retours sans code supplémentaire.

Ce qu'il ne fait pas tout seul sur mobile, et qu'on branche en une quinzaine de lignes :

| À câbler | Sans ça |
|---|---|
| NetInfo vers `onlineManager` | Le rafraîchissement au retour du réseau ne se déclenche jamais |
| `AppState` vers `focusManager` | Le rafraîchissement au retour au premier plan ne se déclenche jamais |
| `PersistQueryClientProvider` | Le cache disparaît à la fermeture de l'application |

L'état vide reste notre propre test, du genre `data.length === 0`. TanStack Query ne
distingue pas "chargé et vide" de "chargé".

Piège connu : le `gcTime` du client doit être supérieur ou égal au `maxAge` de la
persistance, sinon le cache est jeté avant d'être relu.

## Stockage local : AsyncStorage 2.2.0

C'est le seul des trois candidats qui tourne dans Expo Go, et le module de persistance
officiel de TanStack Query est écrit pour lui.

MMKV serait plus rapide mais dépend de code natif absent d'Expo Go. `expo-sqlite`
fonctionnerait, mais obligerait à écrire un schéma et des requêtes SQL pour un cache que
TanStack Query gère déjà.

Attention à la version : `npm install` pose la 3.1.1, incompatible avec le natif embarqué
dans Expo Go. On installe avec `npx expo install`, qui pose la 2.2.0.

C'est aussi le seul vrai écart avec ce qu'on ferait en production, où AsyncStorage
deviendrait lent au delà de quelques mégaoctets d'historique. Le remplacer imposerait de
quitter Expo Go.

## Jeton d'authentification : expo-secure-store 57

Il range le jeton dans le Trousseau iOS, donc chiffré et illisible par une autre
application. AsyncStorage écrirait le jeton en clair sur le disque.

## État global : rien

Les données viennent du serveur, donc TanStack Query est déjà le magasin. Ce qui reste, le
jeton et l'utilisateur connecté, tient dans un contexte React d'une vingtaine de lignes.

Ajouter Redux ou Zustand créerait une deuxième source de vérité pour des données qui n'en
ont pas besoin.

## Interface : React Native Paper 5.15.3

Le sujet note la lisibilité, le contraste et l'accessibilité. Les composants de Paper sont
déjà étiquetés pour VoiceOver et respectent les tailles minimales de zone tactile, ce qui
est long à obtenir à la main. Ses thèmes clair et sombre ont des contrastes corrects
d'origine.

Avec les composants de base, il faudrait écrire chaque `accessibilityLabel` et
`accessibilityRole` nous-mêmes.

## Validation des réponses de l'API : Zod 4.6.5

On valide les réponses HTTP à l'entrée, avec `safeParse`.

Ce n'est pas redondant avec les types TypeScript : les types disparaissent à la
compilation, ils ne vérifient rien à l'exécution. Et le cache disque peut contenir des
données écrites par une version précédente de l'application, qui feraient planter un écran
au lieu d'afficher une erreur.

## Scan de QR code : expo-camera 57

`CameraView` avec `barcodeScannerSettings` limité aux QR, et `useCameraPermissions` qui
rend l'état de la permission pour afficher proprement un refus.

`expo-barcode-scanner`, que beaucoup de tutoriels utilisent encore, a été retiré du SDK.

## Ce qui ne marche pas dans Expo Go

La règle simple : tout ce qui n'est pas dans le SDK Expo et qui contient du code natif.

En pratique, cela exclut MMKV, `react-native-keychain`, `react-native-vision-camera`, et
les notifications poussées, qui ne fonctionnent plus dans Expo Go depuis le SDK 53. Les
notifications locales fonctionnent toujours. Les tâches de fond ne sont pas fiables dans
Expo Go, donc on ne construit pas la synchronisation dessus.
