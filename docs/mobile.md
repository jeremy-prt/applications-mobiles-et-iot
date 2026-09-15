# Application mobile

Connexion, puis liste des salles, puis détail d'une salle, puis détail d'un objet. Le scan de
QR code part de la liste des salles.

## Les quatre états, sur chaque écran qui charge des données

| État | Ce qu'on affiche | Comment on le détecte |
|---|---|---|
| Chargement | Des blocs gris à la forme du contenu | L'appel est en cours et il n'y a pas de cache |
| Vide | « Aucune mesure pour cette salle », et pourquoi | L'appel a réussi et la liste est vide |
| Erreur | Le message, et un bouton pour réessayer | L'appel a échoué |
| Données anciennes | La valeur, sa date, et une mention visible | Le backend renvoie `is_stale` à vrai |

0 degré et 0 ppm sont des valeurs valides : on ne s'en sert jamais pour signifier l'absence
de donnée.

## Trois situations à ne jamais confondre

| Situation | Ce que voit l'utilisateur |
|---|---|
| L'objet est déconnecté | « Capteur déconnecté », la disponibilité renvoyée par l'API vaut `offline` |
| L'objet est en ligne mais ne mesure plus | « Dernière mesure il y a 3 minutes », `is_stale` vaut vrai et la disponibilité reste `online` |
| Le téléphone n'a plus de réseau | Une bannière hors ligne, et les données du cache avec leur date |

## Actualisation des données

| Déclencheur | Comportement |
|---|---|
| Ouverture d'un écran | Appel si les données en cache ont plus de 15 secondes |
| Retour de l'application au premier plan | Nouvel appel |
| Retour du réseau | Nouvel appel |
| Pendant qu'un écran est ouvert | Rafraîchissement toutes les 15 secondes |
| Après l'envoi d'une commande | Interrogation du suivi toutes les 2 secondes, jusqu'à un statut définitif ou 15 secondes |

## Hors ligne

La consultation reste possible, les commandes sont bloquées. Le cache est écrit sur le disque
du téléphone, donc il survit à la fermeture complète de l'application, et chaque donnée
affichée porte sa date.

Une commande tentée hors ligne affiche une explication et n'est pas mise en file. Le sujet
l'interdit : rejouée au retour du réseau, une action partirait sans que l'utilisateur la
redemande.

## Commande de ventilation

L'application n'affiche jamais « activé » sur un simple clic. Elle affiche en attente,
confirmé, ou résultat inconnu, selon le statut renvoyé par `GET /commands/:id`.

## Scan de QR code et permission caméra

| Cas | Ce qui se passe |
|---|---|
| Code valide | L'objet est associé, retour à l'écran de la salle |
| Code au bon format mais objet inconnu | Message d'erreur, on peut rescanner |
| Code au mauvais format | Message d'erreur, on peut rescanner |
| Permission refusée | Écran expliquant pourquoi la caméra est nécessaire, avec un lien vers les réglages du téléphone. L'application n'est pas bloquée |

Le kit fournit les contenus exacts à encoder dans `infra/kit/docs/association.md`, y compris
un objet inconnu et un format invalide pour la recette.

## Accessibilité

Reste à vérifier nous-mêmes : le contraste des couleurs d'alerte, et le fait qu'une alerte
porte aussi un texte et pas seulement une couleur.
