# Commande sans réponse et délai de confirmation

## Problème

Une commande peut rester sans résultat (incident `no-response`, résultat perdu) ou en recevoir
un en retard. Quand arrêter d'attendre, quel statut afficher, que faire d'un résultat tardif ?

## Options

- `failed` après un délai.
- `unknown` après un délai.
- Attendre sans limite en `pending`.
- Pour le délai : un minuteur en mémoire par commande, ou un contrôle en base par le job de
  consolidation.

## Choix et compromis

`unknown` après 15 secondes sans résultat. On ne sait pas si l'objet a agi, donc `failed`
serait faux. 15 secondes dépassent l'expiration de 10 secondes envoyée à l'objet, qui ne peut
plus agir après notre abandon.

Le job contrôle la date de demande en base, donc un redémarrage du backend ne perd aucune
attente. Les résultats passent par la zone brute et le job, comme les mesures, et sont
appliqués avant les abandons. Un résultat tardif est appliqué avec `late` à vrai.

Coût : le job tourne toutes les 5 secondes. Un résultat apparaît après 0 à 5 secondes et
`unknown` tombe entre 15 et 20 secondes. `unknown` ne dit pas quoi faire, mais l'état réel de
la ventilation reste affiché.

## Aide de l'IA

L'IA a codé nos statuts et délais. Le mobile arrêtait son suivi à 15 secondes alors que le
backend tranche jusqu'à 20 : il aurait lâché une commande encore `pending`. Plafond du mobile
porté à 30 secondes.

## Vérification

Avec `incident sensor-001 no-response`, la commande reste `pending` à 5, 10 et 15 secondes et
passe `unknown` à 20. Traces : `commande_acceptee` à 12:06:04.775, `commande_publiee` à
12:06:04.777, `commande_sans_reponse` (`reason` `delai_depasse`) à 12:06:24.701.

Un résultat publié à la main ensuite donne `executed` avec `late` à vrai. Rejoué, il donne
`commande_doublon` sans effet. Un `command_id` inconnu donne `resultat_rejete` (`reason`
`commande_inconnue`). `backend/src/domain/commandes.test.ts` couvre un résultat arrivé après le
délai mais avant l'abandon.

## Limite

Broker coupé pendant un POST : réponse après 2 secondes sans `published_at`, puis `unknown` si
rien ne revient. `rejected` n'a pas pu être provoqué en réel, car le backend envoie toujours
une expiration valide. Testé en unitaire seulement.

Ce qui ferait changer d'avis : si les 0 à 5 secondes gênaient. Le job passerait dès l'arrivée
d'un résultat.
