# Architecture de l'application mobile

## Problème

Trois niveaux de navigation : salles, équipements d'une salle, détail d'un objet. Fin J1, tout
tenait dans un écran de 180 lignes qui mêlait dates, cartes et quatre états de chargement.

## Options

- Par domaine : `src/features/salles/`, `src/features/commandes/`.
- Technique : un dossier par nature de fichier.
- Tout laisser dans les fichiers de route.

## Choix et compromis

Expo Router fait un écran de chaque fichier de `app/` (`app/components/carte.tsx` deviendrait la
page `/components/carte`), donc le reste va ailleurs.

Découpage technique en quatre dossiers sous `src/`, comme le backend : `app/` les routes, `api/`
le client HTTP, les schémas Zod et les requêtes, `components/` les composants réutilisés, `lib/`
les fonctions sans dépendance. Seul `app/` connaît les routes, un composant reçoit juste une
fonction pour le clic. Seul `api/` appelle le réseau.

Coût : un écran court est écrit deux fois (route avec ses états, composant qui affiche), et
`components/` peut devenir un fourre-tout.

## Aide de l'IA

L'IA proposait le découpage par domaine, d'après le cours. Rejeté : la doc d'Expo ne décrit que
le technique, et les trois écrans lisent la même route. Elle affirmait aussi que seul `src/api/`
appelait le réseau, alors que sa propre commande trouvait les trois écrans à cause de `refetch(`.

## Vérification

Le 15 septembre 2026, backend et simulateur en marche, les quatre passent.

| Ce qu'on vérifie | Commande, depuis `mobile/` | Résultat attendu |
|---|---|---|
| Le code compile | `npx tsc --noEmit` | aucune sortie |
| Seul `src/app/` navigue | `grep -rln "expo-router" src` | uniquement des fichiers de `src/app/` |
| Rien ne dépend des routes | `grep -rn "from '@/app" src` | aucune ligne |
| Seul `src/api/` appelle le réseau | `grep -rn "await fetch(" src` | une seule ligne, dans `src/api/client.ts` |

Défaut trouvé, présent depuis J1 : l'adresse du backend, calculée au chargement de
`src/api/client.ts`, plantait toute l'app en cas d'échec au lieu d'afficher l'écran d'erreur.
Elle est maintenant calculée à chaque appel.

## Limite

En J3, scan, commandes et session seront trois domaines séparés. Si `components/` dépasse une
quinzaine de fichiers servant surtout à un seul écran, le découpage par domaine deviendra le bon.
