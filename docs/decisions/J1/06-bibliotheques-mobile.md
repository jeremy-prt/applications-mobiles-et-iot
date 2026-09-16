# Choix des bibliothèques de l'application mobile

## Problème

L'application affiche les données du serveur, garde un jeton, scanne un QR code et doit rester
lisible quand le réseau tombe. Elle tourne dans Expo Go, qui écarte d'avance tout ce qui n'est
pas dans le SDK Expo et contient du code natif. MMKV, `react-native-keychain` et
`react-native-vision-camera` sont donc hors jeu.

## Options

Pour le stockage local, AsyncStorage, MMKV ou `expo-sqlite`. Pour l'état global, TanStack Query
seul, Redux ou Zustand. Pour le scan, `expo-camera` ou `expo-barcode-scanner`. Pour le jeton,
`expo-secure-store` ou AsyncStorage.

## Choix et compromis

| Besoin | Retenu | Pourquoi, et ce qui est écarté |
|---|---|---|
| Navigation | Expo Router 57 | C'est ce que génère `create-expo-app`, et les routes sont des fichiers, `app/salles/[id]/equipements.tsx` se lit tout seul. React Navigation n'est pas un concurrent, Expo Router tourne dessus. L'utiliser seul voudrait dire écrire à la main l'arbre de navigation et les liens profonds, dont on a besoin au retour d'un scan |
| Réseau et cache | TanStack Query 5.102.8 | Fournit l'état de chargement, l'état d'erreur et `dataUpdatedAt`, la date de dernière mise à jour, qui est ce qu'on affiche pour signaler des données anciennes. Piège connu, le `gcTime` du client doit être supérieur ou égal au `maxAge` de la persistance, sinon le cache est jeté avant d'être relu |
| Stockage local | AsyncStorage 2.2.0 | Seul des trois candidats à tourner dans Expo Go, et le module de persistance officiel de TanStack Query est écrit pour lui. À installer avec `npx expo install`, car `npm install` pose la 3.1.1, incompatible avec le natif embarqué dans Expo Go. `expo-sqlite` obligerait à écrire un schéma et des requêtes SQL pour un cache déjà géré |
| Jeton | `expo-secure-store` 57 | Range le jeton dans le Trousseau iOS, chiffré et illisible par une autre application. AsyncStorage l'écrirait en clair sur le disque |
| État global | rien | Les données viennent du serveur, donc TanStack Query est déjà le magasin. Le jeton et l'utilisateur connecté tiennent dans un contexte React d'une vingtaine de lignes. Redux ou Zustand créeraient une deuxième source de vérité |
| Interface | React Native Paper 5.15.3 | Le sujet note la lisibilité, le contraste et l'accessibilité. Les composants de Paper sont déjà étiquetés pour VoiceOver, respectent les tailles minimales de zone tactile et ont des thèmes clair et sombre contrastés. Sinon, chaque `accessibilityLabel` est à écrire à la main |
| Validation des réponses | Zod 4.6.5, avec `safeParse` | Les types TypeScript disparaissent à la compilation et ne vérifient rien à l'exécution. Et le cache disque peut contenir des données écrites par une version précédente de l'application, qui feraient planter un écran au lieu d'afficher une erreur |
| Scan de QR code | `expo-camera` 57 | `CameraView` avec `barcodeScannerSettings` limité aux QR, et `useCameraPermissions` qui rend l'état de la permission pour afficher proprement un refus. `expo-barcode-scanner`, encore présent dans beaucoup de tutoriels, a été retiré du SDK |

Ce que ça coûte. NetInfo vers `onlineManager`, `AppState` vers `focusManager` et
`PersistQueryClientProvider` se câblent à la main, sinon le rafraîchissement au retour du
réseau et au premier plan ne part jamais et le cache disparaît à la fermeture. L'état vide
reste notre test, `data.length === 0`, car TanStack Query ne le distingue pas de « chargé ».

## Aide de l'IA

L'IA a proposé d'ajouter Zustand pour l'état global. Rejeté, les données viennent du serveur et
sont déjà gérées par TanStack Query, une seconde source de vérité n'apporterait rien.

Elle a proposé la version d'AsyncStorage publiée sur npm. C'est faux, elle est incompatible
avec ce qu'embarque Expo Go, il faut passer par `npx expo install`.

## Vérification

Fait en J2. `cd mobile && npm test` fait passer 20 tests sans téléphone ni serveur. Sur iPhone
en mode Avion, les dernières données restent affichées avec leur date, capture
`docs/preuves/J2-hors-ligne.png`. Le cache survit à un rechargement complet de l'application,
serveur éteint.

## Limite

AsyncStorage est le seul vrai écart avec ce qu'on ferait en production, où il deviendrait lent
au delà de quelques mégaoctets d'historique. Le remplacer imposerait de quitter Expo Go.

Fermer l'application et la rouvrir sans réseau n'est pas testable dans Expo Go, qui recharge le
code depuis le serveur de développement au lancement.

Les notifications poussées ne fonctionnent plus dans Expo Go depuis le SDK 53, les locales
oui. Les tâches de fond n'y sont pas fiables, donc la synchronisation ne s'appuie pas dessus.
