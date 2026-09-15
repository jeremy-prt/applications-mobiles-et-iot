# Application mobile

## Écrans

```
Connexion
   |
Liste des salles  ──scan QR──>  Association d'un objet
   |
Détail d'une salle, ses objets
   |
Détail d'un objet : mesures, historique, commande de ventilation
```

| Écran | Ce qu'il affiche |
|---|---|
| Connexion | Identifiant et mot de passe |
| Liste des salles | Une carte par salle : dernière température, dernier CO2, date, et une pastille d'alerte si le CO2 dépasse le seuil |
| Détail d'une salle | Les objets de la salle et leur état |
| Détail d'un objet | Mesures avec unité et date, historique, disponibilité, et le bouton de ventilation si l'utilisateur a le droit |
| Association | La caméra, puis le résultat du scan |

## Les quatre états, sur chaque écran qui charge des données

| État | Ce qu'on affiche | Comment on le détecte |
|---|---|---|
| Chargement | Des blocs gris à la forme du contenu | L'appel est en cours et il n'y a pas de cache |
| Vide | « Aucune mesure pour cette salle », et pourquoi | L'appel a réussi et la liste est vide |
| Erreur | Le message, et un bouton pour réessayer | L'appel a échoué |
| Données anciennes | La valeur, sa date, et une mention visible | Le backend renvoie `is_stale` à vrai |

0 degré et 0 ppm sont des valeurs valides : on ne s'en sert jamais pour signifier l'absence
de donnée.

L'état hors ligne est à part, il concerne le téléphone et pas la donnée. Une bannière
l'annonce, et le cache reste affiché avec sa date.

## Trois situations à ne jamais confondre

| Situation | Ce que voit l'utilisateur |
|---|---|
| L'objet est déconnecté | « Capteur déconnecté », la disponibilité renvoyée par l'API vaut `offline` |
| L'objet est en ligne mais ne mesure plus | « Dernière mesure il y a 3 minutes », `is_stale` vaut vrai et la disponibilité reste `online` |
| Le téléphone n'a plus de réseau | Une bannière hors ligne, et les données du cache avec leur date |

C'est le backend qui calcule `is_stale`, pas l'application. Le téléphone a sa propre
horloge, qui peut différer, et deux appareils afficheraient sinon des choses différentes
pour la même mesure.

## Actualisation des données

| Déclencheur | Comportement |
|---|---|
| Ouverture d'un écran | Appel si les données en cache ont plus de 15 secondes |
| Retour de l'application au premier plan | Nouvel appel |
| Retour du réseau | Nouvel appel |
| Pendant qu'un écran est ouvert | Rafraîchissement toutes les 15 secondes |
| Après l'envoi d'une commande | Interrogation du suivi de la commande toutes les 2 secondes, jusqu'à un statut définitif ou 15 secondes |

Pourquoi 15 secondes : les capteurs publient toutes les 2 secondes, mais rafraîchir aussi
vite afficherait des variations d'un point de CO2 et viderait la batterie. Et 15 reste bien
sous le seuil de fraîcheur de 30, donc l'affichage ne passe jamais en « ancienne » à cause
de notre propre rythme.

## Hors ligne

La consultation est obligatoire, les commandes sont bloquées.

Le cache est écrit sur le disque du téléphone, donc il survit à la fermeture complète de
l'application. Chaque donnée affichée porte sa date.

Une commande tentée hors ligne affiche une explication et n'est pas mise en file. Le sujet
l'interdit : rejouée au retour du réseau, une action partirait sans que l'utilisateur la
redemande.

## Commande de ventilation

Trois retours, et jamais autre chose.

| Retour | Quand |
|---|---|
| En attente | La commande est partie, on interroge le suivi |
| Confirmé | Le backend a reçu le résultat de l'objet |
| Échec ou résultat inconnu | Rien n'est revenu dans le délai |

L'application n'affiche jamais « activé » sur un simple clic.

## Scan de QR code et permission caméra

| Cas | Ce qui se passe |
|---|---|
| Code valide | L'objet est associé, retour à l'écran de la salle |
| Code au bon format mais objet inconnu | Message d'erreur, on peut rescanner |
| Code au mauvais format | Message d'erreur, on peut rescanner |
| Permission refusée | Écran expliquant pourquoi la caméra est nécessaire, avec un lien vers les réglages du téléphone. L'application n'est pas bloquée |

Le kit fournit les contenus exacts à encoder, dans `infra/kit/docs/association.md`, y
compris un objet inconnu et un format invalide pour la recette.

## Accessibilité

Les composants de la bibliothèque d'interface sont déjà étiquetés pour les lecteurs
d'écran. Ce qu'il reste à vérifier nous-mêmes : le contraste des couleurs d'alerte, et le
fait qu'une alerte ne repose pas uniquement sur la couleur, mais porte aussi un texte.
