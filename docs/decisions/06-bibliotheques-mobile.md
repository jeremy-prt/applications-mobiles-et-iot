# Choix des bibliothèques de l'application mobile

## Les choix simples

| Besoin | Retenu | Pourquoi, et ce qui est écarté |
|---|---|---|
| Navigation | Expo Router 57 | C'est ce que génère `create-expo-app`, et les routes sont des fichiers : `app/salles/[id]/equipements.tsx` se lit tout seul. React Navigation n'est pas un concurrent, Expo Router tourne dessus ; l'utiliser seul voudrait dire écrire à la main l'arbre de navigation et les liens profonds, dont on a besoin au retour d'un scan |
| Jeton | expo-secure-store 57 | Range le jeton dans le Trousseau iOS, donc chiffré et illisible par une autre application. AsyncStorage l'écrirait en clair sur le disque |
| État global | rien | Les données viennent du serveur, donc TanStack Query est déjà le magasin. Le jeton et l'utilisateur connecté tiennent dans un contexte React d'une vingtaine de lignes. Redux ou Zustand créeraient une deuxième source de vérité |
| Interface | React Native Paper 5.15.3 | Le sujet note la lisibilité, le contraste et l'accessibilité. Les composants de Paper sont déjà étiquetés pour VoiceOver, respectent les tailles minimales de zone tactile et ont des thèmes clair et sombre contrastés. Avec les composants de base, il faudrait écrire chaque `accessibilityLabel` et `accessibilityRole` nous-mêmes |
| Validation des réponses de l'API | Zod 4.6.5, avec `safeParse` | Les types TypeScript disparaissent à la compilation et ne vérifient rien à l'exécution. Et le cache disque peut contenir des données écrites par une version précédente de l'application, qui feraient planter un écran au lieu d'afficher une erreur |
| Scan de QR code | expo-camera 57 | `CameraView` avec `barcodeScannerSettings` limité aux QR, et `useCameraPermissions` qui rend l'état de la permission pour afficher proprement un refus. `expo-barcode-scanner`, encore présent dans beaucoup de tutoriels, a été retiré du SDK |

## Appels réseau et cache : TanStack Query 5.102.8

Il fournit l'état de chargement, l'état d'erreur, et `dataUpdatedAt`, la date de dernière
mise à jour, qui est ce qu'on affiche pour signaler des données anciennes. Pour la commande
de ventilation, il rend un statut `pending`, `success` ou `error`, soit nos trois retours
sans code supplémentaire.

Ce qu'il ne fait pas tout seul sur mobile, et qu'on branche en une quinzaine de lignes :

| À câbler | Sans ça |
|---|---|
| NetInfo vers `onlineManager` | Le rafraîchissement au retour du réseau ne se déclenche jamais |
| `AppState` vers `focusManager` | Le rafraîchissement au retour au premier plan ne se déclenche jamais |
| `PersistQueryClientProvider` | Le cache disparaît à la fermeture de l'application |

L'état vide reste notre propre test, du genre `data.length === 0` : TanStack Query ne
distingue pas « chargé et vide » de « chargé ». Piège connu : le `gcTime` du client doit être
supérieur ou égal au `maxAge` de la persistance, sinon le cache est jeté avant d'être relu.

## Stockage local : AsyncStorage 2.2.0

Seul des trois candidats à tourner dans Expo Go, et le module de persistance officiel de
TanStack Query est écrit pour lui. MMKV serait plus rapide mais dépend de code natif absent
d'Expo Go. `expo-sqlite` fonctionnerait, mais obligerait à écrire un schéma et des requêtes
SQL pour un cache que TanStack Query gère déjà.

Attention à la version : `npm install` pose la 3.1.1, incompatible avec le natif embarqué
dans Expo Go. On installe avec `npx expo install`, qui pose la 2.2.0.

C'est le seul vrai écart avec ce qu'on ferait en production, où AsyncStorage deviendrait lent
au delà de quelques mégaoctets d'historique. Le remplacer imposerait de quitter Expo Go.

## Ce qui ne marche pas dans Expo Go

La règle : tout ce qui n'est pas dans le SDK Expo et qui contient du code natif. Cela exclut
MMKV, `react-native-keychain`, `react-native-vision-camera`, et les notifications poussées,
qui ne fonctionnent plus dans Expo Go depuis le SDK 53. Les notifications locales
fonctionnent toujours. Les tâches de fond ne sont pas fiables, donc on ne construit pas la
synchronisation dessus.

## Aide de l'IA

L'IA a d'abord proposé d'ajouter Zustand pour l'état global. Rejeté après examen : les
données viennent du serveur et sont déjà gérées par TanStack Query, une seconde source de
vérité n'apporterait rien.

Elle a aussi listé `expo-network` et `expo-sqlite` dans une première réponse, puis NetInfo et
AsyncStorage dans une seconde. Tranché sur la seconde : NetInfo distingue mieux être connecté
d'avoir accès au réseau, et le module de persistance officiel de TanStack Query est écrit
pour AsyncStorage.

Elle a enfin proposé la version d'AsyncStorage publiée sur npm. Corrigé : elle est
incompatible avec ce qu'embarque Expo Go, il faut passer par `npx expo install`.

## Vérification

À faire en J1 et J2, à la création du projet mobile : couper le Wi-Fi du téléphone après une
consultation réussie et vérifier que les dernières données restent affichées avec leur date,
puis fermer complètement l'application et la rouvrir hors ligne pour vérifier que le cache a
bien survécu.
