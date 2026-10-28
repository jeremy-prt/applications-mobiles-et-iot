# Choix des bibliothèques de l'application mobile

## Problème

L'app affiche les données du serveur, garde un jeton, scanne un QR code et reste lisible sans
réseau. Expo Go exclut le code natif hors SDK, donc MMKV, `react-native-keychain` et
`react-native-vision-camera` sont hors jeu.

## Options

- Stockage local : AsyncStorage, MMKV ou `expo-sqlite`.
- État global : TanStack Query seul, Redux ou Zustand.
- Scan : `expo-camera` ou `expo-barcode-scanner`.
- Jeton : `expo-secure-store` ou AsyncStorage.

## Choix et compromis

| Besoin | Retenu | Pourquoi |
|---|---|---|
| Navigation | Expo Router 57 | Généré par `create-expo-app`, une route par fichier (`app/salles/[id]/equipements.tsx`). React Navigation seul, qu'il utilise dessous, obligerait à écrire les liens profonds du retour de scan |
| Réseau et cache | TanStack Query 5.102.8 | Chargement, erreur, et `dataUpdatedAt` pour l'ancienneté. Piège : `gcTime` doit être supérieur ou égal au `maxAge` de la persistance, sinon le cache est jeté avant d'être relu |
| Stockage local | AsyncStorage 2.2.0 | Seul des trois dans Expo Go, et cible de la persistance de TanStack Query. Par `npx expo install`, car `npm install` pose la 3.1.1, incompatible. `expo-sqlite` imposerait un schéma et du SQL |
| Jeton | `expo-secure-store` 57 | Trousseau iOS chiffré. AsyncStorage l'écrirait en clair |
| État global | rien | TanStack Query est déjà le magasin. Jeton et utilisateur tiennent dans un contexte React d'une vingtaine de lignes. Redux ou Zustand doubleraient la source de vérité |
| Interface | React Native Paper 5.15.3 | Accessibilité notée : étiquettes VoiceOver, zones tactiles minimales, thèmes clair et sombre contrastés, sans écrire chaque `accessibilityLabel` |
| Validation des réponses | Zod 4.6.5, avec `safeParse` | Les types ne vérifient rien à l'exécution, et le cache peut venir d'une ancienne version. On affiche une erreur au lieu de planter |
| Scan de QR code | `expo-camera` 57 | `CameraView` avec `barcodeScannerSettings` limité aux QR, `useCameraPermissions` pour le refus. `expo-barcode-scanner` est retiré du SDK |

Coût : NetInfo vers `onlineManager`, `AppState` vers `focusManager` et `PersistQueryClientProvider`
sont à câbler à la main, sinon pas de rafraîchissement au retour du réseau ou au premier plan, ni
de cache après fermeture. L'état vide (`data.length === 0`) est à nous, TanStack Query le confond
avec « chargé ».

## Aide de l'IA

Zustand pour l'état global : rejeté, TanStack Query gère déjà les données du serveur. La version
npm d'AsyncStorage : incompatible avec Expo Go, il faut `npx expo install`.

## Vérification

En J2, `cd mobile && npm test` fait passer 20 tests sans téléphone ni serveur. En mode Avion sur
iPhone, les dernières données restent affichées avec leur date (`docs/preuves/J2-hors-ligne.png`).
Le cache survit à un rechargement complet, serveur éteint.

## Limite

AsyncStorage ralentirait au-delà de quelques mégaoctets d'historique, mais le remplacer oblige à
quitter Expo Go. Rouvrir l'app sans réseau n'est pas testable, Expo Go recharge le code depuis le
serveur de dev. Les notifications poussées ne marchent plus dans Expo Go depuis le SDK 53 (les
locales oui), et les tâches de fond n'y sont pas fiables, donc la synchro n'en dépend pas.
