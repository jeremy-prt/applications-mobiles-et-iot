# Architecture de l'application mobile : les routes d'un côté, le reste de l'autre

## Contexte

Le sujet demande une navigation à trois niveaux : la liste des salles, les équipements d'une
salle, puis le détail d'un objet. À la fin de J1, l'application tenait dans un seul écran de
180 lignes qui mélangeait le formatage des dates, l'affichage d'une carte et les quatre états
de chargement. J3 y ajoutera le scan et les commandes.

Il faut donc décider où va le code qui n'est pas un écran.

## Options envisagées

Un découpage par domaine, `src/features/salles/` et plus tard `src/features/commandes/`,
chacun avec ses composants et ses appels réseau. Un découpage technique, un dossier par
nature de fichier. Ou laisser le code dans les fichiers de route.

## Choix retenu

Quatre dossiers sous `src/`, avec une règle de dépendance, comme le backend.

```
src/app/         les routes Expo Router, rien d'autre
src/api/         le client HTTP, les schémas Zod, les requêtes
src/components/  les composants d'affichage réutilisés
src/lib/         les fonctions sans dépendance, aujourd'hui le calcul d'ancienneté
```

Deux règles. Seul `src/app/` connaît les routes : un composant reçoit une fonction à appeler
au clic, il ne décide pas où elle mène. Et seul `src/api/` appelle le réseau.

## Pourquoi

**Rien qui ne soit pas une route ne peut vivre dans `app/`.** Expo Router transforme chaque
fichier de ce dossier en écran de l'application : un fichier `app/components/carte.tsx`
deviendrait une page à l'adresse `/components/carte`. La documentation d'Expo le dit et
demande de ranger le reste ailleurs. La question n'est donc pas de savoir si on sort le code
de `app/`, mais où on le met.

**Le découpage technique est celui que documente Expo**, qui ne cite que `components`,
`hooks`, `lib` et `utils`. Le découpage par domaine vient du support React Native du cours,
qui est un complément et non une consigne.

**Un découpage par domaine n'aurait aujourd'hui qu'un seul domaine.** Les trois écrans lisent
la même route `/rooms` du backend. `src/features/salles/` contiendrait donc toute
l'application, ce qui ne range rien.

**C'est déjà le découpage du backend**, qui sépare `schemas`, `domain`, `db`, `mqtt` et
`http` avec une règle de dépendance. Une seule logique de rangement pour les deux moitiés du
projet, alors que chacun de nous doit savoir expliquer les deux en soutenance.

## Ce que ça coûte

Un écran court est écrit à deux endroits : la route qui gère ses états, et le composant qui
affiche le contenu. Sur les cartes de salle et d'objet, ça se défend. Sur un futur écran de
dix lignes, ce serait de la découpe pour la découpe.

Et `components/` peut devenir le tiroir où l'on range ce dont on ne sait pas quoi faire.

**Ce qui nous ferait changer d'avis.** En J3, le scan de QR code, les commandes et la session
feront trois domaines qui ne partagent ni leurs écrans ni leurs appels. Si `components/`
dépasse une quinzaine de fichiers dont la plupart ne servent qu'à un seul écran, le
découpage par domaine devient le bon.

## Aide de l'IA

L'IA a d'abord proposé le découpage par domaine, en s'appuyant sur le support du cours et sur
des articles récents. Rejeté après vérification de la documentation d'Expo, qui ne documente
que le découpage technique, et parce que nous n'avons qu'un domaine.

Elle a aussi proposé de créer tout de suite les dossiers de l'authentification, du scan et
des commandes, et d'installer les bibliothèques annoncées dans `docs/architecture.md`. Rejeté
également : ce sont des dossiers vides et des dépendances sans code qui les utilise. Elles
seront installées en J2 et J3, avec le code correspondant.

Elle avait enfin écrit une ligne de vérification affirmant que seul `src/api/` appelle le
réseau, contredite par la commande qui l'accompagnait : celle-ci désignait aussi les trois
écrans, parce qu'ils contiennent `refetch(`. La commande a été corrigée avant d'être écrite
ici.

## Vérification

Faite le 15 septembre 2026, backend et simulateur en marche.

| Ce qu'on vérifie | Commande, depuis `mobile/` | Résultat attendu |
|---|---|---|
| Le code compile | `npx tsc --noEmit` | aucune sortie |
| Seul `src/app/` navigue | `grep -rln "expo-router" src` | uniquement des fichiers de `src/app/` |
| Rien ne dépend des routes | `grep -rn "from '@/app" src` | aucune ligne |
| Seul `src/api/` appelle le réseau | `grep -rn "await fetch(" src` | une seule ligne, dans `src/api/client.ts` |

Les quatre passent. Le parcours des trois écrans a été suivi jusqu'au détail de `sensor-003`,
avec les mesures, leur date, la fraîcheur, la disponibilité et l'état de la ventilation.

Cette vérification a révélé un défaut présent depuis J1. L'adresse du backend était calculée
au chargement du fichier `src/api/client.ts`, et ce calcul levait une exception quand il n'y
arrivait pas. Une exception à cet endroit arrête toute l'application au lieu d'afficher
l'écran d'erreur prévu, qui propose de réessayer. L'adresse est maintenant calculée à chaque
appel, et l'échec passe par le même chemin que les autres erreurs de l'API.

## Limite

Cette organisation ne dit rien du cache hors ligne ni de la reprise après coupure, qui sont
le travail de J2. Elle réserve seulement l'endroit où ils iront : la configuration du cache
avec le client, dans `src/api/`.
