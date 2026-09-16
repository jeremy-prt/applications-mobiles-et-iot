# Architecture de l'application mobile

## Problème

Le sujet demande trois niveaux de navigation, les salles, les équipements d'une salle, puis le
détail d'un objet. À la fin de J1, tout tenait dans un écran de 180 lignes qui mélangeait le
formatage des dates, l'affichage d'une carte et les quatre états de chargement.

## Options

Un découpage par domaine, `src/features/salles/` puis `src/features/commandes/`. Un découpage
technique, un dossier par nature de fichier. Ou laisser le code dans les fichiers de route.

## Choix et compromis

Expo Router transforme chaque fichier de `app/` en écran. `app/components/carte.tsx`
deviendrait la page `/components/carte`, donc la question est où mettre le reste.

Quatre dossiers sous `src/`, comme le backend. `app/` ne porte que les routes, `api/` le
client HTTP, les schémas Zod et les requêtes, `components/` les composants réutilisés, `lib/`
les fonctions sans dépendance. Seul `app/` connaît les routes, un composant reçoit une
fonction à appeler au clic sans savoir où elle mène. Seul `api/` appelle le réseau.

Ce que ça coûte. Un écran court est écrit à deux endroits, la route qui gère ses états et le
composant qui affiche le contenu. Et `components/` peut devenir un tiroir fourre-tout.

## Aide de l'IA

L'IA a proposé le découpage par domaine, d'après le support du cours. Rejeté, la documentation
d'Expo ne décrit que le découpage technique, et les trois écrans lisent la même route.

Elle avait aussi écrit une ligne de vérification affirmant que seul `src/api/` appelle le
réseau, contredite par sa commande, qui désignait les trois écrans à cause de `refetch(`.

## Vérification

Faite le 15 septembre 2026, backend et simulateur en marche. Les quatre passent.

| Ce qu'on vérifie | Commande, depuis `mobile/` | Résultat attendu |
|---|---|---|
| Le code compile | `npx tsc --noEmit` | aucune sortie |
| Seul `src/app/` navigue | `grep -rln "expo-router" src` | uniquement des fichiers de `src/app/` |
| Rien ne dépend des routes | `grep -rn "from '@/app" src` | aucune ligne |
| Seul `src/api/` appelle le réseau | `grep -rn "await fetch(" src` | une seule ligne, dans `src/api/client.ts` |

Elle a révélé un défaut présent depuis J1. L'adresse du backend était calculée au chargement de
`src/api/client.ts`, et l'exception levée quand ce calcul échouait arrêtait toute l'application
au lieu d'afficher l'écran d'erreur prévu. L'adresse est maintenant calculée à chaque appel.

## Limite

En J3, le scan, les commandes et la session feront trois domaines qui ne partagent ni leurs
écrans ni leurs appels. Si `components/` dépasse une quinzaine de fichiers dont la plupart ne
servent qu'à un seul écran, le découpage par domaine devient le bon.
